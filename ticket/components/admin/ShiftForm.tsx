"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createShiftAction, generateShiftsAction, updateShiftAction } from "@/lib/admin/shift-actions";
import { SHIFT_DEFAULT_TIME, SHIFT_LABEL, SHIFT_TYPES } from "@/lib/admin/constants";
import type { ShiftType } from "@/generated/prisma/enums";
import type { MasterFormState } from "@/lib/admin/master-types";
import { Card, Field, InputField, SelectField, inputClass } from "@/components/admin/ui";
import { FormAlert, SubmitButton } from "@/components/auth/fields";

const initial: MasterFormState = {};

type PetugasOption = { id: string; name: string; role: "PETUGAS_L1" | "PETUGAS_L2" };
const levelOf = (r: PetugasOption["role"]) => (r === "PETUGAS_L1" ? "L1" : "L2");

// Memilih tipe shift mengisi jam default-nya, tapi jam tetap bisa diubah manual.
function useShiftTimes(type: string, start?: string, end?: string) {
  const [shiftType, setShiftType] = useState<string>(type);
  const [jamMulai, setJamMulai] = useState(start ?? SHIFT_DEFAULT_TIME[type as ShiftType]?.start ?? "");
  const [jamSelesai, setJamSelesai] = useState(end ?? SHIFT_DEFAULT_TIME[type as ShiftType]?.end ?? "");
  function onTypeChange(v: string) {
    setShiftType(v);
    const d = SHIFT_DEFAULT_TIME[v as ShiftType];
    if (d) {
      setJamMulai(d.start);
      setJamSelesai(d.end);
    }
  }
  return { shiftType, onTypeChange, jamMulai, setJamMulai, jamSelesai, setJamSelesai };
}

function TimeFields({
  t,
  fe,
}: {
  t: ReturnType<typeof useShiftTimes>;
  fe: Partial<Record<string, string[]>>;
}) {
  return (
    <>
      <Field label="Shift type" htmlFor="shiftType" error={fe.shiftType?.[0]}>
        <select
          id="shiftType"
          name="shiftType"
          required
          value={t.shiftType}
          onChange={(e) => t.onTypeChange(e.target.value)}
          className={inputClass}
        >
          {SHIFT_TYPES.map((s) => (
            <option key={s} value={s}>
              {SHIFT_LABEL[s]}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Start time" htmlFor="jamMulai" error={fe.jamMulai?.[0]}>
          <input id="jamMulai" name="jamMulai" type="time" required value={t.jamMulai} onChange={(e) => t.setJamMulai(e.target.value)} className={inputClass} />
        </Field>
        <Field
          label="End time"
          htmlFor="jamSelesai"
          error={fe.jamSelesai?.[0]}
          hint="If the end time is earlier than the start time, the shift ends the next day."
        >
          <input id="jamSelesai" name="jamSelesai" type="time" required value={t.jamSelesai} onChange={(e) => t.setJamSelesai(e.target.value)} className={inputClass} />
        </Field>
      </div>
    </>
  );
}

export function ShiftForm({
  mode,
  petugas,
  shift,
}: {
  mode: "create" | "edit";
  petugas: PetugasOption[];
  shift?: { id: string; petugasId: string; shiftType: string; tanggalBerlaku: string; jamMulai: string; jamSelesai: string };
}) {
  const action = mode === "create" ? createShiftAction : updateShiftAction.bind(null, shift!.id);
  const [state, formAction, pending] = useActionState(action, initial);
  const fe = state.fieldErrors ?? {};
  const t = useShiftTimes(state.values?.shiftType ?? shift?.shiftType ?? "PAGI", state.values?.jamMulai ?? shift?.jamMulai, state.values?.jamSelesai ?? shift?.jamSelesai);

  return (
    <Card className="mx-auto max-w-xl">
      <p className="text-[12px] font-semibold uppercase tracking-widest text-brand">{mode === "create" ? "New shift" : "Edit shift"}</p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{mode === "create" ? "Schedule a petugas" : "Edit schedule"}</h2>

      <form action={formAction} className="mt-6 space-y-5">
        {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
        <SelectField
          label="Petugas"
          name="petugasId"
          defaultValue={state.values?.petugasId ?? shift?.petugasId ?? petugas[0]?.id}
          options={petugas.map((p) => ({ value: p.id, label: `${p.name} (${levelOf(p.role)})` }))}
          error={fe.petugasId?.[0]}
        />
        <InputField
          label="Date"
          name="tanggalBerlaku"
          type="date"
          defaultValue={state.values?.tanggalBerlaku ?? shift?.tanggalBerlaku}
          error={fe.tanggalBerlaku?.[0]}
        />
        <TimeFields t={t} fe={fe} />
        <div className="flex items-center justify-between pt-2">
          <Link href="/admin/shifts" className="text-[14px] font-semibold text-ink transition hover:text-brand">
            Cancel
          </Link>
          <SubmitButton pending={pending} arrow={false}>
            {mode === "create" ? "Save" : "Update"}
          </SubmitButton>
        </div>
      </form>
    </Card>
  );
}

export function ShiftGenerateForm({ petugas }: { petugas: PetugasOption[] }) {
  const [state, formAction, pending] = useActionState(generateShiftsAction, initial);
  const fe = state.fieldErrors ?? {};
  const t = useShiftTimes(state.values?.shiftType ?? "PAGI", state.values?.jamMulai, state.values?.jamSelesai);
  const checked = new Set((state.values?.petugasIds ?? "").split(",").filter(Boolean));

  return (
    <Card className="mx-auto max-w-2xl">
      <p className="text-[12px] font-semibold uppercase tracking-widest text-brand">Bulk schedule</p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">Generate shifts</h2>
      <p className="mt-1 text-[13px] text-muted">
        Creates the same shift for every selected petugas across a date range. Days where a petugas already has a shift are skipped, never overwritten.
      </p>

      <form action={formAction} className="mt-6 space-y-5">
        {state.error && <FormAlert tone="error">{state.error}</FormAlert>}

        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-ink">Petugas</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {petugas.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-field px-4 py-3 text-[14px] text-ink has-[:checked]:border-brand/60 has-[:checked]:bg-brand-soft/40">
                <input type="checkbox" name="petugasIds" value={p.id} defaultChecked={checked.has(p.id)} className="h-4 w-4 accent-brand" />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="text-[11px] font-semibold text-muted">{levelOf(p.role)}</span>
              </label>
            ))}
          </div>
          {fe.petugasIds?.[0] && <p className="mt-1.5 text-[12px] font-medium text-brand-dark">{fe.petugasIds[0]}</p>}
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <InputField label="From date" name="dari" type="date" defaultValue={state.values?.dari} error={fe.dari?.[0]} />
          <InputField label="To date" name="sampai" type="date" defaultValue={state.values?.sampai} error={fe.sampai?.[0]} />
        </div>

        <TimeFields t={t} fe={fe} />

        <label className="flex cursor-pointer items-center gap-3 text-[14px] text-ink">
          <input type="checkbox" name="includeWeekend" defaultChecked={state.values?.includeWeekend === "on"} className="h-4 w-4 accent-brand" />
          Include Saturdays and Sundays
        </label>

        <div className="flex items-center justify-between pt-2">
          <Link href="/admin/shifts" className="text-[14px] font-semibold text-ink transition hover:text-brand">
            Cancel
          </Link>
          <SubmitButton pending={pending} arrow={false}>
            Generate
          </SubmitButton>
        </div>
      </form>
    </Card>
  );
}
