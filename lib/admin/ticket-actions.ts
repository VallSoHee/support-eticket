"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/admin/audit";
import { ticketPrioritySchema } from "@/lib/admin/master-validation";
import { PRIORITY_LABEL } from "@/lib/admin/constants";
import type { MasterFormState } from "@/lib/admin/master-types";

// FR-3.2 — priority default dari kategori, tapi boleh diubah manual oleh petugas/admin.
// Perubahan dicatat di timeline tiket (FR-3.4) dan audit log (FR-8.1).
export async function updateTicketPriorityAction(
  ticketId: string,
  _prev: MasterFormState,
  formData: FormData,
): Promise<MasterFormState> {
  const actor = await requireRole("ADMIN");
  const parsed = ticketPrioritySchema.safeParse({ priority: formData.get("priority") });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { error: "Ticket not found." };
  if (ticket.priority === parsed.data.priority) return { success: "Priority is already set to this value." };

  const note = `Priority changed from ${PRIORITY_LABEL[ticket.priority]} to ${PRIORITY_LABEL[parsed.data.priority]} by admin.`;
  await prisma.$transaction([
    prisma.ticket.update({ where: { id: ticketId }, data: { priority: parsed.data.priority } }),
    prisma.ticketTimeline.create({
      data: { ticketId, statusBaru: ticket.status, actorType: "ADMIN", actorId: actor.id, catatan: note },
    }),
  ]);

  await writeAudit({
    actorId: actor.id,
    action: "TICKET_PRIORITY_CHANGE",
    entityType: "Ticket",
    entityId: ticketId,
    description: `${note} ("${ticket.judul}")`,
  });
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
  return { success: "Priority updated." };
}
