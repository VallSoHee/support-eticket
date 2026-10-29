import Link from "next/link";
import type { CurrentUser } from "@/lib/auth/guards";
import { getStaffOverview } from "@/lib/staff/queries";
import { STAFF_LEVEL, type StaffLevel } from "@/lib/staff/rules";
import { StatCard } from "@/components/dashboard/StatCard";
import { TicketRowCard } from "@/components/staff/TicketRowCard";
import { AutoRefresh } from "@/components/staff/AutoRefresh";

const card = "overflow-hidden rounded-3xl border border-line bg-white shadow-sm";

function Panel({
  title,
  description,
  href,
  hrefLabel,
  empty,
  children,
  count,
}: {
  title: string;
  description: string;
  href: string;
  hrefLabel: string;
  empty: string;
  children: React.ReactNode;
  count: number;
}) {
  return (
    <section className={card}>
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h3 className="text-[16px] font-extrabold tracking-tight text-ink">{title}</h3>
          <p className="mt-0.5 text-[12px] text-muted">{description}</p>
        </div>
        <Link href={href} className="shrink-0 text-[13px] font-semibold text-brand hover:text-brand-dark">
          {hrefLabel}
        </Link>
      </div>
      {count === 0 ? <p className="px-5 py-10 text-center text-[13px] text-muted">{empty}</p> : <div className="divide-y divide-line">{children}</div>}
    </section>
  );
}

// Dashboard Petugas — dipakai L1 dan L2, beda hanya di definisi "antrean" (lihat viewWhere).
export async function StaffDashboard({ level, user }: { level: StaffLevel; user: CurrentUser }) {
  const cfg = STAFF_LEVEL[level];
  const o = await getStaffOverview(level, user.id);
  const l1 = level === "L1";

  return (
    <div className="space-y-8">
      <AutoRefresh />
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-widest text-brand">
          {cfg.short} · {cfg.title}
        </p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">Hi, {user.name.split(" ")[0]}</h2>
        <p className="mt-1 text-[14px] text-muted">
          {o.counts.queue > 0
            ? `${o.counts.queue} ticket${o.counts.queue === 1 ? " is" : "s are"} waiting for ${l1 ? "an agent" : "the technical team"}.`
            : "The queue is clear right now."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="In queue" value={o.counts.queue} hint={l1 ? "Waiting for an L1 agent" : "Escalated, waiting for L2"} />
        <StatCard
          label="My active tickets"
          value={o.counts.mine}
          hint={l1 ? `${o.escalated} escalated to L2` : "Assigned to you"}
        />
        <StatCard label="Resolved today" value={o.resolvedToday} hint="Since midnight (WIB)" />
        <StatCard label="Past SLA" value={o.overdue} hint="Your active tickets over target" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Queue"
          description="Highest priority first, then longest waiting."
          href={`${cfg.base}/tickets?view=queue`}
          hrefLabel="View queue"
          empty="Nothing is waiting. Nice work."
          count={o.queue.length}
        >
          {o.queue.map((t) => (
            <TicketRowCard key={t.id} level={level} ticket={t} />
          ))}
        </Panel>

        <Panel
          title="My active tickets"
          description="Tickets you're handling right now."
          href={`${cfg.base}/tickets?view=mine`}
          hrefLabel="View all"
          empty="You have no active tickets. Take one from the queue."
          count={o.mine.length}
        >
          {o.mine.map((t) => (
            <TicketRowCard key={t.id} level={level} ticket={t} />
          ))}
        </Panel>
      </div>
    </div>
  );
}
