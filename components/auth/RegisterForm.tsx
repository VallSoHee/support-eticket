"use client";

import Link from "next/link";
import { useActionState, useId, useRef, useState, useTransition } from "react";
import { registerAction, sendRegisterOtpAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/types";
import { AuthHeading, FormAlert, PasswordField, SubmitButton, TextField, UserIcon } from "@/components/auth/fields";
import { LoginTransition } from "@/components/auth/LoginTransition";
import { OtpCodeInput, SendOtpButton, otpInputClass, useCooldown } from "@/components/auth/otp-ui";

const initial: AuthFormState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initial);
  const fe = state.fieldErrors ?? {};
  const formRef = useRef<HTMLFormElement>(null);
  const uid = useId(); // id unik: form Login & Register sama-sama ada di DOM (flip card)

  // Email & OTP dikontrol state: React mereset form setelah action, dan input ini tidak boleh ikut hilang.
  const [email, setEmail] = useState(state.values?.email ?? "");
  const [otp, setOtp] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null); // email tujuan OTP terakhir
  const [otpMsg, setOtpMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [sending, startSend] = useTransition();
  const [cooldown, startCooldown] = useCooldown();

  const normalized = email.trim().toLowerCase();
  const otpReady = sentTo !== null && sentTo === normalized; // ganti email -> wajib kirim OTP lagi

  function sendOtp() {
    setOtpMsg(null);
    startSend(async () => {
      const res = await sendRegisterOtpAction(email);
      if (res.ok) {
        setSentTo(normalized);
        setOtp("");
        setOtpMsg({ tone: "success", text: res.message ?? "Code sent." });
      } else {
        setOtpMsg({ tone: "error", text: res.error ?? "Couldn't send the code." });
      }
      if (res.retryAfter) startCooldown(res.retryAfter);
    });
  }

  return (
    <div>
      {/* Daftar sukses -> animasi yang sama seperti login, dengan sapaan "Welcome" (akun baru). */}
      {state.redirectTo && (
        <LoginTransition to={state.redirectTo} animate={!!state.animate} name={state.welcomeName} returning={state.returning} originRef={formRef} />
      )}

      <AuthHeading
        title="Create account"
        dot
        subtitle="Register as a client to submit and track your support tickets."
      />

      <form ref={formRef} action={formAction} className="mt-8 space-y-5">
        {state.error && <FormAlert tone="error">{state.error}</FormAlert>}

        <TextField label="Full name" name="name" placeholder="Your name" autoComplete="name" defaultValue={state.values?.name} icon={<UserIcon />} error={fe.name?.[0]} />

        <div>
          <label htmlFor={`${uid}-email`} className="mb-2 block text-[13px] font-semibold text-ink">
            Email
          </label>
          <div className="flex gap-2">
            <input
              id={`${uid}-email`}
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
              aria-invalid={!!fe.email?.[0]}
              aria-describedby={fe.email?.[0] ? `${uid}-email-error` : undefined}
              className={otpInputClass}
            />
            <SendOtpButton onClick={sendOtp} pending={sending} cooldown={cooldown} sent={otpReady} disabled={!normalized} />
          </div>
          {fe.email?.[0] && (
            <p id={`${uid}-email-error`} className="mt-1.5 text-[12px] font-medium text-brand-dark">
              {fe.email[0]}
            </p>
          )}
        </div>

        {otpMsg && <FormAlert tone={otpMsg.tone}>{otpMsg.text}</FormAlert>}

        {otpReady && (
          <div className="auth-fade-up">
            <OtpCodeInput id={`${uid}-otp`} name="otp" label="Verification code" value={otp} onChange={setOtp} error={fe.otp?.[0]} autoFocus />
          </div>
        )}
        {!otpReady && fe.otp?.[0] && <p className="-mt-3 text-[12px] font-medium text-brand-dark">Verify your email with the Send OTP button first.</p>}

        <PasswordField label="Password" name="password" autoComplete="new-password" placeholder="At least 8 characters" error={fe.password?.[0]} />
        <PasswordField label="Confirm password" name="confirmPassword" autoComplete="new-password" placeholder="Repeat password" error={fe.confirmPassword?.[0]} />

        <div className="flex items-center justify-between pt-1">
          <Link href="/login" className="text-[14px] font-semibold text-ink transition hover:text-brand">
            Sign In
          </Link>
          <SubmitButton pending={pending}>Create account</SubmitButton>
        </div>
      </form>
    </div>
  );
}
