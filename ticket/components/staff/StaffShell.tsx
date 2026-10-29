"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactElement, type ReactNode } from "react";
import { ArrivalCurtain } from "@/components/dashboard/ArrivalCurtain";
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import type { CurrentUser } from "@/lib/auth/guards";
import { BRAND } from "@/lib/brand";
import type { WelcomeKind } from "@/lib/client/welcome";
import { STAFF_LEVEL, type StaffLevel } from "@/lib/staff/rules";

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const DashboardIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="3" width="8" height="8" rx="2" />
    <rect x="13" y="3" width="8" height="8" rx="2" />
    <rect x="3" y="13" width="8" height="8" rx="2" />
    <rect x="13" y="13" width="8" height="8" rx="2" />
  </svg>
);
const TicketIcon = () => (
  <svg {...iconProps}>
    <path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v3Z" />
    <path d="M13 5v14" strokeDasharray="2 3" />
  </svg>
);
const MenuIcon = () => (
  <svg {...iconProps}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);
const CloseIcon = () => (
  <svg {...iconProps}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

type NavItem = { href: string; label: string; icon: ReactElement; exact: boolean };

function navFor(base: string): NavItem[] {
  return [
    { href: base, label: "Dashboard", icon: <DashboardIcon />, exact: true },
    { href: `${base}/tickets`, label: "Tickets", icon: <TicketIcon />, exact: false },
  ];
}

const isActive = (pathname: string, item: NavItem) =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

function NavLinks({ nav, pathname, onNavigate }: { nav: NavItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-6">
      {nav.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-[14px] font-semibold transition ${
              active
                ? "bg-brand text-white shadow-[0_10px_24px_-10px_color-mix(in_srgb,var(--color-brand)_70%,transparent)]"
                : "text-muted hover:bg-field hover:text-ink"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ level }: { level: StaffLevel }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-brand" />
        <span className="text-lg font-extrabold tracking-tight text-ink">{BRAND.name}</span>
      </div>
      <p className="mt-1 pl-[18px] text-[11px] font-semibold uppercase tracking-widest text-muted">
        {STAFF_LEVEL[level].short} · {STAFF_LEVEL[level].title}
      </p>
    </div>
  );
}

// Shell dashboard Petugas L1 & L2 (sidebar + header), setara DashboardShell milik Admin.
export function StaffShell({
  user,
  level,
  welcome = null,
  children,
}: {
  user: CurrentUser;
  level: StaffLevel;
  /** Baru saja login -> putar animasi kedatangan. null = tanpa animasi. */
  welcome?: WelcomeKind | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = navFor(STAFF_LEVEL[level].base);
  const current = nav.find((item) => isActive(pathname, item));
  // Detail tiket (/l1/tickets/:id, /l2/tickets/:id): halaman TIDAK boleh scroll di desktop.
  // Hanya isi (chat & panel samping) yang scroll di dalam kotaknya sendiri.
  const lockPage = new RegExp(`^${STAFF_LEVEL[level].base}/tickets/[^/]+/?$`).test(pathname);

  return (
    <ArrivalCurtain user={user} welcome={welcome} className="bg-field">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-white md:flex">
        <div className="px-6 py-6">
          <Brand level={level} />
        </div>
        <NavLinks nav={nav} pathname={pathname} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
            <div className="flex items-start justify-between px-6 py-6">
              <Brand level={level} />
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="text-muted hover:text-ink">
                <CloseIcon />
              </button>
            </div>
            <NavLinks nav={nav} pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className={`flex min-h-screen flex-col md:pl-64 ${lockPage ? "xl:h-screen xl:overflow-hidden" : ""}`}>
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-line bg-white/80 px-5 py-4 backdrop-blur md:px-8">
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="text-muted hover:text-ink md:hidden">
            <MenuIcon />
          </button>
          <h1 className="text-[17px] font-bold text-ink">
            {pathname.startsWith(`${STAFF_LEVEL[level].base}/profile`) ? "Profile settings" : (current?.label ?? "Dashboard")}
          </h1>
          <ProfileMenu
            user={user}
            settingsHref={`${STAFF_LEVEL[level].base}/profile`}
            leading={<NotificationBell role={user.role} userId={user.id} />}
          />
        </header>
        <main className={`flex-1 p-5 md:p-8 ${lockPage ? "xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden" : ""}`}>{children}</main>
      </div>
    </ArrivalCurtain>
  );
}
