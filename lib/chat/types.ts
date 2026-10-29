import type { ChatMessage } from "@/lib/staff/types";

/** Pesan + kanalnya. `internal` = Internal note (hanya Petugas), selain itu Public chat. */
export type LiveMessage = ChatMessage & { internal: boolean };

/** Isi event SSE bernama "chat". */
export type StreamMessageEvent = LiveMessage;

/** Isi event SSE bernama "status": status tiket berubah (diklaim, eskalasi, selesai, dst). */
export type StreamStatusEvent = { status: string };

/** Hasil Server Action kirim pesan dari Client. Dipisah dari file "use server" (hanya boleh ekspor fungsi async). */
export type ClientSendState = { error?: string; message?: LiveMessage };

/** Cara menghapus pesan: "me" = hanya untuk saya, "all" = untuk semua orang di chat. */
export type DeleteScope = "me" | "all";
export type ClientDeleteState = { error?: string; ok?: boolean };

/** Hasil aksi Client di fase bot: minta petugas / tandai selesai. */
export type ClientActionState = { error?: string; ok?: boolean };

/** Metadata lampiran tiket (nama asli, tipe, ukuran) untuk tab Media petugas. */
export type AttachmentMeta = { id: string; name: string; mime: string; size: number; createdAt: string };
