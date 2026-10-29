"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { googleSignInAction, loginAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/types";
import { BRAND } from "@/lib/brand";
import { AuthHeading, FormAlert, PasswordField, SubmitButton, TextField, UserIcon } from "@/components/auth/fields";
import { LoginTransition } from "@/components/auth/LoginTransition";

const initial: AuthFormState = {};

const OAUTH_ERRORS: Record<string, string> = {
  AccessDenied: "This Google account can't be used to sign in (unverified email or deactivated account).",
};

export function LoginForm({
  resetSuccess = false,
  authError = null,
}: {
  resetSuccess?: boolean;
  authError?: string | null;
}) {
  const [state, formAction, pending] = useActionState(loginAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div>
      {/* Login sukses -> lingkaran merah membesar dari tombol Sign In, lalu pindah ke dashboard. */}
      {state.redirectTo && (
        <LoginTransition to={state.redirectTo} animate={!!state.animate} name={state.welcomeName} returning={state.returning} originRef={formRef} />
      )}

      <AuthHeading
        title={BRAND.name}
        dot
        subtitle="Enter your email and password to manage customer helpdesk tickets."
      />

      <form ref={formRef} action={formAction} className="mt-8 space-y-5">
        {resetSuccess && !state.error && <FormAlert tone="success">Password updated. You can sign in now.</FormAlert>}
        {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
        {!state.error && authError && (
          <FormAlert tone="error">{OAUTH_ERRORS[authError] ?? "Google sign-in failed. Please try again."}</FormAlert>
        )}

        <TextField
          label="Email"
          name="email"
          type="email"
          placeholder="you@email.com"
          autoComplete="email"
          defaultValue={state.values?.email}
          icon={<UserIcon />}
        />

        <div>
          <PasswordField label="Password" name="password" autoComplete="current-password" />
          <div className="mt-2 text-right">
            <Link href="/forgot-password" className="text-[12px] text-muted transition hover:text-brand">
              Forgot password?
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <Link href="/register" className="text-[14px] font-semibold text-ink transition hover:text-brand">
            Sign Up
          </Link>
          <SubmitButton pending={pending}>Sign In</SubmitButton>
        </div>
      </form>

      <div className="my-6 flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        <span className="h-px flex-1 bg-line" />
        Or sign in with
        <span className="h-px flex-1 bg-line" />
      </div>

      <form action={googleSignInAction}>
        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-line bg-white text-[13px] font-semibold text-ink transition hover:bg-black/[0.03]"
        >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        Continue with Google
        </button>
      </form>
    </div>
  );
}
