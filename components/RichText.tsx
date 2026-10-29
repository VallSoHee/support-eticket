import { looksLikeHtml, sanitizeRichText } from "@/lib/client/sanitize";

// Menampilkan deskripsi tiket. Tiket baru berisi HTML CKEditor (disanitasi lagi di sini sebagai
// lapisan kedua); tiket lama berisi teks polos dan tetap ditampilkan apa adanya.
export function RichText({ html, className = "" }: { html: string; className?: string }) {
  if (!looksLikeHtml(html)) {
    return <p className={`whitespace-pre-line text-[14px] leading-relaxed text-ink/80 ${className}`}>{html}</p>;
  }
  return <div className={`rich-content ${className}`} dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }} />;
}
