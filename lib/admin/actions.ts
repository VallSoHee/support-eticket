"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { createUserSchema, updateUserSchema } from "@/lib/admin/validation";
import { writeAudit } from "@/lib/admin/audit";
import { SCOPE_BASE_PATH, SCOPE_ROLES, isRoleInScope, type UserScope } from "@/lib/admin/scope";
import type { AdminFormState } from "@/lib/admin/types";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
}

// Dipakai via .bind(null, scope) di UserForm supaya satu action bisa dipakai untuk
// ketiga scope (ADMIN/PETUGAS/CLIENT) sekaligus tetap kompatibel dengan useActionState.
export async function createUserAction(
  scope: UserScope,
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const actor = await requireRole("ADMIN");

  const roles = SCOPE_ROLES[scope];
  // Kalau scope hanya punya 1 role (ADMIN/CLIENT) tidak ada <select name="role">
  // di form -> role dikunci dari server, tidak pernah dipercaya dari input.
  const values = {
    name: str(formData.get("name")),
    email: str(formData.get("email")),
    role: roles.length > 1 ? str(formData.get("role")) : roles[0],
  };
  const parsed = createUserSchema(scope).safeParse({ ...values, password: str(formData.get("password")) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };

  let createdId: string;
  try {
    const created = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        passwordHash: await hashPassword(parsed.data.password),
      },
    });
    createdId = created.id;
  } catch (e) {
    if (isUniqueViolation(e)) return { fieldErrors: { email: ["This email is already registered."] }, values };
    throw e;
  }

  await writeAudit({
    actorId: actor.id,
    action: "USER_CREATE",
    entityType: "User",
    entityId: createdId,
    description: `Created ${parsed.data.role} account ${parsed.data.email}.`,
  });
  revalidatePath(SCOPE_BASE_PATH[scope]);
  redirect(SCOPE_BASE_PATH[scope]);
}

export async function updateUserAction(
  scope: UserScope,
  id: string,
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const actor = await requireRole("ADMIN");

  const roles = SCOPE_ROLES[scope];
  const values = {
    name: str(formData.get("name")),
    email: str(formData.get("email")),
    role: roles.length > 1 ? str(formData.get("role")) : roles[0],
  };
  const parsed = updateUserSchema(scope).safeParse({ ...values, password: str(formData.get("password")) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || !isRoleInScope(scope, existing.role)) return { error: "Account not found." };

  try {
    await prisma.user.update({
      where: { id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        // String kosong = "tidak diubah", jadi field password TIDAK disentuh sama sekali.
        ...(parsed.data.password ? { passwordHash: await hashPassword(parsed.data.password) } : {}),
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { fieldErrors: { email: ["This email is already registered."] }, values };
    throw e;
  }

  const changes: string[] = [];
  if (existing.name !== parsed.data.name) changes.push("name");
  if (existing.email !== parsed.data.email) changes.push("email");
  if (existing.role !== parsed.data.role) changes.push(`role ${existing.role} → ${parsed.data.role}`);
  if (parsed.data.password) changes.push("password reset");
  await writeAudit({
    actorId: actor.id,
    action: "USER_UPDATE",
    entityType: "User",
    entityId: id,
    description: `Updated account ${parsed.data.email}${changes.length ? ` (${changes.join(", ")})` : " (no changes)"}.`,
  });
  revalidatePath(SCOPE_BASE_PATH[scope]);
  redirect(SCOPE_BASE_PATH[scope]);
}

export async function deleteUserAction(scope: UserScope, id: string) {
  const actor = await requireRole("ADMIN");
  const basePath = SCOPE_BASE_PATH[scope];

  // Tidak bisa hapus akun sendiri lewat sini (tombolnya juga disembunyikan di UI).
  if (actor.id === id) redirect(basePath);

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || !isRoleInScope(scope, existing.role)) redirect(basePath);

  // Riwayat login/aksi (audit log) TIDAK menghalangi penghapusan: baris log tetap ada,
  // hanya tidak lagi tertaut ke akun. Yang menghalangi hanya tiket milik client, karena tiket
  // adalah catatan layanan yang tidak boleh hilang bersama akunnya.
  if (existing.role === "CLIENT" && (await prisma.ticket.count({ where: { clientId: id } })) > 0) {
    redirect(`${basePath}?error=has-tickets`);
  }

  try {
    await prisma.user.delete({ where: { id } });
  } catch {
    // Jangan biarkan error mentah sampai ke halaman error Next.js.
    redirect(`${basePath}?error=delete-failed`);
  }

  await writeAudit({
    actorId: actor.id,
    action: "USER_DELETE",
    entityType: "User",
    entityId: id,
    description: `Deleted ${existing.role} account ${existing.email}.`,
  });
  revalidatePath(basePath);
  redirect(`${basePath}?success=deleted`);
}

export async function toggleActiveAction(scope: UserScope, id: string) {
  const actor = await requireRole("ADMIN");
  const basePath = SCOPE_BASE_PATH[scope];

  if (actor.id === id) redirect(basePath);

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || !isRoleInScope(scope, existing.role)) redirect(basePath);

  await prisma.user.update({ where: { id }, data: { isActive: !existing.isActive } });
  await writeAudit({
    actorId: actor.id,
    action: existing.isActive ? "USER_DEACTIVATE" : "USER_ACTIVATE",
    entityType: "User",
    entityId: id,
    description: `${existing.isActive ? "Deactivated" : "Activated"} account ${existing.email}.`,
  });
  revalidatePath(basePath);
}
