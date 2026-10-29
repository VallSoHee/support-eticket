import { prisma } from "@/lib/prisma";
import { notifyTicket } from "@/lib/chat/events";
import { dispatchEvent } from "@/lib/notify/dispatch";
import { notifyPreview } from "@/lib/notify/preview";
import { looksLikeHtml, richTextToPlain } from "@/lib/client/sanitize";
import { PLATFORM_LABEL } from "@/lib/admin/constants";
import { generateBotReply } from "@/lib/bot/index";
import { BOT_TEXT, detectLang } from "@/lib/bot/text";
import type { BotTurn } from "@/lib/bot/types";

// Menulis balasan bot ke Public chat sebuah tiket. Dipanggil lewat after() (setelah respons ke browser
// terkirim), jadi client tidak menunggu LLM; balasan tiba lewat stream SSE yang sudah ada.

/** Batas balasan bot per tiket — menjaga kuota free tier dari spam. Bisa diubah lewat BOT_MAX_REPLIES. */
const maxReplies = () => {
  const n = Number(process.env.BOT_MAX_REPLIES);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 20;
};

const plainOf = (content: string) => {
  const text = looksLikeHtml(content) ? richTextToPlain(content) : content.replace(/\s+/g, " ").trim();
  return text || (/<img\b/i.test(content) ? "[image]" : "");
};

/**
 * @param afterMessageId pesan client yang memicu balasan ini. Bila sudah ada pesan client yang lebih baru
 *   (client mengetik cepat), balasan ini dilewati supaya bot menjawab sekali untuk pesan terakhir.
 */
export async function respondToTicket(ticketId: string, opts: { afterMessageId?: string } = {}): Promise<void> {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        status: true,
        judul: true,
        aplikasi: true,
        platform: true,
        deskripsi: true,
        client: { select: { name: true } },
      },
    });
    // Bot hanya bicara selama tiket masih di tangannya.
    if (!ticket || ticket.status !== "BOT_HANDLING") return;

    const session = await prisma.chatSession.upsert({
      where: { ticketId_type: { ticketId, type: "PUBLIC" } },
      update: {},
      create: { ticketId, type: "PUBLIC" },
      select: { id: true },
    });

    const recent = await prisma.message.findMany({
      where: { chatSessionId: session.id, isInternalNote: false, deletedAt: null, senderType: { in: ["CLIENT", "BOT"] } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
      select: { id: true, senderType: true, content: true, createdAt: true },
    });
    const messages = recent.reverse();

    const lastClient = [...messages].reverse().find((m) => m.senderType === "CLIENT");
    if (opts.afterMessageId) {
      if (!lastClient || lastClient.id !== opts.afterMessageId) return; // ada pesan yang lebih baru
      if (messages.some((m) => m.senderType === "BOT" && m.createdAt >= lastClient.createdAt)) return; // sudah dijawab
    }

    const botCount = await prisma.message.count({ where: { chatSessionId: session.id, senderType: "BOT" } });
    const lang = detectLang(`${ticket.judul} ${richTextToPlain(ticket.deskripsi)} ${lastClient ? plainOf(lastClient.content) : ""}`);

    let text: string;
    if (botCount >= maxReplies()) {
      const limitText = BOT_TEXT.replyLimit(lang);
      const lastBot = [...messages].reverse().find((m) => m.senderType === "BOT");
      if (lastBot?.content === limitText) return; // pesan batas cukup sekali
      text = limitText;
    } else {
      const faq = await prisma.faqEntry.findMany({ select: { id: true, keywords: true, jawaban: true }, take: 200 });
      const history: BotTurn[] = messages
        .map<BotTurn>((m) => ({ from: m.senderType === "BOT" ? "bot" : "client", text: plainOf(m.content) }))
        .filter((h) => h.text !== "");
      const isFirst = botCount === 0 && !lastClient;

      const reply = await generateBotReply({
        clientName: ticket.client.name,
        ticket: {
          judul: ticket.judul,
          aplikasi: ticket.aplikasi,
          platform: PLATFORM_LABEL[ticket.platform],
          deskripsi: richTextToPlain(ticket.deskripsi),
        },
        history,
        latestClientText: isFirst || !lastClient ? null : plainOf(lastClient.content),
        faq,
      });
      const hello = botCount === 0 ? BOT_TEXT.greeting(ticket.client.name.split(" ")[0] ?? ticket.client.name, lang) : "";
      text = `${hello}${reply.text}`;
    }

    // LLM bisa memakan beberapa detik: cek lagi bahwa client belum minta petugas / menutup tiket.
    const fresh = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { status: true } });
    if (fresh?.status !== "BOT_HANDLING") return;

    await prisma.message.create({
      data: { chatSessionId: session.id, senderType: "BOT", senderId: null, content: text, isInternalNote: false },
    });
    notifyTicket(ticketId);
    // Sudah berjalan di dalam after(): cukup await langsung (dispatchEvent tidak pernah melempar error).
    await dispatchEvent("BOT_REPLIED", { ticketId, preview: notifyPreview(text) });
  } catch (e) {
    // after() berjalan di luar permintaan: jangan sampai exception tak tertangkap.
    console.error("[bot] gagal membalas tiket", ticketId, e);
  }
}
