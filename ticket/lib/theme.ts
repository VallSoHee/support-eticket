/**
 * Warna tema aplikasi. Seluruh UI memakai variabel CSS `--color-brand` (lihat globals.css),
 * jadi cukup mengganti variabel itu di <html> dan semua halaman ikut berubah.
 * Pilihan disimpan di COOKIE (per browser, bukan per akun). Cookie ikut terkirim ke server, jadi
 * app/layout.tsx bisa memasang warnanya langsung di <html> pada HTML pertama -> tidak ada kedipan
 * warna bawaan (merah) saat refresh, tanpa menunggu script jalan di browser.
 */
export const THEME_COOKIE = "valify-theme-color";
const ONE_YEAR_S = 60 * 60 * 24 * 365;

/** HSV: h 0-360, s 0-1, v 0-1. Cocok untuk color wheel (sudut = hue, jari-jari = saturasi). */
export type Hsv = { h: number; s: number; v: number };

export const DEFAULT_HEX = "#ff1a47";

export function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

export const isHex = (v: string) => /^#?[0-9a-f]{6}$/i.test(v.trim());

export function hexToHsv(hex: string): Hsv {
  const n = parseInt(hex.trim().replace("#", ""), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export const DEFAULT_HSV: Hsv = hexToHsv(DEFAULT_HEX);

export const PRESETS: { name: string; hex: string }[] = [
  { name: "Red", hex: "#ff1a47" },
  { name: "Orange", hex: "#f97316" },
  { name: "Green", hex: "#16a34a" },
  { name: "Teal", hex: "#0d9488" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Purple", hex: "#7c3aed" },
  { name: "Pink", hex: "#db2777" },
];

/** Hex "#rrggbb" valid. Dipakai server untuk memvalidasi isi cookie sebelum dipasang ke <html>. */
export const isStoredHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

/** Nilai mentah cookie -> hex valid atau null. Aman dipakai di server maupun client. */
export function parseThemeCookie(raw: string | undefined | null): string | null {
  if (!raw) return null;
  try {
    const v = decodeURIComponent(raw);
    return isStoredHex(v) ? v.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Client only: warna tersimpan (dari cookie) sebagai HSV, untuk posisi awal color wheel. */
export function readStoredColor(): Hsv | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
  const hex = parseThemeCookie(m?.[1]);
  return hex ? hexToHsv(hex) : null;
}

/** Pasang warna ke seluruh app dan jadikan warna bawaan browser ini (cookie 1 tahun). */
export function applyColor(hsv: Hsv) {
  const hex = hsvToHex(hsv);
  document.documentElement.style.setProperty("--color-brand", hex);
  document.cookie = `${THEME_COOKIE}=${encodeURIComponent(hex)}; path=/; max-age=${ONE_YEAR_S}; samesite=lax`;
}
