"use client";

import { useId, useState, type ReactNode } from "react";

const inputClass =
  "h-12 w-full rounded-2xl border border-line bg-field px-4 text-[14px] text-ink placeholder:text-[#9aa1b3] " +
  "outline-none transition focus:border-brand/60 focus:bg-white focus:ring-4 focus:ring-brand/10 " +
  "aria-[invalid=true]:border-brand";

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const UserIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
  </svg>
);
export const EyeIcon = () => (
  <svg {...iconProps}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const EyeOffIcon = () => (
  <svg {...iconProps}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6A17 17 0 0 0 2 12s3.6 7 10 7c1.7 0 3.2-.4 4.5-1" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);
export const ArrowIcon = () => (
  <svg {...iconProps} width={18} height={18} strokeWidth={2.2}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

type FieldProps = {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
  autoComplete?: string;
  error?: string;
};

function FieldShell({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[13px] font-semibold text-ink">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[12px] font-medium text-brand-dark">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  type = "text",
  icon,
  ...p
}: FieldProps & { type?: "text" | "email"; icon?: ReactNode }) {
  const uid = useId(); // id unik: form Login & Register sama-sama ada di DOM (flip card)
  const id = `${uid}-${p.name}`;
  return (
    <FieldShell id={id} label={p.label} error={p.error}>
      <div className="relative">
        <input
          id={id}
          name={p.name}
          type={type}
          required
          placeholder={p.placeholder}
          defaultValue={p.defaultValue}
          autoComplete={p.autoComplete}
          aria-invalid={!!p.error}
          aria-describedby={p.error ? `${id}-error` : undefined}
          className={`${inputClass} ${icon ? "pr-11" : ""}`}
        />
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-muted">{icon}</span>
        )}
      </div>
    </FieldShell>
  );
}

export function PasswordField(p: FieldProps & { required?: boolean }) {
  const [visible, setVisible] = useState(false);
  const uid = useId(); // id unik: form Login & Register sama-sama ada di DOM (flip card)
  const id = `${uid}-${p.name}`;
  return (
    <FieldShell id={id} label={p.label} error={p.error}>
      <div className="relative">
        <input
          id={id}
          name={p.name}
          type={visible ? "text" : "password"}
          required={p.required ?? true}
          placeholder={p.placeholder ?? "Password"}
          autoComplete={p.autoComplete}
          aria-invalid={!!p.error}
          aria-describedby={p.error ? `${id}-error` : undefined}
          className={`${inputClass} pr-11`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-3 flex w-8 items-center justify-center text-muted transition hover:text-ink"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </FieldShell>
  );
}

export function SubmitButton({
  pending,
  children,
  arrow = true,
}: {
  pending: boolean;
  children: ReactNode;
  arrow?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-8 text-[15px] font-semibold text-white shadow-[0_14px_30px_-10px_color-mix(in_srgb,var(--color-brand)_75%,transparent)] transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Please wait…" : children}
      {!pending && arrow && <ArrowIcon />}
    </button>
  );
}

export function FormAlert({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const styles =
    tone === "error"
      ? "border-brand/20 bg-brand-soft/70 text-brand-dark"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 text-[13px] font-medium ${styles}`}>
      {children}
    </div>
  );
}

export function AuthHeading({ title, subtitle, dot = false }: { title: string; subtitle: string; dot?: boolean }) {
  return (
    <div>
      <h1 className="text-[38px] font-extrabold leading-none tracking-tight text-ink sm:text-[42px]">
        {title}
        {dot && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-brand align-baseline" />}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">{subtitle}</p>
    </div>
  );
}
