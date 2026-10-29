import "dotenv/config";
import { prisma } from "../lib/prisma";

// Tiket yang dibuat SEBELUM alur antrean dipasang berhenti di status OPEN dan tidak pernah
// muncul di antrean petugas. Skrip ini memasukkannya ke antrean L1. Aman dijalankan berulang.
//   npm run db:requeue
async function main() {
  const stuck = await prisma.ticket.findMany({ where: { status: "OPEN" }, select: { id: true } });
  for (const t of stuck) {
    await prisma.$transaction(async (tx) => {
      const res = await tx.ticket.updateMany({ where: { id: t.id, status: "OPEN" }, data: { status: "WAITING_AGENT_L1" } });
      if (res.count === 0) return;
      await tx.ticketTimeline.create({
        data: { ticketId: t.id, statusBaru: "WAITING_AGENT_L1", actorType: "SYSTEM", catatan: "Placed in the support queue." },
      });
      if ((await tx.queueEntry.count({ where: { ticketId: t.id, level: "L1" } })) === 0) {
        await tx.queueEntry.create({ data: { ticketId: t.id, level: "L1" } });
      }
      await tx.chatSession.upsert({
        where: { ticketId_type: { ticketId: t.id, type: "PUBLIC" } },
        update: {},
        create: { ticketId: t.id, type: "PUBLIC" },
      });
    });
  }
  console.log(`Requeued ${stuck.length} ticket(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
