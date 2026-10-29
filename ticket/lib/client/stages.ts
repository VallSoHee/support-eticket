import type { TicketStatus } from "@/generated/prisma/enums";

// Client tidak perlu tahu 8 status internal (L1/L2, bot, dst). Di sisi mereka tiket
// cukup melewati 4 tahap: diterima -> antre -> dikerjakan -> selesai.
export const STAGES = [{ label: "Received" }, { label: "In queue" }, { label: "In progress" }, { label: "Resolved" }] as const;

const STAGE_OF: Record<TicketStatus, number> = {
  OPEN: 0,
  BOT_HANDLING: 0,
  WAITING_AGENT_L1: 1,
  IN_PROGRESS_L1: 2,
  ESCALATED_L2: 2,
  IN_PROGRESS_L2: 2,
  RESOLVED: 3,
  CLOSED: 3,
};

export const stageOf = (status: TicketStatus) => STAGE_OF[status];

/** Label badge versi client (warna badge tetap memakai STATUS_BADGE milik admin). */
export const CLIENT_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Received",
  BOT_HANDLING: "Assistant replying",
  WAITING_AGENT_L1: "Waiting for an agent",
  IN_PROGRESS_L1: "With support",
  ESCALATED_L2: "With technical team",
  IN_PROGRESS_L2: "With technical team",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

/** Kalimat singkat "sekarang tiketmu di mana". */
export const STATUS_NOTE: Record<TicketStatus, string> = {
  OPEN: "We've received your ticket.",
  BOT_HANDLING: "Our assistant is helping first. If that doesn't solve it, you can ask for a support agent.",
  WAITING_AGENT_L1: "You're in the queue for a support agent.",
  IN_PROGRESS_L1: "A support agent is working on this.",
  ESCALATED_L2: "Passed to our technical team.",
  IN_PROGRESS_L2: "Our technical team is working on this.",
  RESOLVED: "Marked as resolved. Let us know if the problem comes back.",
  CLOSED: "This ticket is closed.",
};

export const TIMELINE_ACTOR: Record<"BOT" | "L1" | "L2" | "SYSTEM" | "ADMIN", string> = {
  BOT: "Assistant",
  L1: "Support team",
  L2: "Technical team",
  ADMIN: "Support team",
  SYSTEM: "System",
};
