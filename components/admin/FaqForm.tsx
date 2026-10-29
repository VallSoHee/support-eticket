"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createFaqAction, updateFaqAction } from "@/lib/admin/faq-actions";
import type { MasterFormState } from "@/lib/admin/master-types";
import { Card, SelectField, TextareaField } from "@/components/admin/ui";
import { FormAlert, SubmitButton } from "@/components/auth/fields";

const initial: MasterFormState = {};

export function FaqForm({
  mode,
  categories,
  faq,
  defaultCategoryId,
}: {
  mode: "create" | "edit";
  categories: { id: string; nama: string }[];
  faq?: { id: string; categoryId: string; keywords: string; jawaban: string };
  defaultCategoryId?: string;
}) {
  const action = mode === "create" ? createFaqAction : updateFaqAction.bind(null, faq!.id);
  const [state, formAction, pending] = useActionState(action, initial);
  const fe = state.fieldErrors ?? {};

  return (
    <Card className="mx-auto max-w-2xl">
      <p className="text-[12px] font-semibold uppercase tracking-widest text-brand">
        {mode === "create" ? "New FAQ" : "Edit FAQ"}
      </p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
        {mode === "create" ? "Add bot answer" : "Edit bot answer"}
      </h2>
      <p className="mt-1 text-[13px] text-muted">
        The chatbot replies with this answer when a client&apos;s message matches one of the keywords in the ticket&apos;s category.
      </p>

      <form action={formAction} className="mt-6 space-y-5">
        {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
        <SelectField
          label="Category"
          name="categoryId"
          defaultValue={state.values?.categoryId ?? faq?.categoryId ?? defaultCategoryId ?? categories[0]?.id}
          options={categories.map((c) => ({ value: c.id, label: c.nama }))}
          error={fe.categoryId?.[0]}
        />
        <TextareaField
          label="Keywords"
          name="keywords"
          rows={3}
          placeholder="forgot password, reset password, can't log in"
          defaultValue={state.values?.keywords ?? faq?.keywords}
          hint="Separate keywords with commas or new lines. Matching ignores upper/lower case."
          error={fe.keywords?.[0]}
        />
        <TextareaField
          label="Answer"
          name="jawaban"
          rows={7}
          placeholder="What the bot should reply…"
          defaultValue={state.values?.jawaban ?? faq?.jawaban}
          error={fe.jawaban?.[0]}
        />
        <div className="flex items-center justify-between pt-2">
          <Link href="/admin/faq" className="text-[14px] font-semibold text-ink transition hover:text-brand">
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
