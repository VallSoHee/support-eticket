"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPasswordAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/types";
import { AuthHeading, FormAlert, PasswordField, SubmitButton } from "@/components/auth/fields";

const initial: AuthFormState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initial);
  const fe = state.fieldErrors ?? {};

  return (
    <div>
      <AuthHeading title="Reset password" subtitle="Choose a new password for your account." />

      <form action={formAction} className="mt-8 space-y-5">
        <input type="hidden" name="token" value={token} />
        {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
        {fe.token && <FormAlert tone="error">This reset link is invalid.</FormAlert>}

        <PasswordField label="New password" name="password" autoComplete="new-password" placeholder="At least 8 characters" error={fe.password?.[0]} />
        <PasswordField label="Confirm new password" name="confirmPassword" autoComplete="new-password" placeholder="Repeat password" error={fe.confirmPassword?.[0]} />

        <div className="flex items-center justify-between pt-1">
          <Link href="/login" className="text-[14px] font-semibold text-ink transition hover:text-brand">
            Back to Sign In
          </Link>
          <SubmitButton pending={pending} arrow={false}>Update password</SubmitButton>
        </div>
      </form>
    </div>
  );
}
