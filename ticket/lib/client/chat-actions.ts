"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/admin/audit";
import { respondToTicket } from "@/lib/bot/respond";
import { BOT_TEXT, detectLang } from "@/lib/bot/text";
import { notifyMessageDeleted, notifyTicket } from "@/lib/chat/events";
import { notifyLater } from "@/lib/notify/dispatch";
import { notifyPreview } from "@/lib/notify/preview";
import { messageSelect, toLiveMessage } from "@/lib/chat/message-map";
import { MAX_MESSAGE_HTML, MAX_MESSAGE_LENGTH, getClientChatAccess } from "@/lib/chat/rules";
import type { ClientActionState, ClientDeleteState, ClientSendState, DeleteScope } from "@/lib/chat/types";
import { extractUploadIds, richTextToPlain, sanitizeRichText } from "@/lib/client/sanitize";

const NOT_FOUND = "This ticket doesn't exist or isn't available to you.";

// Client membalas di Public chat tiketnya sendiri. Aturan ditegakkan di server:
// tiket orang lain = "tidak ada", dan tiket yang sudah selesai tidak bisa dibalas.
// `content` adalah HTML dari editor chat; HTML dari browser tidak dipercaya -> disanitasi dulu.
export async function sendClientMessageAction(
  ticketId: string,
  content: string,
  replyToId?: string | null,
): Promise<ClientSendState> {
  const user = await requireRole("CLIENT");

  const html = sanitizeRichText(typeof content === "string" ? content : "");
  const plain = richTextToPlain(html);
  const hasImage = /<img\b/i.test(html);
  if (!plain && !hasImage) return { error: "Write a message first." };
  if (plain.length > MAX_MESSAGE_LENGTH) return { error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` };
  if (html.length > MAX_MESSAGE_HTML) return { error: "Message is too long. Shorten it or attach the details as a file." };

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, clientId: user.id },
    select: { id: true, status: true },
  });
  if (!ticket) return { error: "This ticket doesn't exist or isn't available to you." };

  const access = getClientChatAccess(ticket.status);
  if (!access.canSend) return { error: access.note ?? "You can't reply to this ticket." };

  const session = await prisma.chatSession.upsert({
    where: { ticketId_type: { ticketId, type: "PUBLIC" } },
    update: {},
    create: { ticketId, type: "PUBLIC" },
    select: { id: true },
  });

  // Pesan yang dibalas harus ada di Public chat tiket INI (bukan catatan internal / tiket lain).
  let replyTo: string | null = null;
  if (replyToId) {
    const target = await prisma.message.findFirst({
      where: { id: replyToId, isInternalNote: false, chatSession: { id: session.id } },
      select: { id: true },
    });
    if (!target) return { error: "The message you're replying to is no longer available." };
    replyTo = target.id;
  }

  const saved = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        chatSessionId: session.id,
        senderType: "CLIENT",
        senderId: user.id,
        content: html,
        isInternalNote: false,
        replyToId: replyTo,
      },
      select: messageSelect,
    });
    // Hubungkan unggahan (gambar/file) yang dipakai di pesan ini ke tiket. Filter uploaderId mencegah
    // client "mengklaim" file milik orang lain hanya dengan menulis ID-nya di HTML.
    const uploadIds = extractUploadIds(html);
    if (uploadIds.length > 0) {
      await tx.ticketAttachment.updateMany({
        where: { id: { in: uploadIds }, uploaderId: user.id, ticketId: null },
        data: { ticketId },
      });
    }
    return created;
  });

  notifyTicket(ticketId);

  // Fase bot: client hanya bicara dengan bot, belum ada petugas yang perlu diberi tahu.
  if (ticket.status !== "BOT_HANDLING") {
    notifyLater("CLIENT_REPLIED", { ticketId, actorId: user.id, actorName: user.name, preview: notifyPreview(html) });
  }

  // Selama tiket masih di fase bot, setiap pesan client dijawab bot. Dijalankan setelah respons
  // dikirim supaya pengirim tidak menunggu LLM; jawabannya tiba lewat stream SSE.
  if (ticket.status === "BOT_HANDLING") after(() => respondToTicket(ticketId, { afterMessageId: saved.id }));

  return { message: toLiveMessage(saved) };
}

// Hapus pesan di Public chat tiket milik client ini.
//  - "me":  pesan disembunyikan hanya dari tampilan client ini (boleh untuk pesan siapa pun, kapan pun).
//  - "all": hanya pesan MILIK SENDIRI, dan hanya selama chat masih terbuka. Isi dikosongkan
//           (tidak sekadar disembunyikan) supaya tidak bisa dibaca lagi oleh siapa pun.
export async function deleteClientMessageAction(
  ticketId: string,
  messageId: string,
  scope: DeleteScope,
): Promise<ClientDeleteState> {
  const user = await requireRole("CLIENT");
  if (scope !== "me" && scope !== "all") return { error: "Invalid request." };

  const msg = await prisma.message.findFirst({
    where: {
      id: messageId,
      isInternalNote: false,
      chatSession: { ticketId, type: "PUBLIC", ticket: { clientId: user.id } },
    },
    select: { id: true, senderId: true, deletedAt: true, chatSession: { select: { ticket: { select: { status: true } } } } },
  });
  if (!msg) return { error: "This message isn't available." };

  if (scope === "me") {
    await prisma.messageHide.upsert({
      where: { messageId_userId: { messageId: msg.id, userId: user.id } },
      update: {},
      create: { messageId: msg.id, userId: user.id },
    });
    return { ok: true };
  }

  if (msg.senderId !== user.id) return { error: "You can only delete your own messages for everyone." };
  if (!getClientChatAccess(msg.chatSession.ticket.status).canSend) {
    return { error: "This chat is read-only, so messages can't be deleted for everyone." };
  }
  if (!msg.deletedAt) {
    await prisma.message.update({ where: { id: msg.id }, data: { content: "", deletedAt: new Date() } });
    notifyMessageDeleted(ticketId, msg.id);
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Keputusan client di akhir fase bot (flowchart: "Client puas?")
// ---------------------------------------------------------------------------

function refreshPages(ticketId: string) {
  revalidatePath("/client");
  revalidatePath("/client/tickets");
  revalidatePath(`/client/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
  revalidatePath("/l1", "layout"); // antrean petugas L1 ikut segar
}

/**
 * "Talk to a support agent" — client belum puas: BOT_HANDLING -> WAITING_AGENT_L1 (eskalasi Bot -> L1).
 * Hanya client pemilik tiket, hanya dari fase bot. Riwayat chat bot ikut terbawa (FR-4.5) karena
 * Public chat-nya sama: petugas L1 membaca percakapan yang sama.
 */
export async function requestAgentAction(ticketId: string): Promise<ClientActionState> {
  const user = await requireRole("CLIENT");

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, clientId: user.id },
    select: { id: true, judul: true, status: true, deskripsi: true },
  });
  if (!ticket) return { error: NOT_FOUND };
  if (ticket.status === "WAITING_AGENT_L1") return { error: "You're already in the queue for a support agent." };
  if (ticket.status !== "BOT_HANDLING") return { error: "This ticket can't be passed to an agent right now." };

  const lang = detectLang(`${ticket.judul} ${richTextToPlain(ticket.deskripsi)}`);

  const moved = await prisma.$transaction(async (tx) => {
    // updateMany + syarat status = atomik: klik ganda / dua tab tidak membuat dua baris antrean.
    const res = await tx.ticket.updateMany({
      where: { id: ticketId, clientId: user.id, status: "BOT_HANDLING" },
      data: { status: "WAITING_AGENT_L1" },
    });
    if (res.count === 0) return false;

    await tx.ticketTimeline.create({
      data: {
        ticketId,
        statusBaru: "WAITING_AGENT_L1",
        actorType: "SYSTEM",
        catatan: "You asked to talk to a support agent. Waiting for an agent.",
      },
    });
    if ((await tx.queueEntry.count({ where: { ticketId, level: "L1", assignedToId: null } })) === 0) {
      await tx.queueEntry.create({ data: { ticketId, level: "L1" } });
    }
    const session = await tx.chatSession.upsert({
      where: { ticketId_type: { ticketId, type: "PUBLIC" } },
      update: {},
      create: { ticketId, type: "PUBLIC" },
      select: { id: true },
    });
    await tx.message.create({
      data: { chatSessionId: session.id, senderType: "BOT", senderId: null, content: BOT_TEXT.handoff(lang), isInternalNote: false },
    });
    return true;
  });
  if (!moved) return { error: "This ticket can't be passed to an agent right now. Reload and try again." };

  notifyTicket(ticketId);
  // Client = pelaku sekaligus penerima yang sah (konfirmasi) -> tanpa actorId supaya tidak dikecualikan.
  notifyLater("AGENT_REQUESTED", { ticketId, actorName: user.name });
  await writeAudit({
    actorId: user.id,
    action: "TICKET_ESCALATE",
    entityType: "Ticket",
    entityId: ticketId,
    description: `Client asked for a support agent (bot -> L1 queue). ("${ticket.judul}")`,
  });
  refreshPages(ticketId);
  return { ok: true };
}

/**
 * "It's solved" — client puas dengan jawaban bot: BOT_HANDLING -> RESOLVED tanpa petugas.
 * Aturan Tahap 2: tiket tidak boleh selesai tanpa minimal satu interaksi, jadi harus sudah ada balasan bot.
 */
export async function markSolvedByBotAction(ticketId: string): Promise<ClientActionState> {
  const user = await requireRole("CLIENT");

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, clientId: user.id },
    select: { id: true, judul: true, status: true, deskripsi: true },
  });
  if (!ticket) return { error: NOT_FOUND };
  if (ticket.status !== "BOT_HANDLING") return { error: "This ticket can't be marked as solved from here." };

  const botReplies = await prisma.message.count({
    where: { chatSession: { ticketId, type: "PUBLIC" }, senderType: "BOT" },
  });
  if (botReplies === 0) return { error: "Wait for the assistant's first reply before marking this as solved." };

  const lang = detectLang(`${ticket.judul} ${richTextToPlain(ticket.deskripsi)}`);

  const done = await prisma.$transaction(async (tx) => {
    const res = await tx.ticket.updateMany({
      where: { id: ticketId, clientId: user.id, status: "BOT_HANDLING" },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
    if (res.count === 0) return false;

    await tx.ticketTimeline.create({
      data: {
        ticketId,
        statusBaru: "RESOLVED",
        actorType: "BOT",
        catatan: "You confirmed the assistant's answer solved the problem.",
      },
    });
    const session = await tx.chatSession.upsert({
      where: { ticketId_type: { ticketId, type: "PUBLIC" } },
      update: {},
      create: { ticketId, type: "PUBLIC" },
      select: { id: true },
    });
    await tx.message.create({
      data: { chatSessionId: session.id, senderType: "BOT", senderId: null, content: BOT_TEXT.solved(lang), isInternalNote: false },
    });
    return true;
  });
  if (!done) return { error: "This ticket can't be marked as solved right now. Reload and try again." };

  notifyTicket(ticketId);
  await writeAudit({
    actorId: user.id,
    action: "TICKET_STATUS_CHANGE",
    entityType: "Ticket",
    entityId: ticketId,
    description: `Client marked the ticket as solved by the assistant. ("${ticket.judul}")`,
  });
  refreshPages(ticketId);
  return { ok: true };
}
