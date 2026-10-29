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
const ShieldIcon = () => (
  <svg {...iconProps}>
    <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
  </svg>
);
const HeadsetIcon = () => (
  <svg {...iconProps}>
    <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
    <rect x="3" y="13" width="5" height="6" rx="2" />
    <rect x="16" y="13" width="5" height="6" rx="2" />
  </svg>
);
const UsersIcon = () => (
  <svg {...iconProps}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.5 20c0-3 2.9-5.5 6.5-5.5s6.5 2.5 6.5 5.5" />
    <circle cx="17.5" cy="9" r="2.6" />
    <path d="M15 14.3c2.9.3 6 2 6 5.7" />
  </svg>
);
const TicketIcon = () => (
  <svg {...iconProps}>
    <path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v3Z" />
    <path d="M13 5v14" strokeDasharray="2 3" />
  </svg>
);
const AppsIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const TagIcon = () => (
  <svg {...iconProps}>
    <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" />
    <circle cx="8" cy="8" r="1.4" />
  </svg>
);
const FaqIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5M12 17h.01" />
  </svg>
);
const ClockIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const CalendarIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);
const ChartIcon = () => (
  <svg {...iconProps}>
    <path d="M4 20V4M4 20h16" />
    <path d="M8 16v-4M12 16V8M16 16v-6" />
  </svg>
);
const LogIcon = () => (
  <svg {...iconProps}>
    <path d="M6 3h9l4 4v14H6Z" />
    <path d="M14 3v5h5M9 13h7M9 17h7" />
  </svg>
);
const BellIcon = () => (
  <svg {...iconProps}>
    <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
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

type NavItem = { href: string; label: string; icon: ReactElement };
type NavGroup = { title?: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { items: [{ href: "/admin", label: "Dashboard", icon: <DashboardIcon /> }] },
  {
    title: "Accounts",
    items: [
      { href: "/admin/admins", label: "Admin", icon: <ShieldIcon /> },
      { href: "/admin/petugas", label: "Petugas", icon: <HeadsetIcon /> },
      { href: "/admin/clients", label: "Client", icon: <UsersIcon /> },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/tickets", label: "Tickets", icon: <TicketIcon /> },
      { href: "/admin/shifts", label: "Shifts", icon: <CalendarIcon /> },
    ],
  },
  {
    title: "Master data",
    items: [
      { href: "/admin/categories", label: "Categories", icon: <TagIcon /> },
      { href: "/admin/applications", label: "Applications", icon: <AppsIcon /> },
      { href: "/admin/faq", label: "Bot FAQ", icon: <FaqIcon /> },
      { href: "/admin/sla", label: "SLA", icon: <ClockIcon /> },
      { href: "/admin/notifications", label: "Notifications", icon: <BellIcon /> },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/admin/reports", label: "Reports", icon: <ChartIcon /> },
      { href: "/admin/audit-log", label: "Audit log", icon: <LogIcon /> },
    ],
  },
];

const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-6">
      {NAV_GROUPS.map((group, gi) => (
        <div key={group.title ?? gi} className="flex flex-col gap-1">
          {group.title && <p className="px-4 pb-1 text-[11px] font-semibold text-muted">{group.title}</p>}
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
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
        </div>
      ))}
    </nav>
  );
}

export function DashboardShell({
  user,
  welcome = null,
  children,
}: {
  user: CurrentUser;
  /** Baru saja login -> putar animasi kedatangan. null = tanpa animasi. */
  welcome?: WelcomeKind | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = NAV.find((item) => isActive(pathname, item.href));
  const title = pathname.startsWith("/admin/profile") ? "Profile settings" : (current?.label ?? "Dashboard");

  return (
    <ArrivalCurtain user={user} welcome={welcome} className="bg-field">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-white md:flex">
        <div className="flex items-center gap-2 px-6 py-6">
          <span className="h-2.5 w-2.5 rounded-full bg-brand" />
          <span className="text-lg font-extrabold tracking-tight text-ink">{BRAND.name}</span>
        </div>
        <NavLinks pathname={pathname} />
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between px-6 py-6">
              <span className="text-lg font-extrabold tracking-tight text-ink">{BRAND.name}</span>
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="text-muted hover:text-ink">
                <CloseIcon />
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
              </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-col md:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-line bg-white/80 px-5 py-4 backdrop-blur md:px-8">
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="text-muted hover:text-ink md:hidden">
            <MenuIcon />
          </button>
          <h1 className="text-[17px] font-bold text-ink">{title}</h1>
          <ProfileMenu user={user} settingsHref="/admin/profile" leading={<NotificationBell role={user.role} userId={user.id} />} />
        </header>
        <main className="flex-1 p-5 md:p-8">{children}</main>
      </div>
    </ArrivalCurtain>
  );
}
