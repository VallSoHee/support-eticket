import { looksLikeHtml, richTextToPlain, sanitizeRichText } from "@/lib/client/sanitize";

const PREVIEW_MAX = 140;

/** Cuplikan isi pesan untuk teks notifikasi: HTML editor -> teks polos, pesan gambar saja -> "Photo". */
export function notifyPreview(content: string): string {
  const plain = looksLikeHtml(content) ? richTextToPlain(sanitizeRichText(content)) : content.replace(/\s+/g, " ").trim();
  if (!plain && /<img\b/i.test(content)) return "Photo";
  return plain.length > PREVIEW_MAX ? `${plain.slice(0, PREVIEW_MAX)}…` : plain;
}
