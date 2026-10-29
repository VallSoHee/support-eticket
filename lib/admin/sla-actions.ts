"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/admin/audit";
import { slaSchema } from "@/lib/admin/master-validation";
import { PRIORITIES, PRIORITY_LABEL, formatMinutes } from "@/lib/admin/constants";
import type { Priority } from "@/generated/prisma/enums";
import type { MasterFormState } from "@/lib/admin/master-types";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

// Satu baris SLA per priority (priority @unique) -> upsert. Baris yang belum ada
// otomatis dibuat saat pertama kali disimpan.
export async function saveSlaAction(priority: Priority, _prev: MasterFormState, formData: FormData): Promise<MasterFormState> {
  const actor = await requireRole("ADMIN");
  if (!PRIORITIES.includes(priority)) return { error: "Unknown priority." };

  const values = {
    targetResponMenit: str(formData.get("targetResponMenit")),
    targetSelesaiMenit: str(formData.get("targetSelesaiMenit")),
  };
  const parsed = slaSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };

  const before = await prisma.slaConfig.findUnique({ where: { priority } });
  const saved = await prisma.slaConfig.upsert({
    where: { priority },
    create: { priority, ...parsed.data },
    update: parsed.data,
  });

  await writeAudit({
    actorId: actor.id,
    action: "SLA_UPDATE",
    entityType: "SlaConfig",
    entityId: saved.id,
    description:
      `SLA ${PRIORITY_LABEL[priority]}: response ${formatMinutes(before?.targetResponMenit)} → ${formatMinutes(parsed.data.targetResponMenit)}, ` +
      `resolution ${formatMinutes(before?.targetSelesaiMenit)} → ${formatMinutes(parsed.data.targetSelesaiMenit)}.`,
  });
  revalidatePath("/admin/sla");
  return { success: "Saved.", values };
}
