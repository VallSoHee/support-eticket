"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Menyegarkan data halaman daftar tiket berkala (antrean baru muncul sendiri), hanya saat tab terlihat. */
export function AutoRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
