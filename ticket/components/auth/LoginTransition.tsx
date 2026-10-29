"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { WelcomeSplash } from "@/components/client/WelcomeSplash";

// Harus >= durasi CSS .login-leave (globals.css) + jeda singkat agar teks sempat terbaca.
const LEAVE_MS = 950;

/**
 * Dirender LoginForm setelah login berhasil. Menutup layar dengan lingkaran merah yang
 * membesar dari tombol Sign In, lalu berpindah halaman. Halaman tujuan melanjutkan dengan
 * tirai yang identik (ClientShell), jadi hasilnya satu gerakan utuh.
 *
 * `animate = false` -> langsung pindah halaman tanpa overlay (sekarang semua role memakai animasi).
 */
export function LoginTransition({
  to,
  animate,
  name,
  returning,
  originRef,
}: {
  to: string;
  animate: boolean;
  name?: string;
  returning?: boolean;
  originRef: RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const overlay = useRef<HTMLDivElement>(null);

  // Titik asal lingkaran = pusat tombol Sign In. Diset sebelum paint supaya animasi tidak lompat.
  useLayoutEffect(() => {
    const el = overlay.current;
    if (!el) return;
    const rect = originRef.current?.querySelector<HTMLElement>('button[type="submit"]')?.getBoundingClientRect();
    el.style.setProperty("--ox", `${rect ? rect.left + rect.width / 2 : window.innerWidth / 2}px`);
    el.style.setProperty("--oy", `${rect ? rect.top + rect.height / 2 : window.innerHeight / 2}px`);
  }, [originRef]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    router.prefetch(to);
    // replace (bukan push): tombol Back tidak membawa user kembali ke form login.
    const t = window.setTimeout(() => router.replace(to), animate && !reduceMotion ? LEAVE_MS : 0);
    return () => window.clearTimeout(t);
  }, [router, to, animate]);

  if (!animate) return null;

  // Portal ke <body>: kartu login berada di dalam elemen ber-transform 3D (flip card),
  // dan `position: fixed` di dalam elemen ber-transform tidak lagi relatif ke viewport.
  return createPortal(
    <div ref={overlay} className="login-leave" role="status" aria-live="polite">
      <WelcomeSplash name={name} returning={returning} />
    </div>,
    document.body,
  );
}
