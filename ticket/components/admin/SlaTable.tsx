"use client";

import { useActionState } from "react";
import { saveSlaAction } from "@/lib/admin/sla-actions";
import { PRIORITY_BADGE, PRIORITY_LABEL, formatMinutes } from "@/lib/admin/constants";
import type { Priority } from "@/generated/prisma/enums";
import type { MasterFormState } from "@/lib/admin/master-types";
import { Badge, inputClass, primaryBtn } from "@/components/admin/ui";

const initial: MasterFormState = {};

function SlaRow({
  priority,
  current,
}: {
  priority: Priority;
  current: { targetResponMenit: number; targetSelesaiMenit: number } | null;
}) {
  const [state, formAction, pending] = useActionState(saveSlaAction.bind(null, priority), initial);
  const fe = state.fieldErrors ?? {};
  const respon = state.values?.targetResponMenit ?? current?.targetResponMenit ?? "";
  const selesai = state.values?.targetSelesaiMenit ?? current?.targetSelesaiMenit ?? "";

  return (
    <form action={formAction} className="grid items-start gap-4 border-b border-line px-5 py-5 last:border-0 md:grid-cols-[140px_1fr_1fr_auto]">
      <div className="pt-2.5">
        <Badge className={PRIORITY_BADGE[priority]}>{PRIORITY_LABEL[priority]}</Badge>
        {!current && <p className="mt-2 text-[12px] text-muted">Not configured yet</p>}
      </div>

      <div>
        <label htmlFor={`respon-${priority}`} className="mb-1.5 block text-[12px] font-semibold text-muted">
          First response (minutes)
        </label>
        <input
          id={`respon-${priority}`}
          name="targetResponMenit"
          type="number"
          min={1}
          required
          defaultValue={respon}
          aria-invalid={!!fe.targetResponMenit}
          className={inputClass}
        />
        <p className="mt-1.5 text-[12px] text-muted">{respon !== "" ? `= ${formatMinutes(Number(respon))}` : " "}</p>
        {fe.targetResponMenit?.[0] && <p className="text-[12px] font-medium text-brand-dark">{fe.targetResponMenit[0]}</p>}
      </div>

      <div>
        <label htmlFor={`selesai-${priority}`} className="mb-1.5 block text-[12px] font-semibold text-muted">
          Resolution (minutes)
        </label>
        <input
          id={`selesai-${priority}`}
          name="targetSelesaiMenit"
          type="number"
          min={1}
          required
          defaultValue={selesai}
          aria-invalid={!!fe.targetSelesaiMenit}
          className={inputClass}
        />
        <p className="mt-1.5 text-[12px] text-muted">{selesai !== "" ? `= ${formatMinutes(Number(selesai))}` : " "}</p>
        {fe.targetSelesaiMenit?.[0] && <p className="text-[12px] font-medium text-brand-dark">{fe.targetSelesaiMenit[0]}</p>}
      </div>

      <div className="flex flex-col items-end gap-2 md:pt-[26px]">
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending ? "Saving…" : "Save"}
        </button>
        {state.success && <p role="status" className="text-[12px] font-medium text-emerald-700">{state.success}</p>}
        {state.error && <p role="alert" className="text-[12px] font-medium text-brand-dark">{state.error}</p>}
      </div>
    </form>
  );
}

export function SlaTable({
  rows,
}: {
  rows: { priority: Priority; current: { targetResponMenit: number; targetSelesaiMenit: number } | null }[];
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
      {rows.map((r) => (
        <SlaRow key={r.priority} priority={r.priority} current={r.current} />
      ))}
    </div>
  );
}
