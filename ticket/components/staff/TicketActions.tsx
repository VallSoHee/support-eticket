"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { claimTicketAction, resolveTicketAction } from "@/lib/staff/actions";
import type { StaffAccess } from "@/lib/staff/rules";
import { ghostBtn, primaryBtn } from "@/components/admin/ui";
import { EscalateDialog } from "@/components/staff/EscalateDialog";

// Tombol aksi di header detail tiket. Hanya tombol yang diizinkan aturan (getStaffAccess) yang muncul.
export function TicketActions({
  ticketId,
  access,
}: {
  ticketId: string;
  access: Pick<StaffAccess, "canClaim" | "canEscalate" | "canResolve">;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [confirmResolve, setConfirmResolve] = useState(false);
  const closeEscalate = useCallback(() => setEscalateOpen(false), []);

  // Konfirmasi "selesai" kedaluwarsa sendiri supaya tidak tertinggal armed.
  useEffect(() => {
    if (!confirmResolve) return;
    const t = setTimeout(() => setConfirmResolve(false), 4000);
    return () => clearTimeout(t);
  }, [confirmResolve]);

  if (!access.canClaim && !access.canEscalate && !access.canResolve) return null;

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-3">
        {access.canClaim && (
          <button type="button" disabled={pending} onClick={() => run(() => claimTicketAction(ticketId))} className={primaryBtn}>
            {pending ? "Taking…" : "Take ticket"}
          </button>
        )}
        {access.canEscalate && (
          <button type="button" disabled={pending} onClick={() => setEscalateOpen(true)} className={ghostBtn}>
            Escalate to L2
          </button>
        )}
        {access.canResolve && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirmResolve) return setConfirmResolve(true);
              setConfirmResolve(false);
              run(() => resolveTicketAction(ticketId));
            }}
            className={
              confirmResolve
                ? "inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 px-5 text-[14px] font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-70"
                : ghostBtn
            }
          >
            {confirmResolve ? "Click again to confirm" : "Mark resolved"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[12px] font-medium text-brand-dark">
          {error}
        </p>
      )}
      <EscalateDialog ticketId={ticketId} open={escalateOpen} onClose={closeEscalate} />
    </div>
  );
}
