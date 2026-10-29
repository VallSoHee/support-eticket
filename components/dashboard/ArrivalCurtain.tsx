"use client";

import { useEffect, type ReactNode } from "react";
import { WelcomeSplash } from "@/components/client/WelcomeSplash";
import type { CurrentUser } from "@/lib/auth/guards";
import { WELCOME_COOKIE, type WelcomeKind } from "@/lib/client/welcome";

/**
 * Sisi "masuk" dari transisi login -> dashboard (sisi "keluar" ada di LoginTransition).
 * Layar merah + sapaan yang identik dengan overlay di halaman login bertahan sebentar,
 * lalu dashboard "dibuka" sebagai lingkaran dari tengah layar (CSS .arrive-* di globals.css).
 *
 * Dipakai dashboard Admin (DashboardShell) dan layout Petugas L1/L2. Dashboard Client punya
 * versi sendiri di ClientShell dengan animasi yang sama.
 *
 * `className` = latar dashboard. Wajib opak, karena tirai merah ada tepat di belakangnya.
 */
export function ArrivalCurtain({
  user,
  welcome,
  className = "",
  children,
}: {
  user: Pick<CurrentUser, "name">;
  /** Baru saja login -> putar animasi. "new" = Welcome, "back" = Welcome back. null = tanpa animasi. */
  welcome: WelcomeKind | null;
  className?: string;
  children: ReactNode;
}) {
  const firstName = user.name.trim().split(/\s+/)[0];

  // Penanda sudah dipakai server untuk render pertama -> hapus supaya refresh tidak memutar ulang.
  useEffect(() => {
    if (welcome) document.cookie = `${WELCOME_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }, [welcome]);

  return (
    <div className="relative min-h-screen">
      {welcome && (
        <div className="arrive-backdrop" aria-hidden>
          <WelcomeSplash name={firstName} returning={welcome === "back"} />
        </div>
      )}
      <div className={`relative z-10 min-h-screen ${className} ${welcome ? "arrive-reveal" : ""}`}>{children}</div>
    </div>
  );
}
