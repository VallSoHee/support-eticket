"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

// Hanya untuk halaman non-flip (reset password). /login, /register & /forgot-password
// dirender oleh AuthPanel (FlipCard), jadi di sini dilewati agar tidak dobel animasi.
export default function AuthTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/register" || pathname === "/forgot-password") return <>{children}</>;
  return <div className="auth-fade-up">{children}</div>;
}
