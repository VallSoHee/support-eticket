import Link from "next/link";
import type { CurrentUser } from "@/lib/auth/guards";
import { getStaffOverview } from "@/lib/staff/queries";
import { STAFF_LEVEL, type StaffLevel } from "@/lib/staff/rules";
import { TicketRowCard } from "@/components/staff/TicketRowCard";
import { AutoRefresh } from "@/components/staff/AutoRefresh";

function Stat({
  label,
  value,
  hint,
  alert = false,
}: {
  label: string;
  value: number;
  hint: string;
  /** Angka dibuat merah hanya kalau memang ada yang perlu perhatian. */
  alert?: boolean;
}) {
  return (
    <div className="bg-white px-6 py-5">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className={`mt-2 text-[32px] font-semibold leading-none tabular-nums ${alert && value > 0 ? "text-rose-600" : "text-ink"}`}>
        {value}
      </dd>
      <p className="mt-2 text-[12px] text-muted">{hint}</p>
    </div>
  );
}

function Panel({
  title,
  note,
  total,
  href,
  emptyTitle,
  emptyHint,
  children,
  shown,
}: {
  title: string;
  note?: string;
  total: number;
  href: string;
  emptyTitle: string;
  emptyHint: string;
  children: React.ReactNode;
  shown: number;
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex items-baseline justify-between gap-4 border-b border-line px-5 py-3.5">
        <div className="flex min-w-0 items-baseline gap-2">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          <span className="text-[13px] tabular-nums text-muted">{total}</span>
          {note && <span className="hidden truncate text-[12px] text-muted sm:inline">{note}</span>}
        </div>
        <Link href={href} className="shrink-0 text-[13px] font-medium text-muted transition-colors hover:text-brand">
          {total > shown ? `View all ${total}` : "View all"}
        </Link>
      </div>
      {shown === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-16 text-center">
          <p className="text-[14px] font-medium text-ink">{emptyTitle}</p>
          <p className="mt-1 text-[13px] text-muted">{emptyHint}</p>
        </div>
      ) : (
        <div className="flex-1 divide-y divide-line">{children}</div>
      )}
    </section>
  );
}

// Dashboard Petugas — dipakai L1 dan L2, beda hanya di definisi "antrean" (lihat viewWhere).
export async function StaffDashboard({ level, user }: { level: StaffLevel; user: CurrentUser }) {
  const cfg = STAFF_LEVEL[level];
  const o = await getStaffOverview(level, user.id);
  const l1 = level === "L1";

  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  return (
    <div className="flex flex-col gap-6 xl:min-h-[calc(100vh-10rem)]">
      <AutoRefresh />

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight text-ink">Hi, {user.name.split(" ")[0]}</h2>
          <p className="mt-1 text-[14px] text-muted">
            {o.counts.queue > 0
              ? `${o.counts.queue} ticket${o.counts.queue === 1 ? " is" : "s are"} waiting for ${l1 ? "an agent" : "the technical team"}.`
              : "The queue is clear right now."}
          </p>
        </div>
        <p className="text-[13px] text-muted">{today}</p>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        <Stat label="In queue" value={o.counts.queue} hint={l1 ? "Waiting for an L1 agent" : "Escalated, waiting for L2"} />
        <Stat label="My active tickets" value={o.counts.mine} hint={l1 ? `${o.escalated} escalated to L2` : "Assigned to you"} />
        <Stat label="Past SLA" value={o.overdue} hint="Active tickets over target" alert />
        <Stat label="Resolved today" value={o.resolvedToday} hint="Since midnight (WIB)" />
      </dl>

      <div className="grid flex-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          title="Queue"
          note="Highest priority first"
          total={o.counts.queue}
          shown={o.queue.length}
          href={`${cfg.base}/tickets?view=queue`}
          emptyTitle="Nothing is waiting"
          emptyHint="New tickets will show up here."
        >
          {o.queue.map((t) => (
            <TicketRowCard key={t.id} level={level} ticket={t} />
          ))}
        </Panel>

        <Panel
          title="My active tickets"
          total={o.counts.mine}
          shown={o.mine.length}
          href={`${cfg.base}/tickets?view=mine`}
          emptyTitle="No active tickets"
          emptyHint="Take one from the queue to get started."
        >
          {o.mine.map((t) => (
            <TicketRowCard key={t.id} level={level} ticket={t} />
          ))}
        </Panel>
      </div>
    </div>
  );
}
