import Link from "next/link";
import { notFound } from "next/navigation";
import type { CurrentUser } from "@/lib/auth/guards";
import { PLATFORM_LABEL, STATUS_BADGE, STATUS_LABEL, formatMinutes } from "@/lib/admin/constants";
import { getStaffTicket } from "@/lib/staff/queries";
import { getTicketAttachments } from "@/lib/chat/queries";
import { STAFF_LEVEL, getStaffAccess, isDone, type StaffLevel } from "@/lib/staff/rules";
import { Badge, Card, dateFmt } from "@/components/admin/ui";
import { RichText } from "@/components/RichText";
import { ChatPanel } from "@/components/staff/ChatPanel";
import { WorkspaceLayout } from "@/components/staff/WorkspaceLayout";
import { TicketActions } from "@/components/staff/TicketActions";
import { Info, OverdueChip, PriorityBadge, StatusBadge } from "@/components/staff/TicketBits";

const ACTOR_LABEL = { BOT: "Bot", L1: "Petugas L1", L2: "Petugas L2", SYSTEM: "System", ADMIN: "Admin" } as const;

const minutes = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000;

// Detail tiket Petugas: chat di kiri (L1: Public chat + Internal note; L2: hanya obrolan dengan L1), info tiket di kanan.
export async function TicketWorkspace({ level, user, ticketId }: { level: StaffLevel; user: CurrentUser; ticketId: string }) {
  const cfg = STAFF_LEVEL[level];
  const data = await getStaffTicket(level, user.id, ticketId);
  if (!data) notFound();

  const { ticket, publicMessages, internalMessages, hasInternalSession, sla } = data;
  const attachments = await getTicketAttachments(ticket.id); // akses tiket sudah lolos di getStaffTicket
  const access = getStaffAccess(level, user.id, {
    status: ticket.status,
    assignedL1Id: ticket.assignedL1Id,
    assignedL2Id: ticket.assignedL2Id,
    hasInternalSession,
  });
  const done = isDone(ticket.status);
  const overdue = !done && (sla.verdict.response === "breached" || sla.verdict.resolution === "breached");

  return (
    <div className="space-y-6 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:space-y-3">
      {/* Satu baris ringkas: tombol kembali, status, judul, dan aksi — supaya chat & detail dapat tinggi maksimal. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          href={`${cfg.base}/tickets`}
          className="shrink-0 text-[13px] font-semibold text-muted transition hover:text-brand"
        >
          ← Tickets
        </Link>
        <span aria-hidden className="hidden h-5 w-px bg-line sm:block" />
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          {overdue && <OverdueChip />}
        </div>
        <h2
          title={ticket.judul}
          className="order-last w-full min-w-0 truncate text-[17px] font-extrabold leading-tight tracking-tight text-ink sm:order-none sm:w-auto sm:flex-1"
        >
          {ticket.judul}
        </h2>
        <div className="ml-auto shrink-0">
          <TicketActions
            ticketId={ticket.id}
            access={{ canClaim: access.canClaim, canEscalate: access.canEscalate, canResolve: access.canResolve }}
          />
        </div>
      </div>

      <WorkspaceLayout
        chat={
        <ChatPanel
          level={level}
          ticketId={ticket.id}
          viewerId={user.id}
          clientName={ticket.client.name}
          publicMessages={publicMessages}
          internalMessages={internalMessages}
          access={access}
          canEscalate={access.canEscalate}
          live={!done}
          initialCursor={
            [...publicMessages, ...internalMessages].map((m) => m.createdAt).sort().at(-1) ?? ticket.createdAt.toISOString()
          }
          initialStatus={ticket.status}
          attachments={attachments}
          descriptionHtml={ticket.deskripsi}
          openedAt={ticket.createdAt.toISOString()}
        />
        }
        side={
        <>
          <Card className="space-y-5 md:p-6">
            <h3 className="text-[16px] font-extrabold tracking-tight text-ink">Ticket details</h3>
            <Info label="Client">
              {ticket.client.name}
              <span className="block text-[12px] text-muted">{ticket.client.email}</span>
            </Info>
            <div className="grid grid-cols-2 gap-5">
              <Info label="Category">{ticket.category.nama}</Info>
              <Info label="Opened">{dateFmt(ticket.createdAt, true)}</Info>
            </div>
            <Info label="Application">
              {ticket.aplikasi}
              <span className="block text-[12px] text-muted">{PLATFORM_LABEL[ticket.platform]}</span>
            </Info>
            <div className="grid grid-cols-2 gap-5">
              <Info label="Petugas L1">{ticket.assignedL1?.name ?? <span className="text-muted">Not assigned</span>}</Info>
              <Info label="Petugas L2">{ticket.assignedL2?.name ?? <span className="text-muted">{hasInternalSession ? "Waiting" : "Not escalated"}</span>}</Info>
            </div>
            <Info label="First reply">
              {sla.firstReply ? (
                `${formatMinutes(minutes(ticket.createdAt, sla.firstReply))} after creation`
              ) : (
                <span className="text-muted">No reply yet</span>
              )}
            </Info>
            <Info label="SLA target">
              {sla.target ? (
                <>
                  Respond within {formatMinutes(sla.target.respon)}
                  <span className="block text-[12px] text-muted">Resolve within {formatMinutes(sla.target.selesai)}</span>
                </>
              ) : (
                <span className="text-muted">Not set for this priority</span>
              )}
            </Info>
            {ticket.resolvedAt && <Info label="Resolved">{dateFmt(ticket.resolvedAt, true)}</Info>}
          </Card>

          <Card className="md:p-6">
            <h3 className="text-[16px] font-extrabold tracking-tight text-ink">Client&apos;s request</h3>
            <RichText html={ticket.deskripsi} className="mt-3 max-h-80 overflow-y-auto pr-1" />
          </Card>

          <Card className="md:p-6">
            <h3 className="text-[16px] font-extrabold tracking-tight text-ink">Timeline</h3>
            {ticket.timeline.length === 0 ? (
              <p className="mt-3 text-[13px] text-muted">No status changes recorded yet.</p>
            ) : (
              <ol className="mt-5 space-y-5 border-l border-line pl-6">
                {ticket.timeline.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={STATUS_BADGE[e.statusBaru]}>{STATUS_LABEL[e.statusBaru]}</Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-muted">
                      {ACTOR_LABEL[e.actorType]}
                      {e.actor ? ` · ${e.actor.name}` : ""} · {dateFmt(e.createdAt, true)}
                    </p>
                    {e.catatan && <p className="mt-1 text-[13px] text-ink/80">{e.catatan}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </>
        }
      />
    </div>
  );
}
