import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { AuthToggle } from "@/components/auth/AuthToggle";
import { HeroIllustration } from "@/components/auth/HeroIllustration";

// Layout fullscreen: background memenuhi seluruh viewport; konten dibatasi max-w
// supaya tidak melebar berlebihan di layar ultrawide.
export function AuthShell({ children }: { children: ReactNode }) {
  const container = "mx-auto w-full max-w-[1440px] px-6 sm:px-10 lg:px-16";

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-gradient-to-br from-white via-[#fff8f9] to-[#ffe9ed] text-ink">
      <div className="pointer-events-none absolute -right-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-brand/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-brand/10 blur-3xl" />

      {/* Header */}
      <header className="relative z-10 py-6">
        <div className={`${container} flex flex-wrap items-center justify-between gap-4`}>
          <Link href="/login" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white shadow-[0_10px_22px_-8px_color-mix(in_srgb,var(--color-brand)_80%,transparent)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 15l6-6 6 6" />
              </svg>
            </span>
            <span className="leading-none">
              <span className="block text-[19px] font-extrabold text-ink">{BRAND.name}</span>
              <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
                {BRAND.tagline}
              </span>
            </span>
          </Link>

          <AuthToggle />

          <div className="hidden items-center gap-2 rounded-full border border-line bg-white/80 px-4 py-2 text-[12px] text-muted shadow-sm md:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Ticket Dispatcher: <span className="font-bold text-emerald-600">Online</span>
          </div>
        </div>
      </header>

      {/* Body: mengisi sisa tinggi layar */}
      <main className="relative z-10 flex flex-1 items-center py-8">
        <div className={`${container} grid items-center gap-10 lg:grid-cols-2 lg:gap-16`}>
          <div className="hidden lg:block">
            <HeroIllustration />
          </div>
          <div className="mx-auto w-full max-w-[480px] lg:mx-0 lg:max-w-[500px]">{children}</div>
        </div>
      </main>

      {/* Footer menempel di dasar layar */}
      <footer className="relative z-10 border-t border-black/5">
        <div className={`${container} flex flex-wrap items-center justify-between gap-3 py-6 text-[12px] text-muted`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>© {new Date().getFullYear()} {BRAND.name} Support Hub</span>
            <a href="#" className="hover:text-ink">Privacy Policy</a>
            <a href="#" className="hover:text-ink">Terms of Service</a>
          </div>
          <p>
            Need help? <a href="#" className="font-bold text-brand">Contact System Admin</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
