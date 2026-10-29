"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { avatarSrc } from "@/lib/avatar";

const icon = {
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function ProfileMenu({
  user,
  settingsHref,
  leading,
}: {
  user: { id?: string; name: string; email: string; role: Role; avatarName?: string | null };
  /** Tanpa ini menu profil hanya berisi Log out (mis. Petugas belum punya halaman pengaturan). */
  settingsHref?: string;
  /** Elemen di sisi kiri tombol profil (mis. bel notifikasi), selalu sejajar dengannya. */
  leading?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Tutup saat klik di luar atau tekan Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="ml-auto flex items-center gap-2 sm:gap-3">
      {leading}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-3 rounded-full border border-line bg-white py-1.5 pl-1.5 pr-3 transition hover:border-brand/50 md:pr-4"
        >
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-brand text-[13px] font-bold text-white">
            {user.id && user.avatarName ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc(user.id, user.avatarName)} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(user.name)
            )}
          </span>
          <span className="hidden text-left md:block">
            <span className="block max-w-[160px] truncate text-[13px] font-semibold leading-tight text-ink">{user.name}</span>
            <span className="block text-[11px] leading-tight text-muted">{ROLE_LABEL[user.role]}</span>
          </span>
          <svg {...icon} width={16} height={16} className={`text-muted transition ${open ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_20px_40px_-16px_rgba(30,35,60,0.35)]"
          >
            <div className="border-b border-line px-4 py-3">
              <p className="truncate text-[13px] font-semibold text-ink">{user.name}</p>
              <p className="truncate text-[12px] text-muted">{user.email}</p>
            </div>
            <div className="p-1.5">
              {settingsHref && (
                <Link
                  href={settingsHref}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-ink transition hover:bg-field"
                >
                  <svg {...icon}>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
                  </svg>
                  Profile settings
                </Link>
              )}
              <form action={logoutAction}>
                <button
                  type="submit"
                  role="menuitem"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-brand-dark transition hover:bg-brand-soft/60"
                >
                  <svg {...icon}>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                  Log out
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
