import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { PRIORITY_BADGE, PRIORITY_LABEL, STATUS_BADGE } from "@/lib/admin/constants";
import { getClientOverview } from "@/lib/client/queries";
import { CLIENT_STATUS_LABEL, STATUS_NOTE } from "@/lib/client/stages";
import { timeAgo } from "@/lib/client/format";
import { Badge, dateFmt, primaryBtn } from "@/components/admin/ui";
import { TicketListHeader, TicketRow } from "@/components/client/TicketRow";
import { TicketTrack } from "@/components/client/TicketTrack";

const card = "rounded-3xl border border-line bg-white shadow-sm";

function StatCard({
  label,
  hint,
  value,
  href,
  dot,
}: {
  label: string;
  hint: string;
  value: number;
  href: string;
  dot: string;
}) {
  return (
    <Link
      href={href}
      className={`${card} group flex items-center justify-between gap-4 px-6 py-5 transition hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${dot}`} />
          {label}
        </p>
        <p className="mt-1 truncate text-[12px] text-muted transition group-hover:text-ink">{hint}</p>
      </div>
      <span className="text-4xl font-extrabold tracking-tight text-ink">{value}</span>
    </Link>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 truncate text-[14px] font-semibold text-ink">{children}</p>
    </div>
  );
}

export default async function ClientDashboardPage() {
  const user = await requireRole("CLIENT");
  const o = await getClientOverview(user.id);
  const firstName = user.name.trim().split(/\s+/)[0];

  const headline =
    o.total === 0
      ? "You haven't opened a ticket yet."
      : o.active === 0
        ? "All your tickets are resolved."
        : o.active === 1
          ? "You have 1 active ticket."
          : `You have ${o.active} active tickets.`;

  const latest = o.latest;

  return (
    // flex-1: halaman mengisi sisa tinggi layar; daftar tiket terbaru di bawah ikut melebar ke dasar.
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-ink">Hi, {firstName}</h2>
          <p className="mt-1.5 text-[16px] text-muted">{headline}</p>
        </div>
        <Link href="/client/tickets/new" className={primaryBtn}>
          + Submit ticket
        </Link>
      </div>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {latest ? (
          <div className={`${card} flex flex-col p-6 md:p-10`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[13px] font-semibold text-muted">Latest active ticket</span>
              <Badge className={STATUS_BADGE[latest.status]}>{CLIENT_STATUS_LABEL[latest.status]}</Badge>
              <Badge className={PRIORITY_BADGE[latest.priority]}>{PRIORITY_LABEL[latest.priority]}</Badge>
            </div>

            <h3 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-ink">{latest.judul}</h3>
            <p className="mt-2 text-[15px] text-muted">{STATUS_NOTE[latest.status]}</p>

            <div className="mx-auto mt-10 w-full max-w-3xl">
              <TicketTrack status={latest.status} />
            </div>

            <div className="mt-10 grid grid-cols-2 gap-5 border-t border-line pt-6 md:grid-cols-4">
              <Fact label="Category">{latest.category.nama}</Fact>
              <Fact label="Opened">{dateFmt(latest.createdAt)}</Fact>
              <Fact label="Handled by">{latest.assignedL1?.name ?? <span className="font-normal text-muted">Not assigned yet</span>}</Fact>
              <Fact label="Last update">{timeAgo(latest.lastActivity)}</Fact>
            </div>

            <div className="mt-6 flex justify-end">
              <Link href={`/client/tickets/${latest.id}`} className={primaryBtn}>
                View ticket
              </Link>
            </div>
          </div>
        ) : (
          <div className={`${card} flex flex-col justify-center p-6 md:p-10`}>
            <h3 className="text-2xl font-extrabold tracking-tight text-ink">
              {o.total === 0 ? "No tickets yet" : "Nothing needs attention"}
            </h3>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted">
              {o.total === 0
                ? "When you contact support, your ticket appears here and you can follow it from first reply to resolution."
                : "Every ticket you've opened has been resolved. Past tickets stay in My tickets."}
            </p>
            <div className="mt-5">
              <Link href={o.total === 0 ? "/client/tickets/new" : "/client/tickets"} className={primaryBtn}>
                {o.total === 0 ? "Submit your first ticket" : "See past tickets"}
              </Link>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1 xl:grid-rows-3">
          <StatCard label="Active" hint="Waiting or being handled" value={o.active} href="/client/tickets?view=active" dot="bg-brand" />
          <StatCard label="Resolved" hint="Completed requests" value={o.done} href="/client/tickets?view=done" dot="bg-emerald-500" />
          <StatCard label="All time" hint="Every request you've sent" value={o.total} href="/client/tickets" dot="bg-muted" />
        </div>
      </section>

      <section className="flex flex-1 flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-extrabold tracking-tight text-ink">Recent tickets</h3>
          {o.total > 0 && (
            <Link href="/client/tickets" className="text-[13px] font-semibold text-brand hover:text-brand-dark">
              View all
            </Link>
          )}
        </div>

        {o.recent.length === 0 ? (
          <div className={`${card} flex flex-1 items-center justify-center px-5 py-10 text-center text-[14px] text-muted`}>
            Your tickets will show up here.
          </div>
        ) : (
          <div className={`${card} flex flex-1 flex-col overflow-hidden`}>
            <TicketListHeader />
            <div className="divide-y divide-line">
              {o.recent.map((t) => (
                <TicketRow key={t.id} ticket={t} />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
