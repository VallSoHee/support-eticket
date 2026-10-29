import Link from "next/link";
import { timeAgo } from "@/lib/client/format";
import { STAFF_LEVEL, type StaffLevel } from "@/lib/staff/rules";
import type { StaffTicketItem } from "@/lib/staff/queries";
import { Avatar, OverdueChip, PriorityBadge, StatusBadge } from "@/components/staff/TicketBits";
import { ChevronRightIcon } from "@/components/staff/icons";

// Baris tiket ringkas untuk panel di dashboard.
export function TicketRowCard({ level, ticket: t }: { level: StaffLevel; ticket: StaffTicketItem }) {
  return (
    <Link
      href={`${STAFF_LEVEL[level].base}/tickets/${t.id}`}
      className="group flex items-center gap-4 px-5 py-4 transition hover:bg-field/60 focus-visible:bg-field/60 focus-visible:outline-none"
    >
      <Avatar name={t.client.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-ink transition group-hover:text-brand">{t.judul}</p>
        <p className="mt-1 truncate text-[12px] text-muted">
          {t.client.name} · {t.category.nama} · {timeAgo(t.createdAt)}
          {level === "L2" && t.assignedL1 && ` · Escalated by ${t.assignedL1.name}`}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5">
          {t.overdue && <OverdueChip />}
          <PriorityBadge priority={t.priority} />
        </div>
        <StatusBadge status={t.status} />
      </div>
      <ChevronRightIcon className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
    </Link>
  );
}
