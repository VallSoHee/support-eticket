import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/auth/guards";
import { ClientShell } from "@/components/client/ClientShell";
import { WELCOME_COOKIE, parseWelcome } from "@/lib/client/welcome";

export default async function ClientLayout({ children }: { children: ReactNode }) {
  // Lapisan otoritatif (NFR-4): proxy.ts hanya pagar pertama berbasis JWT.
  const user = await requireRole("CLIENT");
  // Ada hanya sesaat setelah login (login, daftar, atau Google lewat /welcome) -> memutar animasi kedatangan.
  const welcome = parseWelcome((await cookies()).get(WELCOME_COOKIE)?.value);
  return (
    <ClientShell user={user} welcome={welcome}>
      {children}
    </ClientShell>
  );
}
