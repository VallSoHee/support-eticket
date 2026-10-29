import Link from "next/link";
import type { Priority, TicketStatus } from "@/generated/prisma/enums";
import { PRIORITY_BADGE, PRIORITY_LABEL, STATUS_BADGE } from "@/lib/admin/constants";
import { CLIENT_STATUS_LABEL } from "@/lib/client/stages";
import { timeAgo } from "@/lib/client/format";
import { Badge, dateFmt } from "@/components/admin/ui";

type Row = {
  id: string;
  judul: string;
  status: TicketStatus;
  priority?: Priority;
  createdAt: Date;
  lastActivity: Date;
  category: { nama: string };
  assignedL1?: { name: string } | null;
};

// Lebar kolom dipakai bersama oleh baris dan judul kolom supaya selalu sejajar.
const COL_PRIORITY = "hidden w-24 shrink-0 md:block";
const COL_AGENT = "hidden w-44 shrink-0 lg:block";
const COL_STATUS = "w-36 shrink-0 sm:w-44";

/** Judul kolom untuk daftar tiket (hanya tampil di layar sedang ke atas). */
export function TicketListHeader() {
  return (
    <div
      aria-hidden
      className="hidden items-center gap-4 border-b border-line bg-field/60 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted md:flex"
    >
      <span className="min-w-0 flex-1">Ticket</span>
      <span className={COL_PRIORITY}>Priority</span>
      <span className={COL_AGENT}>Handled by</span>
      <span className={`${COL_STATUS} text-right`}>Status</span>
      <span className="w-[18px] shrink-0" />
    </div>
  );
}

export function TicketRow({ ticket: t }: { ticket: Row }) {
  return (
    <Link
      href={`/client/tickets/${t.id}`}
      className="group relative flex items-center gap-4 px-5 py-4 transition-all duration-300 before:absolute before:bottom-3 before:left-0 before:top-3 before:w-[3px] before:origin-center before:scale-y-0 before:rounded-r-full before:bg-brand before:transition-transform before:duration-300 hover:bg-field/60 hover:before:scale-y-100 focus-visible:bg-field/60 focus-visible:outline-none focus-visible:before:scale-y-100 active:bg-brand-soft/40"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-ink transition-all duration-300 group-hover:translate-x-1 group-hover:text-brand">{t.judul}</p>
        <p className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-muted">
          <span>{t.category.nama}</span>
          <span>Opened {dateFmt(t.createdAt)}</span>
        </p>
      </div>

      {t.priority && (
        <div className={COL_PRIORITY}>
          <Badge className={PRIORITY_BADGE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
        </div>
      )}

      {t.assignedL1 !== undefined && (
        <p className={`${COL_AGENT} truncate text-[13px] ${t.assignedL1 ? "font-medium text-ink" : "text-muted"}`}>
          {t.assignedL1?.name ?? "Not assigned yet"}
        </p>
      )}

      <div className={`${COL_STATUS} flex flex-col items-end gap-1.5`}>
        <Badge className={STATUS_BADGE[t.status]}>{CLIENT_STATUS_LABEL[t.status]}</Badge>
        <span className="hidden text-[12px] text-muted sm:block">Updated {timeAgo(t.lastActivity)}</span>
      </div>

      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="shrink-0 text-muted transition-all duration-300 group-hover:translate-x-1.5 group-hover:text-brand"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}
