"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/admin/audit";
import { generateShiftSchema, shiftSchema } from "@/lib/admin/master-validation";
import { SHIFT_LABEL } from "@/lib/admin/constants";
import { eachDate, fromDbDate, isWeekend, toDbDate, toDbTime } from "@/lib/admin/time";
import type { MasterFormState } from "@/lib/admin/master-types";

const BASE = "/admin/shifts";
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

// Hanya petugas (L1/L2) yang aktif yang boleh dijadwalkan.
async function findSchedulable(ids: string[]) {
  return prisma.user.findMany({
    where: { id: { in: ids }, role: { in: ["PETUGAS_L1", "PETUGAS_L2"] }, isActive: true },
    select: { id: true, name: true },
  });
}

function readShift(formData: FormData) {
  return {
    petugasId: str(formData.get("petugasId")),
    shiftType: str(formData.get("shiftType")),
    tanggalBerlaku: str(formData.get("tanggalBerlaku")),
    jamMulai: str(formData.get("jamMulai")),
    jamSelesai: str(formData.get("jamSelesai")),
  };
}

const DUPLICATE_MSG = "This petugas already has a shift on that date.";

export async function createShiftAction(_prev: MasterFormState, formData: FormData): Promise<MasterFormState> {
  const actor = await requireRole("ADMIN");
  const values = readShift(formData);
  const parsed = shiftSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };

  const [petugas] = await findSchedulable([parsed.data.petugasId]);
  if (!petugas) return { fieldErrors: { petugasId: ["Choose an active L1/L2 petugas."] }, values };

  // Aturan: 1 petugas maksimal 1 shift per tanggal.
  const dup = await prisma.shift.findFirst({
    where: { petugasId: petugas.id, tanggalBerlaku: toDbDate(parsed.data.tanggalBerlaku) },
  });
  if (dup) return { fieldErrors: { tanggalBerlaku: [DUPLICATE_MSG] }, values };

  const created = await prisma.shift.create({
    data: {
      petugasId: petugas.id,
      shiftType: parsed.data.shiftType,
      tanggalBerlaku: toDbDate(parsed.data.tanggalBerlaku),
      jamMulai: toDbTime(parsed.data.jamMulai),
      jamSelesai: toDbTime(parsed.data.jamSelesai),
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "SHIFT_CREATE",
    entityType: "Shift",
    entityId: created.id,
    description: `Scheduled ${petugas.name} on ${parsed.data.tanggalBerlaku}, shift ${SHIFT_LABEL[parsed.data.shiftType]} (${parsed.data.jamMulai}–${parsed.data.jamSelesai}).`,
  });
  revalidatePath(BASE);
  redirect(`${BASE}?success=created`);
}

export async function updateShiftAction(id: string, _prev: MasterFormState, formData: FormData): Promise<MasterFormState> {
  const actor = await requireRole("ADMIN");
  const values = readShift(formData);
  const parsed = shiftSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };

  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) return { error: "Shift not found." };

  const [petugas] = await findSchedulable([parsed.data.petugasId]);
  if (!petugas) return { fieldErrors: { petugasId: ["Choose an active L1/L2 petugas."] }, values };

  const dup = await prisma.shift.findFirst({
    where: { id: { not: id }, petugasId: petugas.id, tanggalBerlaku: toDbDate(parsed.data.tanggalBerlaku) },
  });
  if (dup) return { fieldErrors: { tanggalBerlaku: [DUPLICATE_MSG] }, values };

  await prisma.shift.update({
    where: { id },
    data: {
      petugasId: petugas.id,
      shiftType: parsed.data.shiftType,
      tanggalBerlaku: toDbDate(parsed.data.tanggalBerlaku),
      jamMulai: toDbTime(parsed.data.jamMulai),
      jamSelesai: toDbTime(parsed.data.jamSelesai),
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "SHIFT_UPDATE",
    entityType: "Shift",
    entityId: id,
    description: `Updated shift of ${petugas.name}: ${fromDbDate(existing.tanggalBerlaku)} → ${parsed.data.tanggalBerlaku}, ${SHIFT_LABEL[parsed.data.shiftType]} (${parsed.data.jamMulai}–${parsed.data.jamSelesai}).`,
  });
  revalidatePath(BASE);
  redirect(`${BASE}?success=updated`);
}

export async function deleteShiftAction(id: string) {
  const actor = await requireRole("ADMIN");
  const existing = await prisma.shift.findUnique({ where: { id }, include: { petugas: { select: { name: true } } } });
  if (!existing) redirect(BASE);

  await prisma.shift.delete({ where: { id } });
  await writeAudit({
    actorId: actor.id,
    action: "SHIFT_DELETE",
    entityType: "Shift",
    entityId: id,
    description: `Deleted shift of ${existing.petugas.name} on ${fromDbDate(existing.tanggalBerlaku)}.`,
  });
  revalidatePath(BASE);
  redirect(`${BASE}?success=deleted`);
}

// Buat jadwal massal: beberapa petugas x rentang tanggal, dengan shift & jam yang sama.
// Tanggal yang petugasnya sudah punya shift dilewati (tidak menimpa jadwal yang ada).
export async function generateShiftsAction(_prev: MasterFormState, formData: FormData): Promise<MasterFormState> {
  const actor = await requireRole("ADMIN");
  const raw = {
    petugasIds: formData.getAll("petugasIds").filter((v): v is string => typeof v === "string"),
    shiftType: str(formData.get("shiftType")),
    dari: str(formData.get("dari")),
    sampai: str(formData.get("sampai")),
    jamMulai: str(formData.get("jamMulai")),
    jamSelesai: str(formData.get("jamSelesai")),
    includeWeekend: formData.get("includeWeekend") === "on",
  };
  const values: Record<string, string> = {
    shiftType: raw.shiftType,
    dari: raw.dari,
    sampai: raw.sampai,
    jamMulai: raw.jamMulai,
    jamSelesai: raw.jamSelesai,
    includeWeekend: raw.includeWeekend ? "on" : "",
    petugasIds: raw.petugasIds.join(","),
  };

  const parsed = generateShiftSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };

  const people = await findSchedulable(parsed.data.petugasIds);
  if (people.length === 0) return { fieldErrors: { petugasIds: ["Choose active L1/L2 petugas."] }, values };

  const dates = eachDate(parsed.data.dari, parsed.data.sampai).filter((d) => parsed.data.includeWeekend || !isWeekend(d));
  if (dates.length === 0) return { fieldErrors: { dari: ["No working days in this range."] }, values };

  const existing = await prisma.shift.findMany({
    where: {
      petugasId: { in: people.map((p) => p.id) },
      tanggalBerlaku: { gte: toDbDate(dates[0]), lte: toDbDate(dates[dates.length - 1]) },
    },
    select: { petugasId: true, tanggalBerlaku: true },
  });
  const taken = new Set(existing.map((s) => `${s.petugasId}|${fromDbDate(s.tanggalBerlaku)}`));

  const rows = [];
  let skipped = 0;
  for (const p of people) {
    for (const d of dates) {
      if (taken.has(`${p.id}|${d}`)) {
        skipped++;
        continue;
      }
      rows.push({
        petugasId: p.id,
        shiftType: parsed.data.shiftType,
        tanggalBerlaku: toDbDate(d),
        jamMulai: toDbTime(parsed.data.jamMulai),
        jamSelesai: toDbTime(parsed.data.jamSelesai),
      });
    }
  }

  if (rows.length > 0) await prisma.shift.createMany({ data: rows });

  await writeAudit({
    actorId: actor.id,
    action: "SHIFT_GENERATE",
    entityType: "Shift",
    entityId: "bulk",
    description:
      `Generated ${rows.length} shift(s) ${SHIFT_LABEL[parsed.data.shiftType]} (${parsed.data.jamMulai}–${parsed.data.jamSelesai}) ` +
      `for ${people.map((p) => p.name).join(", ")}, ${parsed.data.dari} to ${parsed.data.sampai}; ${skipped} skipped (already scheduled).`,
  });
  revalidatePath(BASE);
  redirect(`${BASE}?success=generated&count=${rows.length}&skipped=${skipped}`);
}
