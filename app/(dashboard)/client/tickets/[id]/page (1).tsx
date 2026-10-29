import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { PLATFORM_LABEL, PRIORITY_BADGE, PRIORITY_LABEL, STATUS_BADGE } from "@/lib/admin/constants";
import { getClientTicket } from "@/lib/client/queries";
import { getRecentMessages } from "@/lib/chat/queries";
import { getClientChatAccess } from "@/lib/chat/rules";
import { isDone } from "@/lib/staff/rules";
import { CLIENT_STATUS_LABEL, STATUS_NOTE, TIMELINE_ACTOR } from "@/lib/client/stages";
import { Badge, Card, Flash, dateFmt } from "@/components/admin/ui";
import { RichText } from "@/components/RichText";
import { TicketTrack } from "@/components/client/TicketTrack";
import { ClientChat } from "@/components/client/ClientChat";

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-muted">{label}</p>
      <div className="mt-1 text-[14px] text-ink">{children}</div>
    </div>
  );
}

export default async function ClientTicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const user = await requireRole("CLIENT");
  const { id } = await params;
  const { submitted } = await searchParams;

  // Difilter clientId di query: tiket milik orang lain sama saja dengan "tidak ada" (404).
  const ticket = await getClientTicket(user.id, id);
  if (!ticket) notFound();

  const escalated = ticket.status === "ESCALATED_L2" || ticket.status === "IN_PROGRESS_L2";

  // Riwayat chat (Public saja) + aturan kirim, dihitung di server; stream SSE meneruskan sisanya.
  const messages = await getRecentMessages(ticket.id, { kind: "client" });
  const lastMessage = messages[messages.length - 1];

  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
      <Link href="/client/tickets" className="w-fit text-[13px] font-semibold text-muted transition hover:text-brand">
        ← My tickets
      </Link>

      {submitted === "1" && <Flash success="Your ticket has been submitted. We'll keep you updated here." />}

      <div className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(360px,460px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
        {/* Kiri: tracking tiket + detail + riwayat update. Scroll sendiri bila panjang. */}
        <div className="space-y-6 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <Card className="md:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={STATUS_BADGE[ticket.status]}>{CLIENT_STATUS_LABEL[ticket.status]}</Badge>
              <Badge className={PRIORITY_BADGE[ticket.priority]}>{PRIORITY_LABEL[ticket.priority]}</Badge>
            </div>
            <h2 className="mt-3 break-words text-2xl font-extrabold leading-tight tracking-tight text-ink">{ticket.judul}</h2>
            <p className="mt-2 text-[14px] text-muted">{STATUS_NOTE[ticket.status]}</p>

            <div className="mt-7">
              <TicketTrack status={ticket.status} />
            </div>

            <div className="mt-7 border-t border-line pt-5">
              <p className="text-[12px] font-semibold text-muted">Your request</p>
              <RichText html={ticket.deskripsi} className="mt-2" />
            </div>

            <div className="mt-5 grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
              <Info label="Application">
                {ticket.aplikasi}
                <span className="block text-[12px] text-muted">{PLATFORM_LABEL[ticket.platform]}</span>
              </Info>
              <Info label="Category">{ticket.category.nama}</Info>
              <Info label="Opened">{dateFmt(ticket.createdAt, true)}</Info>
              <Info label="Handled by">
                {ticket.assignedL1 ? (
                  <>
                    {ticket.assignedL1.name}
                    {escalated && <span className="block text-[12px] text-muted">with our technical team</span>}
                  </>
                ) : (
                  <span className="text-muted">Not assigned yet</span>
                )}
              </Info>
              <Info label="Resolved">
                {ticket.resolvedAt ? dateFmt(ticket.resolvedAt, true) : <span className="text-muted">Not yet</span>}
              </Info>
            </div>
          </Card>

          <Card className="md:p-6">
            <h3 className="text-lg font-extrabold tracking-tight text-ink">Updates</h3>
            {ticket.timeline.length === 0 ? (
              <p className="mt-3 text-[13px] text-muted">No updates yet. We&apos;ll list every change here.</p>
            ) : (
              <ol className="mt-5 space-y-5 border-l border-line pl-6">
                {ticket.timeline.map((e, i) => (
                  <li key={e.id} className="relative">
                    <span
                      className={`absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-brand ring-4 ring-brand/15" : "bg-line"}`}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={STATUS_BADGE[e.statusBaru]}>{CLIENT_STATUS_LABEL[e.statusBaru]}</Badge>
                      <span className="text-[12px] text-muted">
                        {TIMELINE_ACTOR[e.actorType]}, {dateFmt(e.createdAt, true)}
                      </span>
                    </div>
                    {/* Catatan petugas bisa berisi hal internal -> hanya catatan otomatis (bot/sistem) yang ditampilkan. */}
                    {e.catatan && (e.actorType === "BOT" || e.actorType === "SYSTEM") && (
                      <p className="mt-1.5 text-[13px] text-ink/80">{e.catatan}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        {/* Kanan: chat mengisi tinggi layar di desktop; 560px saat ditumpuk di mobile. */}
        <div className="lg:h-full lg:min-h-0">
          <ClientChat
            ticketId={ticket.id}
            viewerId={user.id}
            viewerName={user.name}
            initialMessages={messages}
            initialCursor={lastMessage?.createdAt ?? ticket.createdAt.toISOString()}
            initialStatus={ticket.status}
            access={getClientChatAccess(ticket.status)}
            live={!isDone(ticket.status)}
            className="h-[560px] lg:h-full"
          />
        </div>
      </div>
    </div>
  );
}
