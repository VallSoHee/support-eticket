"use client";

import { useActionState } from "react";
import { updateTicketPriorityAction } from "@/lib/admin/ticket-actions";
import { PRIORITIES, PRIORITY_LABEL } from "@/lib/admin/constants";
import type { MasterFormState } from "@/lib/admin/master-types";
import { inputClass, primaryBtn } from "@/components/admin/ui";

const initial: MasterFormState = {};

export function TicketPriorityForm({ ticketId, priority }: { ticketId: string; priority: string }) {
  const [state, formAction, pending] = useActionState(updateTicketPriorityAction.bind(null, ticketId), initial);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[160px] flex-1">
        <label htmlFor="priority" className="mb-1.5 block text-[12px] font-semibold text-muted">
          Priority
        </label>
        <select id="priority" name="priority" defaultValue={priority} className={inputClass}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending ? "Saving…" : "Change priority"}
      </button>
      {state.success && <p role="status" className="w-full text-[12px] font-medium text-emerald-700">{state.success}</p>}
      {(state.error || state.fieldErrors?.priority) && (
        <p role="alert" className="w-full text-[12px] font-medium text-brand-dark">
          {state.error ?? state.fieldErrors?.priority?.[0]}
        </p>
      )}
    </form>
  );
}
