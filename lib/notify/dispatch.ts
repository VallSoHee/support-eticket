import { after } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { PRIORITY_LABEL } from "@/lib/admin/constants";
import { emitUserNotified } from "@/lib/notify/bus";
import {
  ANNOUNCE_AUDIENCE_OPTIONS,
  EVENT_BY_KEY,
  MESSAGE_MAX,
  TITLE_MAX,
  parseAudience,
  renderTemplate,
  resolveHref,
  type Audience,
  type EventKey,
  type NotifyVars,
  type Target,
} from "@/lib/notify/events";

// Mesin pengiriman notifikasi. Dua pintu masuk:
//   dispatchEvent  -> kejadian otomatis (buat tiket, balas chat, ...), aturannya dari halaman Admin > Notifications.
//   sendAnnouncement -> tombol "Send now" Admin (pengumuman mendadak).
// Keduanya HANYA menulis ke tabel notifications lalu membangunkan stream SSE penerima. Kegagalan di sini
// tidak boleh menggagalkan aksi utama (kirim chat, buat tiket, ...), jadi dispatchEvent tidak pernah melempar error.

type Rule = { enabled: boolean; title: string; message: string; audience: Audience[]; target: Target; customPath: string | null };

/** Aturan efektif sebuah kejadian: baris DB (hasil simpan Admin) menimpa nilai bawaan kode. */
export async function getEffectiveRule(key: EventKey): Promise<Rule | null> {
  const def = EVENT_BY_KEY.get(key);
  if (!def) return null;
  const row = await prisma.notificationRule.findUnique({ where: { eventKey: key } });
  if (!row) {
    return { enabled: def.enabled, title: def.title, message: def.message, audience: def.audience, target: def.target, customPath: null };
  }
  return {
    enabled: row.enabled,
    title: row.title,
    message: row.message,
    // Dibatasi ke pilihan yang valid untuk kejadian ini, walau DB diubah manual.
    audience: parseAudience(row.audience, def.audienceOptions),
    target: row.target,
    customPath: row.customPath,
  };
}

type Recipient = { id: string; role: Role };

function audienceWhere(audience: readonly Audience[], ticket?: { clientId: string; assignedL1Id: string | null; assignedL2Id: string | null }) {
  const or: Prisma.UserWhereInput[] = [];
  for (const a of audience) {
    if (a === "CLIENT" && ticket) or.push({ id: ticket.clientId });
    else if (a === "ASSIGNED_L1" && ticket?.assignedL1Id) or.push({ id: ticket.assignedL1Id });
    else if (a === "ASSIGNED_L2" && ticket?.assignedL2Id) or.push({ id: ticket.assignedL2Id });
    else if (a === "ALL_L1") or.push({ role: "PETUGAS_L1" });
    else if (a === "ALL_L2") or.push({ role: "PETUGAS_L2" });
    else if (a === "ADMINS") or.push({ role: "ADMIN" });
    else if (a === "ALL_CLIENTS") or.push({ role: "CLIENT" });
  }
  return or;
}

async function findRecipients(or: Prisma.UserWhereInput[], excludeId?: string | null): Promise<Recipient[]> {
  if (or.length === 0) return [];
  // Akun nonaktif tidak menerima apa pun. Pelaku aksi tidak diberi notifikasi atas aksinya sendiri.
  return prisma.user.findMany({
    where: { isActive: true, OR: or, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, role: true },
  });
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// Pesan chat beruntun tidak boleh membanjiri bel: selama notifikasi sejenis untuk tiket yang sama belum
// dibaca, isinya diperbarui (cuplikan terbaru + naik ke atas) alih-alih menambah baris baru.
const COALESCE = new Set<EventKey>(["CLIENT_REPLIED", "AGENT_REPLIED", "BOT_REPLIED", "INTERNAL_NOTE"]);

export type DispatchInput = {
  ticketId: string;
  /** Pelaku aksi — dikecualikan dari penerima dan jadi {actor}. */
  actorId?: string | null;
  /** Nama pelaku bila sudah diketahui (menghemat satu query); selain itu dicari dari actorId. */
  actorName?: string | null;
  /** Cuplikan isi pesan untuk {preview}. */
  preview?: string;
};

/** Kirim notifikasi untuk satu kejadian. Aman dipanggil dari mana saja: tidak pernah melempar error. Mengembalikan jumlah penerima. */
export async function dispatchEvent(key: EventKey, input: DispatchInput): Promise<number> {
  try {
    const rule = await getEffectiveRule(key);
    if (!rule || !rule.enabled || rule.audience.length === 0) return 0;

    const ticket = await prisma.ticket.findUnique({
      where: { id: input.ticketId },
      select: {
        id: true,
        judul: true,
        aplikasi: true,
        priority: true,
        clientId: true,
        assignedL1Id: true,
        assignedL2Id: true,
        client: { select: { name: true } },
      },
    });
    if (!ticket) return 0;

    let actorName = input.actorName ?? null;
    if (!actorName && input.actorId) {
      actorName = (await prisma.user.findUnique({ where: { id: input.actorId }, select: { name: true } }))?.name ?? null;
    }

    const vars: NotifyVars = {
      ticket: ticket.judul,
      client: ticket.client.name,
      actor: actorName ?? "Someone",
      app: ticket.aplikasi,
      priority: PRIORITY_LABEL[ticket.priority],
      preview: input.preview ?? "",
    };
    const title = clip(renderTemplate(rule.title, vars), TITLE_MAX) || "Notification";
    const message = clip(renderTemplate(rule.message, vars), MESSAGE_MAX) || title;
    const type = EVENT_BY_KEY.get(key)!.type;

    const recipients = await findRecipients(audienceWhere(rule.audience, ticket), input.actorId);
    if (recipients.length === 0) return 0;

    const hrefOf = (r: Recipient) => resolveHref(r.role, rule.target, rule.customPath, ticket.id);

    let fresh = recipients;
    if (COALESCE.has(key)) {
      const existing = await prisma.notification.findMany({
        where: { userId: { in: recipients.map((r) => r.id) }, ticketId: ticket.id, type, title, isRead: false },
        select: { id: true, userId: true },
      });
      const have = new Map(existing.map((e) => [e.userId, e.id]));
      if (have.size > 0) {
        const now = new Date();
        await prisma.$transaction(
          recipients
            .filter((r) => have.has(r.id))
            .map((r) => prisma.notification.update({ where: { id: have.get(r.id)! }, data: { message, createdAt: now, href: hrefOf(r) } })),
        );
        fresh = recipients.filter((r) => !have.has(r.id));
      }
    }

    if (fresh.length > 0) {
      await prisma.notification.createMany({
        data: fresh.map((r) => ({ userId: r.id, ticketId: ticket.id, type, title, message, href: hrefOf(r) })),
      });
    }
    emitUserNotified(recipients.map((r) => r.id));
    return recipients.length;
  } catch (e) {
    console.error("[notify]", key, e);
    return 0;
  }
}

/** Seperti dispatchEvent tapi dijalankan SETELAH respons dikirim (pemakai tidak menunggu). Hanya dari Server Action / Route Handler. */
export function notifyLater(key: EventKey, input: DispatchInput) {
  after(() => dispatchEvent(key, input));
}

// ---------------------------------------------------------------------------
// Pengumuman manual
// ---------------------------------------------------------------------------
export type AnnouncementInput = {
  title: string;
  message: string;
  audience: Audience[];
  target: Target;
  customPath: string | null;
};

const CHUNK = 500;

export async function sendAnnouncement(input: AnnouncementInput): Promise<number> {
  // Pengumuman tidak terikat tiket -> hanya audiens massal yang berlaku. Admin pengirim ikut menerima bila
  // memilih "All admins" (disengaja: ia bisa langsung melihat hasilnya di bel).
  const audience = input.audience.filter((a) => ANNOUNCE_AUDIENCE_OPTIONS.includes(a));
  const recipients = await findRecipients(audienceWhere(audience));
  if (recipients.length === 0) return 0;

  const title = clip(input.title.trim(), TITLE_MAX);
  const message = clip(input.message.trim(), MESSAGE_MAX);
  for (let i = 0; i < recipients.length; i += CHUNK) {
    await prisma.notification.createMany({
      data: recipients.slice(i, i + CHUNK).map((r) => ({
        userId: r.id,
        type: "ANNOUNCEMENT" as const,
        title,
        message,
        href: resolveHref(r.role, input.target, input.customPath, null),
      })),
    });
  }
  emitUserNotified(recipients.map((r) => r.id));
  return recipients.length;
}

/** Berapa orang yang akan menerima pengumuman ini (untuk teks konfirmasi sebelum "Send now"). */
export async function countAnnouncementRecipients(audience: Audience[]): Promise<number> {
  const or = audienceWhere(audience.filter((a) => ANNOUNCE_AUDIENCE_OPTIONS.includes(a)));
  if (or.length === 0) return 0;
  return prisma.user.count({ where: { isActive: true, OR: or } });
}
