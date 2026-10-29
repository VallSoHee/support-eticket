import type { Prisma } from "@/generated/prisma/client";
import type { Priority, TicketStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { PRIORITIES, TICKET_STATUSES } from "@/lib/admin/constants";

// ---------------------------------------------------------------------------
// Filter tiket bersama — dipakai halaman Tickets, Reports, dan export CSV
// supaya angka di layar & di file CSV selalu memakai definisi filter yang sama.
// ---------------------------------------------------------------------------

export type TicketFilters = {
  q?: string;
  status?: string;
  priority?: string;
  categoryId?: string;
  level?: string; // "L1" | "L2" -> pernah ditangani level tsb
  petugasId?: string;
  from?: string; // YYYY-MM-DD (WIB)
  to?: string;
};

const isStatus = (v?: string): v is TicketStatus => !!v && (TICKET_STATUSES as readonly string[]).includes(v);
const isPriority = (v?: string): v is Priority => !!v && (PRIORITIES as readonly string[]).includes(v);
const isDate = (v?: string): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function buildTicketWhere(f: TicketFilters): Prisma.TicketWhereInput {
  const and: Prisma.TicketWhereInput[] = [];

  const q = f.q?.trim();
  if (q) {
    and.push({
      OR: [
        { judul: { contains: q } },
        { client: { name: { contains: q } } },
        { client: { email: { contains: q } } },
      ],
    });
  }
  if (isStatus(f.status)) and.push({ status: f.status });
  if (isPriority(f.priority)) and.push({ priority: f.priority });
  if (f.categoryId) and.push({ categoryId: f.categoryId });
  if (f.level === "L1") and.push({ assignedL1Id: { not: null } });
  if (f.level === "L2") and.push({ assignedL2Id: { not: null } });
  if (f.petugasId) and.push({ OR: [{ assignedL1Id: f.petugasId }, { assignedL2Id: f.petugasId }] });

  // Rentang tanggal dibaca sebagai hari kalender WIB (UTC+7), bukan zona server.
  if (isDate(f.from)) and.push({ createdAt: { gte: new Date(`${f.from}T00:00:00+07:00`) } });
  if (isDate(f.to)) and.push({ createdAt: { lte: new Date(`${f.to}T23:59:59.999+07:00`) } });

  return and.length ? { AND: and } : {};
}

// ---------------------------------------------------------------------------
// Waktu respon & penyelesaian
// ---------------------------------------------------------------------------

/**
 * Waktu respon pertama = selisih tiket dibuat -> balasan PUBLIK pertama dari Petugas L1
 * (bukan bot: bot membalas instan sehingga tidak mencerminkan kinerja petugas).
 * Internal note tidak dihitung karena tidak terlihat client.
 */
export async function firstAgentReplyMap(ticketIds: string[]): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  if (ticketIds.length === 0) return out;

  const grouped = await prisma.message.groupBy({
    by: ["chatSessionId"],
    where: {
      senderType: "PETUGAS_L1",
      isInternalNote: false,
      chatSession: { type: "PUBLIC", ticketId: { in: ticketIds } },
    },
    _min: { createdAt: true },
  });
  if (grouped.length === 0) return out;

  const sessions = await prisma.chatSession.findMany({
    where: { id: { in: grouped.map((g) => g.chatSessionId) } },
    select: { id: true, ticketId: true },
  });
  const ticketOf = new Map(sessions.map((s) => [s.id, s.ticketId]));
  for (const g of grouped) {
    const tid = ticketOf.get(g.chatSessionId);
    if (tid && g._min.createdAt) out.set(tid, g._min.createdAt);
  }
  return out;
}

const minutesBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000;

export type Timings = {
  avgResponseMin: number | null;
  avgResolveMin: number | null;
  respondedCount: number;
  resolvedCount: number;
};

export async function computeTimings(where: Prisma.TicketWhereInput): Promise<Timings> {
  const tickets = await prisma.ticket.findMany({ where, select: { id: true, createdAt: true, resolvedAt: true } });
  const replies = await firstAgentReplyMap(tickets.map((t) => t.id));

  let respSum = 0;
  let respN = 0;
  let resSum = 0;
  let resN = 0;
  for (const t of tickets) {
    const r = replies.get(t.id);
    if (r) {
      respSum += minutesBetween(t.createdAt, r);
      respN++;
    }
    if (t.resolvedAt) {
      resSum += minutesBetween(t.createdAt, t.resolvedAt);
      resN++;
    }
  }
  return {
    avgResponseMin: respN ? respSum / respN : null,
    avgResolveMin: resN ? resSum / resN : null,
    respondedCount: respN,
    resolvedCount: resN,
  };
}

export type SlaTargets = Record<Priority, { respon: number; selesai: number } | undefined>;

export async function getSlaTargets(): Promise<SlaTargets> {
  const rows = await prisma.slaConfig.findMany();
  const map = {} as SlaTargets;
  for (const r of rows) map[r.priority] = { respon: r.targetResponMenit, selesai: r.targetSelesaiMenit };
  return map;
}

/**
 * Status SLA satu tiket: "ok" | "breached" | "n/a".
 * "n/a" bila priority-nya belum punya target SLA, atau tiket tidak pernah sampai ke petugas
 * (selesai di level bot) — SLA hanya mengukur kinerja petugas.
 */
export function slaVerdict(
  t: { priority: Priority; createdAt: Date; resolvedAt: Date | null; assignedL1Id: string | null },
  firstReply: Date | undefined,
  targets: SlaTargets,
  now = new Date(),
) {
  const target = targets[t.priority];
  if (!target || !t.assignedL1Id) return { response: "n/a" as const, resolution: "n/a" as const };
  const respEnd = firstReply ?? now;
  const resEnd = t.resolvedAt ?? now;
  return {
    response: minutesBetween(t.createdAt, respEnd) > target.respon ? ("breached" as const) : ("ok" as const),
    resolution: minutesBetween(t.createdAt, resEnd) > target.selesai ? ("breached" as const) : ("ok" as const),
  };
}
