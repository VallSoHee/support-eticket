"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { markAllNotificationsReadAction, markNotificationsReadAction, markTicketNotificationsReadAction } from "@/lib/notify/actions";
import type { NotificationItem, NotificationPage } from "@/lib/notify/types";
import type { Role } from "@/lib/roles";

// Bel notifikasi di header, di samping menu profil (dipakai Admin, Petugas L1/L2, dan Client).
//  - Daftar awal: GET /api/notifications. Pembaruan realtime: SSE /api/notifications/stream.
//  - Membuka halaman sebuah tiket otomatis menandai notifikasi tiket itu terbaca.
//  - Notifikasi baru muncul sebagai toast kecil (kecuali untuk tiket yang sedang dibuka).

const MAX_LOADED = 30;
const TOAST_MS = 6000;
const MAX_TOASTS = 3;

const ic = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const BellIcon = ({ size = 20 }: { size?: number }) => (
  <svg {...ic} width={size} height={size}>
    <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
);

function TypeIcon({ type }: { type: NotificationItem["type"] }) {
  switch (type) {
    case "NEW_REPLY":
      return (
        <svg {...ic}>
          <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4A8 8 0 1 1 20 12Z" />
        </svg>
      );
    case "NEW_TICKET":
      return (
        <svg {...ic}>
          <path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v3Z" />
          <path d="M13 5v14" strokeDasharray="2 3" />
        </svg>
      );
    case "ANNOUNCEMENT":
      return (
        <svg {...ic}>
          <path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1Z" />
          <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
        </svg>
      );
    case "SLA_WARNING":
    case "SLA_BREACH":
      return (
        <svg {...ic}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5M12 16h.01" />
        </svg>
      );
    default:
      return (
        <svg {...ic}>
          <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />
        </svg>
      );
  }
}

function timeAgo(iso: string, now: number) {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(m, 1)} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

// Tiket yang sedang dibuka, dari URL (/client/tickets/<id>, /l1/..., /l2/..., /admin/...). "new" bukan tiket.
const TICKET_PATH = /^\/(?:client|l1|l2|admin)\/tickets\/([^/]+)\/?$/;
const openTicketId = (pathname: string) => {
  const id = TICKET_PATH.exec(pathname)?.[1];
  return id && id !== "new" ? id : null;
};

type Toast = { key: string; item: NotificationItem };

export function NotificationBell({ role, userId }: { role: Role; userId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ringKey, setRingKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<HTMLDivElement>(null);

  // Nilai terkini untuk handler SSE (dibuat sekali) tanpa membuka ulang koneksi tiap render.
  const live = useRef({ pathname, open });
  useEffect(() => {
    live.current = { pathname, open };
  });

  const markRead = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const set = new Set(ids);
    setItems((prev) => prev.map((n) => (set.has(n.id) ? { ...n, isRead: true } : n)));
    setUnread((u) => Math.max(0, u - ids.length));
    void markNotificationsReadAction(ids).catch(() => {});
  }, []);

  // ---- Daftar awal + realtime ----
  // Browser membatasi ±6 koneksi per origin (HTTP/1.1) dan chat sudah memakai satu SSE per tab tiket. Karena itu
  // semua tab dalam satu browser BERBAGI satu stream notifikasi: tab "pemimpin" (pemegang Web Lock) membuka
  // EventSource lalu meneruskan kejadian ke tab lain lewat BroadcastChannel. Tab pemimpin ditutup -> kunci
  // berpindah ke tab lain. Browser tanpa Web Locks/BroadcastChannel membuka stream sendiri-sendiri.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/notifications?limit=${MAX_LOADED}`, { cache: "no-store" });
        if (!res.ok) return;
        const page = (await res.json()) as NotificationPage;
        if (cancelled) return;
        setItems(page.items);
        setUnread(page.unread);
        setLoaded(true);
      } catch {
        /* jaringan putus: stream menyambung ulang dan memanggil load lagi */
      }
    };

    const handle = ({ item, unread: total }: { item: NotificationItem; unread: number }) => {
      const { pathname: here, open: isOpen } = live.current;
      const viewing = !!item.ticketId && openTicketId(here) === item.ticketId;

      // Tiket yang sedang dibuka: pesannya sudah terlihat di chat, jadi langsung dianggap terbaca.
      if (viewing && !item.isRead) {
        item = { ...item, isRead: true };
        void markTicketNotificationsReadAction(item.ticketId!).catch(() => {});
        setUnread(Math.max(0, total - 1));
      } else {
        setUnread(total);
        setRingKey((k) => k + 1);
        if (!isOpen && !item.isRead) {
          const key = `${item.id}-${item.createdAt}`;
          setToasts((prev) => [...prev.filter((t) => t.item.id !== item.id), { key, item }].slice(-MAX_TOASTS));
          window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.key !== key)), TOAST_MS);
        }
      }
      setItems((prev) => [item, ...prev.filter((n) => n.id !== item.id)].slice(0, MAX_LOADED));
    };

    const connect = (onMessage?: (p: { item: NotificationItem; unread: number }) => void, onOpen?: () => void) => {
      const es = new EventSource("/api/notifications/stream");
      // Dipanggil di setiap (re)koneksi: menutup celah notifikasi yang masuk saat koneksi putus.
      es.onopen = () => {
        void load();
        onOpen?.();
      };
      es.addEventListener("notification", (e) => {
        const payload = JSON.parse((e as MessageEvent<string>).data) as { item: NotificationItem; unread: number };
        handle(payload);
        onMessage?.(payload);
      });
      es.addEventListener("gone", () => es.close());
      return es;
    };

    let es: EventSource | null = null;
    let bc: BroadcastChannel | null = null;
    let releaseLock: (() => void) | null = null;

    if ("locks" in navigator && typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(`notify:${userId}`);
      bc = channel;
      channel.onmessage = (e: MessageEvent<{ t: "n"; p: { item: NotificationItem; unread: number } } | { t: "reload" }>) => {
        if (e.data.t === "n") handle(e.data.p);
        else void load();
      };
      void navigator.locks.request(
        `notify-sse:${userId}`,
        () =>
          new Promise<void>((resolve) => {
            if (cancelled) return resolve();
            releaseLock = resolve;
            es = connect(
              (p) => channel.postMessage({ t: "n", p }),
              () => channel.postMessage({ t: "reload" }),
            );
          }),
      );
      // Tab yang bukan pemimpin tetap mengambil daftar awalnya sendiri.
      void load();
    } else {
      es = connect();
    }

    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      es?.close();
      releaseLock?.();
      bc?.close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  // ---- Membuka halaman tiket = notifikasi tiket itu terbaca ----
  // State lokal diperbarui SETELAH server action selesai; `inflight` mencegah panggilan ganda selagi menunggu.
  const inflight = useRef(new Set<string>());
  useEffect(() => {
    const id = openTicketId(pathname);
    if (!id || inflight.current.has(id)) return;
    const pending = items.filter((n) => n.ticketId === id && !n.isRead).map((n) => n.id);
    if (pending.length === 0) return;
    inflight.current.add(id);
    markTicketNotificationsReadAction(id)
      .then(() => {
        const done = new Set(pending);
        setItems((prev) => prev.map((n) => (done.has(n.id) ? { ...n, isRead: true } : n)));
        setUnread((u) => Math.max(0, u - pending.length));
      })
      .catch(() => {})
      .finally(() => inflight.current.delete(id));
  }, [pathname, items]);

  // ---- Dropdown: tutup saat klik di luar / Escape; waktu relatif diperbarui selama terbuka ----
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markAll = () => {
    if (unread === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    void markAllNotificationsReadAction().catch(() => {});
  };

  const openItem = (n: NotificationItem) => {
    if (!n.isRead) markRead([n.id]);
    setOpen(false);
    setToasts((prev) => prev.filter((t) => t.item.id !== n.id));
  };

  const goToast = (n: NotificationItem) => {
    openItem(n);
    if (n.href) router.push(n.href);
  };

  return (
    // Tidak `relative` di layar kecil: panel dipasang selebar header (relatif ke header yang sticky),
    // supaya tidak terpotong di sisi kiri layar. Mulai sm panel menempel ke tombol bel.
    <div ref={ref} className="sm:relative">
      <button
        type="button"
        onClick={() => {
          setNow(Date.now());
          setOpen((v) => !v);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:border-brand/50 hover:text-brand"
      >
        <span key={ringKey} className={ringKey > 0 ? "bell-ring" : ""}>
          <BellIcon />
        </span>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute inset-x-3 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_20px_40px_-16px_rgba(30,35,60,0.35)] sm:inset-x-auto sm:right-0 sm:w-[24rem]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="text-[14px] font-bold text-ink">
              Notifications
              {unread > 0 && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-dark">{unread} new</span>}
            </p>
            <button
              type="button"
              onClick={markAll}
              disabled={unread === 0}
              className="text-[12px] font-semibold text-brand transition hover:text-brand-dark disabled:cursor-default disabled:text-muted disabled:opacity-60"
            >
              Mark all as read
            </button>
          </div>

          <ul className="max-h-[min(70vh,26rem)] overflow-y-auto">
            {!loaded && <li className="px-4 py-10 text-center text-[13px] text-muted">Loading…</li>}
            {loaded && items.length === 0 && (
              <li className="px-4 py-10 text-center">
                <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-field text-muted">
                  <BellIcon />
                </span>
                <p className="text-[13px] font-semibold text-ink">You&apos;re all caught up</p>
                <p className="mt-0.5 text-[12px] text-muted">New activity on your tickets will show up here.</p>
              </li>
            )}
            {items.map((n) => {
              const body = (
                <>
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      n.isRead ? "bg-field text-muted" : "bg-brand-soft text-brand-dark"
                    }`}
                  >
                    <TypeIcon type={n.type} />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className={`block truncate text-[13px] ${n.isRead ? "font-medium text-ink" : "font-bold text-ink"}`}>{n.title}</span>
                    <span className="mt-0.5 line-clamp-2 block break-words text-[12px] leading-snug text-muted">{n.message}</span>
                    <span className="mt-1 block text-[11px] text-muted">{timeAgo(n.createdAt, now)}</span>
                  </span>
                  {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                </>
              );
              const cls = `flex w-full items-start gap-3 border-b border-line px-4 py-3 transition last:border-0 hover:bg-field ${n.isRead ? "" : "bg-brand-soft/30"}`;
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link href={n.href} onClick={() => openItem(n)} className={cls}>
                      {body}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => openItem(n)} className={cls}>
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {role === "ADMIN" && (
            <Link
              href="/admin/notifications"
              onClick={() => setOpen(false)}
              className="block border-t border-line px-4 py-3 text-center text-[12px] font-semibold text-ink transition hover:bg-field hover:text-brand"
            >
              Notification settings
            </Link>
          )}
        </div>
      )}

      {/* Toast: di-portal ke <body> karena header memakai backdrop-blur (membuat `fixed` terkurung di header). */}
      {toasts.length > 0 &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-3 top-3 z-[70] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:top-4" aria-live="polite">
            {toasts.map(({ key, item }) => (
              <div
                key={key}
                className="toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-white p-3 pr-2 shadow-[0_20px_40px_-16px_rgba(30,35,60,0.4)]"
              >
                <button type="button" onClick={() => goToast(item)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-dark">
                    <TypeIcon type={item.type} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-ink">{item.title}</span>
                    <span className="mt-0.5 line-clamp-2 block break-words text-[12px] leading-snug text-muted">{item.message}</span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => setToasts((prev) => prev.filter((t) => t.key !== key))}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-field hover:text-ink"
                >
                  <svg {...ic} width={14} height={14}>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
