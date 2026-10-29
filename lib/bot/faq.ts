import { normalize } from "@/lib/bot/text";
import type { FaqRow } from "@/lib/bot/types";

// FR-4.2 — pencocokan kata kunci (rule-based). Gratis, instan, dan hasilnya bisa diprediksi.
// Dipakai SEBELUM LLM: jawaban FAQ yang pasti tidak perlu menghabiskan kuota API.

const words = (s: string) => (s ? s.split(" ").length : 0);

// Kata pengisi dibuang dari teks DAN kata kunci sebelum dicocokkan, supaya "akun saya dinonaktifkan"
// tetap kena kata kunci "akun dinonaktifkan" dan "my account is deactivated" kena "account deactivated".
const FILLER = new Set([
  "saya", "aku", "ku", "kami", "kita", "anda", "kamu", "yang", "itu", "ini", "dong", "deh", "nih", "sih", "ya", "kok",
  "i", "me", "my", "we", "our", "you", "your", "the", "a", "an", "is", "are", "was", "am", "it", "its", "this", "that",
]);
const squash = (s: string) =>
  normalize(s)
    .split(" ")
    .filter((w) => w && !FILLER.has(w))
    .join(" ");

/** Skor = jumlah kata dari kata kunci yang muncul utuh di teks (frasa 2 kata bernilai 2). */
export function scoreFaq(text: string, row: Pick<FaqRow, "keywords">): number {
  const haystack = ` ${squash(text)} `;
  let score = 0;
  for (const raw of row.keywords.split(",")) {
    const kw = squash(raw);
    if (kw && haystack.includes(` ${kw} `)) score += words(kw);
  }
  return score;
}

export function rankFaq<T extends Pick<FaqRow, "keywords">>(text: string, rows: T[]): { row: T; score: number }[] {
  return rows
    .map((row) => ({ row, score: scoreFaq(text, row) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Cocok yakin: skor >= 2, atau pesan sangat pendek (<= 4 kata) yang kena satu kata kunci. */
export function isConfident(text: string, score: number): boolean {
  return score >= 2 || (score >= 1 && words(normalize(text)) <= 4);
}
