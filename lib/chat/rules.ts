import type { TicketStatus } from "@/generated/prisma/enums";
import { isDone } from "@/lib/staff/rules";

// Aturan chat dari sisi CLIENT. Modul murni (tanpa Prisma) supaya aman dipakai di komponen client
// dan di server action — satu sumber kebenaran, seperti lib/staff/rules.ts.

export type ClientChatAccess = { canSend: boolean; note?: string };

export function getClientChatAccess(status: TicketStatus): ClientChatAccess {
  if (isDone(status)) {
    return {
      canSend: false,
      note:
        status === "RESOLVED"
          ? "This ticket is marked as resolved, so the chat is read-only. Open a new ticket if the problem comes back."
          : "This ticket is closed, so the chat is read-only.",
    };
  }
  return { canSend: true };
}

export const MAX_MESSAGE_LENGTH = 4000; // karakter teks (tanpa tag HTML)
export const MAX_MESSAGE_HTML = 20_000; // panjang HTML mentah yang disimpan
