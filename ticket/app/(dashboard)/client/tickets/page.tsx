import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { getClientCounts, getClientTickets, parseView, type TicketView } from "@/lib/client/queries";
import { Pagination, inputClass, parsePage, primaryBtn } from "@/components/admin/ui";
import { TicketListHeader, TicketRow } from "@/components/client/TicketRow";
import { TicketTabs } from "@/components/client/TicketTabs";

type SP = { view?: string; q?: string; page?: string };

const card = "rounded-3xl border border-line bg-white shadow-sm";

function tabHref(view: TicketView, q?: string) {
  const sp = new URLSearchParams();
  if (view !== "all") sp.set("view", view);
  if (q) sp.set("q", q);
  const qs = sp.toString();
  return qs ? `/client/tickets?${qs}` : "/client/tickets";
}

export default async function ClientTicketsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireRole("CLIENT");
  const sp = await searchParams;
  const view = parseView(sp.view);
  const q = sp.q?.trim() || undefined;
  const page = parsePage(sp.page);

  const [counts, { total, totalPages, tickets }] = await Promise.all([
    getClientCounts(user.id),
    getClientTickets(user.id, { view, q, page }),
  ]);

  const tabs: { view: TicketView; label: string; count: number }[] = [
    { view: "all", label: "All", count: counts.total },
    { view: "active", label: "Active", count: counts.active },
    { view: "done", label: "Resolved", count: counts.done },
  ];

  return (
    <div className="tickets-root flex flex-1 flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-ink">My tickets</h2>
          <p className="mt-1 text-[14px] text-muted">Follow every request you&apos;ve sent to support.</p>
        </div>
        <Link href="/client/tickets/new" className={primaryBtn}>
          + Submit ticket
        </Link>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <TicketTabs view={view} tabs={tabs.map((t) => ({ ...t, href: tabHref(t.view, q) }))} />

        <form method="get" className="flex gap-2">
          {view !== "all" && <input type="hidden" name="view" value={view} />}
          <input
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder="Search by title"
            aria-label="Search tickets by title"
            className={`${inputClass} md:w-64`}
          />
          <button type="submit" className={primaryBtn}>
            Search
          </button>
        </form>
      </div>

      {/* key berubah => panel di-mount ulang => animasi masuk diputar tiap pindah tab/search/halaman */}
      <div className="ticket-list-wrap flex flex-1 flex-col">
      <div key={`${view}|${q ?? ""}|${page}`} className="ticket-panel-in flex flex-1 flex-col">
      {tickets.length === 0 ? (
        <div className={`${card} flex flex-1 flex-col items-center justify-center px-5 py-14 text-center`}>
          <p className="text-[15px] font-semibold text-ink">
            {q ? `No tickets match "${q}"` : view === "active" ? "No active tickets" : view === "done" ? "No resolved tickets yet" : "No tickets yet"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">
            {q || view !== "all"
              ? "Try another search or switch to All tickets."
              : "Tickets you open with support will appear here."}
          </p>
          {!q && view === "all" && (
            <div className="mt-5">
              <Link href="/client/tickets/new" className={primaryBtn}>
                Submit your first ticket
              </Link>
            </div>
          )}
          {(q || view !== "all") && (
            <div className="mt-5">
              <Link href="/client/tickets" className="text-[13px] font-semibold text-brand hover:text-brand-dark">
                Show all tickets
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className={`${card} flex flex-1 flex-col overflow-hidden`}>
          <TicketListHeader />
          <div className="divide-y divide-line">
            {tickets.map((t, i) => (
              <div key={t.id} className="ticket-row-in" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
                <TicketRow ticket={t} />
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} basePath="/client/tickets" params={{ view: sp.view, q }} />
    </div>
  );
}
