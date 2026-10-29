import { prisma } from "@/lib/prisma";
import { buildTicketWhere, firstAgentReplyMap, getSlaTargets, slaVerdict, type TicketFilters } from "@/lib/admin/metrics";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/admin/constants";

// FR-7.3 / FR-7.4 — satu sumber data untuk halaman Reports dan export CSV,
// supaya angka di layar selalu sama dengan isi file.

export type ReportRow = {
  id: string;
  judul: string;
  clientName: string;
  clientEmail: string;
  category: string;
  priority: keyof typeof PRIORITY_LABEL;
  status: keyof typeof STATUS_LABEL;
  l1Id: string | null;
  l1Name: string | null;
  l2Id: string | null;
  l2Name: string | null;
  createdAt: Date;
  firstReplyAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  responseMin: number | null;
  resolveMin: number | null;
  slaResponse: "ok" | "breached" | "n/a";
  slaResolution: "ok" | "breached" | "n/a";
};

const MAX_ROWS = 5000; // pagar pengaman agar export tidak menghabiskan memori

export async function getReportRows(filters: TicketFilters): Promise<{ rows: ReportRow[]; truncated: boolean }> {
  const where = buildTicketWhere(filters);
  const [tickets, targets] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS + 1,
      include: {
        client: { select: { name: true, email: true } },
        category: { select: { nama: true } },
        assignedL1: { select: { name: true } },
        assignedL2: { select: { name: true } },
      },
    }),
    getSlaTargets(),
  ]);

  const truncated = tickets.length > MAX_ROWS;
  const slice = truncated ? tickets.slice(0, MAX_ROWS) : tickets;
  const replies = await firstAgentReplyMap(slice.map((t) => t.id));
  const now = new Date();
  const mins = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60_000);

  const rows: ReportRow[] = slice.map((t) => {
    const reply = replies.get(t.id) ?? null;
    const verdict = slaVerdict(t, reply ?? undefined, targets, now);
    return {
      id: t.id,
      judul: t.judul,
      clientName: t.client.name,
      clientEmail: t.client.email,
      category: t.category.nama,
      priority: t.priority,
      status: t.status,
      l1Id: t.assignedL1Id,
      l1Name: t.assignedL1?.name ?? null,
      l2Id: t.assignedL2Id,
      l2Name: t.assignedL2?.name ?? null,
      createdAt: t.createdAt,
      firstReplyAt: reply,
      resolvedAt: t.resolvedAt,
      closedAt: t.closedAt,
      responseMin: reply ? mins(t.createdAt, reply) : null,
      resolveMin: t.resolvedAt ? mins(t.createdAt, t.resolvedAt) : null,
      slaResponse: verdict.response,
      slaResolution: verdict.resolution,
    };
  });
  return { rows, truncated };
}

export function summarize(rows: ReportRow[]) {
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const pct = (ok: number, n: number) => (n ? Math.round((ok / n) * 100) : null);

  const resp = rows.filter((r) => r.responseMin != null).map((r) => r.responseMin as number);
  const res = rows.filter((r) => r.resolveMin != null).map((r) => r.resolveMin as number);
  const respJudged = rows.filter((r) => r.slaResponse !== "n/a");
  const resJudged = rows.filter((r) => r.slaResolution !== "n/a");

  // Per petugas: tiket yang pernah ditangani (sebagai L1 atau L2).
  const perPetugas = new Map<string, { name: string; level: "L1" | "L2"; total: number; resolved: number; resolveMins: number[] }>();
  const bump = (id: string | null, name: string | null, level: "L1" | "L2", r: ReportRow) => {
    if (!id || !name) return;
    const e = perPetugas.get(id) ?? { name, level, total: 0, resolved: 0, resolveMins: [] };
    e.total++;
    if (r.resolvedAt) {
      e.resolved++;
      if (r.resolveMin != null) e.resolveMins.push(r.resolveMin);
    }
    perPetugas.set(id, e);
  };
  for (const r of rows) {
    bump(r.l1Id, r.l1Name, "L1", r);
    bump(r.l2Id, r.l2Name, "L2", r);
  }

  const countBy = <K extends string>(key: (r: ReportRow) => K) => {
    const m = new Map<K, number>();
    for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return m;
  };

  return {
    total: rows.length,
    resolved: rows.filter((r) => r.resolvedAt).length,
    avgResponseMin: avg(resp),
    avgResolveMin: avg(res),
    slaResponsePct: pct(respJudged.filter((r) => r.slaResponse === "ok").length, respJudged.length),
    slaResolutionPct: pct(resJudged.filter((r) => r.slaResolution === "ok").length, resJudged.length),
    byStatus: countBy((r) => r.status),
    byPriority: countBy((r) => r.priority),
    byCategory: countBy((r) => r.category),
    perPetugas: [...perPetugas.entries()]
      .map(([id, e]) => ({ id, name: e.name, level: e.level, total: e.total, resolved: e.resolved, avgResolveMin: avg(e.resolveMins) }))
      .sort((a, b) => b.total - a.total),
  };
}

// ---- CSV ----
// Sel yang diawali = + - @ dianggap formula oleh Excel/Sheets (CSV injection) -> diberi tanda kutip.
function csvCell(v: string | number | null | undefined): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const iso = (d: Date | null) => (d ? d.toISOString() : "");

export function rowsToCsv(rows: ReportRow[]): string {
  const header = [
    "Ticket ID", "Title", "Client", "Client email", "Category", "Priority", "Status", "Petugas L1", "Petugas L2",
    "Created (UTC)", "First agent reply (UTC)", "Resolved (UTC)", "Closed (UTC)",
    "Response time (min)", "Resolution time (min)", "SLA response", "SLA resolution",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id, r.judul, r.clientName, r.clientEmail, r.category, PRIORITY_LABEL[r.priority], STATUS_LABEL[r.status],
        r.l1Name, r.l2Name, iso(r.createdAt), iso(r.firstReplyAt), iso(r.resolvedAt), iso(r.closedAt),
        r.responseMin, r.resolveMin, r.slaResponse, r.slaResolution,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  // BOM supaya Excel membaca UTF-8 dengan benar; CRLF sesuai RFC 4180.
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
