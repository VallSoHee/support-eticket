"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ChatMessage } from "@/lib/staff/types";
import type { DeleteScope } from "@/lib/chat/types";
import { MediaViewer, UPLOAD_PREFIX, kindOfName, type MediaItem } from "@/components/chat/media";

// Potongan UI chat yang dipakai bersama oleh ChatPanel (Petugas) dan ClientChat (Client).

// WIB dipatok eksplisit supaya render server & browser identik (tanpa hydration mismatch).
const TZ = "Asia/Jakarta";
export const timeFmt = (iso: string) =>
  new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
export const dayFmt = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ });

export type ChatRow = { kind: "day"; key: string; label: string } | { kind: "msg"; msg: ChatMessage };

/** Sisipkan pembatas tanggal di antara pesan. */
export function buildRows(messages: ChatMessage[]): ChatRow[] {
  const out: ChatRow[] = [];
  let last = "";
  for (const m of messages) {
    const day = dayFmt(m.createdAt);
    if (day !== last) {
      out.push({ kind: "day", key: `d-${m.id}`, label: day });
      last = day;
    }
    out.push({ kind: "msg", msg: m });
  }
  return out;
}

export function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1 text-[11px] font-semibold text-muted">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Siapa pengirimnya, menurut siapa yang membaca. Client tidak perlu tahu istilah L1/L2. */
export function senderLabel(
  m: Pick<ChatMessage, "senderType" | "senderName">,
  viewer: "staff" | "client",
  clientName: string,
) {
  if (m.senderType === "CLIENT") return clientName;
  if (m.senderType === "BOT") return "Assistant";
  if (viewer === "client") return m.senderType === "PETUGAS_L1" ? (m.senderName ?? "Support team") : "Technical team";
  return `${m.senderName ?? "Petugas"} · ${m.senderType === "PETUGAS_L1" ? "L1" : "L2"}`;
}

/** Ringkasan satu baris sebuah pesan (untuk bilah "Replying to"). Konten HTML sudah disanitasi server. */
export function messagePreview(m: ChatMessage): string {
  if (m.deleted) return "This message was deleted";
  if (!m.html) return m.content.replace(/\s+/g, " ").trim().slice(0, 140);
  const text = m.content
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (!text && /<img\b/i.test(m.content)) return "Photo";
  return text.slice(0, 140);
}

/** Teks lengkap sebuah pesan (untuk disalin). Konten HTML sudah disanitasi server; di sini hanya diubah jadi teks. */
export function messageFullText(m: ChatMessage): string {
  if (m.deleted) return "";
  if (!m.html) return m.content.trim();
  const text = m.content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || (/<img\b/i.test(m.content) ? "[Photo]" : "");
}

/** Aksi per pesan (menu seperti WhatsApp). Tanpa `actions`, bubble hanya tampilan baca. */
export type BubbleActions = {
  onReply?: (m: ChatMessage) => void;
  /** Teruskan pesan ini (Petugas). */
  onForward?: (m: ChatMessage) => void;
  /** Masuk mode pilih dengan pesan ini sebagai pilihan pertama (Petugas). */
  onSelect?: (m: ChatMessage) => void;
  onDelete?: (m: ChatMessage, scope: DeleteScope) => void;
  /** Boleh "hapus untuk semua"? (hanya pesan sendiri, chat masih terbuka) */
  canDeleteForAll?: (m: ChatMessage) => boolean;
};

const MENU_W = 208;

function MessageMenu({
  m,
  mine,
  actions,
}: {
  m: ChatMessage;
  mine: boolean;
  actions: BubbleActions;
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = () => setPos(null);
  const canReply = !!actions.onReply && !m.deleted;
  const canDeleteAll = !!actions.onDelete && !m.deleted && !!actions.canDeleteForAll?.(m);
  const canDeleteMe = !!actions.onDelete;
  const canForward = !!actions.onForward && !m.deleted;
  const canSelect = !!actions.onSelect;

  useEffect(() => {
    if (!pos) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true); // true: ikut scroll di dalam kotak chat
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [pos]);

  if (!canReply && !canDeleteMe && !canForward && !canSelect) return null;

  const toggle = () => {
    if (pos) return close();
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const items = [canReply, canForward, canSelect, canDeleteMe, canDeleteAll].filter(Boolean).length;
    const h = items * 40 + 12;
    const left = Math.max(8, Math.min(window.innerWidth - MENU_W - 8, mine ? r.right - MENU_W : r.left));
    const top = r.bottom + 4 + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 4) : r.bottom + 4;
    setPos({ left, top });
  };

  const item =
    "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-semibold text-ink transition hover:bg-field";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="Message options"
        aria-haspopup="menu"
        aria-expanded={!!pos}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-black/5 hover:text-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 group-hover/msg:opacity-100 [@media(hover:none)]:opacity-100 ${
          pos ? "opacity-100" : "opacity-0"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ left: pos.left, top: pos.top, width: MENU_W }}
            className="fixed z-[60] overflow-hidden rounded-2xl border border-line bg-white py-1.5 shadow-[0_18px_44px_-14px_rgba(28,33,48,0.4)]"
          >
            {canReply && (
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => {
                  close();
                  actions.onReply?.(m);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 14L4 9l5-5" />
                  <path d="M4 9h10a6 6 0 0 1 6 6v3" />
                </svg>
                Reply
              </button>
            )}
            {canForward && (
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => {
                  close();
                  actions.onForward?.(m);
                }}
              >
                <ForwardIcon />
                Forward
              </button>
            )}
            {canSelect && (
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => {
                  close();
                  actions.onSelect?.(m);
                }}
              >
                <SelectIcon />
                Select
              </button>
            )}
            {canDeleteMe && (
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => {
                  close();
                  actions.onDelete?.(m, "me");
                }}
              >
                <TrashIcon />
                Delete for me
              </button>
            )}
            {canDeleteAll && (
              <button
                type="button"
                role="menuitem"
                className={`${item} text-brand-dark`}
                onClick={() => {
                  close();
                  actions.onDelete?.(m, "all");
                }}
              >
                <TrashIcon />
                Delete for everyone
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

export function ForwardIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H10a6 6 0 0 0-6 6v3" />
    </svg>
  );
}

export function SelectIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </svg>
  );
}

export function CopyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
    </svg>
  );
}

export function Bubble({
  m,
  mine,
  internal = false,
  viewer,
  clientName,
  viewerId,
  actions,
  onJump,
  flash = false,
  selection,
}: {
  m: ChatMessage;
  mine: boolean;
  internal?: boolean;
  viewer: "staff" | "client";
  clientName: string;
  /** Untuk menandai kutipan "You" pada balasan. */
  viewerId?: string;
  actions?: BubbleActions;
  /** Klik kutipan -> lompat ke pesan asal. */
  onJump?: (messageId: string) => void;
  /** Sorot sebentar (setelah lompat dari kutipan). */
  flash?: boolean;
  /** Mode "pilih pesan": klik bubble = pilih/batal pilih; menu per pesan disembunyikan. */
  selection?: { active: boolean; selected: boolean; onToggle: (m: ChatMessage) => void };
}) {
  const deleted = !!m.deleted;
  const selecting = !!selection?.active;
  const selected = selecting && selection!.selected;
  const tone = deleted
    ? "border border-dashed border-line bg-white/70 text-muted"
    : internal
      ? "border border-amber-200 bg-amber-100 text-amber-950"
      : m.senderType === "BOT"
        ? "border border-violet-100 bg-violet-50 text-violet-950"
        : mine
          ? "bg-brand text-white"
          : "border border-line bg-white text-ink";

  const quote = m.replyTo;
  const quoteMine = !!quote && !!viewerId && quote.senderId === viewerId;

  // Pesan yang isinya hanya foto: bubble dirapatkan supaya gambar tidak "mengambang" di tengah blok warna.
  const mediaOnly = !deleted && !!m.html && !quote && messagePreview(m) === "Photo";

  // Klik foto -> viewer layar penuh (foto lain di pesan yang sama bisa digeser). Klik tautan video -> diputar.
  const [lightbox, setLightbox] = useState<{ items: MediaItem[]; index: number } | null>(null);
  const onRichClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selecting) {
      e.preventDefault(); // klik foto/tautan hanya memilih bubble, tidak membuka viewer
      return;
    }
    const target = e.target as HTMLElement;
    const img = target.closest("img");
    if (img && e.currentTarget.contains(img)) {
      const imgs = Array.from(e.currentTarget.querySelectorAll("img")).filter((i) => (i.getAttribute("src") ?? "").startsWith(UPLOAD_PREFIX));
      const index = imgs.indexOf(img);
      if (index >= 0) {
        e.preventDefault();
        setLightbox({
          items: imgs.map((i, n) => ({
            id: `${m.id}-${n}`,
            url: i.getAttribute("src") ?? "",
            name: i.getAttribute("alt") || "Photo",
            kind: "image" as const,
            at: m.createdAt,
          })),
          index,
        });
      }
      return;
    }
    const a = target.closest("a");
    if (a && e.currentTarget.contains(a)) {
      const href = a.getAttribute("href") ?? "";
      const name = (a.textContent ?? "").trim();
      if (href.startsWith(UPLOAD_PREFIX) && kindOfName(name) === "video") {
        e.preventDefault();
        setLightbox({ items: [{ id: `${m.id}-v`, url: href, name, kind: "video", at: m.createdAt }], index: 0 });
      }
    }
  };

  return (
    <div
      id={`msg-${m.id}`}
      {...(selecting
        ? {
            role: "checkbox",
            "aria-checked": selected,
            "aria-label": `Select message from ${mine ? "you" : senderLabel(m, viewer, clientName)}`,
            tabIndex: 0,
            onClick: () => selection?.onToggle(m),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                selection?.onToggle(m);
              }
            },
          }
        : {})}
      className={`group/msg flex flex-col ${mine ? "items-end" : "items-start"} ${
        selecting ? `-mx-2 cursor-pointer rounded-2xl px-2 py-1.5 transition ${selected ? "bg-brand/10" : "hover:bg-black/[0.03]"}` : ""
      }`}
    >
      <span className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-semibold text-muted">
        {mine ? "You" : senderLabel(m, viewer, clientName)}
        {m.forwarded && viewer === "staff" && !deleted && (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-1.5 py-px text-[10px] font-semibold">
            <ForwardIcon size={10} />
            Forwarded
          </span>
        )}
      </span>

      <div className={`flex w-full items-center gap-1 ${mine ? "flex-row-reverse" : ""}`}>
        {selecting && (
          <span
            aria-hidden
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
              selected ? "border-brand bg-brand text-white" : "border-line bg-white text-transparent"
            } ${mine ? "ml-1" : "mr-1"}`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
        )}
        <div
          className={`min-w-0 max-w-[85%] break-words rounded-2xl text-[14px] leading-relaxed transition-shadow duration-500 sm:max-w-[75%] ${mediaOnly ? "p-1.5" : "px-4 py-2.5"} ${tone} ${
            mine ? "rounded-br-md" : "rounded-bl-md"
          } ${m.html ? "" : "whitespace-pre-wrap"} ${flash ? "ring-4 ring-brand/30" : ""}`}
        >
          {quote && !deleted && (
            <button
              type="button"
              onClick={(e) => {
                if (selecting) return; // biarkan klik naik ke bubble (memilih)
                e.stopPropagation();
                onJump?.(quote.id);
              }}
              className={`mb-2 block w-full rounded-lg border-l-4 px-2.5 py-1.5 text-left text-[12px] leading-snug ${
                mine && !internal ? "border-white/70 bg-white/15" : "border-brand bg-field text-ink"
              }`}
            >
              <span className="block font-bold">{quoteMine ? "You" : senderLabel(quote, viewer, clientName)}</span>
              <span className={`line-clamp-2 break-words opacity-80 ${quote.deleted ? "italic" : ""}`}>
                {quote.deleted ? "This message was deleted" : quote.preview || "Message"}
              </span>
            </button>
          )}

          {deleted ? (
            <span className="inline-flex items-center gap-1.5 italic">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M5.6 5.6l12.8 12.8" />
              </svg>
              This message was deleted
            </span>
          ) : m.html ? (
            <div className="chat-rich" onClick={onRichClick} dangerouslySetInnerHTML={{ __html: m.content }} />
          ) : (
            m.content
          )}
        </div>

        {actions && !selecting && <MessageMenu m={m} mine={mine} actions={actions} />}
      </div>

      <span className="mt-1 px-1 text-[11px] text-muted">{timeFmt(m.createdAt)}</span>

      {lightbox && <MediaViewer items={lightbox.items} index={lightbox.index} onClose={() => setLightbox(null)} onIndex={(i) => setLightbox((v) => (v ? { ...v, index: i } : v))} />}
    </div>
  );
}

/** Titik kecil status sambungan realtime. */
export function LiveDot({ connected }: { connected: boolean }) {
  return (
    <span
      className="flex items-center gap-1.5 text-[11px] font-semibold text-muted"
      title={connected ? "Messages arrive instantly" : "Reconnecting…"}
      role="status"
    >
      <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "animate-pulse bg-amber-500"}`} />
      {connected ? "Live" : "Reconnecting…"}
    </span>
  );
}
