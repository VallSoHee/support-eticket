import Link from "next/link";
import type { CurrentUser } from "@/lib/auth/guards";
import { PRIORITIES, PRIORITY_LABEL } from "@/lib/admin/constants";
import { timeAgo } from "@/lib/client/format";
import { getStaffCounts, getStaffTickets, parseStaffView, type StaffView } from "@/lib/staff/queries";
import { STAFF_LEVEL, type StaffLevel } from "@/lib/staff/rules";
import { EmptyRow, PageHeader, Pagination, TableShell, Th, inputClass, parsePage, primaryBtn } from "@/components/admin/ui";
import { OverdueChip, PriorityBadge, StatusBadge } from "@/components/staff/TicketBits";
import { AutoRefresh } from "@/components/staff/AutoRefresh";

type SP = { view?: string; q?: string; priority?: string; page?: string };

const EMPTY: Record<StaffView, string> = {
  queue: "The queue is empty.",
  mine: "You have no active tickets.",
  done: "You haven't resolved any tickets yet.",
  all: "No tickets yet.",
};

export async function StaffTicketsPage({ level, user, sp }: { level: StaffLevel; user: CurrentUser; sp: SP }) {
  const cfg = STAFF_LEVEL[level];
  const view = parseStaffView(sp.view);
  const q = sp.q?.trim() || undefined;
  const priority = sp.priority || undefined;
  const page = parsePage(sp.page);

  const [counts, { total, totalPages, tickets }] = await Promise.all([
    getStaffCounts(level, user.id),
    getStaffTickets(level, user.id, { view, q, priority, page }),
  ]);

  const tabs: { view: StaffView; label: string; count: number }[] = [
    { view: "queue", label: "Queue", count: counts.queue },
    { view: "mine", label: "My tickets", count: counts.mine },
    { view: "done", label: "Resolved", count: counts.done },
    { view: "all", label: "All", count: counts.all },
  ];

  const tabHref = (v: StaffView) => {
    const p = new URLSearchParams();
    p.set("view", v);
    if (q) p.set("q", q);
    if (priority) p.set("priority", priority);
    return `${cfg.base}/tickets?${p.toString()}`;
  };

  const filtered = !!q || !!priority;

  return (
    <div className="space-y-5">
      <AutoRefresh />
      <PageHeader
        title="Tickets"
        description={
          level === "L1"
            ? "Take tickets from the queue, chat with clients, and escalate to L2 when needed."
            : "Tickets escalated by L1. Take one, work with L1 in internal notes, and resolve it."
        }
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <nav aria-label="Filter tickets" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-white p-1 shadow-sm">
          {tabs.map((t) => {
            const active = t.view === view;
            return (
              <Link
                key={t.view}
                href={tabHref(t.view)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold transition ${
                  active ? "bg-brand text-white shadow-[0_8px_18px_-8px_color-mix(in_srgb,var(--color-brand)_70%,transparent)]" : "text-muted hover:text-ink"
                }`}
              >
                {t.label}
                <span className={`text-[12px] ${active ? "text-white/80" : "text-muted"}`}>{t.count}</span>
              </Link>
            );
          })}
        </nav>

        <form method="get" className="flex flex-wrap gap-2">
          <input type="hidden" name="view" value={view} />
          <input
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder="Title, client name or email"
            aria-label="Search tickets"
            className={`${inputClass} md:w-64`}
          />
          <select name="priority" defaultValue={priority ?? ""} aria-label="Filter by priority" className={`${inputClass} md:w-40`}>
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
          <button type="submit" className={primaryBtn}>
            Search
          </button>
        </form>
      </div>

      <TableShell minWidth={860}>
        <thead>
          <tr className="border-b border-line">
            <Th>Ticket</Th>
            <Th>Client</Th>
            <Th>Priority</Th>
            <Th>Status</Th>
            <Th>{level === "L2" ? "Escalated by" : "Handled by"}</Th>
            <Th>Updated</Th>
          </tr>
        </thead>
        <tbody>
          {tickets.length === 0 && (
            <EmptyRow colSpan={6}>
              {filtered ? "No tickets match these filters." : EMPTY[view]}
              {filtered && (
                <>
                  {" "}
                  <Link href={`${cfg.base}/tickets?view=${view}`} className="font-semibold text-brand hover:text-brand-dark">
                    Clear filters
                  </Link>
                </>
              )}
            </EmptyRow>
          )}
          {tickets.map((t) => (
            <tr key={t.id} className="border-b border-line last:border-0 hover:bg-field/60">
              <td className="max-w-[300px] px-5 py-4">
                <Link href={`${cfg.base}/tickets/${t.id}`} className="line-clamp-2 font-semibold text-ink hover:text-brand">
                  {t.judul}
                </Link>
                <span className="mt-0.5 block text-[12px] text-muted">{t.category.nama}</span>
              </td>
              <td className="px-5 py-4 text-muted">{t.client.name}</td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <PriorityBadge priority={t.priority} />
                  {t.overdue && <OverdueChip />}
                </div>
              </td>
              <td className="px-5 py-4">
                <StatusBadge status={t.status} />
              </td>
              <td className="px-5 py-4 text-muted">
                {level === "L2" ? (t.assignedL1?.name ?? "—") : (t.assignedL1?.name ?? <span className="text-amber-700">Unassigned</span>)}
                {level === "L1" && t.assignedL2 && <span className="block text-[12px]">→ {t.assignedL2.name}</span>}
              </td>
              <td className="whitespace-nowrap px-5 py-4 text-muted">{timeAgo(t.lastActivity)}</td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      <Pagination page={page} totalPages={totalPages} total={total} basePath={`${cfg.base}/tickets`} params={{ view, q, priority }} />
    </div>
  );
}
