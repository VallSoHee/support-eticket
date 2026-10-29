"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createUserAction, updateUserAction } from "@/lib/admin/actions";
import { SCOPE_BASE_PATH, SCOPE_LABEL, SCOPE_ROLES, type UserScope } from "@/lib/admin/scope";
import type { AdminFormState } from "@/lib/admin/types";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { FormAlert, PasswordField, SubmitButton, TextField, UserIcon } from "@/components/auth/fields";

const initial: AdminFormState = {};

export function UserForm({
  scope,
  mode,
  user,
}: {
  scope: UserScope;
  mode: "create" | "edit";
  user?: { id: string; name: string; email: string; role: Role };
}) {
  const action =
    mode === "create" ? createUserAction.bind(null, scope) : updateUserAction.bind(null, scope, user!.id);
  const [state, formAction, pending] = useActionState(action, initial);
  const fe = state.fieldErrors ?? {};
  const roles = SCOPE_ROLES[scope];
  const showRoleSelect = roles.length > 1;
  const basePath = SCOPE_BASE_PATH[scope];

  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-line bg-white p-6 shadow-sm md:p-8">
      <p className="text-[12px] font-semibold uppercase tracking-widest text-brand">
        {mode === "create" ? `New ${SCOPE_LABEL[scope]}` : `Edit ${SCOPE_LABEL[scope]}`}
      </p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
        {mode === "create" ? `Add ${SCOPE_LABEL[scope]} account` : user?.name}
      </h2>

      <form action={formAction} className="mt-6 space-y-5">
        {state.error && <FormAlert tone="error">{state.error}</FormAlert>}

        <TextField
          label="Full name"
          name="name"
          placeholder="Full name"
          autoComplete="name"
          defaultValue={state.values?.name ?? user?.name}
          error={fe.name?.[0]}
          icon={<UserIcon />}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          placeholder="name@email.com"
          autoComplete="email"
          defaultValue={state.values?.email ?? user?.email}
          error={fe.email?.[0]}
        />

        {showRoleSelect && (
          <div>
            <label htmlFor="role" className="mb-2 block text-[13px] font-semibold text-ink">
              Level
            </label>
            <select
              id="role"
              name="role"
              required
              defaultValue={state.values?.role ?? user?.role ?? roles[0]}
              className="h-12 w-full rounded-2xl border border-line bg-field px-4 text-[14px] text-ink outline-none transition focus:border-brand/60 focus:bg-white focus:ring-4 focus:ring-brand/10"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </select>
            {fe.role?.[0] && <p className="mt-1.5 text-[12px] font-medium text-brand-dark">{fe.role[0]}</p>}
          </div>
        )}

        <PasswordField
          label={mode === "create" ? "Password" : "New password"}
          name="password"
          autoComplete="new-password"
          required={mode === "create"}
          placeholder={mode === "create" ? "At least 8 characters" : "Leave blank to keep current password"}
          error={fe.password?.[0]}
        />

        <div className="flex items-center justify-between pt-2">
          <Link href={basePath} className="text-[14px] font-semibold text-ink transition hover:text-brand">
            Cancel
          </Link>
          <SubmitButton pending={pending} arrow={false}>
            {mode === "create" ? "Save" : "Update"}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
