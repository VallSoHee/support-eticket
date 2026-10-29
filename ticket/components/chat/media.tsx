"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { AttachmentMeta } from "@/lib/chat/types";

// Media chat: viewer layar penuh (klik foto/video) + galeri "Media" ala WhatsApp
// yang memisahkan Photos / Videos / Files. Dipakai Petugas (ChatPanel) dan Client (Bubble).

export type MediaKind = "image" | "video" | "file";
export type MediaItem = { id: string; url: string; name: string; kind: MediaKind; size?: number; at: string };

export const UPLOAD_PREFIX = "/api/uploads/";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

export const kindOfName = (name: string): MediaKind =>
  VIDEO_EXT.test(name) ? "video" : IMAGE_EXT.test(name) ? "image" : "file";

export const kindOfMime = (mime: string): MediaKind =>
  mime.startsWith("video/") ? "video" : mime.startsWith("image/") ? "image" : "file";

const stripTags = (s: string) =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

/**
 * Kumpulkan semua foto/video/file dari HTML pesan (+ deskripsi tiket). Dihitung di browser dari pesan
 * yang tampil, jadi ikut realtime & pesan yang "dihapus untuk semua" (isi kosong) otomatis hilang.
 * `meta` (dari database) melengkapi nama asli, tipe, dan ukuran.
 */
export function extractMedia(sources: { html: string; at: string }[], meta: AttachmentMeta[]): MediaItem[] {
  const byId = new Map(meta.map((m) => [m.id, m]));
  const found = new Map<string, MediaItem>();

  const add = (id: string, guessKind: MediaKind, guessName: string | undefined, at: string) => {
    if (found.has(id)) return;
    const m = byId.get(id);
    found.set(id, {
      id,
      url: `${UPLOAD_PREFIX}${id}`,
      name: m?.name ?? guessName ?? "Attachment",
      kind: m ? kindOfMime(m.mime) : guessKind,
      size: m?.size,
      at: m?.createdAt ?? at,
    });
  };

  for (const s of sources) {
    if (!s.html) continue;
    for (const mt of s.html.matchAll(/<img\b[^>]*?\bsrc="\/api\/uploads\/([A-Za-z0-9_-]+)"[^>]*>/gi)) {
      add(mt[1], "image", undefined, s.at);
    }
    for (const mt of s.html.matchAll(/<a\b[^>]*?\bhref="\/api\/uploads\/([A-Za-z0-9_-]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const name = stripTags(mt[2]);
      add(mt[1], kindOfName(name), name || undefined, s.at);
    }
  }
  return [...found.values()].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

const TZ = "Asia/Jakarta";
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ });

function formatBytes(n?: number) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const ico = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const MediaIcon = ({ size = 16 }: { size?: number }) => (
  <svg {...ico} width={size} height={size}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="M21 16l-5-5-8 8" />
  </svg>
);
const PlayIcon = () => (
  <svg {...ico} width={28} height={28} fill="currentColor" stroke="none">
    <path d="M8 5.5v13a1 1 0 0 0 1.55.83l10-6.5a1 1 0 0 0 0-1.66l-10-6.5A1 1 0 0 0 8 5.5Z" />
  </svg>
);
const CloseIcon = () => (
  <svg {...ico}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const DownloadIcon = () => (
  <svg {...ico}>
    <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
  </svg>
);
const ExternalIcon = () => (
  <svg {...ico}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);
const ChevronIcon = ({ dir }: { dir: "left" | "right" }) => (
  <svg {...ico} width={26} height={26}>
    <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
  </svg>
);

/** Viewer layar penuh untuk foto & video. Esc menutup, panah kiri/kanan berpindah. */
export function MediaViewer({
  items,
  index,
  onClose,
  onIndex,
}: {
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const item = items[index];
  const many = items.length > 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && many) onIndex((index - 1 + items.length) % items.length);
      else if (e.key === "ArrowRight" && many) onIndex((index + 1) % items.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, items.length, many, onClose, onIndex]);

  if (!item || typeof document === "undefined") return null;

  const btn =
    "flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={item.name} className="fixed inset-0 z-[80] flex flex-col bg-black/90 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">{item.name}</p>
          <p className="text-[12px] text-white/60">
            {[many ? `${index + 1} / ${items.length}` : "", formatBytes(item.size), dayLabel(item.at)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <a href={item.url} download={item.name} className={btn} aria-label="Download" title="Download">
          <DownloadIcon />
        </a>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className={btn} aria-label="Open in new tab" title="Open in new tab">
          <ExternalIcon />
        </a>
        <button type="button" onClick={onClose} className={btn} aria-label="Close" title="Close (Esc)">
          <CloseIcon />
        </button>
      </div>

      {/* Klik area gelap = tutup; klik media sendiri tidak menutup. */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6" onClick={onClose}>
        {item.kind === "video" ? (
          // key = id supaya pemutar dibuat ulang saat pindah video
          <video
            key={item.id}
            src={item.url}
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-xl bg-black shadow-2xl"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.id}
            src={item.url}
            alt={item.name}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
          />
        )}

        {many && (
          <>
            <button
              type="button"
              aria-label="Previous"
              onClick={(e) => {
                e.stopPropagation();
                onIndex((index - 1 + items.length) % items.length);
              }}
              className={`${btn} absolute left-3 top-1/2 -translate-y-1/2 sm:left-5`}
            >
              <ChevronIcon dir="left" />
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={(e) => {
                e.stopPropagation();
                onIndex((index + 1) % items.length);
              }}
              className={`${btn} absolute right-3 top-1/2 -translate-y-1/2 sm:right-5`}
            >
              <ChevronIcon dir="right" />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

type Filter = "all" | MediaKind;

/** Galeri "Media" untuk Petugas: Photos, Videos, dan Files dipisah. */
export function MediaGallery({ items }: { items: MediaItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<number | null>(null);

  const images = items.filter((i) => i.kind === "image");
  const videos = items.filter((i) => i.kind === "video");
  const files = items.filter((i) => i.kind === "file");
  // Urutan di viewer = urutan tampil di galeri (foto dulu, lalu video).
  const visual = [...images, ...videos];

  const show = (k: MediaKind) => filter === "all" || filter === k;

  const pills: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: items.length },
    { id: "image", label: "Photos", count: images.length },
    { id: "video", label: "Videos", count: videos.length },
    { id: "file", label: "Files", count: files.length },
  ];

  if (items.length === 0) {
    return (
      <div className="mx-auto flex h-full max-w-xs flex-col items-center justify-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-muted shadow-sm ring-1 ring-line">
          <MediaIcon size={24} />
        </span>
        <p className="mt-4 text-[15px] font-bold text-ink">No media yet</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          Photos, videos and files the client sends in this ticket will show up here.
        </p>
      </div>
    );
  }

  const heading = (label: string, count: number) => (
    <h4 className="mb-2.5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-muted">
      {label}
      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-ink ring-1 ring-line">
        {count}
      </span>
    </h4>
  );

  const tile =
    "group relative aspect-square overflow-hidden rounded-xl bg-white ring-1 ring-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Media type" className="flex flex-wrap gap-1.5">
        {pills.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={filter === p.id}
            onClick={() => setFilter(p.id)}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
              filter === p.id ? "bg-brand text-white shadow-sm" : "bg-white text-muted ring-1 ring-line hover:text-ink"
            }`}
          >
            {p.label} <span className="opacity-70">{p.count}</span>
          </button>
        ))}
      </div>

      {show("image") && images.length > 0 && (
        <section aria-label="Photos">
          {heading("Photos", images.length)}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((m, i) => (
              <button key={m.id} type="button" onClick={() => setOpen(i)} className={tile} title={m.name} aria-label={`Open photo ${m.name}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.name} loading="lazy" className="h-full w-full object-cover transition duration-200 group-hover:scale-105" />
              </button>
            ))}
          </div>
        </section>
      )}

      {show("video") && videos.length > 0 && (
        <section aria-label="Videos">
          {heading("Videos", videos.length)}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {videos.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setOpen(images.length + i)}
                className={`${tile} bg-black`}
                title={m.name}
                aria-label={`Play video ${m.name}`}
              >
                <video src={`${m.url}#t=0.1`} preload="metadata" muted playsInline className="h-full w-full object-cover opacity-90" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white transition group-hover:bg-black/40">
                  <PlayIcon />
                </span>
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-left text-[11px] font-medium text-white">
                  {m.name}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {show("file") && files.length > 0 && (
        <section aria-label="Files">
          {heading("Files", files.length)}
          <ul className="space-y-2">
            {files.map((m) => {
              const ext = (m.name.split(".").pop() ?? "file").slice(0, 4).toUpperCase();
              return (
                <li key={m.id}>
                  <a
                    href={m.url}
                    download={m.name}
                    className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 ring-1 ring-line transition hover:ring-brand/50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-[11px] font-extrabold text-brand-dark">
                      {ext}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">{m.name}</span>
                      <span className="block text-[11px] text-muted">
                        {[formatBytes(m.size), dayLabel(m.at)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-muted">
                      <DownloadIcon />
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {open !== null && <MediaViewer items={visual} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />}
    </div>
  );
}
