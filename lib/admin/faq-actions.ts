"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/admin/audit";
import { faqSchema } from "@/lib/admin/master-validation";
import type { MasterFormState } from "@/lib/admin/master-types";

const BASE = "/admin/faq";
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

function read(formData: FormData) {
  return {
    categoryId: str(formData.get("categoryId")),
    keywords: str(formData.get("keywords")),
    jawaban: str(formData.get("jawaban")),
  };
}

export async function createFaqAction(_prev: MasterFormState, formData: FormData): Promise<MasterFormState> {
  const actor = await requireRole("ADMIN");
  const values = read(formData);
  const parsed = faqSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };

  const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category) return { fieldErrors: { categoryId: ["This category no longer exists."] }, values };

  const created = await prisma.faqEntry.create({ data: parsed.data });
  await writeAudit({
    actorId: actor.id,
    action: "FAQ_CREATE",
    entityType: "FaqEntry",
    entityId: created.id,
    description: `Added FAQ to category "${category.nama}" (keywords: ${parsed.data.keywords}).`,
  });
  revalidatePath(BASE);
  redirect(`${BASE}?success=created`);
}

export async function updateFaqAction(id: string, _prev: MasterFormState, formData: FormData): Promise<MasterFormState> {
  const actor = await requireRole("ADMIN");
  const values = read(formData);
  const parsed = faqSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };

  const existing = await prisma.faqEntry.findUnique({ where: { id } });
  if (!existing) return { error: "FAQ not found." };
  const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category) return { fieldErrors: { categoryId: ["This category no longer exists."] }, values };

  await prisma.faqEntry.update({ where: { id }, data: parsed.data });
  await writeAudit({
    actorId: actor.id,
    action: "FAQ_UPDATE",
    entityType: "FaqEntry",
    entityId: id,
    description: `Updated FAQ in category "${category.nama}" (keywords: ${parsed.data.keywords}).`,
  });
  revalidatePath(BASE);
  redirect(`${BASE}?success=updated`);
}

export async function deleteFaqAction(id: string) {
  const actor = await requireRole("ADMIN");
  const existing = await prisma.faqEntry.findUnique({ where: { id }, include: { category: true } });
  if (!existing) redirect(BASE);

  await prisma.faqEntry.delete({ where: { id } });
  await writeAudit({
    actorId: actor.id,
    action: "FAQ_DELETE",
    entityType: "FaqEntry",
    entityId: id,
    description: `Deleted FAQ from category "${existing.category.nama}" (keywords: ${existing.keywords}).`,
  });
  revalidatePath(BASE);
  redirect(`${BASE}?success=deleted`);
}
