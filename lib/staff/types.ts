import type { LiveMessage } from "@/lib/chat/types";

// Tipe bersama modul Petugas (L1/L2). Dipisah dari actions.ts karena file "use server"
// hanya boleh mengekspor fungsi async.

export type StaffActionState = {
  error?: string;
  success?: string;
  // Dikembalikan supaya isi form tidak hilang setelah error (React mereset form).
  values?: { note?: string };
  /** Pesan yang baru tersimpan (sendMessageAction), supaya pengirim langsung melihatnya tanpa menunggu stream. */
  message?: LiveMessage;
};

/** Ringkasan pesan yang dikutip oleh sebuah balasan. */
export type ReplyRef = {
  id: string;
  senderId: string | null;
  senderType: "BOT" | "CLIENT" | "PETUGAS_L1" | "PETUGAS_L2";
  senderName: string | null;
  /** Teks polos singkat (maks. 140 karakter); kosong bila dihapus. */
  preview: string;
  deleted: boolean;
};

export type ChatMessage = {
  id: string;
  senderId: string | null;
  senderType: "BOT" | "CLIENT" | "PETUGAS_L1" | "PETUGAS_L2";
  senderName: string | null;
  /** Kosong bila `deleted`. HTML (sudah disanitasi server) bila `html`, selain itu teks polos. */
  content: string;
  /** true = `content` HTML dari editor chat yang sudah disanitasi server; false/undefined = teks polos. */
  html?: boolean;
  /** "Hapus untuk semua": isi sudah dikosongkan, tampilkan "This message was deleted". */
  deleted?: boolean;
  /** Pesan yang dikutip (balasan). */
  replyTo?: ReplyRef | null;
  /** Pesan hasil "Forward" oleh Petugas. */
  forwarded?: boolean;
  /** ISO string — Date tidak dikirim mentah ke client supaya format waktu deterministik. */
  createdAt: string;
};

/** Hasil aksi hapus massal pesan oleh Petugas. */
export type StaffDeleteState = { error?: string; ok?: boolean; ids?: string[] };

/** Hasil aksi teruskan pesan: pesan baru di kanal tujuan (supaya langsung tampil tanpa menunggu stream). */
export type StaffForwardState = { error?: string; messages?: LiveMessage[] };
