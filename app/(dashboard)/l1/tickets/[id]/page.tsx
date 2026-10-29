import { requireRole } from "@/lib/auth/guards";
import { TicketWorkspace } from "@/components/staff/TicketWorkspace";

export default async function PetugasL1TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("PETUGAS_L1");
  const { id } = await params;
  return <TicketWorkspace level="L1" user={user} ticketId={id} />;
}
