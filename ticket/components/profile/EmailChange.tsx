"use client";

import { useId, useState, useTransition } from "react";
import {
  cancelEmailChangeAction,
  confirmEmailChangeAction,
  sendNewEmailOtpAction,
  sendOldEmailOtpAction,
  verifyOldEmailOtpAction,
} from "@/lib/auth/profile-actions";
import type { OtpActionResult } from "@/lib/auth/types";
import { FormAlert } from "@/components/auth/fields";
import { OtpCodeInput, SendOtpButton, otpInputClass, useCooldown } from "@/components/auth/otp-ui";

const solidBtn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-6 text-[14px] font-semibold text-white " +
  "shadow-[0_14px_30px_-10px_color-mix(in_srgb,var(--color-brand)_75%,transparent)] transition hover:bg-brand-dark active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70";

type Step = "old" | "new";
type Msg = { tone: "error" | "success"; text: string } | null;

/**
 * Ganti email dengan OTP, dua tahap (langsung dari tombol di bawah "Current email", tanpa toggle):
 *  1. kode dikirim ke email LAMA -> diverifikasi
 *  2. user mengisi email BARU -> kode dikirim ke email baru -> diverifikasi -> email berganti.
 * Urutan ditegakkan di server (lib/auth/profile-actions.ts); UI ini hanya mengikuti.
 */
export function EmailChange({ email }: { email: string }) {
  const uid = useId();
  const [step, setStep] = useState<Step>("old");
  const [oldSent, setOldSent] = useState(false);
  const [newSent, setNewSent] = useState<string | null>(null); // alamat tujuan OTP terakhir
  const [oldCode, setOldCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [cooldown, startCooldown] = useCooldown();

  const normalizedNew = newEmail.trim().toLowerCase();
  const newReady = newSent !== null && newSent === normalizedNew;
  const started = oldSent || step === "new";

  function reset() {
    setStep("old");
    setOldSent(false);
    setNewSent(null);
    setOldCode("");
    setNewCode("");
    setNewEmail("");
    setMsg(null);
    startCooldown(0);
  }

  function cancel() {
    reset();
    start(async () => {
      await cancelEmailChangeAction(); // buang kode yang masih menggantung
    });
  }

  function run(task: () => Promise<OtpActionResult>, onOk: (r: OtpActionResult) => void) {
    setMsg(null);
    start(async () => {
      const r = await task();
      if (r.ok) {
        onOk(r);
        if (r.message) setMsg({ tone: "success", text: r.message });
      } else {
        setMsg({ tone: "error", text: r.error ?? "Something went wrong. Please try again." });
      }
      if (r.retryAfter) startCooldown(r.retryAfter);
    });
  }

  const sendOld = () => {
    setDone(null);
    run(sendOldEmailOtpAction, () => {
      setOldSent(true);
      setOldCode("");
    });
  };

  const verifyOld = () =>
    run(() => verifyOldEmailOtpAction(oldCode), () => {
      setStep("new");
      startCooldown(0);
    });

  const sendNew = () =>
    run(() => sendNewEmailOtpAction(newEmail), () => {
      setNewSent(normalizedNew);
      setNewCode("");
    });

  const confirm = () =>
    run(() => confirmEmailChangeAction(newEmail, newCode), (r) => {
      reset();
      setDone(r.message ?? "Email updated.");
    });

  return (
    <section className="px-6 py-6 md:px-8">
      <h3 className="text-[17px] font-extrabold tracking-tight text-ink">Email address</h3>
      <p className="mt-0.5 text-[13px] text-muted">Changing your email requires a code sent to your current and your new address.</p>

      <div className="mt-5 space-y-5">
        {done && <FormAlert tone="success">{done}</FormAlert>}

        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink">Current email</p>
          <div className="flex h-12 items-center rounded-2xl border border-line bg-field px-4 text-[14px] text-muted">
            <span className="truncate">{email}</span>
          </div>
        </div>

        {msg && <FormAlert tone={msg.tone}>{msg.text}</FormAlert>}

        {step === "old" ? (
          !oldSent ? (
            <div className="flex flex-wrap items-center gap-3">
              <SendOtpButton onClick={sendOld} pending={pending} cooldown={cooldown} sent={false} />
              <span className="text-[13px] text-muted">We&apos;ll send a code to {email}.</span>
            </div>
          ) : (
            <div className="auth-fade-up space-y-5">
              <p className="text-[13px] font-semibold text-ink">Step 1 of 2 · Verify your current email</p>
              <OtpCodeInput id={`${uid}-old`} label="Code from your current email" value={oldCode} onChange={setOldCode} autoFocus />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SendOtpButton onClick={sendOld} pending={pending} cooldown={cooldown} sent />
                <button type="button" onClick={verifyOld} disabled={pending || oldCode.length !== 6} className={solidBtn}>
                  {pending ? "Checking…" : "Verify"}
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="auth-fade-up space-y-5">
            <p className="text-[13px] font-semibold text-ink">Step 2 of 2 · Verify your new email</p>
            <div>
              <label htmlFor={`${uid}-new`} className="mb-2 block text-[13px] font-semibold text-ink">
                New email
              </label>
              <div className="flex gap-2">
                <input
                  id={`${uid}-new`}
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new@email.com"
                  autoComplete="email"
                  className={otpInputClass}
                />
                <SendOtpButton onClick={sendNew} pending={pending} cooldown={cooldown} sent={newReady} disabled={!normalizedNew} />
              </div>
            </div>
            {newReady && (
              <>
                <OtpCodeInput id={`${uid}-newcode`} label="Code from your new email" value={newCode} onChange={setNewCode} autoFocus />
                <div className="flex justify-end">
                  <button type="button" onClick={confirm} disabled={pending || newCode.length !== 6} className={solidBtn}>
                    {pending ? "Saving…" : "Confirm new email"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {started && (
          <button type="button" onClick={cancel} className="text-[13px] font-semibold text-muted transition hover:text-brand-dark">
            Cancel email change
          </button>
        )}
      </div>
    </section>
  );
}
