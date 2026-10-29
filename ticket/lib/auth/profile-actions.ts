"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { changePasswordSchema, email as emailSchema, profileSchema } from "@/lib/auth/validation";
import { sendOtpEmail } from "@/lib/auth/mailer";
import { EMAIL_CHANGE_WINDOW_MS, OTP_RESEND_COOLDOWN_S, checkOtp, discardOtp, issueOtp, type OtpScope } from "@/lib/auth/otp";
import { writeAudit } from "@/lib/admin/audit";
import type { AuthFormState, OtpActionResult } from "@/lib/auth/types";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

// Selalu memakai user dari sesi (bukan id dari form) -> hanya bisa mengubah akun sendiri.
export async function updateProfileAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const user = await requireUser();
  const values = { name: str(formData.get("name")) };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };

  await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
  revalidatePath("/", "layout");
  return { success: "Profile updated.", values: { name: parsed.data.name } };
}

export async function changePasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: str(formData.get("currentPassword")),
    password: str(formData.get("password")),
    confirmPassword: str(formData.get("confirmPassword")),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const record = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });

  // Sudah punya password -> wajib menyebut password lama. Akun Google-only boleh langsung membuat password.
  if (record?.passwordHash) {
    const ok = await verifyPassword(parsed.data.currentPassword ?? "", record.passwordHash);
    if (!ok) return { fieldErrors: { currentPassword: ["Current password is incorrect."] } };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });
  return { success: record?.passwordHash ? "Password changed." : "Password set. You can now sign in with email and password." };
}

// ---------------------------------------------------------------- GANTI EMAIL (OTP 2 langkah)
// Alur: (1) kode ke email LAMA -> (2) verifikasi kode lama -> (3) isi email baru, kode ke email BARU
//       -> (4) verifikasi kode baru -> email berganti. Semua status disimpan di server (tabel email_otps),
// jadi client tidak bisa melompati langkah. Selalu memakai user dari sesi.
function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
}

async function sendCode(scope: OtpScope, to: string, purpose: "EMAIL_CHANGE_OLD" | "EMAIL_CHANGE_NEW", name: string): Promise<OtpActionResult> {
  const issued = await issueOtp(scope);
  if (!issued.ok) {
    return { ok: false, error: `Please wait ${issued.retryAfter}s before requesting another code.`, retryAfter: issued.retryAfter };
  }
  try {
    await sendOtpEmail({ to, code: issued.code, purpose, name });
  } catch (e) {
    console.error("[email-change] gagal kirim email", e);
    await discardOtp(scope);
    return { ok: false, error: "We couldn't send the code. Please try again in a moment." };
  }
  return { ok: true, message: `We sent a 6-digit code to ${to}. It expires in 10 minutes.`, retryAfter: OTP_RESEND_COOLDOWN_S };
}

// Langkah 1: kirim kode ke email yang sekarang terdaftar.
export async function sendOldEmailOtpAction(): Promise<OtpActionResult> {
  const user = await requireUser();
  return sendCode({ purpose: "EMAIL_CHANGE_OLD", email: user.email, userId: user.id }, user.email, "EMAIL_CHANGE_OLD", user.name);
}

// Langkah 2: cek kode email lama. Tidak dihapus; ditandai terverifikasi supaya langkah 3 boleh jalan.
export async function verifyOldEmailOtpAction(code: string): Promise<OtpActionResult> {
  const user = await requireUser();
  const scope: OtpScope = { purpose: "EMAIL_CHANGE_OLD", email: user.email, userId: user.id };
  const res = await checkOtp(scope, code);
  if (!res.ok) return { ok: false, error: res.error };

  await prisma.emailOtp.update({
    where: { id: res.id },
    data: { verifiedAt: new Date(), expiresAt: new Date(Date.now() + EMAIL_CHANGE_WINDOW_MS) },
  });
  return { ok: true, message: "Current email verified. Now enter your new email address." };
}

// Langkah 3: kirim kode ke email BARU (hanya kalau langkah 2 sudah lolos dan belum kedaluwarsa).
export async function sendNewEmailOtpAction(rawEmail: string): Promise<OtpActionResult> {
  const user = await requireUser();
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  const newEmail = parsed.data;

  const gate = await prisma.emailOtp.findFirst({
    where: { purpose: "EMAIL_CHANGE_OLD", userId: user.id, email: user.email, verifiedAt: { not: null }, expiresAt: { gt: new Date() } },
  });
  if (!gate) return { ok: false, error: "Please verify your current email first." };

  if (newEmail === user.email) return { ok: false, error: "That is already your current email." };
  if (await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } })) {
    return { ok: false, error: "This email is already used by another account." };
  }

  // Kode email baru lama diganti kalau user mengetik alamat lain (scope-nya per alamat).
  await prisma.emailOtp.deleteMany({ where: { purpose: "EMAIL_CHANGE_NEW", userId: user.id, NOT: { email: newEmail } } });
  return sendCode({ purpose: "EMAIL_CHANGE_NEW", email: newEmail, userId: user.id }, newEmail, "EMAIL_CHANGE_NEW", user.name);
}

// Langkah 4: cek kode email baru lalu ganti email.
export async function confirmEmailChangeAction(rawEmail: string, code: string): Promise<OtpActionResult> {
  const user = await requireUser();
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  const newEmail = parsed.data;

  const gate = await prisma.emailOtp.findFirst({
    where: { purpose: "EMAIL_CHANGE_OLD", userId: user.id, email: user.email, verifiedAt: { not: null }, expiresAt: { gt: new Date() } },
  });
  if (!gate) return { ok: false, error: "Verification expired. Please start again." };

  const res = await checkOtp({ purpose: "EMAIL_CHANGE_NEW", email: newEmail, userId: user.id }, code);
  if (!res.ok) return { ok: false, error: res.error };

  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { email: newEmail } }),
      prisma.emailOtp.deleteMany({ where: { userId: user.id } }), // semua kode ganti-email sekali pakai
    ]);
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "This email is already used by another account." };
    throw e;
  }

  await writeAudit({ actorId: user.id, action: "EMAIL_CHANGE", entityType: "User", entityId: user.id, description: `Changed email from ${user.email} to ${newEmail}.` });
  revalidatePath("/", "layout");
  return { ok: true, email: newEmail, message: "Email updated. Use your new email next time you sign in." };
}

// Dipanggil saat user mematikan opsi ganti email / membatalkan: buang kode yang masih menggantung.
export async function cancelEmailChangeAction(): Promise<void> {
  const user = await requireUser();
  await prisma.emailOtp.deleteMany({ where: { userId: user.id } });
}
