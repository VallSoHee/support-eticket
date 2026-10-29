"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/admin/audit";
import { announcementSchema, eventRuleSchema } from "@/lib/admin/notification-validation";
import type { MasterFormState } from "@/lib/admin/master-types";
import { sendAnnouncement } from "@/lib/notify/dispatch";
import {
  ANNOUNCE_AUDIENCE_OPTIONS,
  AUDIENCE_SHORT,
  EVENT_BY_KEY,
  TARGET_LABEL,
  joinAudience,
  parseAudience,
  type Audience,
  type Target,
} from "@/lib/notify/events";

// Pengaturan notifikasi (Admin): aturan kejadian bawaan + pengumuman manual dengan tombol "Send now".

const BASE = "/admin/notifications";
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

function readCommon(formData: FormData) {
  return {
    title: str(formData.get("title")),
    message: str(formData.get("message")),
    target: str(formData.get("target")),
    customPath: str(formData.get("customPath")),
  };
}

const audienceText = (list: readonly Audience[]) => list.map((a) => AUDIENCE_SHORT[a]).join(", ") || "nobody";

// ---------------------------------------------------------------------------
// Kejadian bawaan
// ---------------------------------------------------------------------------

export async function saveEventRuleAction(key: string, _prev: MasterFormState, formData: FormData): Promise<MasterFormState> {
  const actor = await requireRole("ADMIN");
  const def = EVENT_BY_KEY.get(key);
  if (!def) return { error: "Unknown notification." };

  const enabled = formData.get("enabled") === "on";
  // Hanya penerima yang valid untuk kejadian ini yang diterima, apa pun yang dikirim browser.
  const audience = parseAudience(formData.getAll("audience").filter((v): v is string => typeof v === "string").join(","), def.audienceOptions);
  const values = { ...readCommon(formData), enabled: enabled ? "on" : "", audience: joinAudience(audience) };

  const parsed = eventRuleSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  if (enabled && audience.length === 0) {
    return { fieldErrors: { audience: ["Choose at least one recipient, or turn this notification off."] }, values };
  }

  const data = {
    enabled,
    title: parsed.data.title,
    message: parsed.data.message,
    audience: joinAudience(audience),
    target: parsed.data.target,
    customPath: parsed.data.target === "CUSTOM" ? parsed.data.customPath : null,
  };
  const saved = await prisma.notificationRule.upsert({
    where: { eventKey: key },
    create: { eventKey: key, name: def.label, ...data },
    update: data,
  });

  await writeAudit({
    actorId: actor.id,
    action: "NOTIFICATION_RULE_UPDATE",
    entityType: "NotificationRule",
    entityId: saved.id,
    description: `Notification "${def.label}": ${enabled ? "on" : "off"}, recipients: ${audienceText(audience)}, opens: ${TARGET_LABEL[data.target]}.`,
  });
  revalidatePath(BASE);
  redirect(`${BASE}?success=saved`);
}

/** Tombol On/Off cepat di daftar. Membuat baris dari nilai bawaan bila belum pernah disimpan. */
export async function toggleEventRuleAction(key: string) {
  const actor = await requireRole("ADMIN");
  const def = EVENT_BY_KEY.get(key);
  if (!def) return;

  const row = await prisma.notificationRule.findUnique({ where: { eventKey: key } });
  const enabled = !(row?.enabled ?? def.enabled);
  const saved = row
    ? await prisma.notificationRule.update({ where: { id: row.id }, data: { enabled } })
    : await prisma.notificationRule.create({
        data: {
          eventKey: key,
          name: def.label,
          enabled,
          title: def.title,
          message: def.message,
          audience: joinAudience(def.audience),
          target: def.target,
        },
      });

  await writeAudit({
    actorId: actor.id,
    action: "NOTIFICATION_RULE_UPDATE",
    entityType: "NotificationRule",
    entityId: saved.id,
    description: `Notification "${def.label}" turned ${enabled ? "on" : "off"}.`,
  });
  revalidatePath(BASE);
}

/** Kembalikan ke nilai bawaan: baris DB dihapus, kode bawaan berlaku lagi. */
export async function resetEventRuleAction(key: string) {
  const actor = await requireRole("ADMIN");
  const def = EVENT_BY_KEY.get(key);
  if (!def) redirect(BASE);

  const row = await prisma.notificationRule.findUnique({ where: { eventKey: key } });
  if (row) {
    await prisma.notificationRule.delete({ where: { id: row.id } });
    await writeAudit({
      actorId: actor.id,
      action: "NOTIFICATION_RULE_RESET",
      entityType: "NotificationRule",
      entityId: row.id,
      description: `Notification "${def.label}" reset to its default settings.`,
    });
  }
  revalidatePath(BASE);
  redirect(`${BASE}?success=reset`);
}

// ---------------------------------------------------------------------------
// Pengumuman manual (template + "Send now")
// ---------------------------------------------------------------------------

function readAnnouncement(formData: FormData) {
  const audience = parseAudience(
    formData.getAll("audience").filter((v): v is string => typeof v === "string").join(","),
    ANNOUNCE_AUDIENCE_OPTIONS,
  );
  return {
    audience,
    values: { name: str(formData.get("name")), ...readCommon(formData), audience: joinAudience(audience) },
  };
}

async function deliver(
  actorId: string,
  rule: { id: string; title: string; message: string; audience: string; target: Target; customPath: string | null },
): Promise<number> {
  const audience = parseAudience(rule.audience, ANNOUNCE_AUDIENCE_OPTIONS);
  const count = await sendAnnouncement({ title: rule.title, message: rule.message, audience, target: rule.target, customPath: rule.customPath });
  await prisma.notificationRule.update({ where: { id: rule.id }, data: { lastSentAt: new Date(), lastSentCount: count } });
  await writeAudit({
    actorId,
    action: "ANNOUNCEMENT_SEND",
    entityType: "NotificationRule",
    entityId: rule.id,
    description: `Sent announcement "${rule.title}" to ${count} user${count === 1 ? "" : "s"} (${audienceText(audience)}).`,
  });
  return count;
}

async function saveAnnouncement(id: string | null, formData: FormData): Promise<MasterFormState> {
  const actor = await requireRole("ADMIN");
  const { audience, values } = readAnnouncement(formData);

  const parsed = announcementSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  if (audience.length === 0) return { fieldErrors: { audience: ["Choose who should receive this announcement."] }, values };

  const data = {
    name: parsed.data.name,
    enabled: true,
    title: parsed.data.title,
    message: parsed.data.message,
    audience: joinAudience(audience),
    target: parsed.data.target as Target,
    customPath: parsed.data.target === "CUSTOM" ? parsed.data.customPath : null,
  };

  let saved;
  if (id) {
    const existing = await prisma.notificationRule.findFirst({ where: { id, eventKey: null }, select: { id: true } });
    if (!existing) return { error: "Announcement not found." };
    saved = await prisma.notificationRule.update({ where: { id }, data });
  } else {
    saved = await prisma.notificationRule.create({ data });
  }

  await writeAudit({
    actorId: actor.id,
    action: id ? "ANNOUNCEMENT_UPDATE" : "ANNOUNCEMENT_CREATE",
    entityType: "NotificationRule",
    entityId: saved.id,
    description: `${id ? "Updated" : "Created"} announcement "${data.name}" (${audienceText(audience)}).`,
  });

  let result = id ? "updated" : "created";
  if (formData.get("intent") === "send") {
    const count = await deliver(actor.id, saved);
    result = `sent&n=${count}`;
  }
  revalidatePath(BASE);
  redirect(`${BASE}?success=${result}`);
}

export async function createAnnouncementAction(_prev: MasterFormState, formData: FormData): Promise<MasterFormState> {
  return saveAnnouncement(null, formData);
}

export async function updateAnnouncementAction(id: string, _prev: MasterFormState, formData: FormData): Promise<MasterFormState> {
  return saveAnnouncement(id, formData);
}

/** Tombol "Send now" di daftar: kirim template yang tersimpan, saat ini juga. */
export async function sendAnnouncementNowAction(id: string) {
  const actor = await requireRole("ADMIN");
  const rule = await prisma.notificationRule.findFirst({ where: { id, eventKey: null } });
  if (!rule) redirect(`${BASE}?error=not-found`);

  const count = await deliver(actor.id, rule);
  revalidatePath(BASE);
  redirect(`${BASE}?success=sent&n=${count}`);
}

export async function deleteAnnouncementAction(id: string) {
  const actor = await requireRole("ADMIN");
  const rule = await prisma.notificationRule.findFirst({ where: { id, eventKey: null } });
  if (!rule) redirect(`${BASE}?error=not-found`);

  // Notifikasi yang sudah terkirim tidak ikut terhapus: itu milik penerimanya.
  await prisma.notificationRule.delete({ where: { id } });
  await writeAudit({
    actorId: actor.id,
    action: "ANNOUNCEMENT_DELETE",
    entityType: "NotificationRule",
    entityId: id,
    description: `Deleted announcement "${rule.name}".`,
  });
  revalidatePath(BASE);
  redirect(`${BASE}?success=deleted`);
}
