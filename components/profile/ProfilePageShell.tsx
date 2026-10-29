import type { ReactNode } from "react";

/** Pembungkus halaman profil semua role (Client, Admin, L1, L2). Mengisi seluruh area konten; Client fullscreen, Admin/Staff mengikuti sidebar. */
export function ProfilePageShell({ children }: { children: ReactNode }) {
  return <div className="flex w-full flex-1 flex-col">{children}</div>;
}
