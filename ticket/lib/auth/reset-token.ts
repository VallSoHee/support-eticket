import { createHash, randomBytes } from "node:crypto";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 jam

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Token mentah hanya dikirim lewat email; yang disimpan di DB hanya hash-nya,
// jadi kebocoran tabel tidak bisa dipakai untuk mereset password.
export function generateResetToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashResetToken(token) };
}
