// Cookie pendek yang menandai "baru saja login" (semua role). Diset saat login (loginAction,
// registerAction, atau /welcome untuk Google), dibaca layout /client, /admin, /l1, /l2 untuk
// memutar animasi kedatangan (tirai merah -> dashboard), lalu dihapus lagi oleh ArrivalCurtain
// (atau ClientShell untuk Client).
// Isinya bukan data sensitif: hanya jenis sapaan.
//   "new"  -> login pertama kali (akun baru / baru daftar)  -> "Welcome, Nama"
//   "back" -> sudah pernah login sebelumnya                 -> "Welcome back, Nama"
export const WELCOME_COOKIE = "valify_welcome";
export const WELCOME_MAX_AGE = 60; // detik

export type WelcomeKind = "new" | "back";

export function parseWelcome(v: string | undefined): WelcomeKind | null {
  return v === "new" || v === "back" ? v : null;
}
