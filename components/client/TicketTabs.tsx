"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Tab = { view: string; label: string; count: number; href: string };

/**
 * Tab filter All / Active / Resolved.
 * - Pil merah meluncur (slide) ke tab yang diklik, langsung saat klik (optimistic),
 *   tidak menunggu server selesai render.
 * - Teks berubah warna halus, angka count ikut "pop" kecil.
 */
export function TicketTabs({ tabs, view }: { tabs: Tab[]; view: string }) {
  const [target, setTarget] = useState<string | null>(null);
  const [seenView, setSeenView] = useState(view);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const refs = useRef<Record<string, HTMLAnchorElement | null>>({});

  // Saat halaman baru sudah tiba (prop view berubah), buang state optimistic.
  if (seenView !== view) {
    setSeenView(view);
    setTarget(null);
  }
  const shown = target ?? view;

  useLayoutEffect(() => {
    const measure = () => {
      const el = refs.current[shown];
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [shown, tabs]);

  // Aktifkan transisi hanya setelah posisi awal terukur, supaya tidak "terbang" saat load.
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    if (pill) {
      const id = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(id);
    }
  }, [pill]);

  return (
    <nav aria-label="Filter tickets" className="relative flex w-fit gap-1 rounded-full border border-line bg-white p-1 shadow-sm">
      {pill && (
        <span
          aria-hidden
          className={`absolute bottom-1 top-1 rounded-full bg-brand shadow-[0_8px_18px_-8px_color-mix(in_srgb,var(--color-brand)_70%,transparent)] ${
            animate ? "transition-[left,width] duration-300 ease-[cubic-bezier(0.34,1.3,0.5,1)] motion-reduce:transition-none" : ""
          }`}
          style={{ left: pill.left, width: pill.width }}
        />
      )}
      {tabs.map((t) => {
        const active = t.view === shown;
        return (
          <Link
            key={t.view}
            ref={(el) => {
              refs.current[t.view] = el;
            }}
            href={t.href}
            scroll={false}
            aria-current={t.view === view ? "page" : undefined}
            onClick={() => t.view !== view && setTarget(t.view)}
            data-pending={target === t.view ? "true" : undefined}
            className={`relative z-10 flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors duration-300 active:scale-95 ${
              // Sebelum pil terukur (SSR/hydration), tab aktif memakai background sendiri.
              active ? `text-white ${pill ? "" : "bg-brand"}` : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
            <span
              key={active ? "on" : "off"}
              className={`text-[12px] transition-colors duration-300 ${active ? "text-white/80 animate-[tab-count-pop_0.35s_ease]" : "text-muted"}`}
            >
              {t.count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
