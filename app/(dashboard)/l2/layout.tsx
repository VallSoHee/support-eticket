import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/auth/guards";
import { StaffShell } from "@/components/staff/StaffShell";
import { WELCOME_COOKIE, parseWelcome } from "@/lib/client/welcome";

export default async function PetugasL2Layout({ children }: { children: ReactNode }) {
  // Lapisan otoritatif (NFR-4): proxy.ts hanya pagar pertama berbasis JWT.
  const user = await requireRole("PETUGAS_L2");
  // Ada hanya sesaat setelah login -> memutar animasi kedatangan (tirai merah -> dashboard).
  const welcome = parseWelcome((await cookies()).get(WELCOME_COOKIE)?.value);
  return (
    <StaffShell user={user} level="L2" welcome={welcome}>
      {children}
    </StaffShell>
  );
}
