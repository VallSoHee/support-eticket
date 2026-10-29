"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createApplicationAction, updateApplicationAction } from "@/lib/admin/application-actions";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/admin/constants";
import type { MasterFormState } from "@/lib/admin/master-types";
import { Card, Field, InputField } from "@/components/admin/ui";
import { FormAlert, SubmitButton } from "@/components/auth/fields";

const initial: MasterFormState = {};

export function ApplicationForm({
  mode,
  application,
}: {
  mode: "create" | "edit";
  application?: { id: string; nama: string; platforms: string[] };
}) {
  const action = mode === "create" ? createApplicationAction : updateApplicationAction.bind(null, application!.id);
  const [state, formAction, pending] = useActionState(action, initial);
  const fe = state.fieldErrors ?? {};
  const checked = state.values ? state.values.platforms.split(",") : (application?.platforms ?? []);

  return (
    <Card className="mx-auto max-w-xl">
      <p className="text-[12px] font-semibold uppercase tracking-widest text-brand">
        {mode === "create" ? "New application" : "Edit application"}
      </p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
        {mode === "create" ? "Add application" : application?.nama}
      </h2>

      <form action={formAction} className="mt-6 space-y-5">
        {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
        <InputField
          label="Application name"
          name="nama"
          placeholder="e.g. Billing Portal"
          defaultValue={state.values?.nama ?? application?.nama}
          error={fe.nama?.[0]}
        />
        <Field
          label="Available platforms"
          htmlFor="platform-WEB"
          error={fe.platforms?.[0]}
          hint="Clients pick one of these when submitting a ticket. If only one is ticked, it is filled in automatically and can't be changed."
        >
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {PLATFORMS.map((p) => (
              <label
                key={p}
                className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-field px-3.5 py-2.5 text-[14px] font-medium text-ink transition hover:border-brand"
              >
                <input
                  id={`platform-${p}`}
                  type="checkbox"
                  name="platforms"
                  value={p}
                  defaultChecked={checked.includes(p)}
                  className="h-4 w-4 accent-brand"
                />
                {PLATFORM_LABEL[p]}
              </label>
            ))}
          </div>
        </Field>
        <div className="flex items-center justify-between pt-2">
          <Link href="/admin/applications" className="text-[14px] font-semibold text-ink transition hover:text-brand">
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
