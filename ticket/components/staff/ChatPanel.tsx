"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteStaffMessagesAction, forwardMessagesAction, sendMessageAction } from "@/lib/staff/actions";
import type { StaffAccess, StaffLevel } from "@/lib/staff/rules";
import type { ChatMessage } from "@/lib/staff/types";
import type { AttachmentMeta, DeleteScope, LiveMessage } from "@/lib/chat/types";
import { useTicketStream } from "@/components/chat/useTicketStream";
import {
  Bubble,
  CopyIcon,
  DayDivider,
  ForwardIcon,
  LiveDot,
  TrashIcon,
  buildRows,
  messageFullText,
  messagePreview,
  senderLabel,
  timeFmt,
  type BubbleActions,
} from "@/components/chat/ChatParts";
import { MediaGallery, MediaIcon, extractMedia } from "@/components/chat/media";
import { EscalateDialog } from "@/components/staff/EscalateDialog";
import { ForwardDialog, type ForwardTarget } from "@/components/staff/ForwardDialog";
import { GlobeIcon, LockIcon, NoteIcon, SendIcon } from "@/components/staff/icons";
import { primaryBtn } from "@/components/admin/ui";

type Channel = "public" | "internal";

const toolbarBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[12px] font-semibold text-ink transition hover:bg-field disabled:cursor-not-allowed disabled:opacity-40";

export function ChatPanel({
  level,
  ticketId,
  viewerId,
  clientName,
  publicMessages,
  internalMessages,
  access,
  canEscalate,
  live,
  initialCursor,
  initialStatus,
  attachments,
  descriptionHtml,
  openedAt,
}: {
  /** L2 tidak punya Public chat: hanya tab Internal (obrolan dengan L1) dan Media. */
  level: StaffLevel;
  ticketId: string;
  viewerId: string;
  clientName: string;
  publicMessages: ChatMessage[];
  internalMessages: ChatMessage[];
  access: StaffAccess;
  canEscalate: boolean;
  /** Tiket masih berjalan -> sambungkan stream realtime. */
  live: boolean;
  /** Waktu server (ISO) sebagai titik awal stream bila belum ada pesan. */
  initialCursor: string;
  /** Status tiket saat halaman dirender; stream memberi tahu bila berubah. */
  initialStatus: string;
  /** Metadata lampiran tiket (nama asli, tipe, ukuran) untuk tab Media. */
  attachments: AttachmentMeta[];
  /** Deskripsi tiket dari client (mungkin berisi foto/file). */
  descriptionHtml: string;
  openedAt: string;
}) {
  const router = useRouter();
  const isL2 = level === "L2";
  const [channel, setChannel] = useState<Channel>(isL2 ? "internal" : "public");
  const [drafts, setDrafts] = useState<Record<Channel, string>>({ public: "", internal: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [escalateOpen, setEscalateOpen] = useState(false);
  const closeEscalate = useCallback(() => setEscalateOpen(false), []);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [showMedia, setShowMedia] = useState(false);

  // Balas, pilih banyak pesan, teruskan.
  const [replyTo, setReplyTo] = useState<LiveMessage | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(flashTimer.current), []);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [forwardIds, setForwardIds] = useState<string[] | null>(null);
  const [forwardError, setForwardError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);
  const [acting, startAct] = useTransition();

  const internal = channel === "internal";

  const flashNotice = useCallback((text: string) => {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2600);
  }, []);
  const exitSelect = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
    setConfirmDelete(false);
  }, []);

  // Data awal dari server, digabung dengan pesan realtime dari stream (SSE).
  const initial = useMemo<LiveMessage[]>(
    () => [
      ...publicMessages.map((m) => ({ ...m, internal: false })),
      ...internalMessages.map((m) => ({ ...m, internal: true })),
    ],
    [publicMessages, internalMessages],
  );

  // Status tiket berubah (mis. L2 mengambil alih) -> ambil ulang data halaman. Ditunda sedikit
  // supaya beberapa perubahan beruntun hanya memicu satu refresh.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onStatus = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 250);
  }, [router]);
  useEffect(() => () => clearTimeout(refreshTimer.current), []);

  const stream = useTicketStream({ ticketId, initial, initialCursor, initialStatus, enabled: live, onStatus });
  const { push, markDeleted, hide } = stream;
  const messages = useMemo(
    () => stream.messages.filter((m) => m.internal === internal),
    [stream.messages, internal],
  );

  // Tab Media: semua foto/video/file dari client (deskripsi + chat), dihitung dari pesan yang tampil
  // sehingga ikut realtime dan pesan yang dihapus untuk semua tidak muncul lagi.
  const media = useMemo(
    () =>
      extractMedia(
        [
          { html: descriptionHtml, at: openedAt },
          ...stream.messages.filter((m) => !m.internal && m.html && !m.deleted).map((m) => ({ html: m.content, at: m.createdAt })),
        ],
        attachments,
      ),
    [descriptionHtml, openedAt, stream.messages, attachments],
  );

  const state = internal ? access.internalNote : access.publicChat;
  const locked = internal && access.internalNote.locked;
  const canSend = state.canSend;
  const draft = drafts[channel];

  // Tujuan "Teruskan" = kanal yang boleh ditulis petugas ini (aturan yang sama dengan kirim pesan).
  const forwardTargets = useMemo<ForwardTarget[]>(() => {
    const out: ForwardTarget[] = [];
    if (access.hasPublicChat && access.publicChat.canSend) {
      out.push({ id: "public", label: "Public chat", hint: "The client will see it", visibleToClient: true });
    }
    if (!access.internalNote.locked && access.internalNote.canSend) {
      out.push({
        id: "internal",
        label: isL2 ? "Chat with L1" : "Internal note",
        hint: isL2 ? "Only you and L1 see it" : "Petugas only",
        visibleToClient: false,
      });
    }
    return out;
  }, [access, isL2]);
  const defaultForward: Channel = forwardTargets.find((t) => t.id !== channel)?.id ?? forwardTargets[0]?.id ?? channel;

  // Pesan terpilih, urut sesuai tampilan. Id yang sudah tidak ada (dihapus/disembunyikan) gugur sendiri.
  const selectedMessages = useMemo(() => messages.filter((m) => selected.has(m.id)), [messages, selected]);
  const anyDeletedSelected = selectedMessages.some((m) => m.deleted);
  const canDeleteSelectedForAll =
    canSend && selectedMessages.length > 0 && selectedMessages.every((m) => m.senderId === viewerId && !m.deleted);

  function toggleSelect(m: ChatMessage) {
    setConfirmDelete(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(m.id)) next.delete(m.id);
      else next.add(m.id);
      return next;
    });
  }

  function runDelete(ids: string[], scope: DeleteScope) {
    setError(null);
    startAct(async () => {
      let res: Awaited<ReturnType<typeof deleteStaffMessagesAction>>;
      try {
        res = await deleteStaffMessagesAction(ticketId, ids, scope);
      } catch {
        setError("Couldn't delete the messages. Please reload the page and try again.");
        return;
      }
      if (res.error) {
        setError(res.error);
        return;
      }
      for (const id of ids) (scope === "me" ? hide : markDeleted)(id);
      setReplyTo((cur) => (cur && ids.includes(cur.id) ? null : cur));
      exitSelect();
    });
  }

  async function copySelected() {
    const text = selectedMessages
      .map((m) => `[${timeFmt(m.createdAt)}] ${m.senderId === viewerId ? "You" : senderLabel(m, "staff", clientName)}: ${messageFullText(m)}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      flashNotice(`Copied ${selectedMessages.length} ${selectedMessages.length === 1 ? "message" : "messages"}`);
      exitSelect();
    } catch {
      setError("Couldn't copy to the clipboard. Your browser blocked it.");
    }
  }

  function openForward(ids: string[]) {
    setForwardError(null);
    setForwardIds(ids);
  }
  function runForward(target: Channel) {
    if (!forwardIds) return;
    setForwardError(null);
    startAct(async () => {
      let res: Awaited<ReturnType<typeof forwardMessagesAction>>;
      try {
        res = await forwardMessagesAction(ticketId, forwardIds, target);
      } catch {
        setForwardError("Couldn't forward the messages. Please reload the page and try again.");
        return;
      }
      if (res.error) {
        setForwardError(res.error);
        return;
      }
      for (const m of res.messages ?? []) push(m); // tampil seketika; stream mengirim salinannya (dibuang lewat id)
      stick.current = true;
      setForwardIds(null);
      exitSelect();
      setShowMedia(false);
      setChannel(target); // langsung lihat hasilnya di kanal tujuan
      flashNotice(`Forwarded to ${target === "public" ? "Public chat" : isL2 ? "L1" : "Internal note"}`);
    });
  }

  // Aksi menu per bubble (sama seperti di chat client) + Forward & Select khusus petugas.
  const actions: BubbleActions = {
    onReply: canSend
      ? (m) => {
          setReplyTo(m as LiveMessage);
          document.getElementById("chat-input")?.focus();
        }
      : undefined,
    onForward: forwardTargets.length > 0 ? (m) => openForward([m.id]) : undefined,
    onSelect: (m) => {
      setSelecting(true);
      setSelected(new Set([m.id]));
    },
    onDelete: (m, scope) => runDelete([m.id], scope),
    canDeleteForAll: (m) => canSend && m.senderId === viewerId,
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

  // Esc keluar dari mode pilih.
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && forwardIds === null && exitSelect();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selecting, forwardIds, exitSelect]);

  // Auto-scroll ke pesan terbaru, tapi jangan menyeret petugas yang sedang membaca riwayat.
  useEffect(() => {
    stick.current = true;
  }, [channel, showMedia]);
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [channel, showMedia, messages.length]);

  const rows = useMemo(() => buildRows(messages), [messages]);

  function send() {
    const content = draft.trim();
    if (!content || !canSend || pending) return;
    setError(null);
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof sendMessageAction>>;
      try {
        res = await sendMessageAction(ticketId, channel, content, replyTo?.id ?? null);
      } catch {
        // Respons server tak terduga (mis. sesi habis / server dev di-restart): tampilkan pesan, jangan crash.
        setError("Couldn't send the message. Please reload the page and try again.");
        return;
      }
      if (res.error) {
        setError(res.error);
        return;
      }
      stick.current = true;
      if (res.message) push(res.message); // tampil seketika; stream mengirim salinannya (dibuang lewat id)
      setDrafts((d) => ({ ...d, [channel]: "" }));
      setReplyTo(null);
    });
  }

  const allTabs: { id: Channel; label: string; hint: string; icon: React.ReactNode; lock: boolean }[] = [
    { id: "public", label: "Public chat", hint: "Visible to the client", icon: <GlobeIcon />, lock: false },
    {
      id: "internal",
      label: isL2 ? "Chat with L1" : "Internal note",
      hint: access.internalNote.locked ? "Locked until escalation" : isL2 ? "Private between you and L1" : "Petugas only",
      icon: access.internalNote.locked ? <LockIcon /> : <NoteIcon />,
      lock: access.internalNote.locked,
    },
  ];
  // L2 tidak punya Public chat.
  const tabs = allTabs.filter((t) => t.id !== "public" || access.hasPublicChat);

  return (
    <section
      aria-label="Ticket conversation"
      className="relative flex h-[calc(100dvh-17rem)] min-h-[420px] flex-col overflow-hidden xl:h-full xl:min-h-0 rounded-3xl border border-line bg-white shadow-sm"
    >
      {notice && (
        <div
          role="status"
          className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white shadow-lg"
        >
          {notice}
        </div>
      )}

      {/* Mode pilih pesan: menggantikan bilah tab selama aktif */}
      {selecting && (
        <div className="border-b border-line bg-white">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 md:px-4">
            <button
              type="button"
              onClick={exitSelect}
              aria-label="Cancel selection"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-field hover:text-ink"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <p className="text-[14px] font-bold text-ink" aria-live="polite">
              {selectedMessages.length} selected
            </p>
            <div className="ml-auto flex items-center gap-1.5">
              <button type="button" onClick={copySelected} disabled={selectedMessages.length === 0 || acting} className={toolbarBtn}>
                <CopyIcon size={15} />
                <span className="hidden sm:inline">Copy</span>
              </button>
              <button
                type="button"
                onClick={() => openForward(selectedMessages.map((m) => m.id))}
                disabled={selectedMessages.length === 0 || anyDeletedSelected || forwardTargets.length === 0 || acting}
                title={
                  forwardTargets.length === 0
                    ? "You can't send to any channel right now"
                    : anyDeletedSelected
                      ? "Deleted messages can't be forwarded"
                      : undefined
                }
                className={toolbarBtn}
              >
                <ForwardIcon size={15} />
                <span className="hidden sm:inline">Forward</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete((v) => !v)}
                disabled={selectedMessages.length === 0 || acting}
                aria-expanded={confirmDelete}
                className={`${toolbarBtn} text-brand-dark`}
              >
                <TrashIcon />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </div>
          </div>
          {confirmDelete && selectedMessages.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line bg-field px-4 py-2.5">
              <p className="mr-auto text-[12px] font-semibold text-ink">
                Delete {selectedMessages.length} {selectedMessages.length === 1 ? "message" : "messages"}?
              </p>
              <button type="button" disabled={acting} onClick={() => runDelete(selectedMessages.map((m) => m.id), "me")} className={toolbarBtn}>
                Delete for me
              </button>
              {canDeleteSelectedForAll && (
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => runDelete(selectedMessages.map((m) => m.id), "all")}
                  className={`${toolbarBtn} border-brand/30 bg-brand text-white hover:bg-brand-dark`}
                >
                  Delete for everyone
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab */}
      <div className={`flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 md:px-5 ${selecting ? "hidden" : ""}`}>
        <div role="tablist" aria-label="Conversation channel" className="flex gap-1 rounded-full border border-line bg-field p-1">
          {tabs.map((t) => {
            const active = !showMedia && channel === t.id;
            const activeTone = t.id === "internal" ? "bg-amber-700 text-white shadow-sm" : "bg-brand text-white shadow-sm";
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={active}
                aria-controls="chat-panel"
                onClick={() => {
                  setChannel(t.id);
                  setShowMedia(false);
                  setError(null);
                  setReplyTo(null);
                  exitSelect();
                }}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition ${
                  active ? activeTone : "text-muted hover:text-ink"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
          <button
            type="button"
            role="tab"
            id="tab-media"
            aria-selected={showMedia}
            aria-controls="chat-panel"
            onClick={() => {
              setShowMedia(true);
              exitSelect();
            }}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition ${
              showMedia ? "bg-brand text-white shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <MediaIcon />
            Media
            {media.length > 0 && (
              <span
                className={`rounded-full px-1.5 py-px text-[11px] font-bold leading-none ${showMedia ? "bg-white/25 text-white" : "bg-brand/10 text-brand-dark"}`}
              >
                {media.length}
              </span>
            )}
          </button>
        </div>
        <p className="hidden text-[12px] text-muted sm:block">
          {showMedia ? "Photos, videos & files from the client" : tabs.find((t) => t.id === channel)?.hint}
        </p>
        {live && (
          <span className="ml-auto">
            <LiveDot connected={stream.connected} />
          </span>
        )}
      </div>

      {internal && !locked && !showMedia && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2 text-[12px] font-medium text-amber-900">
          <NoteIcon size={14} />
          {isL2
            ? "Private chat between you and L1. L1 passes your updates on to the client."
            : "Only petugas can see these notes. The client never sees them. Use Forward to pass an update to the client."}
        </div>
      )}

      {showMedia ? (
        <div id="chat-panel" role="tabpanel" aria-labelledby="tab-media" className="flex-1 overflow-y-auto bg-field/50 px-4 py-5 md:px-6">
          <MediaGallery items={media} />
        </div>
      ) : (
        <>
      {/* Isi percakapan */}
      <div
        id="chat-panel"
        role="tabpanel"
        aria-labelledby={`tab-${channel}`}
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className={`flex-1 overflow-y-auto px-4 py-5 md:px-6 ${internal ? "bg-amber-50/40" : "bg-field/50"}`}
      >
        {locked ? (
          <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-muted shadow-sm ring-1 ring-line">
              <LockIcon size={24} />
            </span>
            <p className="mt-4 text-[15px] font-bold text-ink">Internal note is locked</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              {access.internalNote.note}
              {canEscalate && " Escalate to hand this ticket to the technical team and start talking with them here."}
            </p>
            {canEscalate && (
              <button type="button" onClick={() => setEscalateOpen(true)} className={`${primaryBtn} mt-5`}>
                Escalate to L2
              </button>
            )}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-[13px] text-muted">
            {internal
              ? isL2
                ? "No messages yet. Send your findings to L1 here."
                : "No internal notes yet. Use this space to coordinate between L1 and L2."
              : "No messages yet."}
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
                  internal={internal}
                  viewer="staff"
                  clientName={clientName}
                  viewerId={viewerId}
                  actions={actions}
                  onJump={jumpTo}
                  flash={flashId === r.msg.id}
                  selection={{ active: selecting, selected: selected.has(r.msg.id), onToggle: toggleSelect }}
                />
              ),
            )}
          </div>
        )}
      </div>

      {/* Composer (tetap terpasang saat mode pilih supaya draft tidak hilang) */}
      <div className={`border-t border-line p-3 md:p-4 ${selecting ? "hidden" : ""}`}>
        {!canSend && state.note && !locked && (
          <p className="mb-2.5 flex items-center gap-2 rounded-2xl bg-field px-3.5 py-2.5 text-[12px] font-medium text-muted">
            <LockIcon size={14} className="shrink-0" />
            {state.note}
          </p>
        )}
        {error && (
          <p role="alert" className="mb-2.5 text-[12px] font-medium text-brand-dark">
            {error}
          </p>
        )}
        {replyTo && canSend && (
          <div className="mb-2 flex items-start gap-3 rounded-2xl border-l-4 border-brand bg-field px-3.5 py-2">
            <div className="min-w-0 flex-1 text-[12px] leading-snug">
              <p className="font-bold text-ink">
                Replying to {replyTo.senderId === viewerId ? "yourself" : senderLabel(replyTo, "staff", clientName)}
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
          <label htmlFor="chat-input" className="sr-only">
            {internal ? (isL2 ? "Message to L1" : "Internal note") : "Reply to client"}
          </label>
          <textarea
            id="chat-input"
            rows={2}
            value={draft}
            disabled={!canSend}
            maxLength={4000}
            onChange={(e) => setDrafts((d) => ({ ...d, [channel]: e.target.value }))}
            onKeyDown={(e) => {
              // Enter = kirim, Shift+Enter = baris baru. Jangan kirim saat memilih kata lewat IME.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={
              locked
                ? "Locked until this ticket is escalated to L2"
                : !canSend
                  ? "Unavailable"
                  : internal
                    ? isL2
                      ? "Write to L1. The client can't see this…"
                      : "Write an internal note. The client can't see this…"
                    : "Write a reply to the client…"
            }
            className={`min-h-[52px] w-full resize-none rounded-2xl border px-4 py-3 text-[14px] leading-relaxed text-ink outline-none transition placeholder:text-[#9aa1b3] disabled:cursor-not-allowed disabled:opacity-60 ${
              internal
                ? "border-amber-200 bg-amber-50 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/15"
                : "border-line bg-field focus:border-brand/60 focus:bg-white focus:ring-4 focus:ring-brand/10"
            }`}
          />
          <button
            type="button"
            onClick={send}
            disabled={!canSend || pending || !draft.trim()}
            aria-label={internal ? (isL2 ? "Send to L1" : "Add internal note") : "Send reply"}
            className={`flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-full px-5 text-[14px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
              internal ? "bg-amber-700 hover:bg-amber-800" : "bg-brand shadow-[0_14px_30px_-10px_color-mix(in_srgb,var(--color-brand)_75%,transparent)] hover:bg-brand-dark"
            }`}
          >
            <SendIcon />
            <span className="hidden sm:inline">{pending ? "Sending…" : internal ? (isL2 ? "Send" : "Add note") : "Send"}</span>
          </button>
        </div>
      </div>

        </>
      )}

      <ForwardDialog
        open={forwardIds !== null}
        count={forwardIds?.length ?? 0}
        targets={forwardTargets}
        defaultTarget={defaultForward}
        pending={acting}
        error={forwardError}
        onConfirm={runForward}
        onClose={() => setForwardIds(null)}
      />
      <EscalateDialog ticketId={ticketId} open={escalateOpen} onClose={closeEscalate} />
    </section>
  );
}
