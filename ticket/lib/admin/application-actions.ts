"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/admin/audit";
import { applicationSchema } from "@/lib/admin/master-validation";
import { PLATFORM_LABEL, joinPlatforms, parsePlatforms } from "@/lib/admin/constants";
import type { MasterFormState } from "@/lib/admin/master-types";

const BASE = "/admin/applications";
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const isUnique = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
const labels = (raw: string) => parsePlatforms(raw).map((p) => PLATFORM_LABEL[p]).join(", ");

function read(formData: FormData) {
  return { nama: str(formData.get("nama")), platforms: formData.getAll("platforms").map(str) };
}
// values di MasterFormState bertipe string -> platform digabung koma.
const toValues = (v: ReturnType<typeof read>) => ({ nama: v.nama, platforms: v.platforms.join(",") });

export async function createApplicationAction(_prev: MasterFormState, formData: FormData): Promise<MasterFormState> {
  const actor = await requireRole("ADMIN");
  const raw = read(formData);
  const parsed = applicationSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values: toValues(raw) };

  const platforms = joinPlatforms(parsed.data.platforms);
  let id: string;
  try {
    id = (await prisma.application.create({ data: { nama: parsed.data.nama, platforms } })).id;
  } catch (e) {
    if (isUnique(e)) return { fieldErrors: { nama: ["An application with this name already exists."] }, values: toValues(raw) };
    throw e;
  }

  await writeAudit({
    actorId: actor.id,
    action: "APPLICATION_CREATE",
    entityType: "Application",
    entityId: id,
    description: `Created application "${parsed.data.nama}" (${labels(platforms)}).`,
  });
  revalidatePath(BASE);
  revalidatePath("/client/tickets/new");
  redirect(`${BASE}?success=created`);
}

export async function updateApplicationAction(id: string, _prev: MasterFormState, formData: FormData): Promise<MasterFormState> {
  const actor = await requireRole("ADMIN");
  const raw = read(formData);
  const parsed = applicationSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values: toValues(raw) };

  const existing = await prisma.application.findUnique({ where: { id } });
  if (!existing) return { error: "Application not found." };

  const platforms = joinPlatforms(parsed.data.platforms);
  try {
    await prisma.$transaction([
      prisma.application.update({ where: { id }, data: { nama: parsed.data.nama, platforms } }),
      // Tiket lama menyimpan salinan nama; ikut diperbarui kalau aplikasinya di-rename.
      ...(existing.nama !== parsed.data.nama
        ? [prisma.ticket.updateMany({ where: { applicationId: id }, data: { aplikasi: parsed.data.nama } })]
        : []),
    ]);
  } catch (e) {
    if (isUnique(e)) return { fieldErrors: { nama: ["An application with this name already exists."] }, values: toValues(raw) };
    throw e;
  }

  await writeAudit({
    actorId: actor.id,
    action: "APPLICATION_UPDATE",
    entityType: "Application",
    entityId: id,
    description: `Updated application "${existing.nama}" → "${parsed.data.nama}", platforms ${labels(existing.platforms)} → ${labels(platforms)}.`,
  });
  revalidatePath(BASE);
  revalidatePath("/client/tickets/new");
  redirect(`${BASE}?success=updated`);
}

export async function deleteApplicationAction(id: string) {
  const actor = await requireRole("ADMIN");

  const existing = await prisma.application.findUnique({
    where: { id },
    include: { _count: { select: { tickets: true } } },
  });
  if (!existing) redirect(BASE);

  // Tiket lama tetap utuh: nama aplikasinya tersimpan di tiket, relasinya saja yang dilepas (SetNull).
  try {
    await prisma.application.delete({ where: { id } });
  } catch {
    redirect(`${BASE}?error=delete-failed`);
  }

  await writeAudit({
    actorId: actor.id,
    action: "APPLICATION_DELETE",
    entityType: "Application",
    entityId: id,
    description: `Deleted application "${existing.nama}" (${existing._count.tickets} existing ticket${existing._count.tickets === 1 ? "" : "s"} keep the name).`,
  });
  revalidatePath(BASE);
  revalidatePath("/client/tickets/new");
  redirect(`${BASE}?success=deleted`);
}
