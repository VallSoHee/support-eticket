"use client";

import { useLayoutEffect } from "react";

/**
 * Menyamakan warna tema di <html> dengan warna akun yang sedang login. Dipasang di layout tiap role.
 * - Render pertama (reload) sudah benar dari server (app/layout.tsx); komponen ini menjaga transisi
 *   client-side: masuk dashboard -> pasang warna akun, keluar (logout) -> kembali ke warna bawaan,
 *   sehingga warna satu akun tidak "bocor" ke akun lain di browser yang sama.
 */
export function ThemeSync({ color }: { color: string | null }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (color) root.style.setProperty("--color-brand", color);
    else root.style.removeProperty("--color-brand");
  }, [color]);

  useLayoutEffect(() => () => document.documentElement.style.removeProperty("--color-brand"), []);

  return null;
}
