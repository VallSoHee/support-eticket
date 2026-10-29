import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { PLATFORM_LABEL, PRIORITY_BADGE, PRIORITY_LABEL, STATUS_BADGE, STATUS_LABEL } from "@/lib/admin/constants";
import { firstAgentReplyMap } from "@/lib/admin/metrics";
import { formatMinutes } from "@/lib/admin/constants";
import { Badge, Card, dateFmt } from "@/components/admin/ui";
import { TicketPriorityForm } from "@/components/admin/TicketPriorityForm";
import { RichText } from "@/components/RichText";

const ACTOR_LABEL = { BOT: "Bot", L1: "Petugas L1", L2: "Petugas L2", SYSTEM: "System", ADMIN: "Admin" } as const;

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-muted">{label}</p>
      <div className="mt-1 text-[14px] text-ink">{children}</div>
    </div>
  );
}

export default async function AdminTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      client: { select: { name: true, email: true } },
      category: { select: { nama: true } },
      assignedL1: { select: { name: true } },
      assignedL2: { select: { name: true } },
      timeline: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!ticket) notFound();

  const firstReply = (await firstAgentReplyMap([ticket.id])).get(ticket.id);
  const mins = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000;

  return (
    <div className="space-y-6">
      <Link href="/admin/tickets" className="text-[13px] font-semibold text-muted transition hover:text-brand">
        ← All tickets
      </Link>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={STATUS_BADGE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
          <Badge className={PRIORITY_BADGE[ticket.priority]}>{PRIORITY_LABEL[ticket.priority]}</Badge>
        </div>
        <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink">{ticket.judul}</h2>
        <RichText html={ticket.deskripsi} className="mt-3" />

        <div className="mt-6 grid gap-5 border-t border-line pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Client">
            {ticket.client.name}
            <span className="block text-[12px] text-muted">{ticket.client.email}</span>
          </Info>
          <Info label="Application">
            {ticket.aplikasi}
            <span className="block text-[12px] text-muted">{PLATFORM_LABEL[ticket.platform]}</span>
          </Info>
          <Info label="Category">{ticket.category.nama}</Info>
          <Info label="Created">{dateFmt(ticket.createdAt, true)}</Info>
          <Info label="Petugas L1">{ticket.assignedL1?.name ?? <span className="text-muted">Not assigned</span>}</Info>
          <Info label="Petugas L2">{ticket.assignedL2?.name ?? <span className="text-muted">Not escalated</span>}</Info>
          <Info label="Resolved">{ticket.resolvedAt ? dateFmt(ticket.resolvedAt, true) : <span className="text-muted">Not yet</span>}</Info>
          <Info label="First agent reply">
            {firstReply ? `${formatMinutes(mins(ticket.createdAt, firstReply))} after creation` : <span className="text-muted">No reply from L1 yet</span>}
          </Info>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <h3 className="text-lg font-extrabold tracking-tight text-ink">Timeline</h3>
          {ticket.timeline.length === 0 ? (
            <p className="mt-3 text-[13px] text-muted">No status changes recorded yet.</p>
          ) : (
            <ol className="mt-5 space-y-5 border-l border-line pl-6">
              {ticket.timeline.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={STATUS_BADGE[e.statusBaru]}>{STATUS_LABEL[e.statusBaru]}</Badge>
                    <span className="text-[12px] text-muted">
                      {ACTOR_LABEL[e.actorType]}
                      {e.actor ? ` · ${e.actor.name}` : ""} · {dateFmt(e.createdAt, true)}
                    </span>
                  </div>
                  {e.catatan && <p className="mt-1.5 text-[13px] text-ink/80">{e.catatan}</p>}
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="h-fit">
          <h3 className="text-lg font-extrabold tracking-tight text-ink">Adjust priority</h3>
          <p className="mb-4 mt-1 text-[13px] text-muted">The default comes from the category. The change is recorded in the timeline and audit log.</p>
          <TicketPriorityForm ticketId={ticket.id} priority={ticket.priority} />
        </Card>
      </div>
    </div>
  );
}
