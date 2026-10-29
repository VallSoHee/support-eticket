import { requireRole } from "@/lib/auth/guards";
import { TicketWorkspace } from "@/components/staff/TicketWorkspace";

export default async function PetugasL2TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("PETUGAS_L2");
  const { id } = await params;
  return <TicketWorkspace level="L2" user={user} ticketId={id} />;
}
