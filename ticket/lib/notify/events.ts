import { ROLE_HOME, type Role } from "@/lib/roles";

// Definisi notifikasi — SATU sumber kebenaran untuk kejadian bawaan, penerima, tujuan klik, dan template.
// Modul murni (tanpa Prisma): aman dipakai di komponen client (form Admin) maupun server (dispatch).
//
// Alurnya: aksi di aplikasi (buat tiket, balas chat, klaim, eskalasi, ...) memanggil dispatchEvent(key).
// dispatchEvent membaca aturan Admin dari DB; kalau Admin belum pernah menyimpan, nilai bawaan di bawah dipakai.
// Jadi fitur langsung jalan tanpa seed.

// ---------------------------------------------------------------------------
// Penerima
// ---------------------------------------------------------------------------
export const AUDIENCES = ["CLIENT", "ASSIGNED_L1", "ASSIGNED_L2", "ALL_L1", "ALL_L2", "ADMINS", "ALL_CLIENTS"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABEL: Record<Audience, string> = {
  CLIENT: "Ticket owner (client)",
  ASSIGNED_L1: "L1 agent handling the ticket",
  ASSIGNED_L2: "L2 agent handling the ticket",
  ALL_L1: "All L1 agents",
  ALL_L2: "All L2 agents",
  ADMINS: "All admins",
  ALL_CLIENTS: "All clients",
};

/** Label pendek untuk tabel/chip di halaman Admin. */
export const AUDIENCE_SHORT: Record<Audience, string> = {
  CLIENT: "Client",
  ASSIGNED_L1: "Assigned L1",
  ASSIGNED_L2: "Assigned L2",
  ALL_L1: "All L1",
  ALL_L2: "All L2",
  ADMINS: "Admins",
  ALL_CLIENTS: "All clients",
};

export function parseAudience(raw: string | null | undefined, allowed: readonly Audience[] = AUDIENCES): Audience[] {
  const set = new Set((raw ?? "").split(",").map((x) => x.trim()));
  return AUDIENCES.filter((a) => set.has(a) && allowed.includes(a));
}
export const joinAudience = (list: readonly Audience[]) => AUDIENCES.filter((a) => list.includes(a)).join(",");

// ---------------------------------------------------------------------------
// Tujuan klik
// ---------------------------------------------------------------------------
export const TARGETS = ["TICKET", "TICKET_LIST", "DASHBOARD", "CUSTOM"] as const;
export type Target = (typeof TARGETS)[number];

export const TARGET_LABEL: Record<Target, string> = {
  TICKET: "The ticket (detail page)",
  TICKET_LIST: "Ticket list",
  DASHBOARD: "Dashboard",
  CUSTOM: "Custom page (path)",
};

/** Hanya path internal yang boleh jadi tujuan: diawali "/", bukan "//" atau "/\" (open redirect), tanpa karakter kontrol. */
export function safeInternalPath(raw: string | null | undefined): string | null {
  const p = (raw ?? "").trim();
  if (!p || p.length > 200) return null;
  if (!p.startsWith("/") || p.startsWith("//") || p.startsWith("/\\")) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(p)) return null;
  return p;
}

/** Tautan untuk SATU penerima: tiap role punya halaman tiketnya sendiri. */
export function resolveHref(role: Role, target: Target, customPath: string | null | undefined, ticketId?: string | null): string {
  const home = ROLE_HOME[role];
  switch (target) {
    case "TICKET":
      return ticketId ? `${home}/tickets/${ticketId}` : home;
    case "TICKET_LIST":
      return `${home}/tickets`;
    case "CUSTOM":
      return safeInternalPath((customPath ?? "").replaceAll("{ticketId}", ticketId ?? "")) ?? home;
    default:
      return home;
  }
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------
export type NotifyVars = Partial<Record<"ticket" | "client" | "actor" | "app" | "priority" | "preview", string>>;

export const PLACEHOLDERS: { key: keyof NotifyVars; hint: string }[] = [
  { key: "ticket", hint: "ticket title" },
  { key: "client", hint: "client name" },
  { key: "actor", hint: "who did it (agent / client)" },
  { key: "app", hint: "application" },
  { key: "priority", hint: "priority" },
  { key: "preview", hint: "start of the message" },
];

/** "{ticket}" -> nilai. Placeholder yang tidak dikenal dibiarkan apa adanya supaya salah ketik kelihatan. */
export function renderTemplate(tpl: string, vars: NotifyVars): string {
  return tpl.replace(/\{(\w+)\}/g, (whole, k: string) => (k in vars ? (vars[k as keyof NotifyVars] ?? "") : whole)).trim();
}

export const TITLE_MAX = 160;
export const MESSAGE_MAX = 1000;

// ---------------------------------------------------------------------------
// Kejadian bawaan
// ---------------------------------------------------------------------------
export type EventKey =
  | "TICKET_CREATED"
  | "AGENT_REQUESTED"
  | "TICKET_CLAIMED_L1"
  | "TICKET_CLAIMED_L2"
  | "CLIENT_REPLIED"
  | "AGENT_REPLIED"
  | "BOT_REPLIED"
  | "INTERNAL_NOTE"
  | "TICKET_ESCALATED"
  | "TICKET_RESOLVED";

export type EventDef = {
  key: EventKey;
  label: string;
  /** Kapan notifikasi ini muncul — ditampilkan di halaman Admin. */
  when: string;
  /** Jenis notifikasi di DB (ikon & pengelompokan). */
  type: "NEW_TICKET" | "NEW_REPLY" | "STATUS_CHANGE";
  enabled: boolean;
  title: string;
  message: string;
  audience: Audience[];
  /** Penerima yang masuk akal untuk kejadian ini (pilihan di form Admin). */
  audienceOptions: Audience[];
  target: Target;
};

export const EVENTS: EventDef[] = [
  {
    key: "TICKET_CREATED",
    label: "Ticket submitted",
    when: "A client submits a new ticket.",
    type: "NEW_TICKET",
    enabled: true,
    title: "New ticket: {ticket}",
    message: "{client} submitted a ticket for {app} ({priority} priority).",
    audience: ["ADMINS"],
    audienceOptions: ["CLIENT", "ADMINS"],
    target: "TICKET",
  },
  {
    key: "AGENT_REQUESTED",
    label: "Client asks for an agent",
    when: "A client taps “Talk to a support agent” and the ticket enters the L1 queue.",
    type: "STATUS_CHANGE",
    enabled: true,
    title: "Ticket waiting for an agent",
    message: "{client} asked for a support agent: “{ticket}” ({priority} priority).",
    audience: ["ALL_L1"],
    audienceOptions: ["ALL_L1", "ADMINS", "CLIENT"],
    target: "TICKET",
  },
  {
    key: "TICKET_CLAIMED_L1",
    label: "L1 agent takes the ticket",
    when: "An L1 agent claims the ticket from the queue.",
    type: "STATUS_CHANGE",
    enabled: true,
    title: "A support agent is on your ticket",
    message: "{actor} is now handling “{ticket}”. You can chat with them here.",
    audience: ["CLIENT"],
    audienceOptions: ["CLIENT", "ADMINS"],
    target: "TICKET",
  },
  {
    key: "TICKET_CLAIMED_L2",
    label: "L2 agent takes the ticket",
    when: "An L2 agent claims an escalated ticket.",
    type: "STATUS_CHANGE",
    enabled: true,
    title: "L2 picked up “{ticket}”",
    message: "{actor} (L2) started working on the escalated ticket.",
    audience: ["ASSIGNED_L1"],
    audienceOptions: ["ASSIGNED_L1", "CLIENT", "ADMINS"],
    target: "TICKET",
  },
  {
    key: "CLIENT_REPLIED",
    label: "Client sends a message",
    when: "A client writes in the public chat of a ticket that an agent is handling.",
    type: "NEW_REPLY",
    enabled: true,
    title: "New message from {client}",
    message: "{preview}",
    audience: ["ASSIGNED_L1"],
    audienceOptions: ["ASSIGNED_L1", "ALL_L1", "ADMINS"],
    target: "TICKET",
  },
  {
    key: "AGENT_REPLIED",
    label: "Agent replies to the client",
    when: "An L1 agent writes in the public chat.",
    type: "NEW_REPLY",
    enabled: true,
    title: "{actor} replied to your ticket",
    message: "{preview}",
    audience: ["CLIENT"],
    audienceOptions: ["CLIENT", "ADMINS"],
    target: "TICKET",
  },
  {
    key: "BOT_REPLIED",
    label: "Assistant (bot) replies",
    when: "The support assistant answers a client in the public chat.",
    type: "NEW_REPLY",
    enabled: true,
    title: "New reply on “{ticket}”",
    message: "{preview}",
    audience: ["CLIENT"],
    audienceOptions: ["CLIENT"],
    target: "TICKET",
  },
  {
    key: "INTERNAL_NOTE",
    label: "Internal note",
    when: "L1 or L2 writes an internal note. The sender never gets their own notification.",
    type: "NEW_REPLY",
    enabled: true,
    title: "Internal note on “{ticket}”",
    message: "{actor}: {preview}",
    audience: ["ASSIGNED_L1", "ASSIGNED_L2"],
    audienceOptions: ["ASSIGNED_L1", "ASSIGNED_L2", "ALL_L2", "ADMINS"],
    target: "TICKET",
  },
  {
    key: "TICKET_ESCALATED",
    label: "Ticket escalated to L2",
    when: "L1 escalates a ticket and it enters the L2 queue.",
    type: "STATUS_CHANGE",
    enabled: true,
    title: "Escalated: {ticket}",
    message: "{actor} escalated “{ticket}” ({priority} priority) to L2.",
    audience: ["ALL_L2"],
    audienceOptions: ["ALL_L2", "ASSIGNED_L2", "ADMINS", "CLIENT"],
    target: "TICKET",
  },
  {
    key: "TICKET_RESOLVED",
    label: "Ticket resolved",
    when: "An agent marks the ticket as resolved.",
    type: "STATUS_CHANGE",
    enabled: true,
    title: "Your ticket was resolved",
    message: "“{ticket}” was marked as resolved by {actor}.",
    audience: ["CLIENT"],
    audienceOptions: ["CLIENT", "ASSIGNED_L2", "ADMINS"],
    target: "TICKET",
  },
];

export const EVENT_BY_KEY = new Map<string, EventDef>(EVENTS.map((e) => [e.key, e]));
export const isEventKey = (k: string): k is EventKey => EVENT_BY_KEY.has(k);

// ---------------------------------------------------------------------------
// Pengumuman manual (template + tombol "Send now")
// ---------------------------------------------------------------------------
export const ANNOUNCE_AUDIENCE_OPTIONS: Audience[] = ["ALL_CLIENTS", "ALL_L1", "ALL_L2", "ADMINS"];
// Pengumuman tidak terikat tiket, jadi "The ticket" tidak masuk akal.
export const ANNOUNCE_TARGET_OPTIONS = ["DASHBOARD", "TICKET_LIST", "CUSTOM"] as const satisfies readonly Target[];
