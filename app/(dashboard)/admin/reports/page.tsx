import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, TICKET_STATUSES, formatMinutes } from "@/lib/admin/constants";
import { getReportRows, summarize } from "@/lib/admin/report";
import { EmptyRow, FilterBar, FilterInput, FilterSelect, PageHeader, TableShell, Th, primaryBtn } from "@/components/admin/ui";
import { StatCard } from "@/components/dashboard/StatCard";

type SP = { from?: string; to?: string; categoryId?: string; level?: string; priority?: string; status?: string };

// FR-7.3 / FR-7.4 — laporan dengan filter tanggal, kategori, level, priority + export CSV.
export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;

  const [categories, { rows, truncated }] = await Promise.all([
    prisma.category.findMany({ orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
    getReportRows(sp),
  ]);
  const s = summarize(rows);

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) qs.set(k, v);
  const exportHref = `/api/admin/reports/export${qs.size ? `?${qs.toString()}` : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Ticket volume, response times, and petugas performance for the selected period."
        action={
          <a href={exportHref} className={primaryBtn}>
            Export CSV
          </a>
        }
      />

      <FilterBar resetHref="/admin/reports">
        <FilterInput label="From" name="from" type="date" value={sp.from} />
        <FilterInput label="To" name="to" type="date" value={sp.to} />
        <FilterSelect label="Category" name="categoryId" value={sp.categoryId} options={categories.map((c) => ({ value: c.id, label: c.nama }))} />
        <FilterSelect
          label="Handled by"
          name="level"
          value={sp.level}
          options={[
            { value: "L1", label: "Level 1" },
            { value: "L2", label: "Level 2" },
          ]}
        />
        <FilterSelect label="Priority" name="priority" value={sp.priority} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
        <FilterSelect label="Status" name="status" value={sp.status} options={TICKET_STATUSES.map((t) => ({ value: t, label: STATUS_LABEL[t] }))} />
      </FilterBar>

      {truncated && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-700">
          Too many tickets match — figures below cover only the 5,000 most recent. Narrow the date range for exact numbers.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tickets" value={s.total} hint={`${s.resolved} resolved`} />
        <StatCard label="Avg first response" value={formatMinutes(s.avgResponseMin)} hint="Creation to first petugas reply" />
        <StatCard label="Avg resolution" value={formatMinutes(s.avgResolveMin)} hint="Creation to resolved" />
        <StatCard
          label="SLA met"
          value={s.slaResponsePct == null ? "—" : `${s.slaResponsePct}%`}
          hint={s.slaResolutionPct == null ? "No tickets handled by petugas" : `response · ${s.slaResolutionPct}% resolution`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Breakdown title="By status" entries={TICKET_STATUSES.map((t) => [STATUS_LABEL[t], s.byStatus.get(t) ?? 0] as const)} total={s.total} />
        <Breakdown title="By priority" entries={PRIORITIES.map((p) => [PRIORITY_LABEL[p], s.byPriority.get(p) ?? 0] as const)} total={s.total} />
        <Breakdown
          title="By category"
          entries={[...s.byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)}
          total={s.total}
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-extrabold tracking-tight text-ink">Petugas performance</h3>
        <TableShell minWidth={560}>
          <thead>
            <tr className="border-b border-line">
              <Th>Petugas</Th>
              <Th>Level</Th>
              <Th>Tickets handled</Th>
              <Th>Resolved</Th>
              <Th>Avg resolution</Th>
            </tr>
          </thead>
          <tbody>
            {s.perPetugas.length === 0 && <EmptyRow colSpan={5}>No petugas activity in this selection.</EmptyRow>}
            {s.perPetugas.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0 hover:bg-field/60">
                <td className="px-5 py-4 font-semibold text-ink">{p.name}</td>
                <td className="px-5 py-4 text-muted">{p.level}</td>
                <td className="px-5 py-4 text-ink">{p.total}</td>
                <td className="px-5 py-4 text-ink">{p.resolved}</td>
                <td className="px-5 py-4 text-muted">{formatMinutes(p.avgResolveMin)}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </div>
    </div>
  );
}

function Breakdown({ title, entries, total }: { title: string; entries: readonly (readonly [string, number])[]; total: number }) {
  return (
    <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
      <h3 className="text-[14px] font-bold text-ink">{title}</h3>
      {entries.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">No data.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {entries.map(([label, n]) => (
            <li key={label}>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-ink">{label}</span>
                <span className="font-semibold text-ink">{n}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-field">
                <div className="h-full rounded-full bg-brand" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
