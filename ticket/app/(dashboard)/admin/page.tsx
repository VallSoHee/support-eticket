import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { getAdminOverview, getDashboardStats } from "@/lib/admin/queries";
import { STATUS_BADGE, STATUS_LABEL, TICKET_STATUSES, formatMinutes } from "@/lib/admin/constants";
import { Badge, EmptyRow, TableShell, Th } from "@/components/admin/ui";
import { StatCard } from "@/components/dashboard/StatCard";

export default async function AdminDashboardPage() {
  const user = await requireRole("ADMIN");
  const [stats, overview] = await Promise.all([getDashboardStats(), getAdminOverview()]);

  const onlineL1 = overview.petugas.filter((p) => p.role === "PETUGAS_L1" && p.isOnline && p.isActive).length;
  const onlineL2 = overview.petugas.filter((p) => p.role === "PETUGAS_L2" && p.isOnline && p.isActive).length;

  const accountRows = [
    { label: "Admin", desc: "Administrator accounts", total: stats.admin, detail: null, href: "/admin/admins" },
    { label: "Petugas", desc: "Support staff", total: stats.petugas, detail: `${stats.petugasL1} L1 · ${stats.petugasL2} L2`, href: "/admin/petugas" },
    { label: "Client", desc: "Client accounts", total: stats.client, detail: null, href: "/admin/clients" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-widest text-brand">Overview</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">Welcome back, {user.name.split(" ")[0]}</h2>
        <p className="mt-1 text-[14px] text-muted">Here&apos;s what&apos;s happening with your helpdesk today.</p>
      </div>

      <section className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total tickets" value={overview.total} hint={`${stats.ticketActive} still active`} />
          <StatCard label="Past SLA" value={overview.slaOverdue} hint="Active tickets over their target" />
          <StatCard label="Avg first response" value={formatMinutes(overview.timings.avgResponseMin)} hint={`${overview.timings.respondedCount} answered by L1`} />
          <StatCard label="Avg resolution" value={formatMinutes(overview.timings.avgResolveMin)} hint={`${overview.timings.resolvedCount} resolved`} />
          <StatCard label="Petugas online" value={onlineL1 + onlineL2} hint={`${onlineL1} L1 · ${onlineL2} L2`} />
        </div>

        <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-ink">Tickets by status</h3>
            <Link href="/admin/tickets" className="text-[13px] font-semibold text-brand hover:text-brand-dark">
              View all
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {TICKET_STATUSES.map((s) => (
              <Link
                key={s}
                href={`/admin/tickets?status=${s}`}
                className="flex min-w-[140px] flex-1 flex-col gap-2 rounded-2xl border border-line px-4 py-3 transition hover:border-brand"
              >
                <Badge className={STATUS_BADGE[s]}>{STATUS_LABEL[s]}</Badge>
                <span className="text-2xl font-extrabold text-ink">{overview.statusCount[s]}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold tracking-tight text-ink">Tickets per petugas</h3>
          <Link href="/admin/reports" className="text-[13px] font-semibold text-brand hover:text-brand-dark">
            Full report
          </Link>
        </div>
        <TableShell minWidth={620}>
          <thead>
            <tr className="border-b border-line">
              <Th>Petugas</Th>
              <Th>Level</Th>
              <Th>Presence</Th>
              <Th>Active tickets</Th>
              <Th>Handled in total</Th>
            </tr>
          </thead>
          <tbody>
            {overview.petugas.length === 0 && <EmptyRow colSpan={5}>No petugas yet.</EmptyRow>}
            {overview.petugas.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0 hover:bg-field/60">
                <td className="px-5 py-4 font-semibold text-ink">{p.name}</td>
                <td className="px-5 py-4 text-muted">{p.role === "PETUGAS_L1" ? "L1" : "L2"}</td>
                <td className="px-5 py-4">
                  {!p.isActive ? (
                    <Badge className="bg-field text-muted">Inactive</Badge>
                  ) : p.isOnline ? (
                    <Badge className="bg-emerald-50 text-emerald-700">Online</Badge>
                  ) : (
                    <Badge className="bg-field text-muted">Offline</Badge>
                  )}
                </td>
                <td className="px-5 py-4 text-xl font-extrabold text-ink">{p.active}</td>
                <td className="px-5 py-4 text-muted">{p.handled}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-extrabold tracking-tight text-ink">Accounts</h3>
        <div className="overflow-x-auto rounded-3xl border border-line bg-white shadow-sm">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
                <th className="px-5 py-3.5 font-semibold">Category</th>
                <th className="px-5 py-3.5 font-semibold">Total</th>
                <th className="px-5 py-3.5 font-semibold">Detail</th>
                <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accountRows.map((r) => (
                <tr key={r.label} className="border-b border-line last:border-0 hover:bg-field/60">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-ink">{r.label}</p>
                    <p className="text-[12px] text-muted">{r.desc}</p>
                  </td>
                  <td className="px-5 py-4 text-xl font-extrabold text-ink">{r.total}</td>
                  <td className="px-5 py-4 text-muted">{r.detail ?? "—"}</td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={r.href}
                      className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:border-brand hover:text-brand"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
