"use server";

import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { sendOtpEmail, sendPasswordResetEmail } from "@/lib/auth/mailer";
import { OTP_RESEND_COOLDOWN_S, checkOtp, consumeOtp, discardOtp, issueOtp } from "@/lib/auth/otp";
import { RESET_TOKEN_TTL_MS, generateResetToken, hashResetToken } from "@/lib/auth/reset-token";
import {
  email as emailSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/auth/validation";
import type { AuthFormState, OtpActionResult } from "@/lib/auth/types";
import { ROLE_HOME } from "@/lib/roles";
import { WELCOME_COOKIE, WELCOME_MAX_AGE } from "@/lib/client/welcome";
import { welcomeKindFor } from "@/lib/client/welcome-server";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
}

// ---------------------------------------------------------------- LOGIN (FR-1.1, 1.2)
export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { email: str(formData.get("email")) };
  const parsed = loginSchema.safeParse({ email: values.email, password: str(formData.get("password")) });
  if (!parsed.success) return { error: "Enter a valid email and password.", values };

  let result: unknown;
  try {
    // redirect:false -> sesi dibuat tapi TIDAK ada NEXT_REDIRECT. Perpindahan halaman dilakukan
    // client (components/auth/LoginTransition.tsx) supaya animasi transisi login -> dashboard sempat main.
    result = await signIn("credentials", { ...parsed.data, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) {
      return {
        error:
          e.type === "CredentialsSignin"
            ? "Incorrect email or password."
            : "Something went wrong. Please try again.",
        values,
      };
    }
    throw e;
  }
  // Bergantung versi Auth.js, kegagalan kredensial bisa berupa throw (di atas) atau URL ber-?error=.
  if (typeof result === "string" && /[?&]error=/.test(result)) {
    return { error: "Incorrect email or password.", values };
  }

  // authorize() sudah memverifikasi password; di sini hanya mencari role untuk menentukan tujuan.
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, name: true, role: true },
  });
  if (!user) return { error: "Something went wrong. Please try again.", values };

  // Animasi transisi berlaku untuk SEMUA role: halaman tujuan (ClientShell / DashboardShell /
  // layout petugas) membaca cookie penanda lalu menyambung animasinya.
  // Login pertama (akun baru) -> "Welcome"; sudah pernah login -> "Welcome back".
  const kind = await welcomeKindFor(user.id);
  (await cookies()).set(WELCOME_COOKIE, kind, { path: "/", maxAge: WELCOME_MAX_AGE, sameSite: "lax" });
  return {
    redirectTo: ROLE_HOME[user.role],
    animate: true,
    welcomeName: user.name.trim().split(/\s+/)[0],
    returning: kind === "back",
  };
}

// ---------------------------------------------------------------- KIRIM OTP REGISTER
// Dipanggil tombol "Send OTP" di form register. Kode terikat ke alamat email yang diketik.
export async function sendRegisterOtpAction(rawEmail: string): Promise<OtpActionResult> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  const email = parsed.data;

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return { ok: false, error: "This email is already registered." };
  }

  const scope = { purpose: "REGISTER", email } as const;
  const issued = await issueOtp(scope);
  if (!issued.ok) {
    return { ok: false, error: `Please wait ${issued.retryAfter}s before requesting another code.`, retryAfter: issued.retryAfter };
  }
  try {
    await sendOtpEmail({ to: email, code: issued.code, purpose: "REGISTER" });
  } catch (e) {
    console.error("[register-otp] gagal kirim email", e);
    await discardOtp(scope);
    return { ok: false, error: "We couldn't send the code. Please try again in a moment." };
  }
  return { ok: true, message: `We sent a 6-digit code to ${email}. It expires in 10 minutes.`, retryAfter: OTP_RESEND_COOLDOWN_S };
}

// ---------------------------------------------------------------- REGISTER CLIENT (FR-1.1)
export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { name: str(formData.get("name")), email: str(formData.get("email")) };
  const parsed = registerSchema.safeParse({
    ...values,
    otp: str(formData.get("otp")),
    password: str(formData.get("password")),
    confirmPassword: str(formData.get("confirmPassword")),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };

  const { name, email, password, otp } = parsed.data;

  // Email harus terbukti milik user: kode OTP yang dikirim ke email ini harus benar.
  const scope = { purpose: "REGISTER", email } as const;
  const check = await checkOtp(scope, otp);
  if (!check.ok) return { fieldErrors: { otp: [check.error] }, values };

  try {
    await prisma.user.create({
      // Role SELALU CLIENT dan tidak pernah dibaca dari form -> petugas/admin tidak bisa self-register (FR-1.2).
      data: { name, email, passwordHash: await hashPassword(password), role: "CLIENT" },
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { fieldErrors: { email: ["This email is already registered."] }, values };
    }
    throw e;
  }
  await consumeOtp(scope); // sekali pakai

  // redirect:false -> perpindahan halaman dilakukan client (LoginTransition) agar animasi sempat main.
  // Akun baru selalu "Welcome" (bukan "Welcome back").
  await signIn("credentials", { email, password, redirect: false });
  (await cookies()).set(WELCOME_COOKIE, "new", { path: "/", maxAge: WELCOME_MAX_AGE, sameSite: "lax" });
  return { redirectTo: ROLE_HOME.CLIENT, animate: true, welcomeName: name.trim().split(/\s+/)[0], returning: false };
}

// ---------------------------------------------------------------- LOGIN GOOGLE
export async function googleSignInAction() {
  // Redirect ke Google; setelah kembali, callback signIn di auth.ts menyimpan user ke DB.
  // "/welcome" (Route Handler) menyetel cookie animasi + sapaan, lalu meneruskan ke dashboard role-nya.
  await signIn("google", { redirectTo: "/welcome" });
}

// ---------------------------------------------------------------- LOGOUT (FR-1.6)
export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

// ---------------------------------------------------------------- LUPA PASSWORD (FR-1.5)
const GENERIC_RESET_MESSAGE =
  "If that email is registered, we've sent a password reset link. It expires in 1 hour.";

export async function requestPasswordResetAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = { email: str(formData.get("email")) };
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  if (user && user.isActive) {
    const { token, tokenHash } = generateResetToken();
    // Satu token aktif per user: token lama otomatis hangus.
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
      }),
    ]);

    const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl: `${baseUrl}/reset-password?token=${token}`,
      });
    } catch (e) {
      // Jangan bocorkan kegagalan ke client (bisa dipakai menebak email terdaftar).
      console.error("[forgot-password] gagal kirim email", e);
    }
  }

  // Respons identik baik email terdaftar maupun tidak (anti user-enumeration).
  return { success: GENERIC_RESET_MESSAGE };
}

export async function resetPasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: str(formData.get("token")),
    password: str(formData.get("password")),
    confirmPassword: str(formData.get("confirmPassword")),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(parsed.data.token) },
  });
  if (!record || record.expiresAt < new Date()) {
    return { error: "This reset link is invalid or has expired. Please request a new one." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(parsed.data.password) },
    }),
    // Sekali pakai: hapus semua token milik user ini.
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  redirect("/login?reset=success");
}
