import { z } from "zod";
import {
  ANNOUNCE_TARGET_OPTIONS,
  MESSAGE_MAX,
  PLACEHOLDERS,
  TARGETS,
  TITLE_MAX,
  safeInternalPath,
} from "@/lib/notify/events";

// Validasi form Admin > Notifications (aturan kejadian bawaan & template pengumuman).

const KNOWN = new Set<string>(PLACEHOLDERS.map((p) => p.key));

/** Placeholder "{...}" yang tidak dikenal (biasanya salah ketik, mis. {tiket}). */
export function unknownPlaceholders(...texts: string[]): string[] {
  const bad = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(/\{(\w+)\}/g)) if (!KNOWN.has(m[1])) bad.add(`{${m[1]}}`);
  return [...bad];
}

const shared = {
  title: z.string().trim().min(1, "Enter a title.").max(TITLE_MAX, `Title is too long (max ${TITLE_MAX} characters).`),
  message: z.string().trim().min(1, "Enter a message.").max(MESSAGE_MAX, `Message is too long (max ${MESSAGE_MAX} characters).`),
  customPath: z.string().trim().max(200, "Path is too long."),
};

const pathRule = (v: { target: string; customPath: string }, ctx: z.RefinementCtx) => {
  if (v.target === "CUSTOM" && !safeInternalPath(v.customPath.replaceAll("{ticketId}", "x"))) {
    ctx.addIssue({ code: "custom", path: ["customPath"], message: "Enter a path inside this app, starting with “/” (e.g. /client/tickets)." });
  }
};

export const eventRuleSchema = z
  .object({ ...shared, target: z.enum(TARGETS, { message: "Choose where the notification opens." }) })
  .superRefine((v, ctx) => {
    pathRule(v, ctx);
    const bad = unknownPlaceholders(v.title, v.message);
    if (bad.length > 0) {
      ctx.addIssue({ code: "custom", path: ["message"], message: `Unknown placeholder ${bad.join(", ")}. Use only the ones listed below.` });
    }
  });

export const announcementSchema = z
  .object({
    name: z.string().trim().min(2, "Give this announcement a name (min. 2 characters).").max(80, "Name is too long (max 80 characters)."),
    ...shared,
    target: z.enum(ANNOUNCE_TARGET_OPTIONS, { message: "Choose where the notification opens." }),
  })
  .superRefine(pathRule);
