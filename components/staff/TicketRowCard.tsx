import Link from "next/link";
import type { Priority } from "@/generated/prisma/enums";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/admin/constants";
import { timeAgo } from "@/lib/client/format";
import { STAFF_LEVEL, type StaffLevel } from "@/lib/staff/rules";
import type { StaffTicketItem } from "@/lib/staff/queries";

// Satu warna per prioritas dipakai di tiga tempat (garis kiri, titik, teks) supaya
// prioritas terbaca sekilas tanpa perlu badge berwarna-warni.
const PRIORITY_STYLE: Record<Priority, { bar: string; text: string }> = {
  LOW: { bar: "bg-slate-300", text: "text-muted" },
  MEDIUM: { bar: "bg-sky-400", text: "text-sky-700" },
  HIGH: { bar: "bg-amber-500", text: "text-amber-700" },
  CRITICAL: { bar: "bg-rose-500", text: "text-rose-700" },
};

// Baris tiket ringkas untuk panel di dashboard.
export function TicketRowCard({ level, ticket: t }: { level: StaffLevel; ticket: StaffTicketItem }) {
  const p = PRIORITY_STYLE[t.priority];
  return (
    <Link
      href={`${STAFF_LEVEL[level].base}/tickets/${t.id}`}
      className="group relative flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-field/70 focus-visible:bg-field/70 focus-visible:outline-none"
    >
      <span aria-hidden className={`absolute inset-y-3 left-0 w-[3px] rounded-r-full ${p.bar}`} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-ink">{t.judul}</p>
        <p className="mt-1 flex items-center gap-x-3 overflow-hidden text-[12px] text-muted">
          <span className="min-w-0 truncate text-ink/70">{t.client.name}</span>
          <span className="shrink-0 whitespace-nowrap">{t.category.nama}</span>
          <span className="shrink-0 whitespace-nowrap">{timeAgo(t.createdAt)}</span>
          {level === "L2" && t.assignedL1 && (
            <span className="hidden shrink-0 whitespace-nowrap sm:inline">from {t.assignedL1.name}</span>
          )}
          {t.overdue && <span className="shrink-0 whitespace-nowrap font-medium text-rose-600">Past SLA</span>}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-0.5 text-[12px]">
        <span className={`font-medium ${p.text}`}>{PRIORITY_LABEL[t.priority]}</span>
        <span className="text-muted">{STATUS_LABEL[t.status]}</span>
      </div>
    </Link>
  );
}
