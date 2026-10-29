import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { safeInternalPath } from "@/lib/notify/events";
import type { NotificationItem, NotificationPage } from "@/lib/notify/types";

// Pembacaan notifikasi milik SATU user. Semua query selalu memfilter userId: user tidak pernah bisa
// membaca / menandai notifikasi orang lain, walau id-nya ditebak.

export const notificationSelect = {
  id: true,
  type: true,
  title: true,
  message: true,
  href: true,
  ticketId: true,
  isRead: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

type Row = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>;

// Baris lama (sebelum kolom title ada) tidak punya judul -> pakai nama jenisnya.
const FALLBACK_TITLE: Record<Row["type"], string> = {
  SLA_WARNING: "SLA warning",
  SLA_BREACH: "SLA breached",
  NEW_REPLY: "New reply",
  STATUS_CHANGE: "Ticket update",
  NEW_TICKET: "New ticket",
  ANNOUNCEMENT: "Announcement",
};

export function toNotificationItem(r: Row): NotificationItem {
  return {
    id: r.id,
    type: r.type,
    title: r.title?.trim() || FALLBACK_TITLE[r.type],
    message: r.message,
    // Lapisan kedua: hanya path internal yang diteruskan ke browser.
    href: safeInternalPath(r.href),
    ticketId: r.ticketId,
    isRead: r.isRead,
    createdAt: r.createdAt.toISOString(),
  };
}

export const countUnread = (userId: string) => prisma.notification.count({ where: { userId, isRead: false } });

export async function listNotifications(userId: string, limit = 20): Promise<NotificationPage> {
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Math.min(Math.max(limit, 1), 50),
      select: notificationSelect,
    }),
    countUnread(userId),
  ]);
  return { items: rows.map(toNotificationItem), unread };
}

/** Notifikasi dibuat/diperbarui SETELAH `cursor` (inklusif, pemanggil mendedupe berdasarkan id). */
export async function getNotificationsSince(userId: string, cursor: Date): Promise<NotificationItem[]> {
  const rows = await prisma.notification.findMany({
    where: { userId, createdAt: { gte: cursor } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 50,
    select: notificationSelect,
  });
  return rows.map(toNotificationItem);
}
