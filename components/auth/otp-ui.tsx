"use client";

import { useCallback, useEffect, useState } from "react";

export const otpInputClass =
  "h-12 w-full rounded-2xl border border-line bg-field px-4 text-[14px] text-ink placeholder:text-[#9aa1b3] " +
  "outline-none transition focus:border-brand/60 focus:bg-white focus:ring-4 focus:ring-brand/10 " +
  "aria-[invalid=true]:border-brand";

const sendBtn =
  "inline-flex h-12 shrink-0 items-center justify-center rounded-2xl bg-brand px-4 text-[13px] font-semibold text-white " +
  "transition hover:bg-brand-dark active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-field disabled:text-muted";

/** Hitung mundur untuk jeda kirim ulang OTP. */
export function useCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const start = useCallback((seconds: number) => setLeft(Math.max(0, Math.floor(seconds))), []);
  return [left, start] as const;
}

/** Tombol "Send OTP" -> setelah terkirim berubah jadi "Resend in 42s". */
export function SendOtpButton({
  onClick,
  pending,
  cooldown,
  sent,
  disabled,
}: {
  onClick: () => void;
  pending: boolean;
  cooldown: number;
  sent: boolean;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={pending || cooldown > 0 || disabled} className={sendBtn}>
      {pending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : sent ? "Resend OTP" : "Send OTP"}
    </button>
  );
}

/** Input kode 6 digit (hanya angka). Terkontrol supaya tidak hilang saat form di-reset React. */
export function OtpCodeInput({
  id,
  label,
  name,
  value,
  onChange,
  error,
  autoFocus,
}: {
  id: string;
  label: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[13px] font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="6-digit code"
        maxLength={6}
        autoFocus={autoFocus}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${otpInputClass} tracking-[0.35em] placeholder:tracking-normal`}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[12px] font-medium text-brand-dark">
          {error}
        </p>
      )}
    </div>
  );
}
