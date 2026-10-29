import type { Prisma } from "@/generated/prisma/client";
import { looksLikeHtml, richTextToPlain, sanitizeRichText } from "@/lib/client/sanitize";
import type { ReplyRef } from "@/lib/staff/types";
import type { LiveMessage } from "@/lib/chat/types";

// Pemetaan baris Message -> LiveMessage, dipakai bersama oleh chat (lib/chat/queries) dan halaman
// Petugas (lib/staff/queries). Server only: memakai sanitize-html.

export const messageSelect = {
  id: true,
  senderId: true,
  senderType: true,
  content: true,
  isInternalNote: true,
  createdAt: true,
  deletedAt: true,
  forwarded: true,
  sender: { select: { name: true } },
  chatSession: { select: { type: true } },
  replyTo: {
    select: {
      id: true,
      senderId: true,
      senderType: true,
      content: true,
      deletedAt: true,
      sender: { select: { name: true } },
    },
  },
} satisfies Prisma.MessageSelect;

type Row = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;

const PREVIEW_MAX = 140;

function previewOf(content: string): string {
  const plain = looksLikeHtml(content) ? richTextToPlain(sanitizeRichText(content)) : content.replace(/\s+/g, " ").trim();
  if (!plain && /<img\b/i.test(content)) return "Photo";
  return plain.length > PREVIEW_MAX ? `${plain.slice(0, PREVIEW_MAX)}…` : plain;
}

function toReplyRef(r: NonNullable<Row["replyTo"]>): ReplyRef {
  const deleted = r.deletedAt !== null;
  return {
    id: r.id,
    senderId: r.senderId,
    senderType: r.senderType,
    senderName: r.sender?.name ?? null,
    preview: deleted ? "" : previewOf(r.content),
    deleted,
  };
}

export const toLiveMessage = (m: Row): LiveMessage => {
  const deleted = m.deletedAt !== null;
  // HTML dari editor chat disanitasi SEKALI LAGI saat dibaca (lapisan kedua); teks polos (mis. dari
  // Petugas/bot) dikirim apa adanya dan ditampilkan sebagai teks, bukan HTML.
  const html = !deleted && looksLikeHtml(m.content);
  return {
    id: m.id,
    senderId: m.senderId,
    senderType: m.senderType,
    senderName: m.sender?.name ?? null,
    content: deleted ? "" : html ? sanitizeRichText(m.content) : m.content,
    html,
    deleted,
    replyTo: m.replyTo ? toReplyRef(m.replyTo) : null,
    forwarded: m.forwarded,
    createdAt: m.createdAt.toISOString(),
    // Catatan internal = sesi INTERNAL, ATAU pesan bertanda isInternalNote di sesi PUBLIC
    // (sama dengan aturan di getStaffTicket).
    internal: m.chatSession.type === "INTERNAL" || m.isInternalNote,
  };
};

// Siapa yang "mendengarkan" chat sebuah tiket.
//  - Client: hanya Public chat, tanpa Internal note.
//  - L1: kedua kanal. L2: HANYA kanal internal (L2 tidak punya Public chat; pesan Public tidak pernah
//    dikirim ke browser L2, bukan sekadar disembunyikan di UI).
export type ChatViewer = { kind: "client"; userId: string } | { kind: "staff"; userId: string; level: "L1" | "L2" };

/** Filter kanal pesan menurut siapa yang membaca. Satu-satunya tempat aturan ini dirumuskan untuk chat. */
export function channelWhere(ticketId: string, viewer: ChatViewer): Prisma.MessageWhereInput {
  if (viewer.kind === "client") return { chatSession: { ticketId, type: "PUBLIC" }, isInternalNote: false };
  if (viewer.level === "L2") {
    return { chatSession: { ticketId }, OR: [{ chatSession: { type: "INTERNAL" } }, { isInternalNote: true }] };
  }
  return { chatSession: { ticketId } };
}
