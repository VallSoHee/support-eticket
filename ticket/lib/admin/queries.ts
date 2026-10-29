import { prisma } from "@/lib/prisma";
import { ACTIVE_STATUSES, TICKET_STATUSES } from "@/lib/admin/constants";
import { computeTimings, firstAgentReplyMap, getSlaTargets, slaVerdict } from "@/lib/admin/metrics";

export async function getDashboardStats() {
  const [admin, petugasL1, petugasL2, client, ticketActive, ticketTotal] = await Promise.all([
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { role: "PETUGAS_L1" } }),
    prisma.user.count({ where: { role: "PETUGAS_L2" } }),
    prisma.user.count({ where: { role: "CLIENT" } }),
    prisma.ticket.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.ticket.count(),
  ]);

  return {
    admin,
    petugas: petugasL1 + petugasL2,
    petugasL1,
    petugasL2,
    client,
    ticketActive,
    ticketTotal,
  };
}

// ---------------------------------------------------------------------------
// Dashboard Admin (FR-7.1)
// ---------------------------------------------------------------------------

export async function getAdminOverview() {
  const [byStatus, timings, petugas, activeTickets, slaTargets] = await Promise.all([
    prisma.ticket.groupBy({ by: ["status"], _count: { _all: true } }),
    computeTimings({}),
    prisma.user.findMany({
      where: { role: { in: ["PETUGAS_L1", "PETUGAS_L2"] } },
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
        isOnline: true,
        _count: { select: { ticketsAsL1: true, ticketsAsL2: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.ticket.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
      select: { id: true, priority: true, createdAt: true, resolvedAt: true, assignedL1Id: true },
    }),
    getSlaTargets(),
  ]);

  const statusCount = Object.fromEntries(TICKET_STATUSES.map((s) => [s, 0])) as Record<(typeof TICKET_STATUSES)[number], number>;
  for (const row of byStatus) statusCount[row.status] = row._count._all;

  // Tiket aktif per petugas (beban kerja sekarang) — beda dengan total yang pernah ditangani.
  const activeByPetugas = await prisma.ticket.groupBy({
    by: ["assignedL1Id"],
    where: { status: { in: ACTIVE_STATUSES }, assignedL1Id: { not: null } },
    _count: { _all: true },
  });
  const activeByPetugasL2 = await prisma.ticket.groupBy({
    by: ["assignedL2Id"],
    where: { status: { in: ACTIVE_STATUSES }, assignedL2Id: { not: null } },
    _count: { _all: true },
  });
  const activeMap = new Map<string, number>();
  for (const r of activeByPetugas) if (r.assignedL1Id) activeMap.set(r.assignedL1Id, (activeMap.get(r.assignedL1Id) ?? 0) + r._count._all);
  for (const r of activeByPetugasL2) if (r.assignedL2Id) activeMap.set(r.assignedL2Id, (activeMap.get(r.assignedL2Id) ?? 0) + r._count._all);

  // Tiket aktif yang sudah melewati target penyelesaian SLA.
  const replies = await firstAgentReplyMap(activeTickets.map((t) => t.id));
  const slaOverdue = activeTickets.filter((t) => {
    const v = slaVerdict(t, replies.get(t.id), slaTargets);
    return v.resolution === "breached" || v.response === "breached";
  }).length;

  return {
    total: Object.values(statusCount).reduce((a, b) => a + b, 0),
    statusCount,
    timings,
    slaOverdue,
    petugas: petugas.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      isActive: p.isActive,
      isOnline: p.isOnline,
      active: activeMap.get(p.id) ?? 0,
      handled: p.role === "PETUGAS_L1" ? p._count.ticketsAsL1 : p._count.ticketsAsL2,
    })),
  };
}
