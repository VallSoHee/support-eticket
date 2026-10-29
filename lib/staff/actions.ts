"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/admin/audit";
import { STAFF_LEVEL, getStaffAccess, type StaffLevel } from "@/lib/staff/rules";
import { viewWhere } from "@/lib/staff/queries";
import { notifyMessageDeleted, notifyTicket } from "@/lib/chat/events";
import { notifyLater } from "@/lib/notify/dispatch";
import { notifyPreview } from "@/lib/notify/preview";
import { channelWhere, messageSelect, toLiveMessage } from "@/lib/chat/message-map";
import { looksLikeHtml, sanitizeRichText } from "@/lib/client/sanitize";
import type { Prisma } from "@/generated/prisma/client";
import type { DeleteScope } from "@/lib/chat/types";
import type { StaffActionState, StaffDeleteState, StaffForwardState } from "@/lib/staff/types";

// Semua aturan di sini ditegakkan di SERVER. UI yang menyembunyikan/mengunci tombol hanya
// kenyamanan; permintaan yang melanggar aturan (mis. menulis Internal Note sebelum eskalasi)
// tetap ditolak walau dikirim manual.

const NOT_FOUND = "This ticket doesn't exist or isn't available to you.";

async function staffContext() {
  const user = await requireRole("PETUGAS_L1", "PETUGAS_L2");
  const level: StaffLevel = user.role === "PETUGAS_L2" ? "L2" : "L1";
  return { user, level };
}

async function loadTicket(level: StaffLevel, userId: string, ticketId: string) {
  const ticket = await prisma.ticket.findFirst({
    where: { AND: [{ id: ticketId }, viewWhere(level, userId, "all")] },
    select: {
      id: true,
      judul: true,
      status: true,
      assignedL1Id: true,
      assignedL2Id: true,
      chatSessions: { where: { type: "INTERNAL" }, select: { id: true } },
    },
  });
  if (!ticket) return null;
  return { ...ticket, hasInternalSession: ticket.chatSessions.length > 0 };
}

const refresh = (level: StaffLevel) => revalidatePath(STAFF_LEVEL[level].base, "layout");

// ---------------------------------------------------------------------------
// Kirim pesan (Public chat / Internal note)
// ---------------------------------------------------------------------------

const sendSchema = z.object({
  channel: z.enum(["public", "internal"]),
  content: z.string().trim().min(1, "Write a message first.").max(4000, "Message is too long (max 4000 characters)."),
});

type Channel = "public" | "internal";
type Facts = NonNullable<Awaited<ReturnType<typeof loadTicket>>>;

/** Boleh mengirim ke kanal ini sekarang? Mengembalikan pesan error bila tidak. Satu pintu untuk kirim, balas, dan teruskan. */
function sendBlock(level: StaffLevel, userId: string, ticket: Facts, channel: Channel): string | null {
  const access = getStaffAccess(level, userId, ticket);
  if (channel === "internal") {
    // ATURAN UTAMA: sebelum L1 mengeskalasi, Internal Note terkunci total.
    if (access.internalNote.locked) return access.internalNote.note ?? "Internal notes are locked.";
    if (!access.internalNote.canSend) return access.internalNote.note ?? "You can't write internal notes now.";
    return null;
  }
  // L2 tidak punya Public chat (access.publicChat.canSend selalu false untuk L2).
  if (!access.publicChat.canSend) return access.publicChat.note ?? "You can't reply to the client now.";
  return null;
}

/** Pesan yang tampil di sebuah kanal (termasuk catatan internal lama yang tersimpan di sesi PUBLIC). */
function channelOnly(ticketId: string, channel: Channel): Prisma.MessageWhereInput {
  return channel === "internal"
    ? { chatSession: { ticketId }, OR: [{ chatSession: { type: "INTERNAL" } }, { isInternalNote: true }] }
    : { chatSession: { ticketId, type: "PUBLIC" }, isInternalNote: false };
}

async function sessionFor(ticketId: string, channel: Channel) {
  const type = channel === "internal" ? "INTERNAL" : "PUBLIC";
  return prisma.chatSession.upsert({
    where: { ticketId_type: { ticketId, type } },
    update: {},
    create: { ticketId, type },
    select: { id: true },
  });
}

export async function sendMessageAction(
  ticketId: string,
  channel: Channel,
  content: string,
  replyToId?: string | null,
): Promise<StaffActionState> {
  const { user, level } = await staffContext();
  const parsed = sendSchema.safeParse({ channel, content });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid message." };

  const ticket = await loadTicket(level, user.id, ticketId);
  if (!ticket) return { error: NOT_FOUND };

  const blocked = sendBlock(level, user.id, ticket, parsed.data.channel);
  if (blocked) return { error: blocked };

  // Pesan yang dibalas harus ada di kanal YANG SAMA (balasan Public tidak boleh mengutip Internal note).
  let replyTo: string | null = null;
  if (replyToId) {
    const target = await prisma.message.findFirst({
      where: { id: replyToId, ...channelOnly(ticketId, parsed.data.channel) },
      select: { id: true },
    });
    if (!target) return { error: "The message you're replying to is no longer available." };
    replyTo = target.id;
  }

  const session = await sessionFor(ticketId, parsed.data.channel);
  const saved = await prisma.message.create({
    data: {
      chatSessionId: session.id,
      senderType: STAFF_LEVEL[level].sender,
      senderId: user.id,
      content: parsed.data.content,
      isInternalNote: parsed.data.channel === "internal",
      replyToId: replyTo,
    },
    select: messageSelect,
  });

  // Bangunkan stream SSE (client & petugas lain yang membuka tiket ini) -> pesan tampil realtime.
  notifyTicket(ticketId);
  // Bel notifikasi: balasan ke client (Public) atau catatan antar petugas (Internal). Pengirim dikecualikan.
  notifyLater(parsed.data.channel === "internal" ? "INTERNAL_NOTE" : "AGENT_REPLIED", {
    ticketId,
    actorId: user.id,
    actorName: user.name,
    preview: notifyPreview(parsed.data.content),
  });

  // Pesan sendiri tampil lewat hasil aksi ini; refresh hanya menyegarkan panel samping (mis. "First reply" SLA).
  refresh(level);
  return { message: toLiveMessage(saved) };
}

// ---------------------------------------------------------------------------
// Hapus pesan (satu atau banyak sekaligus, hasil mode "pilih pesan")
//  - "me":  disembunyikan hanya dari tampilan petugas ini.
//  - "all": hanya pesan MILIK SENDIRI di kanal yang masih bisa ditulis. Isi dikosongkan, bukan sekadar disembunyikan.
// L2 tidak pernah bisa menyentuh pesan Public: pesan di luar kanal yang boleh ia lihat dianggap "tidak ada".
// ---------------------------------------------------------------------------

const MAX_BULK = 50;

export async function deleteStaffMessagesAction(
  ticketId: string,
  messageIds: string[],
  scope: DeleteScope,
): Promise<StaffDeleteState> {
  const { user, level } = await staffContext();
  if (scope !== "me" && scope !== "all") return { error: "Invalid request." };
  const ids = [...new Set(Array.isArray(messageIds) ? messageIds.filter((x) => typeof x === "string") : [])];
  if (ids.length === 0) return { error: "Select at least one message." };
  if (ids.length > MAX_BULK) return { error: `You can delete at most ${MAX_BULK} messages at once.` };

  const ticket = await loadTicket(level, user.id, ticketId);
  if (!ticket) return { error: NOT_FOUND };

  const rows = await prisma.message.findMany({
    where: { AND: [channelWhere(ticketId, { kind: "staff", userId: user.id, level }), { id: { in: ids } }] },
    select: { id: true, senderId: true, deletedAt: true, isInternalNote: true, chatSession: { select: { type: true } } },
  });
  if (rows.length !== ids.length) return { error: "Some of these messages aren't available anymore." };

  if (scope === "me") {
    await prisma.messageHide.createMany({ data: rows.map((r) => ({ messageId: r.id, userId: user.id })), skipDuplicates: true });
    return { ok: true, ids };
  }

  for (const r of rows) {
    if (r.senderId !== user.id) return { error: "You can only delete your own messages for everyone." };
    const channel: Channel = r.chatSession.type === "INTERNAL" || r.isInternalNote ? "internal" : "public";
    if (sendBlock(level, user.id, ticket, channel)) {
      return { error: "This chat is read-only now, so messages can't be deleted for everyone." };
    }
  }
  const fresh = rows.filter((r) => !r.deletedAt).map((r) => r.id);
  if (fresh.length > 0) {
    await prisma.message.updateMany({ where: { id: { in: fresh } }, data: { content: "", deletedAt: new Date() } });
    for (const id of fresh) notifyMessageDeleted(ticketId, id);
  }
  return { ok: true, ids };
}

// ---------------------------------------------------------------------------
// Teruskan pesan (forward) ke kanal tujuan sebagai pesan BARU atas nama petugas ini.
//  - L1: Internal note -> Public chat (menyampaikan info L2 ke client) atau sebaliknya.
//  - L2: hanya kanal internal (tidak punya Public chat).
// Kanal tujuan harus bisa ditulis oleh petugas ini (aturan yang sama dengan kirim pesan).
// ---------------------------------------------------------------------------

const MAX_FORWARD = 30;

export async function forwardMessagesAction(
  ticketId: string,
  messageIds: string[],
  target: Channel,
): Promise<StaffForwardState> {
  const { user, level } = await staffContext();
  if (target !== "public" && target !== "internal") return { error: "Invalid request." };
  const ids = [...new Set(Array.isArray(messageIds) ? messageIds.filter((x) => typeof x === "string") : [])];
  if (ids.length === 0) return { error: "Select at least one message." };
  if (ids.length > MAX_FORWARD) return { error: `You can forward at most ${MAX_FORWARD} messages at once.` };

  const ticket = await loadTicket(level, user.id, ticketId);
  if (!ticket) return { error: NOT_FOUND };

  const blocked = sendBlock(level, user.id, ticket, target);
  if (blocked) return { error: blocked };

  // Sumber: hanya pesan yang memang boleh dilihat petugas ini, dan belum dihapus.
  const sources = await prisma.message.findMany({
    where: { AND: [channelWhere(ticketId, { kind: "staff", userId: user.id, level }), { id: { in: ids } }] },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, content: true, deletedAt: true },
  });
  if (sources.length !== ids.length) return { error: "Some of these messages aren't available anymore." };
  if (sources.some((m) => m.deletedAt)) return { error: "Deleted messages can't be forwarded." };

  const session = await sessionFor(ticketId, target);
  const base = Date.now();
  const saved = await prisma.$transaction(
    sources.map((m, i) =>
      prisma.message.create({
        data: {
          chatSessionId: session.id,
          senderType: STAFF_LEVEL[level].sender,
          senderId: user.id,
          // HTML dari pesan client disanitasi ulang; teks polos disalin apa adanya.
          content: looksLikeHtml(m.content) ? sanitizeRichText(m.content) : m.content,
          isInternalNote: target === "internal",
          forwarded: true,
          // Cap waktu berurutan supaya urutan asli terjaga walau semuanya dibuat bersamaan.
          createdAt: new Date(base + i),
        },
        select: messageSelect,
      }),
    ),
  );

  notifyTicket(ticketId);
  notifyLater(target === "internal" ? "INTERNAL_NOTE" : "AGENT_REPLIED", {
    ticketId,
    actorId: user.id,
    actorName: user.name,
    preview: notifyPreview(saved[saved.length - 1]?.content ?? ""),
  });
  refresh(level);
  return { messages: saved.map(toLiveMessage) };
}

// ---------------------------------------------------------------------------
// Ambil tiket dari antrean (L1: WAITING_AGENT_L1 -> IN_PROGRESS_L1, L2: ESCALATED_L2 -> IN_PROGRESS_L2)
// ---------------------------------------------------------------------------

export async function claimTicketAction(ticketId: string): Promise<StaffActionState> {
  const { user, level } = await staffContext();
  const ticket = await loadTicket(level, user.id, ticketId);
  if (!ticket) return { error: NOT_FOUND };

  const next = level === "L1" ? "IN_PROGRESS_L1" : "IN_PROGRESS_L2";
  const taken = await prisma.$transaction(async (tx) => {
    // updateMany + syarat status/kepemilikan = klaim atomik: kalau petugas lain lebih dulu, count = 0.
    const res = await tx.ticket.updateMany({
      where:
        level === "L1"
          ? { id: ticketId, status: "WAITING_AGENT_L1", assignedL1Id: null }
          : { id: ticketId, status: "ESCALATED_L2", assignedL2Id: null },
      data: level === "L1" ? { assignedL1Id: user.id, status: next } : { assignedL2Id: user.id, status: next },
    });
    if (res.count === 0) return false;

    await tx.ticketTimeline.create({
      data: { ticketId, statusBaru: next, actorType: level, actorId: user.id, catatan: `Ticket taken by ${user.name}.` },
    });

    const entry = await tx.queueEntry.findFirst({
      where: { ticketId, level, assignedToId: null },
      orderBy: { enteredAt: "desc" },
      select: { id: true },
    });
    const now = new Date();
    if (entry) await tx.queueEntry.update({ where: { id: entry.id }, data: { assignedToId: user.id, assignedAt: now } });
    else await tx.queueEntry.create({ data: { ticketId, level, assignedToId: user.id, assignedAt: now } });

    if (level === "L1") {
      await tx.chatSession.upsert({
        where: { ticketId_type: { ticketId, type: "PUBLIC" } },
        update: {},
        create: { ticketId, type: "PUBLIC" },
      });
    }
    return true;
  });

  if (!taken) return { error: "Another agent already took this ticket." };
  notifyTicket(ticketId); // client langsung melihat "A support agent is working on this."
  notifyLater(level === "L1" ? "TICKET_CLAIMED_L1" : "TICKET_CLAIMED_L2", { ticketId, actorId: user.id, actorName: user.name });

  await writeAudit({
    actorId: user.id,
    action: "TICKET_STATUS_CHANGE",
    entityType: "Ticket",
    entityId: ticketId,
    description: `Ticket taken by ${user.name} (${level}). ("${ticket.judul}")`,
  });
  refresh(level);
  return { success: "Ticket taken. You can reply to the client now." };
}

// ---------------------------------------------------------------------------
// Eskalasi L1 -> L2. Inilah yang membuka Internal Note (membuat sesi INTERNAL).
// ---------------------------------------------------------------------------

const escalateSchema = z.object({
  note: z
    .string()
    .trim()
    .min(10, "Add a short handover note for L2 (at least 10 characters).")
    .max(2000, "Note is too long (max 2000 characters)."),
});

export async function escalateTicketAction(
  ticketId: string,
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const { user, level } = await staffContext();
  const raw = String(formData.get("note") ?? "");
  if (level !== "L1") return { error: "Only L1 can escalate a ticket.", values: { note: raw } };

  const parsed = escalateSchema.safeParse({ note: raw });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid note.", values: { note: raw } };

  const ticket = await loadTicket(level, user.id, ticketId);
  if (!ticket) return { error: NOT_FOUND, values: { note: raw } };

  try {
    await prisma.$transaction(async (tx) => {
      const res = await tx.ticket.updateMany({
        where: { id: ticketId, assignedL1Id: user.id, status: "IN_PROGRESS_L1" },
        data: { status: "ESCALATED_L2" },
      });
      if (res.count === 0) throw new Error("NOT_ELIGIBLE");

      const session = await tx.chatSession.upsert({
        where: { ticketId_type: { ticketId, type: "INTERNAL" } },
        update: {},
        create: { ticketId, type: "INTERNAL" },
        select: { id: true },
      });
      // Catatan serah-terima jadi pesan pertama di Internal note, supaya L2 langsung punya konteks.
      await tx.message.create({
        data: {
          chatSessionId: session.id,
          senderType: "PETUGAS_L1",
          senderId: user.id,
          content: parsed.data.note,
          isInternalNote: true,
        },
      });
      await tx.ticketTimeline.create({
        data: {
          ticketId,
          statusBaru: "ESCALATED_L2",
          actorType: "L1",
          actorId: user.id,
          catatan: `Escalated to L2 by ${user.name}.`,
        },
      });
      await tx.queueEntry.create({ data: { ticketId, level: "L2" } });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_ELIGIBLE") {
      return { error: "This ticket can't be escalated right now. Reload and try again.", values: { note: raw } };
    }
    throw e;
  }
  notifyTicket(ticketId);
  notifyLater("TICKET_ESCALATED", { ticketId, actorId: user.id, actorName: user.name });

  await writeAudit({
    actorId: user.id,
    action: "TICKET_ESCALATE",
    entityType: "Ticket",
    entityId: ticketId,
    description: `Ticket escalated to L2 by ${user.name}. ("${ticket.judul}")`,
  });
  refresh(level);
  return { success: "Ticket escalated. Internal notes are now unlocked." };
}

// ---------------------------------------------------------------------------
// Tandai selesai (hanya L1 pemegang tiket: saat IN_PROGRESS_L1, atau IN_PROGRESS_L2 setelah menyampaikan solusi L2)
// ---------------------------------------------------------------------------

export async function resolveTicketAction(ticketId: string): Promise<StaffActionState> {
  const { user, level } = await staffContext();
  // Hanya L1 yang menutup tiket (L2 tidak bicara dengan client, jadi L1 menyampaikan solusinya lebih dulu).
  if (level !== "L1") return { error: "Only L1 can mark a ticket as resolved. Send your findings to L1 in the chat." };
  const ticket = await loadTicket(level, user.id, ticketId);
  if (!ticket) return { error: NOT_FOUND };

  const resolved = await prisma.$transaction(async (tx) => {
    const res = await tx.ticket.updateMany({
      where: { id: ticketId, assignedL1Id: user.id, status: { in: ["IN_PROGRESS_L1", "IN_PROGRESS_L2"] } },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
    if (res.count === 0) return false;
    await tx.ticketTimeline.create({
      data: {
        ticketId,
        statusBaru: "RESOLVED",
        actorType: level,
        actorId: user.id,
        catatan: `Marked as resolved by ${user.name}.`,
      },
    });
    return true;
  });

  if (!resolved) return { error: "This ticket can't be resolved right now. Reload and try again." };
  notifyTicket(ticketId);
  notifyLater("TICKET_RESOLVED", { ticketId, actorId: user.id, actorName: user.name });

  await writeAudit({
    actorId: user.id,
    action: "TICKET_STATUS_CHANGE",
    entityType: "Ticket",
    entityId: ticketId,
    description: `Ticket resolved by ${user.name} (${level}). ("${ticket.judul}")`,
  });
  refresh(level);
  return { success: "Ticket marked as resolved." };
}
