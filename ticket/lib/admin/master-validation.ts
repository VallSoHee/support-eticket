import { z } from "zod";
import { PLATFORMS, PRIORITIES, SHIFT_TYPES } from "@/lib/admin/constants";

// ---- Kategori (FR-2.5) ----
export const categorySchema = z.object({
  nama: z.string().trim().min(2, "Enter a category name (min. 2 characters).").max(100, "Name is too long."),
  defaultPriority: z.enum(PRIORITIES, { message: "Choose a default priority." }),
});

// ---- Aplikasi (dipilih client saat submit tiket) ----
export const applicationSchema = z.object({
  nama: z.string().trim().min(2, "Enter an application name (min. 2 characters).").max(100, "Name is too long."),
  platforms: z.array(z.enum(PLATFORMS)).min(1, "Choose at least one platform."),
});

// ---- FAQ bot (FR-4.2) ----
// Keyword dipisah koma / baris baru -> dinormalisasi jadi "kata1, kata2" (huruf kecil, unik),
// sesuai format kolom faq_entries.keywords yang dipakai bot rule-based.
export function normalizeKeywords(raw: string): string {
  const seen = new Set<string>();
  for (const part of raw.split(/[,\n]/)) {
    const k = part.trim().toLowerCase().replace(/\s+/g, " ");
    if (k) seen.add(k);
  }
  return [...seen].join(", ");
}

export const faqSchema = z.object({
  categoryId: z.string().min(1, "Choose a category."),
  keywords: z
    .string()
    .transform(normalizeKeywords)
    .pipe(z.string().min(1, "Add at least one keyword.").max(2000, "Keywords are too long.")),
  jawaban: z.string().trim().min(5, "Answer is too short.").max(5000, "Answer is too long (max 5000 characters)."),
});

// ---- SLA (FR-6.1) ----
const minutes = (label: string) =>
  z.coerce
    .number({ message: `${label} must be a number.` })
    .int(`${label} must be a whole number.`)
    .min(1, `${label} must be at least 1 minute.`)
    .max(60 * 24 * 90, `${label} is too large (max 90 days).`);

export const slaSchema = z
  .object({
    targetResponMenit: minutes("First response target"),
    targetSelesaiMenit: minutes("Resolution target"),
  })
  .refine((v) => v.targetResponMenit <= v.targetSelesaiMenit, {
    path: ["targetSelesaiMenit"],
    message: "Resolution target must be equal to or longer than the response target.",
  });

// ---- Shift (FR-2.2) ----
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour).");
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Choose a valid date.");

export const shiftSchema = z
  .object({
    petugasId: z.string().min(1, "Choose a petugas."),
    shiftType: z.enum(SHIFT_TYPES, { message: "Choose a shift type." }),
    tanggalBerlaku: dateStr,
    jamMulai: timeStr,
    jamSelesai: timeStr,
  })
  .refine((v) => v.jamMulai !== v.jamSelesai, { path: ["jamSelesai"], message: "End time must differ from start time." });

export const MAX_GENERATE_DAYS = 62;

export const generateShiftSchema = z
  .object({
    petugasIds: z.array(z.string().min(1)).min(1, "Choose at least one petugas."),
    shiftType: z.enum(SHIFT_TYPES, { message: "Choose a shift type." }),
    dari: dateStr,
    sampai: dateStr,
    jamMulai: timeStr,
    jamSelesai: timeStr,
    includeWeekend: z.boolean(),
  })
  .refine((v) => v.dari <= v.sampai, { path: ["sampai"], message: "End date must be on or after the start date." })
  .refine(
    (v) => (Date.parse(`${v.sampai}T00:00:00Z`) - Date.parse(`${v.dari}T00:00:00Z`)) / 86_400_000 < MAX_GENERATE_DAYS,
    { path: ["sampai"], message: `Range is too long (max ${MAX_GENERATE_DAYS} days).` },
  )
  .refine((v) => v.jamMulai !== v.jamSelesai, { path: ["jamSelesai"], message: "End time must differ from start time." });

// ---- Prioritas tiket (FR-3.2) ----
export const ticketPrioritySchema = z.object({
  priority: z.enum(PRIORITIES, { message: "Choose a priority." }),
});
