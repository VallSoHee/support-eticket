import type { ReactNode } from "react";
import type { Priority, TicketStatus } from "@/generated/prisma/enums";
import { PRIORITY_BADGE, PRIORITY_LABEL, STATUS_BADGE, STATUS_LABEL } from "@/lib/admin/constants";
import { Badge } from "@/components/admin/ui";

// Potongan kecil yang dipakai bersama dashboard, daftar tiket, dan detail tiket Petugas.

export const PriorityBadge = ({ priority }: { priority: Priority }) => (
  <Badge className={PRIORITY_BADGE[priority]}>{PRIORITY_LABEL[priority]}</Badge>
);

export const StatusBadge = ({ status }: { status: TicketStatus }) => (
  <Badge className={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</Badge>
);

export const OverdueChip = () => <Badge className="bg-brand-soft text-brand-dark">Past SLA</Badge>;

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
  return (
    <span
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-field text-[12px] font-bold text-ink"
    >
      {initials}
    </span>
  );
}

export function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-muted">{label}</p>
      <div className="mt-1 text-[14px] text-ink">{children}</div>
    </div>
  );
}
