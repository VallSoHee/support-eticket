"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteClientMessageAction, markSolvedByBotAction, requestAgentAction, sendClientMessageAction } from "@/lib/client/chat-actions";
import type { ClientChatAccess } from "@/lib/chat/rules";
import type { AttachmentMeta, DeleteScope, LiveMessage } from "@/lib/chat/types";
import { useTicketStream } from "@/components/chat/useTicketStream";
import {
  Bubble,
  DayDivider,
  LiveDot,
  buildRows,
  messagePreview,
  senderLabel,
  type BubbleActions,
} from "@/components/chat/ChatParts";
import { MediaGallery, MediaIcon, extractMedia } from "@/components/chat/media";
import type { EditorHandle } from "@/components/client/RichTextEditor";
import { SendIcon } from "@/components/staff/icons";

// CKEditor butuh DOM -> hanya dirender di browser (sama seperti form tiket).
const RichTextEditor = dynamic(() => import("@/components/client/RichTextEditor").then((m) => m.RichTextEditor), {
  ssr: false,
  loading: () => <div className="h-[92px] animate-pulse rounded-2xl border border-line bg-field" aria-hidden />,
});

// Pesan kosong = tanpa teks dan tanpa gambar (HTML editor kosong = "" atau "<p>&nbsp;</p>").
const isEmptyHtml = (html: string) =>
  !/<img\b/i.test(html) && html.replace(/<[^>]*>/g, "").replace(/&nbsp;|\s/g, "") === "";

// Gelembung "Assistant is typing" (gaya sama dengan bubble bot di ChatParts).
function TypingBubble() {
  return (
    <div className="flex" role="status" aria-label="Assistant is typing">
      <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
        <p className="mb-1 text-[11px] font-bold text-violet-900/70">Assistant</p>
        <span className="flex items-center gap-1" aria-hidden>
          {[0, 150, 300].map((d) => (
            <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: `${d}ms` }} />
          ))}
        </span>
      </div>
    </div>
  );
}

// Chat Client <-> Petugas pada halaman detail tiket. Hanya Public chat; Internal note tidak
// pernah dikirim ke sini (difilter di server, bukan di UI).
export function ClientChat({
  ticketId,
  viewerId,
  viewerName,
  initialMessages,
  initialCursor,
  initialStatus,
  access,
  live,
  attachments,
  descriptionHtml,
  openedAt,
  botActive = false,
  className = "h-[560px]",
}: {
  ticketId: string;
  viewerId: string;
  viewerName: string;
  initialMessages: LiveMessage[];
  initialCursor: string;
  initialStatus: string;
  access: ClientChatAccess;
  live: boolean;
  /** Metadata lampiran tiket (nama asli, tipe, ukuran) untuk tab Media. */
  attachments: AttachmentMeta[];
  /** Deskripsi tiket (mungkin berisi foto/file). */
  descriptionHtml: string;
  openedAt: string;
  /** true = tiket masih di fase chatbot (BOT_HANDLING): tampilkan tombol "Talk to a support agent" / "It's solved". */
  botActive?: boolean;
  /** Kelas tinggi/ukuran section. Default 560px; halaman detail memakai h-full agar mengisi kolom kanan. */
  className?: string;
}) {
  const router = useRouter();
  const [html, setHtml] = useState("");
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<LiveMessage | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editorRef = useRef<EditorHandle | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(flashTimer.current), []);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [showMedia, setShowMedia] = useState(false);
  // Indikator "Assistant is typing": menyala setelah client mengirim pesan (atau tiket baru dibuat tanpa
  // balasan bot), padam saat pesan bot tiba. Batas 30 dtk supaya tidak menggantung bila bot gagal.
  const [awaitingBot, setAwaitingBot] = useState(() => botActive && !initialMessages.some((m) => m.senderType === "BOT"));

  // Status tiket berubah (diambil petugas, dieskalasi, selesai) -> segarkan badge, tahapan, dan timeline.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onStatus = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 250);
  }, [router]);
  useEffect(() => () => clearTimeout(refreshTimer.current), []);

  const { messages, push, markDeleted, hide, connected } = useTicketStream({
    ticketId,
    initial: initialMessages,
    initialCursor,
    initialStatus,
    enabled: live,
    onStatus,
  });

  const rows = useMemo(() => buildRows(messages), [messages]);

  const lastIsBot = messages[messages.length - 1]?.senderType === "BOT";
  const hasBotMessage = messages.some((m) => m.senderType === "BOT" && !m.deleted);
  const showTyping = botActive && awaitingBot && !lastIsBot;
  useEffect(() => {
    if (!showTyping) return;
    const t = setTimeout(() => setAwaitingBot(false), 30_000);
    return () => clearTimeout(t);
  }, [showTyping]);

  // Tab Media: foto/video/file dari deskripsi + chat. Dihitung dari pesan yang tampil, jadi ikut realtime
  // dan pesan yang dihapus (untuk semua / untuk saya) tidak muncul lagi.
  const media = useMemo(
    () =>
      extractMedia(
        [{ html: descriptionHtml, at: openedAt }, ...messages.filter((m) => m.html && !m.deleted).map((m) => ({ html: m.content, at: m.createdAt }))],
        attachments,
      ),
    [descriptionHtml, openedAt, messages, attachments],
  );

  useEffect(() => {
    if (showMedia) return;
    stick.current = true; // kembali dari tab Media -> mulai dari pesan terbaru
  }, [showMedia]);
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, showMedia, showTyping]);

  const empty = isEmptyHtml(html);
  const canSubmit = access.canSend && !pending && !uploading && !empty;

  function send() {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const res = await sendClientMessageAction(ticketId, html, replyTo?.id ?? null);
      if (res.error) {
        setError(res.error);
        return;
      }
      stick.current = true;
      if (res.message) push(res.message);
      if (botActive) setAwaitingBot(true);
      editorRef.current?.setData("");
      setHtml("");
      setReplyTo(null);
      editorRef.current?.focus();
    });
  }
  // Enter di editor memanggil versi terbaru send() lewat ref (handler dipasang sekali saat editor siap).
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });
  const onEnter = useCallback(() => sendRef.current(), []);
  const onReady = useCallback((e: EditorHandle) => {
    editorRef.current = e;
  }, []);

  // Keputusan client di fase bot. Server yang menegakkan aturannya; setelah berhasil, status tiket berubah
  // (antre petugas / selesai) sehingga halaman disegarkan untuk memperbarui badge, tahapan, dan timeline.
  function decide(run: () => Promise<{ error?: string; ok?: boolean }>) {
    setError(null);
    startTransition(async () => {
      const res = await run();
      if (res.error) {
        setError(res.error);
        return;
      }
      setAwaitingBot(false);
      router.refresh();
    });
  }
  const requestAgent = () => decide(() => requestAgentAction(ticketId));
  const markSolved = () => decide(() => markSolvedByBotAction(ticketId));

  // Pesan lama yang bisa dihapus untuk semua orang: milik sendiri, chat masih terbuka.
  const actions: BubbleActions = {
    onReply: (m) => {
      setReplyTo(m as LiveMessage);
      editorRef.current?.focus();
    },
    onDelete: (m, scope: DeleteScope) => {
      setError(null);
      startTransition(async () => {
        const res = await deleteClientMessageAction(ticketId, m.id, scope);
        if (res.error) {
          setError(res.error);
          return;
        }
        if (scope === "me") hide(m.id);
        else markDeleted(m.id);
        setReplyTo((cur) => (cur?.id === m.id ? null : cur));
      });
    },
    canDeleteForAll: (m) => access.canSend && m.senderId === viewerId,
  };

  // Klik kutipan di bubble -> gulir ke pesan aslinya dan sorot sebentar.
  const jumpTo = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    stick.current = false;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlashId(id);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 1600);
  };

  return (
    <section aria-label="Conversation" className={`flex flex-col overflow-hidden rounded-2xl border border-line bg-white ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-5">
        <div role="tablist" aria-label="Chat sections" className="flex gap-1 rounded-full border border-line bg-field p-1">
          <button
            type="button"
            role="tab"
            aria-selected={!showMedia}
            onClick={() => setShowMedia(false)}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${!showMedia ? "bg-brand text-white shadow-sm" : "text-muted hover:text-ink"}`}
          >
            Chat
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={showMedia}
            onClick={() => setShowMedia(true)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${showMedia ? "bg-brand text-white shadow-sm" : "text-muted hover:text-ink"}`}
          >
            <MediaIcon size={14} />
            Media
            {media.length > 0 && (
              <span className={`rounded-full px-1.5 py-px text-[10px] font-bold leading-none ${showMedia ? "bg-white/25 text-white" : "bg-brand/10 text-brand-dark"}`}>
                {media.length}
              </span>
            )}
          </button>
        </div>
        {live && <LiveDot connected={connected} />}
      </div>

      {showMedia && (
        <div className="flex-1 overflow-y-auto bg-field/50 px-4 py-5 md:px-6">
          <MediaGallery items={media} />
        </div>
      )}

      {/* Chat & editor tetap terpasang (hanya disembunyikan) supaya draft di editor tidak hilang saat melihat Media. */}
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className={`flex-1 overflow-y-auto bg-field/50 px-4 py-5 md:px-6 ${showMedia ? "hidden" : ""}`}
      >
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-muted">
            {botActive
              ? "Our assistant is reading your ticket and will reply in a moment."
              : "No messages yet. Send a message below and an agent will reply here as soon as they pick up your ticket."}
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((r) =>
              r.kind === "day" ? (
                <DayDivider key={r.key} label={r.label} />
              ) : (
                <Bubble
                  key={r.msg.id}
                  m={r.msg}
                  mine={r.msg.senderId === viewerId}
                  viewer="client"
                  clientName={viewerName}
                  viewerId={viewerId}
                  actions={actions}
                  onJump={jumpTo}
                  flash={flashId === r.msg.id}
                />
              ),
            )}
            {showTyping && <TypingBubble />}
          </div>
        )}
      </div>

      <div className={`border-t border-line p-3 md:p-4 ${showMedia ? "hidden" : ""}`}>
        {!access.canSend && access.note && (
          <p className="rounded-2xl bg-field px-3.5 py-2.5 text-[12px] font-medium text-muted">{access.note}</p>
        )}
        {botActive && access.canSend && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-violet-100 bg-violet-50 px-3.5 py-2.5">
            <p className="mr-auto min-w-[160px] text-[12px] font-medium leading-snug text-violet-900">
              Our assistant answers first. Did that solve it?
            </p>
            <button
              type="button"
              onClick={markSolved}
              disabled={pending || !hasBotMessage}
              className="rounded-full border border-violet-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-violet-900 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              It&apos;s solved
            </button>
            <button
              type="button"
              onClick={requestAgent}
              disabled={pending}
              className="rounded-full bg-brand px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              Talk to a support agent
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="mb-2.5 text-[12px] font-medium text-brand-dark">
            {error}
          </p>
        )}
        {access.canSend && (
          <div>
            {replyTo && (
              <div className="mb-2 flex items-start gap-3 rounded-2xl border-l-4 border-brand bg-field px-3.5 py-2">
                <div className="min-w-0 flex-1 text-[12px] leading-snug">
                  <p className="font-bold text-ink">
                    Replying to {replyTo.senderId === viewerId ? "yourself" : senderLabel(replyTo, "client", viewerName)}
                  </p>
                  <p className="line-clamp-2 break-words text-muted">{messagePreview(replyTo) || "Message"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  aria-label="Cancel reply"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-black/5 hover:text-ink"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            )}

            <div className="flex items-end gap-3">
              <div className="min-w-0 flex-1">
                <RichTextEditor
                  variant="compact"
                  placeholder={botActive ? "Ask the assistant…  (Enter to send)" : "Write a message…  (Enter to send, Shift+Enter for a new line)"}
                  onChange={setHtml}
                  onBusyChange={setUploading}
                  onReady={onReady}
                  onEnter={onEnter}
                />
              </div>
              <button
                type="button"
                onClick={send}
                disabled={!canSubmit}
                aria-label="Send message"
                className="flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                <SendIcon />
                <span className="hidden sm:inline">{pending ? "Sending…" : uploading ? "Uploading…" : "Send"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
