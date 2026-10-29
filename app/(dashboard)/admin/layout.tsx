import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/auth/guards";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { WELCOME_COOKIE, parseWelcome } from "@/lib/client/welcome";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Lapisan otoritatif (NFR-4): proxy.ts hanya pagar pertama berbasis JWT.
  const user = await requireRole("ADMIN");
  // Ada hanya sesaat setelah login (email/password atau Google lewat /welcome) -> memutar animasi kedatangan.
  const welcome = parseWelcome((await cookies()).get(WELCOME_COOKIE)?.value);
  return (
    <DashboardShell user={user} welcome={welcome}>
      {children}
    </DashboardShell>
  );
}
