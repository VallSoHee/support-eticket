"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/types";
import { AuthHeading, FormAlert, SubmitButton, TextField, UserIcon } from "@/components/auth/fields";

const initial: AuthFormState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initial);

  return (
    <div>
      <AuthHeading title="Forgot password" subtitle="Enter your account email and we'll send you a link to reset your password." />

      <form action={formAction} className="mt-8 space-y-5">
        {state.success && <FormAlert tone="success">{state.success}</FormAlert>}
        {state.error && <FormAlert tone="error">{state.error}</FormAlert>}

        <TextField label="Email" name="email" type="email" placeholder="you@email.com" autoComplete="email" defaultValue={state.values?.email} icon={<UserIcon />} error={state.fieldErrors?.email?.[0]} />

        <div className="flex items-center justify-between pt-1">
          <Link href="/login" className="text-[14px] font-semibold text-ink transition hover:text-brand">
            Back to Sign In
          </Link>
          <SubmitButton pending={pending}>Send link</SubmitButton>
        </div>
      </form>
    </div>
  );
}
