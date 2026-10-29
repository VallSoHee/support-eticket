import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { ANNOUNCE_AUDIENCE_OPTIONS, EVENT_BY_KEY, parseAudience } from "@/lib/notify/events";
import { NotificationRuleForm } from "@/components/admin/NotificationRuleForm";

// [key] = kunci kejadian bawaan (mis. CLIENT_REPLIED) ATAU id pengumuman buatan Admin.
// Kunci kejadian huruf besar + underscore, sedangkan id berupa cuid — tidak mungkin bentrok.
export default async function EditNotificationPage({ params }: { params: Promise<{ key: string }> }) {
  await requireRole("ADMIN");
  const { key } = await params;

  const def = EVENT_BY_KEY.get(key);
  if (def) {
    const row = await prisma.notificationRule.findUnique({ where: { eventKey: key } });
    return (
      <NotificationRuleForm
        kind="event"
        def={def}
        rule={{
          enabled: row?.enabled ?? def.enabled,
          title: row?.title ?? def.title,
          message: row?.message ?? def.message,
          audience: row ? parseAudience(row.audience, def.audienceOptions) : def.audience,
          target: row?.target ?? def.target,
          customPath: row?.customPath ?? null,
        }}
      />
    );
  }

  const announcement = await prisma.notificationRule.findFirst({ where: { id: key, eventKey: null } });
  if (!announcement) notFound();
  return (
    <NotificationRuleForm
      kind="announcement"
      mode="edit"
      rule={{
        id: announcement.id,
        name: announcement.name,
        title: announcement.title,
        message: announcement.message,
        audience: parseAudience(announcement.audience, ANNOUNCE_AUDIENCE_OPTIONS),
        target: announcement.target,
        customPath: announcement.customPath,
      }}
    />
  );
}
