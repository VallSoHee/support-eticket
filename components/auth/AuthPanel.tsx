"use client";

import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { FlipCard } from "@/components/auth/FlipCard";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";

const surface =
  "rounded-[32px] border border-white bg-white/90 p-7 shadow-[0_30px_60px_-30px_rgba(30,35,60,0.35)] sm:p-9";

// /login dan /register adalah dua sisi kartu yang sama: keduanya selalu ter-render,
// pindah route = kartu berputar 180° di sumbu Y. URL tetap berganti, jadi tombol back,
// refresh, dan link langsung ke /register tetap berfungsi.
//
// /forgot-password menempati sisi depan bersama login (lihat FlipCard): kartu mengecil,
// isi login memudar & isi forgot muncul. Kembali ke /login memakai animasi yang sama.
export function AuthPanel({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isCardRoute = pathname === "/login" || pathname === "/register" || pathname === "/forgot-password";
  if (!isCardRoute) {
    // Reset password: kartu statis, isi halaman fade-up (lihat template.tsx).
    return <div className={surface}>{children}</div>;
  }

  return (
    <FlipCard
      view={pathname === "/forgot-password" ? "forgot" : "login"}
      flipped={pathname === "/register"}
      surface={surface}
      login={<LoginForm resetSuccess={searchParams.get("reset") === "success"} authError={searchParams.get("error")} />}
      forgot={<ForgotPasswordForm />}
      register={<RegisterForm />}
    />
  );
}
