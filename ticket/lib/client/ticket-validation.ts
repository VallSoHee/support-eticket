import { z } from "zod";
import { PLATFORMS, PRIORITIES } from "@/lib/admin/constants";

// Batas deskripsi: kolom `deskripsi` bertipe TEXT (65.535 byte), sisakan ruang untuk karakter multibyte.
export const MAX_DESCRIPTION_HTML = 30_000;
export const MIN_DESCRIPTION_TEXT = 10;

// Nama kategori bawaan untuk tiket yang diajukan client (client tidak memilih kategori;
// petugas/admin bisa mengubahnya nanti). Dibuat otomatis kalau belum ada.
export const DEFAULT_TICKET_CATEGORY = "General";

// Field teks & pilihan. Deskripsi (HTML) divalidasi terpisah di action karena harus disanitasi dulu.
export const ticketSubmitSchema = z.object({
  judul: z.string().trim().min(5, "Enter a title (min. 5 characters).").max(150, "Title is too long (max 150 characters)."),
  applicationId: z.string().min(1, "Choose an application."),
  platform: z.enum(PLATFORMS, { message: "Choose a platform." }),
  priority: z.enum(PRIORITIES, { message: "Choose an urgency level." }),
});
