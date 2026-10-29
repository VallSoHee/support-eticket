// Aturan tipe & ukuran unggahan lampiran tiket. TANPA impor Node supaya aman dipakai di
// komponen browser (editor) maupun server (route /api/uploads).
//
// Tipe file ditentukan dari EKSTENSI lewat daftar putih ini, bukan dari Content-Type kiriman
// browser (bisa dipalsukan). SVG/HTML sengaja tidak ada: bisa menjalankan skrip.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per file (gambar & dokumen)
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB per video

const TYPES: Record<string, { mime: string; image: boolean; video?: boolean }> = {
  ".png": { mime: "image/png", image: true },
  ".jpg": { mime: "image/jpeg", image: true },
  ".jpeg": { mime: "image/jpeg", image: true },
  ".gif": { mime: "image/gif", image: true },
  ".webp": { mime: "image/webp", image: true },
  ".mp4": { mime: "video/mp4", image: false, video: true },
  ".webm": { mime: "video/webm", image: false, video: true },
  ".mov": { mime: "video/quicktime", image: false, video: true },
  ".pdf": { mime: "application/pdf", image: false },
  ".txt": { mime: "text/plain; charset=utf-8", image: false },
  ".csv": { mime: "text/csv; charset=utf-8", image: false },
  ".log": { mime: "text/plain; charset=utf-8", image: false },
  ".doc": { mime: "application/msword", image: false },
  ".docx": { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", image: false },
  ".xls": { mime: "application/vnd.ms-excel", image: false },
  ".xlsx": { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", image: false },
  ".ppt": { mime: "application/vnd.ms-powerpoint", image: false },
  ".pptx": { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", image: false },
  ".zip": { mime: "application/zip", image: false },
};

/** Nilai atribut `accept` untuk dialog pilih file. */
export const UPLOAD_ACCEPT = Object.keys(TYPES).join(",");

export function uploadTypeOf(filename: string) {
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : "";
  const t = TYPES[ext];
  return t ? { ext, ...t } : null;
}

/** Batas ukuran sesuai jenis file. */
export const maxBytesFor = (t: { video?: boolean }) => (t.video ? MAX_VIDEO_BYTES : MAX_UPLOAD_BYTES);
