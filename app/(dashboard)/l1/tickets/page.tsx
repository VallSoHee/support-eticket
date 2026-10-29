import { requireRole } from "@/lib/auth/guards";
import { StaffTicketsPage } from "@/components/staff/StaffTicketsPage";

export default async function PetugasL1TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; priority?: string; page?: string }>;
}) {
  const user = await requireRole("PETUGAS_L1");
  return <StaffTicketsPage level="L1" user={user} sp={await searchParams} />;
}
