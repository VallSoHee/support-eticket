import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_HOME, type Role } from "@/lib/roles";

// Lapisan otoritatif NFR-4. Berbeda dengan proxy (yang hanya percaya isi JWT), guard ini
// membaca ulang user dari DB: akun yang dinonaktifkan Admin / role yang berubah langsung
// berlaku tanpa menunggu JWT kedaluwarsa.
export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, isActive: true, avatarName: true },
  });
  if (!user || !user.isActive) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Untuk Server Component / Server Action: belum login -> /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Untuk Server Component / Server Action: role salah -> dikembalikan ke home role-nya. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}

/**
 * Untuk Route Handler (API): kembalikan 401/403 JSON, bukan redirect.
 *   const guard = await authorizeApi("CLIENT");
 *   if (!guard.ok) return guard.response;
 *   const { user } = guard;
 */
export async function authorizeApi(
  ...roles: Role[]
): Promise<{ ok: true; user: CurrentUser } | { ok: false; response: Response }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  if (roles.length > 0 && !roles.includes(user.role)) {
    return { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, user };
}
