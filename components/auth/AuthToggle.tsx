"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Halaman /forgot-password & /reset-password dianggap bagian dari sisi "Sign in".
export function AuthToggle() {
  const pathname = usePathname();
  const isSignUp = pathname === "/register";
  const item = "relative z-10 w-24 py-2 text-center text-[14px] font-semibold transition-colors duration-300";

  return (
    <nav aria-label="Auth" className="relative grid grid-cols-2 rounded-full border border-line bg-white/80 p-1 shadow-sm">
      {/* Indikator merah yang bergeser antar tab */}
      <span
        aria-hidden
        className={`absolute bottom-1 left-1 top-1 w-24 rounded-full bg-brand shadow-[0_10px_22px_-8px_color-mix(in_srgb,var(--color-brand)_80%,transparent)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          isSignUp ? "translate-x-full" : "translate-x-0"
        }`}
      />
      <Link href="/login" aria-current={!isSignUp ? "page" : undefined} className={`${item} ${!isSignUp ? "text-white" : "text-muted hover:text-ink"}`}>
        Sign in
      </Link>
      <Link href="/register" aria-current={isSignUp ? "page" : undefined} className={`${item} ${isSignUp ? "text-white" : "text-muted hover:text-ink"}`}>
        Sign Up
      </Link>
    </nav>
  );
}
