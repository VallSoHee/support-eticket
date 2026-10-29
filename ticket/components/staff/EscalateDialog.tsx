"use client";

import { useActionState, useEffect } from "react";
import { escalateTicketAction } from "@/lib/staff/actions";
import type { StaffActionState } from "@/lib/staff/types";
import { inputClass, primaryBtn, ghostBtn } from "@/components/admin/ui";

// Dialog eskalasi L1 -> L2. Catatan serah-terima wajib: jadi pesan pertama di Internal note.
export function EscalateDialog({ ticketId, open, onClose }: { ticketId: string; open: boolean; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(
    escalateTicketAction.bind(null, ticketId),
    {} as StaffActionState,
  );

  useEffect(() => {
    if (open && state.success) onClose();
  }, [open, state.success, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="presentation">
      <button aria-label="Close dialog" className="absolute inset-0 bg-ink/40" onClick={onClose} tabIndex={-1} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="escalate-title"
        className="relative w-full max-w-lg rounded-3xl border border-line bg-white p-6 shadow-[0_30px_60px_-20px_rgba(30,35,60,0.45)] md:p-8"
      >
        <h2 id="escalate-title" className="text-xl font-extrabold tracking-tight text-ink">
          Escalate to L2
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          The ticket moves to the technical team&apos;s queue. Internal notes unlock so you can work with L2. The client
          never sees this note.
        </p>

        <form action={formAction} className="mt-5 space-y-4">
          <div>
            <label htmlFor="escalate-note" className="mb-2 block text-[13px] font-semibold text-ink">
              Handover note for L2
            </label>
            <textarea
              id="escalate-note"
              name="note"
              required
              rows={5}
              autoFocus
              maxLength={2000}
              defaultValue={state.values?.note ?? ""}
              placeholder="What did you already try? What does L2 need to know?"
              aria-invalid={!!state.error}
              className={`${inputClass} h-auto resize-y py-3 leading-relaxed`}
            />
            {state.error && (
              <p role="alert" className="mt-1.5 text-[12px] font-medium text-brand-dark">
                {state.error}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className={ghostBtn}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={primaryBtn}>
              {pending ? "Escalating…" : "Escalate ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
