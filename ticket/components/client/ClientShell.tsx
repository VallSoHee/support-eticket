"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { WelcomeSplash } from "@/components/client/WelcomeSplash";
import type { CurrentUser } from "@/lib/auth/guards";
import { BRAND } from "@/lib/brand";
import { WELCOME_COOKIE, type WelcomeKind } from "@/lib/client/welcome";

// Lebar maksimum SATU untuk navbar dan isi semua halaman client, supaya logo, menu, dan konten selalu sejajar
// di halaman mana pun (dashboard, daftar, detail, submit, profil).
const PAGE_MAX = "max-w-[1760px]";

const NAV = [
  { href: "/client", label: "Dashboard", exact: true },
  { href: "/client/tickets", label: "My tickets", exact: false },
];

function isActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname, className, linkClass }: { pathname: string; className: string; linkClass: string }) {
  return (
    <nav aria-label="Main" className={className}>
      {NAV.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`${linkClass} border-b-2 text-[14px] font-semibold transition ${
              active ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ClientShell({
  user,
  welcome,
  children,
}: {
  user: CurrentUser;
  /** Baru saja login -> putar animasi kedatangan. "new" = Welcome, "back" = Welcome back. null = tanpa animasi. */
  welcome: WelcomeKind | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const firstName = user.name.trim().split(/\s+/)[0];
  // Detail tiket (/client/tickets/<id>, bukan /new): fullscreen dua kolom (tracking kiri, chat kanan)
  // dengan tinggi persis satu layar di desktop; kolom yang panjang scroll sendiri-sendiri.
  const detail = /^\/client\/tickets\/(?!new$)[^/]+$/.test(pathname);
  // Dashboard & daftar tiket: kontennya mengisi tinggi layar, supaya tidak terlihat kosong.
  const fill = pathname === "/client" || pathname === "/client/tickets";
  // Halaman profil & detail tiket dibuat fullscreen: tanpa batas lebar, tinggi mengisi layar.
  const full = pathname.startsWith("/client/profile") || detail || fill;

  // Penanda sudah dipakai server untuk render pertama -> hapus supaya refresh tidak memutar ulang.
  useEffect(() => {
    if (welcome) document.cookie = `${WELCOME_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }, [welcome]);

  return (
    <div className={`relative min-h-screen ${detail ? "lg:h-dvh lg:overflow-hidden" : ""}`}>
      {/* Tirai kedatangan: layar merah + sapaan, identik dengan overlay di halaman login. */}
      {welcome && (
        <div className="arrive-backdrop" aria-hidden>
          <WelcomeSplash name={firstName} returning={welcome === "back"} />
        </div>
      )}

      <div
        className={`relative z-10 flex min-h-screen flex-col bg-field ${detail ? "lg:h-full lg:min-h-0" : ""} ${welcome ? "arrive-reveal" : ""}`}
      >
        <header className="sticky top-0 z-30 shrink-0 border-b border-line bg-white/85 backdrop-blur">
          <div
            className={`mx-auto flex h-16 w-full items-center gap-8 px-5 md:px-8 ${PAGE_MAX}`}
          >
            <Link href="/client" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white shadow-[0_10px_22px_-8px_color-mix(in_srgb,var(--color-brand)_80%,transparent)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 15l6-6 6 6" />
                </svg>
              </span>
              <span className="text-[18px] font-extrabold tracking-tight text-ink">{BRAND.name}</span>
            </Link>

            <NavLinks
              pathname={pathname}
              className="-mb-px hidden h-full items-stretch gap-2 md:flex"
              linkClass="flex items-center px-3"
            />

            <ProfileMenu user={user} settingsHref="/client/profile" leading={<NotificationBell role={user.role} userId={user.id} />} />
          </div>

          {/* Mobile: tab yang sama di baris kedua. */}
          <NavLinks
            pathname={pathname}
            className="-mb-px flex h-11 items-stretch gap-2 border-t border-line px-3 md:hidden"
            linkClass="flex flex-1 items-center justify-center"
          />
        </header>

        <main
          className={`mx-auto w-full flex-1 px-5 md:px-8 ${
            full ? "flex flex-col pb-6 pt-4 md:pb-8 md:pt-5" : "py-8 md:py-10"
          } ${PAGE_MAX} ${fill ? "md:pt-8" : ""} ${detail ? "lg:min-h-0 lg:overflow-hidden lg:pb-6" : ""}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
