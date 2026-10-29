import type { TicketStatus } from "@/generated/prisma/enums";
import type { Role } from "@/lib/roles";

// Aturan hak akses Petugas atas satu tiket. SATU-SATUNYA sumber kebenaran: dipakai halaman
// (untuk menampilkan tombol/composer) DAN server action (untuk menolak permintaan yang
// melanggar aturan), jadi UI dan server tidak bisa berbeda pendapat.
// Modul murni: tidak mengimpor Prisma Client, aman dipakai di komponen client.

export type StaffLevel = "L1" | "L2";

export const STAFF_LEVEL: Record<
  StaffLevel,
  { role: Role; base: string; short: string; title: string; sender: "PETUGAS_L1" | "PETUGAS_L2" }
> = {
  L1: { role: "PETUGAS_L1", base: "/l1", short: "L1", title: "Customer Support", sender: "PETUGAS_L1" },
  L2: { role: "PETUGAS_L2", base: "/l2", short: "L2", title: "Technical Support", sender: "PETUGAS_L2" },
};

export const levelOfRole = (role: Role): StaffLevel | null =>
  role === "PETUGAS_L1" ? "L1" : role === "PETUGAS_L2" ? "L2" : null;

export const isDone = (s: TicketStatus) => s === "RESOLVED" || s === "CLOSED";
export const isEscalatedStatus = (s: TicketStatus) => s === "ESCALATED_L2" || s === "IN_PROGRESS_L2";

export type TicketFacts = {
  status: TicketStatus;
  assignedL1Id: string | null;
  assignedL2Id: string | null;
  /** Sesi chat INTERNAL sudah pernah dibuat (= tiket pernah dieskalasi). */
  hasInternalSession: boolean;
};

export type StaffAccess = {
  /** L2 tidak punya Public chat sama sekali: hanya L1 yang berbicara dengan client. */
  hasPublicChat: boolean;
  canClaim: boolean;
  canEscalate: boolean;
  canResolve: boolean;
  publicChat: { canSend: boolean; note?: string };
  /** locked = tiket belum dieskalasi -> Internal Note terkunci (tidak bisa chat sama sekali). */
  internalNote: { locked: boolean; canSend: boolean; note?: string };
};

export function getStaffAccess(level: StaffLevel, userId: string, t: TicketFacts): StaffAccess {
  const done = isDone(t.status);
  const escalated = isEscalatedStatus(t.status) || t.hasInternalSession;
  const mine = level === "L1" ? t.assignedL1Id === userId : t.assignedL2Id === userId;
  const inQueue =
    level === "L1"
      ? t.status === "WAITING_AGENT_L1" && !t.assignedL1Id
      : t.status === "ESCALATED_L2" && !t.assignedL2Id;

  const canClaim = inQueue;
  const canEscalate = level === "L1" && mine && t.status === "IN_PROGRESS_L1";
  // Hanya L1 yang menutup tiket: L2 tidak bisa bicara dengan client, jadi L1 yang harus menyampaikan
  // solusi dari L2 dulu, baru menandai selesai (setelah itu chat client menjadi read-only).
  const canResolve = level === "L1" && mine && (t.status === "IN_PROGRESS_L1" || t.status === "IN_PROGRESS_L2");

  // ---- Public chat: HANYA L1 pemegang tiket. L2 tidak punya Public chat. ----
  // L1 tetap memegang chat client selama tiket dieskalasi, supaya bisa meneruskan info dari L2.
  const hasPublicChat = level === "L1";
  const publicChat: StaffAccess["publicChat"] =
    hasPublicChat && mine && !done
      ? { canSend: true }
      : {
          canSend: false,
          note: !hasPublicChat
            ? "L2 doesn't talk to the client. Send updates to L1 here and they will pass them on."
            : done
              ? "This ticket is closed, so the public chat is read-only."
              : inQueue
                ? "Take this ticket to reply to the client."
                : "You can't reply to the client at this stage.",
        };

  // ---- Internal note: TERKUNCI sampai L1 mengeskalasi tiket. ----
  const locked = !escalated;
  let internalNote: StaffAccess["internalNote"];
  if (locked) {
    internalNote = {
      locked: true,
      canSend: false,
      note: done
        ? "This ticket was never escalated, so it has no internal notes."
        : level === "L1"
          ? "Internal notes unlock once you escalate this ticket to L2."
          : "Internal notes unlock once this ticket is escalated.",
    };
  } else if (done) {
    internalNote = { locked: false, canSend: false, note: "This ticket is closed, so internal notes are read-only." };
  } else if (!mine) {
    internalNote = { locked: false, canSend: false, note: "Take this ticket to write internal notes." };
  } else {
    internalNote = { locked: false, canSend: true };
  }

  return { hasPublicChat, canClaim, canEscalate, canResolve, publicChat, internalNote };
}
