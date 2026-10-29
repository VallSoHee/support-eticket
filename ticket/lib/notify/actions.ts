"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";

// Menandai notifikasi sebagai dibaca. Selalu dibatasi userId pemanggil: id milik orang lain diabaikan diam-diam.
// Tidak memanggil revalidatePath: bel memperbarui dirinya sendiri (optimistik), tidak perlu refresh halaman.

const MAX_IDS = 100;

export async function markNotificationsReadAction(ids: string[]): Promise<void> {
  const user = await requireUser();
  const list = [...new Set(Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : [])].slice(0, MAX_IDS);
  if (list.length === 0) return;
  await prisma.notification.updateMany({ where: { userId: user.id, id: { in: list }, isRead: false }, data: { isRead: true } });
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
}

/** Dipakai saat user membuka halaman sebuah tiket: semua notifikasi tiket itu langsung dianggap terbaca. */
export async function markTicketNotificationsReadAction(ticketId: string): Promise<void> {
  const user = await requireUser();
  if (typeof ticketId !== "string" || !ticketId) return;
  await prisma.notification.updateMany({ where: { userId: user.id, ticketId, isRead: false }, data: { isRead: true } });
}
