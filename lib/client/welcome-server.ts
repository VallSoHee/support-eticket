import { prisma } from "@/lib/prisma";
import type { WelcomeKind } from "@/lib/client/welcome";

/**
 * Login ini pertama kali atau bukan? Setiap login sukses (email/password maupun Google)
 * sudah dicatat sebagai audit "LOGIN" SEBELUM fungsi ini dipanggil, jadi:
 *   1 catatan (login ini saja) -> pertama kali -> "new"
 *   lebih dari 1                -> pernah login -> "back"
 * Tanpa kolom baru di tabel users, jadi tidak perlu migrasi.
 */
export async function welcomeKindFor(userId: string): Promise<WelcomeKind> {
  const logins = await prisma.auditLog.count({ where: { actorId: userId, action: "LOGIN" } });
  return logins <= 1 ? "new" : "back";
}
