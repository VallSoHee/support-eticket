import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import {
  deleteAnnouncementAction,
  resetEventRuleAction,
  sendAnnouncementNowAction,
  toggleEventRuleAction,
} from "@/lib/admin/notification-actions";
import { countAnnouncementRecipients } from "@/lib/notify/dispatch";
import { ANNOUNCE_AUDIENCE_OPTIONS, AUDIENCE_SHORT, EVENTS, TARGET_LABEL, parseAudience } from "@/lib/notify/events";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { SendNowButton } from "@/components/admin/SendNowButton";
import { Badge, EmptyRow, Flash, PageHeader, TableShell, Th, dateFmt, primaryBtn, smallBtn } from "@/components/admin/ui";

const ERRORS: Record<string, string> = { "not-found": "That announcement no longer exists." };
const SUCCESS: Record<string, string> = {
  saved: "Notification settings saved.",
  reset: "Notification reset to its default settings.",
  created: "Announcement saved. Press “Send now” when you want to send it.",
  updated: "Announcement updated.",
  deleted: "Announcement deleted.",
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; n?: string }>;
}) {
  await requireRole("ADMIN");
  const sp = await searchParams;

  const [rows, announcements] = await Promise.all([
    prisma.notificationRule.findMany({ where: { eventKey: { not: null } } }),
    prisma.notificationRule.findMany({ where: { eventKey: null }, orderBy: { createdAt: "desc" } }),
  ]);
  const byKey = new Map(rows.map((r) => [r.eventKey, r]));

  // Jumlah penerima tiap pengumuman, untuk teks konfirmasi "Send now".
  const counts = new Map(
    await Promise.all(
      announcements.map(async (a) => [a.id, await countAnnouncementRecipients(parseAudience(a.audience, ANNOUNCE_AUDIENCE_OPTIONS))] as const),
    ),
  );

  const sent = Number.parseInt(sp.n ?? "", 10);
  const success =
    sp.success === "sent"
      ? `Notification sent to ${Number.isFinite(sent) ? sent : 0} user${sent === 1 ? "" : "s"}.`
      : sp.success
        ? SUCCESS[sp.success]
        : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Notifications"
        description="Choose what triggers a notification, who receives it, and where it leads — or send an announcement right now."
        action={
          <Link href="/admin/notifications/new" className={primaryBtn}>
            + New announcement
          </Link>
        }
      />
      <Flash error={sp.error ? (ERRORS[sp.error] ?? "Something went wrong.") : null} success={success} />

      <section className="space-y-3">
        <div>
          <h3 className="text-[15px] font-bold text-ink">Automatic notifications</h3>
          <p className="text-[13px] text-muted">Sent by the system when something happens on a ticket. Changes apply immediately.</p>
        </div>
        <TableShell minWidth={860}>
          <thead>
            <tr className="border-b border-line">
              <Th>Event</Th>
              <Th>Recipients</Th>
              <Th>Opens</Th>
              <Th>Status</Th>
              <Th right>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {EVENTS.map((def) => {
              const row = byKey.get(def.key);
              const enabled = row?.enabled ?? def.enabled;
              const audience = row ? parseAudience(row.audience, def.audienceOptions) : def.audience;
              const target = row?.target ?? def.target;
              return (
                <tr key={def.key} className="border-b border-line align-top last:border-0 hover:bg-field/60">
                  <td className="px-5 py-4">
                    <Link href={`/admin/notifications/${def.key}/edit`} className="font-semibold text-ink hover:text-brand">
                      {def.label}
                    </Link>
                    <p className="mt-0.5 max-w-sm text-[12px] text-muted">{def.when}</p>
                    {row && <p className="mt-1 text-[11px] font-semibold text-brand">Customized</p>}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {audience.length === 0 && <span className="text-[12px] italic text-muted">Nobody</span>}
                      {audience.map((a) => (
                        <Badge key={a} className="bg-field text-ink">
                          {AUDIENCE_SHORT[a]}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-muted">{TARGET_LABEL[target]}</td>
                  <td className="px-5 py-4">
                    <form action={toggleEventRuleAction.bind(null, def.key)}>
                      <button
                        type="submit"
                        aria-label={`${enabled ? "Turn off" : "Turn on"} “${def.label}”`}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                          enabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-line bg-field text-muted hover:border-brand hover:text-brand"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${enabled ? "bg-emerald-500" : "bg-[#c3c8d4]"}`} />
                        {enabled ? "On" : "Off"}
                      </button>
                    </form>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/notifications/${def.key}/edit`} className={smallBtn}>
                        Edit
                      </Link>
                      {row && (
                        <DeleteButton
                          action={resetEventRuleAction.bind(null, def.key)}
                          label="Reset"
                          message={`Reset “${def.label}” to its default settings?`}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-[15px] font-bold text-ink">Announcements</h3>
          <p className="text-[13px] text-muted">
            Saved messages you send on demand, such as planned maintenance or an urgent notice. “Send now” delivers it immediately to everyone in the audience.
          </p>
        </div>
        <TableShell minWidth={860}>
          <thead>
            <tr className="border-b border-line">
              <Th>Announcement</Th>
              <Th>Send to</Th>
              <Th>Opens</Th>
              <Th>Last sent</Th>
              <Th right>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {announcements.length === 0 && (
              <EmptyRow colSpan={5}>No announcements yet. Create one to be able to send a notice in one click.</EmptyRow>
            )}
            {announcements.map((a) => (
              <tr key={a.id} className="border-b border-line align-top last:border-0 hover:bg-field/60">
                <td className="px-5 py-4">
                  <Link href={`/admin/notifications/${a.id}/edit`} className="font-semibold text-ink hover:text-brand">
                    {a.name}
                  </Link>
                  <p className="mt-0.5 max-w-sm truncate text-[12px] text-muted">{a.title}</p>
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {parseAudience(a.audience, ANNOUNCE_AUDIENCE_OPTIONS).map((x) => (
                      <Badge key={x} className="bg-field text-ink">
                        {AUDIENCE_SHORT[x]}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    {counts.get(a.id) ?? 0} active user{counts.get(a.id) === 1 ? "" : "s"}
                  </p>
                </td>
                <td className="px-5 py-4 text-muted">{TARGET_LABEL[a.target]}</td>
                <td className="px-5 py-4 text-muted">
                  {a.lastSentAt ? (
                    <>
                      {dateFmt(a.lastSentAt, true)}
                      <span className="block text-[11px]">to {a.lastSentCount ?? 0} user{a.lastSentCount === 1 ? "" : "s"}</span>
                    </>
                  ) : (
                    "Never"
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <SendNowButton action={sendAnnouncementNowAction.bind(null, a.id)} title={a.title} count={counts.get(a.id) ?? 0} />
                    <Link href={`/admin/notifications/${a.id}/edit`} className={smallBtn}>
                      Edit
                    </Link>
                    <DeleteButton
                      action={deleteAnnouncementAction.bind(null, a.id)}
                      message={`Delete “${a.name}”? Notifications already delivered stay in people's inboxes.`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </section>
    </div>
  );
}
