import { Platform, Priority, ShiftType, TicketStatus } from "@/generated/prisma/enums";

// Konstanta tampilan untuk modul Admin. Sengaja hanya mengimpor enums.ts (objek biasa),
// bukan Prisma Client, jadi aman dipakai di komponen client.
export const PRIORITIES = [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.CRITICAL] as const;

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const PRIORITY_BADGE: Record<Priority, string> = {
  LOW: "bg-field text-muted",
  MEDIUM: "bg-sky-50 text-sky-700",
  HIGH: "bg-amber-50 text-amber-700",
  CRITICAL: "bg-brand-soft text-brand-dark",
};

// Penjelasan singkat tiap tingkat urgensi, ditampilkan di form pengajuan tiket client.
export const URGENCY_HINT: Record<Priority, string> = {
  LOW: "Low — minor issue or question, no rush",
  MEDIUM: "Medium — something is off but I can still work",
  HIGH: "High — an important feature is broken",
  CRITICAL: "Critical — the app is down or blocking everything",
};

export const PLATFORMS = [Platform.WEB, Platform.ANDROID, Platform.IOS, Platform.DESKTOP, Platform.OTHER] as const;

export const PLATFORM_LABEL: Record<Platform, string> = {
  WEB: "Web",
  ANDROID: "Android",
  IOS: "iOS",
  DESKTOP: "Desktop",
  OTHER: "Other",
};

// platforms Application disimpan sebagai teks "WEB,ANDROID" (urut sesuai PLATFORMS).
export function parsePlatforms(raw: string): Platform[] {
  const set = new Set(raw.split(",").map((x) => x.trim()));
  return PLATFORMS.filter((p) => set.has(p));
}
export const joinPlatforms = (list: readonly Platform[]) => PLATFORMS.filter((p) => list.includes(p)).join(",");

// FR-3.3 — urutan alur status tiket.
export const TICKET_STATUSES = [
  TicketStatus.OPEN,
  TicketStatus.BOT_HANDLING,
  TicketStatus.WAITING_AGENT_L1,
  TicketStatus.IN_PROGRESS_L1,
  TicketStatus.ESCALATED_L2,
  TicketStatus.IN_PROGRESS_L2,
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
] as const;

export const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Open",
  BOT_HANDLING: "Bot handling",
  WAITING_AGENT_L1: "Waiting agent (L1)",
  IN_PROGRESS_L1: "In progress (L1)",
  ESCALATED_L2: "Escalated (L2)",
  IN_PROGRESS_L2: "In progress (L2)",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const STATUS_BADGE: Record<TicketStatus, string> = {
  OPEN: "bg-field text-muted",
  BOT_HANDLING: "bg-violet-50 text-violet-700",
  WAITING_AGENT_L1: "bg-amber-50 text-amber-700",
  IN_PROGRESS_L1: "bg-sky-50 text-sky-700",
  ESCALATED_L2: "bg-orange-50 text-orange-700",
  IN_PROGRESS_L2: "bg-indigo-50 text-indigo-700",
  RESOLVED: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-field text-ink",
};

// Status yang dianggap "masih berjalan" (dipakai dashboard & laporan).
export const ACTIVE_STATUSES: TicketStatus[] = TICKET_STATUSES.filter((s) => s !== "RESOLVED" && s !== "CLOSED");

export const SHIFT_TYPES = [ShiftType.PAGI, ShiftType.SIANG, ShiftType.MALAM] as const;

export const SHIFT_LABEL: Record<ShiftType, string> = {
  PAGI: "Pagi",
  SIANG: "Siang",
  MALAM: "Malam",
};

// Jam default tiap shift (WIB). MALAM melewati tengah malam (selesai < mulai).
export const SHIFT_DEFAULT_TIME: Record<ShiftType, { start: string; end: string }> = {
  PAGI: { start: "07:00", end: "15:00" },
  SIANG: { start: "15:00", end: "23:00" },
  MALAM: { start: "23:00", end: "07:00" },
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  LOGIN: "Login",
  USER_CREATE: "User created",
  USER_UPDATE: "User updated",
  USER_DELETE: "User deleted",
  EMAIL_CHANGE: "Email changed",
  USER_ACTIVATE: "User activated",
  USER_DEACTIVATE: "User deactivated",
  CATEGORY_CREATE: "Category created",
  CATEGORY_UPDATE: "Category updated",
  CATEGORY_DELETE: "Category deleted",
  APPLICATION_CREATE: "Application created",
  APPLICATION_UPDATE: "Application updated",
  APPLICATION_DELETE: "Application deleted",
  FAQ_CREATE: "FAQ created",
  FAQ_UPDATE: "FAQ updated",
  FAQ_DELETE: "FAQ deleted",
  SLA_UPDATE: "SLA updated",
  SHIFT_CREATE: "Shift created",
  SHIFT_UPDATE: "Shift updated",
  SHIFT_DELETE: "Shift deleted",
  SHIFT_GENERATE: "Shifts generated",
  TICKET_CREATE: "Ticket created",
  TICKET_PRIORITY_CHANGE: "Ticket priority changed",
  TICKET_STATUS_CHANGE: "Ticket status changed",
  TICKET_ESCALATE: "Ticket escalated",
  REPORT_EXPORT: "Report exported",
  NOTIFICATION_RULE_UPDATE: "Notification rule updated",
  NOTIFICATION_RULE_RESET: "Notification rule reset",
  ANNOUNCEMENT_CREATE: "Announcement created",
  ANNOUNCEMENT_UPDATE: "Announcement updated",
  ANNOUNCEMENT_DELETE: "Announcement deleted",
  ANNOUNCEMENT_SEND: "Announcement sent",
};

/** 90 -> "1 h 30 min". Dipakai untuk target SLA & rata-rata waktu. */
export function formatMinutes(total: number | null | undefined): string {
  if (total == null || !Number.isFinite(total)) return "—";
  const m = Math.max(0, Math.round(total));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h < 24) return rest ? `${h} h ${rest} min` : `${h} h`;
  const d = Math.floor(h / 24);
  const hh = h % 24;
  return hh ? `${d} d ${hh} h` : `${d} d`;
}

export const PAGE_SIZE = 15;
