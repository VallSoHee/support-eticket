import { EventEmitter } from "node:events";

// Pemicu "ada notifikasi baru" per user, dalam satu proses Node — pola yang sama dengan lib/chat/events.ts.
// Stream SSE (app/api/notifications/stream) terbangun seketika; stream juga polling berkala sebagai
// cadangan, jadi bila aplikasi jalan >1 instance notifikasi tetap sampai (hanya telat beberapa detik).

const globalForBus = globalThis as unknown as { notifyBus?: EventEmitter };

const bus = globalForBus.notifyBus ?? new EventEmitter();
bus.setMaxListeners(0); // satu listener per tab browser yang terbuka
globalForBus.notifyBus = bus;

const channel = (userId: string) => `notify:${userId}`;

export function emitUserNotified(userIds: Iterable<string>) {
  for (const id of userIds) bus.emit(channel(id));
}

export function onUserNotified(userId: string, listener: () => void) {
  bus.on(channel(userId), listener);
  return () => {
    bus.off(channel(userId), listener);
  };
}
