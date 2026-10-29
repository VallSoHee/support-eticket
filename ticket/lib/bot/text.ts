import type { Lang } from "@/lib/bot/types";

// Utilitas teks murni (tanpa Prisma/jaringan) untuk bot.

/** Huruf kecil, tanpa aksen/tanda baca, spasi tunggal. Dipakai untuk pencocokan kata kunci. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ID_WORDS = new Set([
  "yang", "dan", "tidak", "nggak", "gak", "tak", "bisa", "saya", "aku", "kami", "untuk", "dengan", "ini", "itu",
  "di", "ke", "dari", "pada", "akan", "sudah", "belum", "mau", "ingin", "tolong", "mohon", "kenapa", "gimana",
  "bagaimana", "apa", "kok", "lupa", "masuk", "gagal", "aplikasi", "halaman", "saat", "ketika", "muncul",
  "selamat", "pagi", "siang", "malam", "terima", "kasih", "makasih", "halo", "kendala", "masalah", "sudah",
]);

/** Deteksi sederhana Indonesia vs Inggris — cukup untuk memilih bahasa pesan cadangan bot. */
export function detectLang(text: string): Lang {
  const words = normalize(text).split(" ").filter(Boolean);
  const hits = words.filter((w) => ID_WORDS.has(w)).length;
  return hits >= 2 || (words.length <= 4 && hits >= 1) ? "id" : "en";
}

/** Rapikan keluaran model: bot menyimpan TEKS POLOS (bukan HTML/markdown), supaya tampil aman di bubble. */
export function cleanBotText(s: string, max = 1500): string {
  const out = s
    .replace(/\r/g, "")
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[*•]\s+/gm, "- ")
    .replace(/`/g, "")
    // Tanda < > dibuang: teks yang diawali tag HTML akan dianggap HTML oleh tampilan chat.
    .replace(/[<>]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out;
}

/** Pesan tetap bot (dua bahasa). Nama tombol harus sama dengan label di ClientChat. */
export const BOT_TEXT = {
  greeting: (name: string, lang: Lang) =>
    lang === "id" ? `Halo ${name}, terima kasih sudah menghubungi kami. ` : `Hi ${name}, thanks for reaching out. `,
  didItHelp: (lang: Lang) =>
    lang === "id"
      ? "Apakah ini membantu? Jika belum, tekan \"Talk to a support agent\" untuk berbicara dengan petugas."
      : "Did that help? If not, press \"Talk to a support agent\" to chat with a person.",
  weakMatch: (lang: Lang) =>
    lang === "id"
      ? "Ini mungkin berkaitan dengan masalah Anda:"
      : "This might be related to your problem:",
  noAnswer: (lang: Lang) =>
    lang === "id"
      ? "Maaf, saya belum menemukan jawaban yang tepat untuk masalah ini. Tekan \"Talk to a support agent\" di bawah agar petugas kami membantu langsung. Seluruh percakapan ini akan terlihat oleh mereka."
      : "Sorry, I couldn't find a good answer for this one. Press \"Talk to a support agent\" below and our team will help you directly. They will be able to see this whole conversation.",
  replyLimit: (lang: Lang) =>
    lang === "id"
      ? "Saya sudah mencapai batas balasan untuk tiket ini. Tekan \"Talk to a support agent\" agar petugas kami melanjutkan."
      : "I've reached my reply limit for this ticket. Press \"Talk to a support agent\" and our team will take it from here.",
  handoff: (lang: Lang) =>
    lang === "id"
      ? "Baik, tiket Anda sudah diteruskan ke tim support. Petugas akan membalas di sini begitu tersedia. Seluruh percakapan kita tadi terlihat oleh mereka, jadi Anda tidak perlu mengulang dari awal."
      : "Understood. I've passed your ticket to our support team. An agent will reply here as soon as one is available. They can see everything we discussed, so you won't need to repeat yourself.",
  solved: (lang: Lang) =>
    lang === "id"
      ? "Senang bisa membantu! Tiket ini saya tandai selesai. Jika masalahnya muncul lagi, silakan buat tiket baru."
      : "Glad that helped! I've marked this ticket as resolved. If the problem comes back, just open a new ticket.",
} as const;
