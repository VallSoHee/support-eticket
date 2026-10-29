"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createCategoryAction, updateCategoryAction } from "@/lib/admin/category-actions";
import { PRIORITIES, PRIORITY_LABEL } from "@/lib/admin/constants";
import type { MasterFormState } from "@/lib/admin/master-types";
import { Card, InputField, SelectField } from "@/components/admin/ui";
import { FormAlert, SubmitButton } from "@/components/auth/fields";

const initial: MasterFormState = {};

export function CategoryForm({
  mode,
  category,
}: {
  mode: "create" | "edit";
  category?: { id: string; nama: string; defaultPriority: string };
}) {
  const action = mode === "create" ? createCategoryAction : updateCategoryAction.bind(null, category!.id);
  const [state, formAction, pending] = useActionState(action, initial);
  const fe = state.fieldErrors ?? {};

  return (
    <Card className="mx-auto max-w-xl">
      <p className="text-[12px] font-semibold uppercase tracking-widest text-brand">
        {mode === "create" ? "New category" : "Edit category"}
      </p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
        {mode === "create" ? "Add ticket category" : category?.nama}
      </h2>

      <form action={formAction} className="mt-6 space-y-5">
        {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
        <InputField
          label="Category name"
          name="nama"
          placeholder="e.g. Account & login"
          defaultValue={state.values?.nama ?? category?.nama}
          error={fe.nama?.[0]}
        />
        <SelectField
          label="Default priority"
          name="defaultPriority"
          defaultValue={state.values?.defaultPriority ?? category?.defaultPriority ?? "MEDIUM"}
          options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
          hint="New tickets in this category start with this priority. Petugas or admin can change it later."
          error={fe.defaultPriority?.[0]}
        />
        <div className="flex items-center justify-between pt-2">
          <Link href="/admin/categories" className="text-[14px] font-semibold text-ink transition hover:text-brand">
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
