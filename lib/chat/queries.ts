import type { Prisma } from "@/generated/prisma/client";
import type { TicketStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/auth/guards";
import { levelOfRole } from "@/lib/staff/rules";
import { viewWhere } from "@/lib/staff/queries";
import type { LiveMessage } from "@/lib/chat/types";
import { channelWhere, messageSelect, toLiveMessage, type ChatViewer } from "@/lib/chat/message-map";

export { toLiveMessage };
export type { ChatViewer };

// Siapa yang boleh "mendengarkan" chat sebuah tiket — aturannya SAMA dengan halaman detailnya:
//  - Client: hanya tiket miliknya, dan hanya Public chat (Internal note tidak pernah ikut).
//  - Petugas L1/L2: tiket di antrean levelnya atau yang ditugaskan padanya (viewWhere). L1 melihat kedua
//    kanal; L2 hanya kanal internal (lihat channelWhere).
//  - Admin: tidak ikut chat.

export async function resolveChatViewer(user: CurrentUser, ticketId: string): Promise<ChatViewer | null> {
  if (user.role === "CLIENT") {
    const t = await prisma.ticket.findFirst({ where: { id: ticketId, clientId: user.id }, select: { id: true } });
    return t ? { kind: "client", userId: user.id } : null;
  }
  const level = levelOfRole(user.role);
  if (!level) return null;
  const t = await prisma.ticket.findFirst({
    where: { AND: [{ id: ticketId }, viewWhere(level, user.id, "all")] },
    select: { id: true },
  });
  return t ? { kind: "staff", userId: user.id, level } : null;
}

export async function getTicketStatus(ticketId: string): Promise<TicketStatus | null> {
  const t = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { status: true } });
  return t?.status ?? null;
}

/**
 * Pesan tiket dengan createdAt >= `since` (inklusif, supaya pesan yang lahir di milidetik yang
 * sama tidak terlewat; pemanggil membuang duplikat lewat id). Terlama dulu.
 */
export async function getMessagesSince(ticketId: string, viewer: ChatViewer, since: Date): Promise<LiveMessage[]> {
  const where: Prisma.MessageWhereInput = {
    ...channelWhere(ticketId, viewer),
    createdAt: { gte: since },
    // "Hapus untuk saya": pesan yang disembunyikan user ini tidak ikut dikirim.
    hides: { none: { userId: viewer.userId } },
  };

  const rows = await prisma.message.findMany({
    where,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 200,
    select: messageSelect,
  });
  return rows.map(toLiveMessage);
}

/** Riwayat awal untuk render server: 300 pesan TERBARU, urut lama -> baru. */
export async function getRecentMessages(ticketId: string, viewer: ChatViewer, take = 300): Promise<LiveMessage[]> {
  const where: Prisma.MessageWhereInput = {
    ...channelWhere(ticketId, viewer),
    hides: { none: { userId: viewer.userId } },
  };

  const rows = await prisma.message.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: messageSelect,
  });
  return rows.reverse().map(toLiveMessage);
}

/** Lampiran yang terhubung ke tiket (deskripsi & chat client). Panggil SETELAH akses tiket dicek (getStaffTicket / getClientTicket). */
export async function getTicketAttachments(ticketId: string) {
  const rows = await prisma.ticketAttachment.findMany({
    where: { ticketId },
    orderBy: { createdAt: "desc" },
    select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.originalName,
    mime: r.mimeType,
    size: r.size,
    createdAt: r.createdAt.toISOString(),
  }));
}
