import type { Prisma } from "@/generated/prisma/client";
import type { TicketStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { ACTIVE_STATUSES } from "@/lib/admin/constants";

// Semua query di sini WAJIB memfilter clientId: client hanya boleh melihat tiket miliknya.

export const CLIENT_PAGE_SIZE = 10;

export type TicketView = "all" | "active" | "done";
export const parseView = (v?: string): TicketView => (v === "active" || v === "done" ? v : "all");

const DONE_STATUSES: TicketStatus[] = ["RESOLVED", "CLOSED"];

const listSelect = {
  id: true,
  judul: true,
  status: true,
  priority: true,
  createdAt: true,
  resolvedAt: true,
  category: { select: { nama: true } },
  assignedL1: { select: { name: true } },
  // Ticket tidak punya kolom updatedAt -> "terakhir berubah" = entri timeline terbaru.
  timeline: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
} satisfies Prisma.TicketSelect;

type ListRow = Prisma.TicketGetPayload<{ select: typeof listSelect }>;

function withActivity(t: ListRow) {
  const { timeline, ...rest } = t;
  return { ...rest, lastActivity: timeline[0]?.createdAt ?? t.createdAt };
}

export type ClientTicketItem = ReturnType<typeof withActivity>;

export async function getClientCounts(clientId: string) {
  const grouped = await prisma.ticket.groupBy({ by: ["status"], where: { clientId }, _count: { _all: true } });
  let total = 0;
  let done = 0;
  for (const g of grouped) {
    total += g._count._all;
    if (DONE_STATUSES.includes(g.status)) done += g._count._all;
  }
  return { total, done, active: total - done };
}

export async function getClientOverview(clientId: string) {
  const [counts, latest, recent] = await Promise.all([
    getClientCounts(clientId),
    prisma.ticket.findFirst({
      where: { clientId, status: { in: ACTIVE_STATUSES } },
      orderBy: { createdAt: "desc" },
      select: listSelect,
    }),
    prisma.ticket.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 8, select: listSelect }),
  ]);

  return { ...counts, latest: latest ? withActivity(latest) : null, recent: recent.map(withActivity) };
}

export async function getClientTickets(clientId: string, opts: { view: TicketView; q?: string; page: number }) {
  const q = opts.q?.trim();
  const where: Prisma.TicketWhereInput = {
    clientId,
    ...(opts.view === "active" ? { status: { notIn: DONE_STATUSES } } : {}),
    ...(opts.view === "done" ? { status: { in: DONE_STATUSES } } : {}),
    ...(q ? { judul: { contains: q } } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * CLIENT_PAGE_SIZE,
      take: CLIENT_PAGE_SIZE,
      select: listSelect,
    }),
  ]);

  return { total, totalPages: Math.max(1, Math.ceil(total / CLIENT_PAGE_SIZE)), tickets: rows.map(withActivity) };
}

/** null bila tiket tidak ada ATAU bukan milik client ini (sengaja tidak dibedakan). */
export async function getClientTicket(clientId: string, id: string) {
  return prisma.ticket.findFirst({
    where: { id, clientId },
    include: {
      category: { select: { nama: true } },
      assignedL1: { select: { name: true } },
      timeline: {
        orderBy: { createdAt: "desc" },
        select: { id: true, statusBaru: true, actorType: true, catatan: true, createdAt: true },
      },
    },
  });
}
