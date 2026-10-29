"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { changePasswordAction, updateProfileAction } from "@/lib/auth/profile-actions";
import type { AuthFormState } from "@/lib/auth/types";
import { FormAlert, PasswordField } from "@/components/auth/fields";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { EmailChange } from "@/components/profile/EmailChange";
import { ProfileAnimation } from "@/components/profile/ProfileAnimation";
import { BannerThemePicker } from "@/components/profile/BannerThemePicker";

const initial: AuthFormState = {};

const card = "rounded-3xl border border-line bg-white shadow-sm";
const inputCls =
  "h-12 w-full rounded-2xl border border-line bg-field px-4 text-[14px] text-ink placeholder:text-[#9aa1b3] " +
  "outline-none transition focus:border-brand/60 focus:bg-white focus:ring-4 focus:ring-brand/10 aria-[invalid=true]:border-brand";
const solidBtn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-6 text-[14px] font-semibold text-white " +
  "shadow-[0_14px_30px_-10px_color-mix(in_srgb,var(--color-brand)_75%,transparent)] transition hover:bg-brand-dark active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70";
const outlineBtn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line bg-white px-5 text-[14px] font-semibold text-ink " +
  "transition hover:border-brand hover:text-brand active:scale-[0.97]";

const ico = {
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
const KeyIcon = () => (
  <svg {...ico}>
    <circle cx="8" cy="15" r="4" />
    <path d="M11 12l9-9M16 7l3 3" />
  </svg>
);
const CheckIcon = () => (
  <svg {...ico} strokeWidth={2.4}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg {...ico} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/** Satu bagian di dalam kartu tunggal; dipisah dari bagian sebelumnya oleh garis tipis. */
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="px-6 py-6 md:px-8">
      <h3 className="text-[17px] font-extrabold tracking-tight text-ink">{title}</h3>
      {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Reveal({ delay, className = "", children }: { delay: number; className?: string; children: ReactNode }) {
  return (
    <div className={`auth-fade-up ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export type ProfileStat = { label: string; value: number; href?: string };

type Props = {
  userId: string;
  avatarName: string | null;
  name: string;
  email: string;
  hasPassword: boolean;
  memberSince: string;
  /** Metode login yang aktif, mis. "Email & password · Google". */
  signIn: string;
  /** Teks badge di kartu kiri, mis. "Client", "Admin", "L1 · Customer Support". */
  roleLabel: string;
  /** Tiga angka ringkas di kartu kiri (beda tiap role). `href` opsional -> angka jadi tautan. */
  stats: ProfileStat[];
};

export function AccountProfile({ userId, avatarName, name, email, hasPassword, memberSince, signIn, roleLabel, stats }: Props) {
  const [profile, profileAction, profilePending] = useActionState(updateProfileAction, initial);
  const [pw, pwAction, pwPending] = useActionState(changePasswordAction, initial);
  const [nameVal, setNameVal] = useState(name);
  const [pwOpen, setPwOpen] = useState(false);

  const pfe = profile.fieldErrors ?? {};
  const fe = pw.fieldErrors ?? {};
  const dirty = nameVal.trim() !== name;
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";

  return (
    <Reveal delay={0} className="flex flex-1 flex-col">
      {/* ===== Satu kartu untuk seluruh profil ===== */}
      <section className={`${card} flex flex-1 flex-col overflow-hidden`}>
        {/* Identitas */}
        {/* Banner penuh selebar kartu; klik untuk memilih warna tema aplikasi */}
        <BannerThemePicker />
        <div className="flex-1 lg:grid lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="border-b border-line lg:border-b-0 lg:border-r">
        <div className="px-6 pb-6 md:px-8">
          <AvatarUploader userId={userId} name={name} avatarName={avatarName} initials={initials} />
          <p className="mt-4 truncate text-[20px] font-extrabold tracking-tight text-ink">{name}</p>
          <p className="truncate text-[13px] text-muted">{email}</p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[12px] font-semibold text-brand-dark">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            {roleLabel}
          </span>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {stats.map((st) => {
              const body = (
                <>
                  <p className="text-[18px] font-extrabold text-ink">{st.value}</p>
                  <p className="text-[11px] font-semibold text-muted">{st.label}</p>
                </>
              );
              const cls = "rounded-2xl bg-field px-2 py-3 text-center transition";
              return st.href ? (
                <Link key={st.label} href={st.href} className={`${cls} hover:-translate-y-0.5 hover:bg-brand-soft/60`}>
                  {body}
                </Link>
              ) : (
                <div key={st.label} className={cls}>
                  {body}
                </div>
              );
            })}
          </div>

          <dl className="mt-6 divide-y divide-line border-t border-line text-[13px]">
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="text-muted">Member since</dt>
              <dd className="font-semibold text-ink">{memberSince}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="text-muted">Password</dt>
              <dd className={`font-semibold ${hasPassword ? "text-emerald-600" : "text-muted"}`}>
                {hasPassword ? "Set" : "Not set"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="text-muted">Sign-in</dt>
              <dd className="text-right font-semibold text-ink">{signIn}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="text-muted">Status</dt>
              <dd className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </dd>
            </div>
          </dl>
        </div>
        </aside>

        {/* Kanan: Personal information + Email berdampingan, Security di bawah */}
        <div className="flex min-w-0 flex-col">
        <div className="grid flex-1 md:grid-cols-2">
        <div className="min-w-0">
        <Section title="Personal information" hint="Your name appears on every ticket you submit.">
          <form action={profileAction} className="space-y-5">
            {profile.error && <FormAlert tone="error">{profile.error}</FormAlert>}
            {profile.success && !dirty && <FormAlert tone="success">{profile.success}</FormAlert>}

            <div>
              <label htmlFor="profile-name" className="mb-2 block text-[13px] font-semibold text-ink">
                Full name
              </label>
              <input
                id="profile-name"
                name="name"
                required
                autoComplete="name"
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                aria-invalid={!!pfe.name?.[0]}
                className={inputCls}
              />
              {pfe.name?.[0] && <p className="mt-1.5 text-[12px] font-medium text-brand-dark">{pfe.name[0]}</p>}
            </div>

            {/* Tombol simpan hanya muncul (meluncur) saat ada perubahan. */}
            <div
              className={`grid transition-all duration-300 ease-out ${
                dirty ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden" inert={!dirty}>
                <div className="flex justify-end gap-2 border-t border-line pt-5">
                  <button type="button" onClick={() => setNameVal(name)} className={outlineBtn}>
                    Cancel
                  </button>
                  <button type="submit" disabled={profilePending} className={solidBtn}>
                    {profilePending ? (
                      "Saving…"
                    ) : (
                      <>
                        <CheckIcon />
                        Save changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Hiasan animasi: kartu sedang; isi <ProfileAnimation> dengan children untuk animasi sendiri. */}
          <ProfileAnimation />
        </Section>
        </div>
        <div className="min-w-0 border-t border-line md:border-l md:border-t-0">
        <EmailChange email={email} />
        </div>
        </div>

        <div className="border-t border-line">
        <Section title="Security">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <KeyIcon />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-ink">{hasPassword ? "Password" : "Set a password"}</p>
              <p className="text-[13px] text-muted">
                {hasPassword
                  ? "Use a strong password you don't use anywhere else."
                  : "You signed up with Google. Set a password to also sign in with email."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPwOpen((o) => !o)}
              aria-expanded={pwOpen}
              aria-controls="pw-panel"
              className={outlineBtn}
            >
              {hasPassword ? "Change password" : "Set password"}
              <ChevronIcon open={pwOpen} />
            </button>
          </div>

          <div
            id="pw-panel"
            className={`grid transition-all duration-300 ease-out ${
              pwOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden" inert={!pwOpen}>
              {/* key: form di-reset setelah sukses supaya password tidak tertinggal di input */}
              <form key={pw.success ?? "form"} action={pwAction} className="mt-6 space-y-5 border-t border-line pt-6">
                {pw.error && <FormAlert tone="error">{pw.error}</FormAlert>}
                {pw.success && <FormAlert tone="success">{pw.success}</FormAlert>}

                {hasPassword && (
                  <PasswordField
                    label="Current password"
                    name="currentPassword"
                    autoComplete="current-password"
                    placeholder="Current password"
                    error={fe.currentPassword?.[0]}
                  />
                )}
                <div className="grid gap-5 md:grid-cols-2">
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
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setPwOpen(false)} className={outlineBtn}>
                    Cancel
                  </button>
                  <button type="submit" disabled={pwPending} className={solidBtn}>
                    {pwPending ? "Saving…" : hasPassword ? "Update password" : "Set password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Section>
        </div>
        </div>
        </div>
      </section>
    </Reveal>
  );
}
