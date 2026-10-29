// Tipe bersama modul Bot. Modul ini SENGAJA terpisah dari chat/tiket (NFR-6): untuk mengganti
// penyedia LLM cukup menyentuh gemini.ts dan index.ts, tidak ada kode tiket yang ikut berubah.

export type Lang = "id" | "en";

/** Satu entri basis pengetahuan (tabel faq_entries, dikelola Admin di /admin/faq). */
export type FaqRow = {
  id: string;
  /** Kata kunci dipisah koma, mis. "lupa password, reset password". */
  keywords: string;
  jawaban: string;
};

export type BotTurn = { from: "client" | "bot"; text: string };

export type BotInput = {
  clientName: string;
  ticket: { judul: string; aplikasi: string; platform: string; deskripsi: string };
  /** Percakapan sejauh ini (lama -> baru), sudah berupa teks polos. */
  history: BotTurn[];
  /** Pesan client terbaru, atau null bila ini balasan pertama (bot membaca isi tiket). */
  latestClientText: string | null;
  faq: FaqRow[];
};

export type BotReply = {
  text: string;
  /** Dari mana jawaban berasal: basis FAQ, model bahasa (LLM), atau pesan cadangan. */
  source: "faq" | "llm" | "fallback";
  /** true = bot merasa tidak bisa menuntaskan; UI tetap hanya menawarkan tombol (client yang memutuskan). */
  offerAgent: boolean;
};
