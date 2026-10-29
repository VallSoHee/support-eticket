"use client";

import { useActionState } from "react";
import { changePasswordAction, updateProfileAction } from "@/lib/auth/profile-actions";
import type { AuthFormState } from "@/lib/auth/types";
import { FormAlert, PasswordField, SubmitButton, TextField, UserIcon } from "@/components/auth/fields";

const initial: AuthFormState = {};
const card = "rounded-3xl border border-line bg-white p-6 shadow-sm md:p-8";

export function ProfileForms({ name, email, hasPassword }: { name: string; email: string; hasPassword: boolean }) {
  const [profile, profileAction, profilePending] = useActionState(updateProfileAction, initial);
  const [pw, pwAction, pwPending] = useActionState(changePasswordAction, initial);
  const pfe = profile.fieldErrors ?? {};
  const fe = pw.fieldErrors ?? {};

  return (
    <div className="w-full space-y-6">
      <section className={card}>
        <p className="text-[12px] font-semibold uppercase tracking-widest text-brand">Account</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">Profile</h2>

        <form action={profileAction} className="mt-6 space-y-5">
          {profile.error && <FormAlert tone="error">{profile.error}</FormAlert>}
          {profile.success && <FormAlert tone="success">{profile.success}</FormAlert>}

          <div className="grid gap-5 md:grid-cols-2">
            <TextField
              label="Full name"
              name="name"
              autoComplete="name"
              defaultValue={profile.values?.name ?? name}
              error={pfe.name?.[0]}
              icon={<UserIcon />}
            />
            <div>
              <p className="mb-2 text-[13px] font-semibold text-ink">Email</p>
              <p className="flex h-12 items-center rounded-2xl border border-line bg-field px-4 text-[14px] text-muted">
                {email}
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <SubmitButton pending={profilePending} arrow={false}>
              Save changes
            </SubmitButton>
          </div>
        </form>
      </section>

      <section className={card}>
        <h2 className="text-xl font-extrabold tracking-tight text-ink">
          {hasPassword ? "Change password" : "Set password"}
        </h2>
        {!hasPassword && (
          <p className="mt-1 text-[13px] text-muted">
            You signed up with Google. Set a password if you also want to sign in with email.
          </p>
        )}

        {/* key: form di-reset setelah sukses supaya password tidak tertinggal di input */}
        <form key={pw.success ?? "form"} action={pwAction} className="mt-6 space-y-5">
          {pw.error && <FormAlert tone="error">{pw.error}</FormAlert>}
          {pw.success && <FormAlert tone="success">{pw.success}</FormAlert>}

          <div className={`grid gap-5 ${hasPassword ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
            {hasPassword && (
              <PasswordField
                label="Current password"
                name="currentPassword"
                autoComplete="current-password"
                placeholder="Current password"
                error={fe.currentPassword?.[0]}
              />
            )}
            <PasswordField
              label="New password"
              name="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              error={fe.password?.[0]}
            />
            <PasswordField
              label="Confirm new password"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Repeat new password"
              error={fe.confirmPassword?.[0]}
            />
          </div>
          <div className="flex justify-end">
            <SubmitButton pending={pwPending} arrow={false}>
              {hasPassword ? "Change password" : "Set password"}
            </SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}
