import type { Prisma } from "@/generated/prisma/client";
import type { TicketStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { firstAgentReplyMap, getSlaTargets, slaVerdict } from "@/lib/admin/metrics";
import { isDone, type StaffLevel } from "@/lib/staff/rules";
import { channelWhere, messageSelect, toLiveMessage } from "@/lib/chat/message-map";

// Semua query Petugas WAJIB lewat viewWhere(): petugas hanya boleh melihat tiket di antrean
// levelnya atau tiket yang ditugaskan kepadanya (NFR-4). Tiket lain = "tidak ada" (404).

export const STAFF_PAGE_SIZE = 12;

export type StaffView = "queue" | "mine" | "done" | "all";
export const parseStaffView = (v?: string): StaffView => (v === "mine" || v === "done" || v === "all" ? v : "queue");

const DONE: TicketStatus[] = ["RESOLVED", "CLOSED"];
const QUEUE_STATUS = { L1: "WAITING_AGENT_L1", L2: "ESCALATED_L2" } as const;

export function viewWhere(level: StaffLevel, userId: string, view: StaffView): Prisma.TicketWhereInput {
  const owner: Prisma.TicketWhereInput = level === "L1" ? { assignedL1Id: userId } : { assignedL2Id: userId };
  const unowned: Prisma.TicketWhereInput = level === "L1" ? { assignedL1Id: null } : { assignedL2Id: null };

  const queue: Prisma.TicketWhereInput = { AND: [{ status: QUEUE_STATUS[level] }, unowned] };
  const mine: Prisma.TicketWhereInput = { AND: [owner, { status: { notIn: DONE } }] };
  const done: Prisma.TicketWhereInput = { AND: [owner, { status: { in: DONE } }] };

  switch (view) {
    case "queue":
      return queue;
    case "mine":
      return mine;
    case "done":
      return done;
    default:
      return { OR: [queue, owner] };
  }
}

const rowSelect = {
  id: true,
  judul: true,
  status: true,
  priority: true,
  createdAt: true,
  resolvedAt: true,
  assignedL1Id: true,
  client: { select: { name: true } },
  category: { select: { nama: true } },
  assignedL1: { select: { name: true } },
  assignedL2: { select: { name: true } },
  // Ticket tidak punya updatedAt -> "terakhir berubah" = entri timeline terbaru.
  timeline: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
} satisfies Prisma.TicketSelect;

type RawRow = Prisma.TicketGetPayload<{ select: typeof rowSelect }>;

async function decorate(rows: RawRow[]) {
  const [targets, replies] = await Promise.all([getSlaTargets(), firstAgentReplyMap(rows.map((r) => r.id))]);
  return rows.map(({ timeline, ...t }) => {
    const v = slaVerdict(
      { priority: t.priority, createdAt: t.createdAt, resolvedAt: t.resolvedAt, assignedL1Id: t.assignedL1Id },
      replies.get(t.id),
      targets,
    );
    const overdue = !isDone(t.status) && (v.response === "breached" || v.resolution === "breached");
    return { ...t, lastActivity: timeline[0]?.createdAt ?? t.createdAt, overdue };
  });
}

export type StaffTicketItem = Awaited<ReturnType<typeof decorate>>[number];

export async function getStaffCounts(level: StaffLevel, userId: string) {
  const [queue, mine, done, all] = await Promise.all([
    prisma.ticket.count({ where: viewWhere(level, userId, "queue") }),
    prisma.ticket.count({ where: viewWhere(level, userId, "mine") }),
    prisma.ticket.count({ where: viewWhere(level, userId, "done") }),
    prisma.ticket.count({ where: viewWhere(level, userId, "all") }),
  ]);
  return { queue, mine, done, all };
}

// Awal hari ini menurut WIB (UTC+7), bukan zona server.
function startOfTodayWib() {
  const wib = new Date(Date.now() + 7 * 3_600_000);
  wib.setUTCHours(0, 0, 0, 0);
  return new Date(wib.getTime() - 7 * 3_600_000);
}

export async function getStaffOverview(level: StaffLevel, userId: string) {
  const ownerWhere: Prisma.TicketWhereInput = level === "L1" ? { assignedL1Id: userId } : { assignedL2Id: userId };

  const [counts, resolvedToday, escalated, queueRows, mineRows] = await Promise.all([
    getStaffCounts(level, userId),
    prisma.ticket.count({
      where: {
        AND: [
          ownerWhere,
          { status: { in: DONE } },
          { resolvedAt: { gte: startOfTodayWib() } },
          // L1 hanya dihitung untuk tiket yang ia selesaikan sendiri, bukan yang diselesaikan L2.
          ...(level === "L1" ? [{ assignedL2Id: null }] : []),
        ],
      },
    }),
    level === "L1"
      ? prisma.ticket.count({ where: { assignedL1Id: userId, status: { in: ["ESCALATED_L2", "IN_PROGRESS_L2"] } } })
      : Promise.resolve(0),
    // Antrean: prioritas tertinggi dulu, lalu yang paling lama menunggu.
    prisma.ticket.findMany({
      where: viewWhere(level, userId, "queue"),
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 5,
      select: rowSelect,
    }),
    prisma.ticket.findMany({
      where: viewWhere(level, userId, "mine"),
      orderBy: { createdAt: "desc" },
      take: 100,
      select: rowSelect,
    }),
  ]);

  const [queue, mine] = await Promise.all([decorate(queueRows), decorate(mineRows)]);

  return {
    counts,
    resolvedToday,
    escalated,
    overdue: mine.filter((t) => t.overdue).length,
    queue,
    mine: mine.slice(0, 5),
  };
}

export async function getStaffTickets(
  level: StaffLevel,
  userId: string,
  opts: { view: StaffView; q?: string; priority?: string; page: number },
) {
  const q = opts.q?.trim();
  const priority = (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).find((p) => p === opts.priority);

  const where: Prisma.TicketWhereInput = {
    AND: [
      viewWhere(level, userId, opts.view),
      ...(priority ? [{ priority }] : []),
      ...(q
        ? [{ OR: [{ judul: { contains: q } }, { client: { name: { contains: q } } }, { client: { email: { contains: q } } }] }]
        : []),
    ],
  };

  const [total, rows] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      // Antrean: yang paling lama menunggu di atas. Tampilan lain: terbaru di atas.
      orderBy: opts.view === "queue" ? [{ priority: "desc" }, { createdAt: "asc" }] : { createdAt: "desc" },
      skip: (opts.page - 1) * STAFF_PAGE_SIZE,
      take: STAFF_PAGE_SIZE,
      select: rowSelect,
    }),
  ]);

  return { total, totalPages: Math.max(1, Math.ceil(total / STAFF_PAGE_SIZE)), tickets: await decorate(rows) };
}

/** null bila tiket tidak ada ATAU di luar jangkauan petugas ini (sengaja tidak dibedakan). */
export async function getStaffTicket(level: StaffLevel, userId: string, id: string) {
  const ticket = await prisma.ticket.findFirst({
    where: { AND: [{ id }, viewWhere(level, userId, "all")] },
    include: {
      client: { select: { name: true, email: true } },
      category: { select: { nama: true } },
      assignedL1: { select: { name: true } },
      assignedL2: { select: { name: true } },
      timeline: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
      chatSessions: { select: { type: true } },
    },
  });
  if (!ticket) return null;

  // Ambil 300 pesan TERBARU (desc) lalu dibalik, supaya percakapan panjang tidak memotong ujungnya.
  const [rows, targets, replies] = await Promise.all([
    prisma.message.findMany({
      // L2 tidak punya Public chat: pesan Public tidak pernah dikirim ke browser L2.
      // "Hapus untuk saya" (message_hides) ikut dihormati, sama seperti chat client.
      where: { ...channelWhere(id, { kind: "staff", userId, level }), hides: { none: { userId } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 300,
      select: messageSelect,
    }),
    getSlaTargets(),
    firstAgentReplyMap([id]),
  ]);
  rows.reverse();

  // Catatan internal = sesi INTERNAL, ATAU pesan bertanda isInternalNote di sesi PUBLIC
  // (representasi lama FR-4.8). Yang terakhir tidak boleh bocor ke tab Public chat.
  const messages = rows.map(toLiveMessage);

  const firstReply = replies.get(id);
  return {
    ticket,
    publicMessages: messages.filter((m) => !m.internal),
    internalMessages: messages.filter((m) => m.internal),
    hasInternalSession: ticket.chatSessions.some((s) => s.type === "INTERNAL"),
    sla: {
      target: targets[ticket.priority],
      firstReply,
      verdict: slaVerdict(ticket, firstReply, targets),
    },
  };
}

