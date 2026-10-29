"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LiveMessage } from "@/lib/chat/types";

// Menyambung ke /api/tickets/:id/stream (SSE) dan menjaga daftar pesan tetap mutakhir.
// Dipakai bersama oleh chat Client dan chat Petugas.

function mergeMessages(prev: LiveMessage[], incoming: LiveMessage[]): LiveMessage[] {
  if (incoming.length === 0) return prev;
  const known = new Set(prev.map((m) => m.id));
  const fresh = incoming.filter((m) => !known.has(m.id));
  if (fresh.length === 0) return prev; // referensi sama -> tidak memicu render ulang
  return [...prev, ...fresh].sort((a, b) =>
    a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1,
  );
}

export function useTicketStream({
  ticketId,
  initial,
  initialCursor,
  initialStatus,
  enabled,
  onStatus,
}: {
  ticketId: string;
  /** Pesan hasil render server. Harus stabil (useMemo) — perubahan isinya digabung, bukan menimpa. */
  initial: LiveMessage[];
  /** Waktu server (ISO) untuk titik awal stream bila belum ada pesan — bebas dari selisih jam browser. */
  initialCursor: string;
  initialStatus: string;
  /** false untuk tiket yang sudah selesai: tidak perlu membuka koneksi. */
  enabled: boolean;
  /** Status tiket berubah (diklaim, eskalasi, selesai, ...). */
  onStatus?: (status: string) => void;
}) {
  // Pesan yang datang lewat stream / hasil kirim. Digabung dengan `initial` (data server) saat dibaca,
  // jadi data baru dari router.refresh() tidak menghapus pesan stream dan sebaliknya.
  const [live, setLive] = useState<LiveMessage[]>([]);
  const merged = useMemo(() => mergeMessages(initial, live), [initial, live]);
  const [connected, setConnected] = useState(false);

  // "Hapus untuk semua" (dari stream atau aksi sendiri) & "Hapus untuk saya" diterapkan di atas daftar
  // gabungan, jadi tetap berlaku walau router.refresh() menyegarkan `initial`.
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set());
  const messages = useMemo(() => {
    if (deletedIds.size === 0 && hiddenIds.size === 0) return merged;
    return merged
      .filter((m) => !hiddenIds.has(m.id))
      .map((m) => {
        const replyGone = m.replyTo && deletedIds.has(m.replyTo.id) && !m.replyTo.deleted;
        if (!deletedIds.has(m.id) && !replyGone) return m;
        return {
          ...m,
          ...(deletedIds.has(m.id) ? { deleted: true, content: "", html: false } : {}),
          ...(replyGone && m.replyTo ? { replyTo: { ...m.replyTo, deleted: true, preview: "" } } : {}),
        };
      });
  }, [merged, deletedIds, hiddenIds]);

  const cursor = useRef(initialCursor);
  const status = useRef(initialStatus);
  const onStatusRef = useRef(onStatus);
  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

  // Kursor selalu = pesan terbaru yang sudah dilihat; dipakai saat menyambung ulang.
  useEffect(() => {
    const last = merged[merged.length - 1];
    if (last && last.createdAt > cursor.current) cursor.current = last.createdAt;
  }, [merged]);

  // Status dari server (initialStatus berubah setelah refresh) menjadi acuan perbandingan berikutnya.
  useEffect(() => {
    status.current = initialStatus;
  }, [initialStatus]);

  const push = useCallback((m: LiveMessage) => setLive((prev) => mergeMessages(prev, [m])), []);
  const markDeleted = useCallback((id: string) => setDeletedIds((prev) => new Set(prev).add(id)), []);
  const hide = useCallback((id: string) => setHiddenIds((prev) => new Set(prev).add(id)), []);

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let delay = 1000;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      const qs = new URLSearchParams({ after: cursor.current, status: status.current });
      es = new EventSource(`/api/tickets/${encodeURIComponent(ticketId)}/stream?${qs.toString()}`);

      es.onopen = () => {
        delay = 1000;
        setConnected(true);
      };

      es.addEventListener("chat", (ev) => {
        try {
          const m = JSON.parse((ev as MessageEvent<string>).data) as LiveMessage;
          setLive((prev) => mergeMessages(prev, [m]));
        } catch {
          /* abaikan paket rusak */
        }
      });

      es.addEventListener("deleted", (ev) => {
        try {
          const { id } = JSON.parse((ev as MessageEvent<string>).data) as { id: string };
          setDeletedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
        } catch {
          /* abaikan */
        }
      });

      es.addEventListener("status", (ev) => {
        try {
          const { status: next } = JSON.parse((ev as MessageEvent<string>).data) as { status: string };
          status.current = next;
          onStatusRef.current?.(next);
        } catch {
          /* abaikan */
        }
      });

      // Akses dicabut (akun dinonaktifkan / tiket dipindah): berhenti, jangan menyambung ulang.
      es.addEventListener("gone", () => {
        stopped = true;
        es?.close();
        setConnected(false);
      });

      es.onerror = () => {
        // Tutup dan sambung ulang sendiri dengan kursor TERBARU (EventSource bawaan akan memakai
        // URL lama, sehingga mengirim ulang pesan yang sudah ada).
        es?.close();
        setConnected(false);
        if (stopped) return;
        retry = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 15000);
      };
    };

    // Tab kembali terlihat (laptop bangun dari sleep, HP dibuka lagi): sambung segera kalau terputus.
    const onVisible = () => {
      if (document.visibilityState !== "visible" || stopped) return;
      if (!es || es.readyState === EventSource.CLOSED) {
        clearTimeout(retry);
        delay = 1000;
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      document.removeEventListener("visibilitychange", onVisible);
      es?.close();
      setConnected(false);
    };
  }, [ticketId, enabled]);

  return { messages, push, markDeleted, hide, connected };
}
