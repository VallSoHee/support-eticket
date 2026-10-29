// Aturan & helper foto profil. TANPA impor Node: aman dipakai di komponen browser maupun server.

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB (browser sudah memperkecil ke 512px, jadi biasanya < 100 KB)
export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";
export const AVATAR_URL_BASE = "/api/avatar";

/** URL foto profil. `?v=` = nama file, jadi otomatis berganti (cache-busting) saat foto diganti. */
export const avatarSrc = (userId: string, avatarName: string) =>
  `${AVATAR_URL_BASE}/${userId}?v=${encodeURIComponent(avatarName)}`;
