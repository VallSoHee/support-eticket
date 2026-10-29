"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/admin/audit";
import { categorySchema } from "@/lib/admin/master-validation";
import { PRIORITY_LABEL } from "@/lib/admin/constants";
import type { MasterFormState } from "@/lib/admin/master-types";

const BASE = "/admin/categories";
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const isUnique = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

function read(formData: FormData) {
  return { nama: str(formData.get("nama")), defaultPriority: str(formData.get("defaultPriority")) };
}

export async function createCategoryAction(_prev: MasterFormState, formData: FormData): Promise<MasterFormState> {
  const actor = await requireRole("ADMIN");
  const values = read(formData);
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };

  let id: string;
  try {
    const created = await prisma.category.create({ data: parsed.data });
    id = created.id;
  } catch (e) {
    if (isUnique(e)) return { fieldErrors: { nama: ["A category with this name already exists."] }, values };
    throw e;
  }

  await writeAudit({
    actorId: actor.id,
    action: "CATEGORY_CREATE",
    entityType: "Category",
    entityId: id,
    description: `Created category "${parsed.data.nama}" (default priority ${PRIORITY_LABEL[parsed.data.defaultPriority]}).`,
  });
  revalidatePath(BASE);
  redirect(`${BASE}?success=created`);
}

export async function updateCategoryAction(id: string, _prev: MasterFormState, formData: FormData): Promise<MasterFormState> {
  const actor = await requireRole("ADMIN");
  const values = read(formData);
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return { error: "Category not found." };

  try {
    await prisma.category.update({ where: { id }, data: parsed.data });
  } catch (e) {
    if (isUnique(e)) return { fieldErrors: { nama: ["A category with this name already exists."] }, values };
    throw e;
  }

  await writeAudit({
    actorId: actor.id,
    action: "CATEGORY_UPDATE",
    entityType: "Category",
    entityId: id,
    description: `Updated category "${existing.nama}" → "${parsed.data.nama}", default priority ${PRIORITY_LABEL[existing.defaultPriority]} → ${PRIORITY_LABEL[parsed.data.defaultPriority]}.`,
  });
  revalidatePath(BASE);
  redirect(`${BASE}?success=updated`);
}

export async function deleteCategoryAction(id: string) {
  const actor = await requireRole("ADMIN");

  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { tickets: true, faqEntries: true } } },
  });
  if (!existing) redirect(BASE);

  // Kategori yang sudah dipakai tiket tidak boleh dihapus (riwayat tiket harus utuh).
  if (existing._count.tickets > 0) redirect(`${BASE}?error=in-use`);

  try {
    // FAQ milik kategori ikut terhapus (onDelete: Cascade di skema).
    await prisma.category.delete({ where: { id } });
  } catch {
    redirect(`${BASE}?error=delete-failed`);
  }

  await writeAudit({
    actorId: actor.id,
    action: "CATEGORY_DELETE",
    entityType: "Category",
    entityId: id,
    description: `Deleted category "${existing.nama}" and its ${existing._count.faqEntries} FAQ entr${existing._count.faqEntries === 1 ? "y" : "ies"}.`,
  });
  revalidatePath(BASE);
  revalidatePath("/admin/faq");
  redirect(`${BASE}?success=deleted`);
}
