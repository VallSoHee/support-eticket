"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/admin/audit";
import { respondToTicket } from "@/lib/bot/respond";
import { notifyLater } from "@/lib/notify/dispatch";
import { PLATFORM_LABEL, PRIORITY_LABEL, parsePlatforms } from "@/lib/admin/constants";
import type { MasterFormState } from "@/lib/admin/master-types";
import { extractUploadIds, richTextToPlain, sanitizeRichText } from "@/lib/client/sanitize";
import {
  DEFAULT_TICKET_CATEGORY,
  MAX_DESCRIPTION_HTML,
  MIN_DESCRIPTION_TEXT,
  ticketSubmitSchema,
} from "@/lib/client/ticket-validation";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

// Client mengajukan tiket baru dari halaman My tickets.
// Tiket langsung berstatus BOT_HANDLING: chatbot menjawab lebih dulu. Tiket baru masuk antrean L1
// kalau client sendiri menekan "Talk to a support agent" (lihat requestAgentAction).
export async function createTicketAction(_prev: MasterFormState, formData: FormData): Promise<MasterFormState> {
  const user = await requireRole("CLIENT");

  const values = {
    judul: str(formData.get("judul")),
    applicationId: str(formData.get("applicationId")),
    platform: str(formData.get("platform")),
    priority: str(formData.get("priority")),
    deskripsi: str(formData.get("deskripsi")),
  };

  const parsed = ticketSubmitSchema.safeParse(values);
  const fieldErrors: NonNullable<MasterFormState["fieldErrors"]> = parsed.success ? {} : parsed.error.flatten().fieldErrors;

  // HTML dari browser tidak dipercaya: sanitasi dulu, baru validasi & simpan.
  const deskripsi = sanitizeRichText(values.deskripsi);
  const hasImage = /<img\b/i.test(deskripsi);
  if (richTextToPlain(deskripsi).length < MIN_DESCRIPTION_TEXT && !hasImage) {
    fieldErrors.deskripsi = [`Describe the problem (min. ${MIN_DESCRIPTION_TEXT} characters), or attach a screenshot.`];
  } else if (deskripsi.length > MAX_DESCRIPTION_HTML) {
    fieldErrors.deskripsi = ["Description is too long. Shorten it or attach the details as a file."];
  }

  // Aplikasi harus dari master data; platform ditentukan aplikasinya (bukan dipercaya dari browser):
  // satu platform -> otomatis dipakai, lebih dari satu -> pilihan client harus salah satu dari daftarnya.
  const application = parsed.success ? await prisma.application.findUnique({ where: { id: parsed.data.applicationId } }) : null;
  let platform = parsed.success ? parsed.data.platform : undefined;
  if (parsed.success) {
    if (!application) {
      fieldErrors.applicationId = ["This application is no longer available. Choose another one."];
    } else {
      const allowed = parsePlatforms(application.platforms);
      if (allowed.length === 1) platform = allowed[0];
      else if (!allowed.includes(parsed.data.platform)) fieldErrors.platform = ["Choose one of the platforms available for this application."];
    }
  }

  if (!parsed.success || !application || !platform || fieldErrors.deskripsi || fieldErrors.platform) return { fieldErrors, values };
  const data = { ...parsed.data, platform };

  const category = await prisma.category.upsert({
    where: { nama: DEFAULT_TICKET_CATEGORY },
    update: {},
    create: { nama: DEFAULT_TICKET_CATEGORY, defaultPriority: "MEDIUM" },
  });

  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.ticket.create({
      data: {
        clientId: user.id,
        categoryId: category.id,
        judul: data.judul,
        applicationId: application.id,
        aplikasi: application.nama,
        platform: data.platform,
        priority: data.priority,
        deskripsi,
        // Bot menjawab lebih dulu (FR-4.1). TIDAK ada baris antrean L1 di sini: antrean baru dibuat
        // saat client minta petugas, supaya petugas tidak melihat tiket yang masih ditangani bot.
        status: "BOT_HANDLING",
      },
      select: { id: true },
    });
    await tx.ticketTimeline.create({
      data: {
        ticketId: created.id,
        statusBaru: "BOT_HANDLING",
        actorType: "BOT",
        catatan: "Ticket received. Our assistant is looking at your request.",
      },
    });
    // Sesi Public chat dibuka sekarang; balasan pertama bot masuk lewat after() di bawah.
    await tx.chatSession.create({ data: { ticketId: created.id, type: "PUBLIC" } });
    // Hubungkan unggahan yang dipakai di deskripsi. Filter uploaderId mencegah client
    // "mengklaim" file milik orang lain hanya dengan menulis ID-nya di HTML.
    const uploadIds = extractUploadIds(deskripsi);
    if (uploadIds.length > 0) {
      await tx.ticketAttachment.updateMany({
        where: { id: { in: uploadIds }, uploaderId: user.id, ticketId: null },
        data: { ticketId: created.id },
      });
    }
    return created;
  });

  await writeAudit({
    actorId: user.id,
    action: "TICKET_CREATE",
    entityType: "Ticket",
    entityId: ticket.id,
    description: `Submitted ticket "${data.judul}" (${application.nama}, ${PLATFORM_LABEL[data.platform]}, urgency ${PRIORITY_LABEL[data.priority]}).`,
  });
  revalidatePath("/client");
  revalidatePath("/client/tickets");
  revalidatePath("/admin/tickets");

  // Notifikasi "tiket baru". Pembuat tiket = client sendiri, jadi TIDAK dikecualikan (actorId tidak diisi):
  // Admin boleh memilih client sebagai penerima untuk konfirmasi "tiket diterima".
  notifyLater("TICKET_CREATED", { ticketId: ticket.id, actorName: user.name });

  // Balasan pertama bot dibuat SETELAH respons dikirim, jadi client langsung diarahkan ke halaman
  // tiket dan melihat indikator mengetik; balasannya tiba lewat stream SSE.
  after(() => respondToTicket(ticket.id));

  redirect(`/client/tickets/${ticket.id}?submitted=1`);
}
