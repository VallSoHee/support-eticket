import { requireRole } from "@/lib/auth/guards";
import { StaffDashboard } from "@/components/staff/StaffDashboard";

export default async function PetugasL2Page() {
  // Cek role di server (lapisan otoritatif) — proxy.ts hanya pagar pertama.
  const user = await requireRole("PETUGAS_L2");
  return <StaffDashboard level="L2" user={user} />;
}
