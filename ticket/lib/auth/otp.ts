import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { OtpPurpose } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const OTP_TTL_MS = 10 * 60 * 1000; // kode berlaku 10 menit
export const OTP_RESEND_COOLDOWN_S = 60; // jeda kirim ulang
export const OTP_MAX_ATTEMPTS = 5; // salah input maksimal 5x, lalu kode hangus
export const EMAIL_CHANGE_WINDOW_MS = 15 * 60 * 1000; // setelah kode email lama benar, sisa waktu untuk email baru

export type OtpScope = { purpose: OtpPurpose; email: string; userId?: string | null };

function hashCode(code: string, scope: OtpScope) {
  // HMAC (bukan hash polos): ruang kode cuma 10^6, jadi tanpa secret mudah ditebak dari tabel yang bocor.
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-only-otp-secret";
  return createHmac("sha256", secret).update(`${scope.purpose}:${scope.email}:${scope.userId ?? ""}:${code}`).digest("hex");
}

function sameHash(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const where = (s: OtpScope) => ({ purpose: s.purpose, email: s.email, userId: s.userId ?? null });

/**
 * Membuat kode baru (menggantikan kode lama untuk scope yang sama).
 * Mengembalikan `retryAfter` (detik) kalau masih dalam masa jeda kirim ulang.
 */
export async function issueOtp(scope: OtpScope): Promise<{ ok: true; code: string } | { ok: false; retryAfter: number }> {
  const previous = await prisma.emailOtp.findFirst({ where: where(scope), orderBy: { createdAt: "desc" } });
  if (previous) {
    const wait = OTP_RESEND_COOLDOWN_S - Math.floor((Date.now() - previous.createdAt.getTime()) / 1000);
    if (wait > 0) return { ok: false, retryAfter: wait };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.$transaction([
    prisma.emailOtp.deleteMany({ where: where(scope) }),
    prisma.emailOtp.create({
      data: { ...where(scope), codeHash: hashCode(code, scope), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    }),
  ]);
  return { ok: true, code };
}

/** Dipakai kalau email gagal terkirim: batalkan kode supaya cooldown tidak menahan user. */
export async function discardOtp(scope: OtpScope) {
  await prisma.emailOtp.deleteMany({ where: where(scope) });
}

export type VerifyResult = { ok: true; id: string } | { ok: false; error: string };

/** Cek kode. Tidak menghapus record — pemanggil memutuskan (consumeOtp / markOtpVerified). */
export async function checkOtp(scope: OtpScope, rawCode: string): Promise<VerifyResult> {
  const code = rawCode.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "Enter the 6-digit code." };

  const record = await prisma.emailOtp.findFirst({ where: where(scope), orderBy: { createdAt: "desc" } });
  if (!record || record.expiresAt < new Date()) {
    return { ok: false, error: "This code has expired or was never requested. Please request a new one." };
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "Too many incorrect attempts. Please request a new code." };
  }

  if (!sameHash(record.codeHash, hashCode(code, scope))) {
    await prisma.emailOtp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "Incorrect code. Please try again." };
  }
  return { ok: true, id: record.id };
}

/** Kode sekali pakai. */
export async function consumeOtp(scope: OtpScope) {
  await prisma.emailOtp.deleteMany({ where: where(scope) });
}
