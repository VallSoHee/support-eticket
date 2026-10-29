import { requireRole } from "@/lib/auth/guards";
import { StaffDashboard } from "@/components/staff/StaffDashboard";

export default async function PetugasL1Page() {
  // Cek role di server (lapisan otoritatif) — proxy.ts hanya pagar pertama.
  const user = await requireRole("PETUGAS_L1");
  return <StaffDashboard level="L1" user={user} />;
}
