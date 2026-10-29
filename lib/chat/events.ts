import { EventEmitter } from "node:events";

// Pemicu "ada yang baru" per tiket, dalam satu proses Node. Stream SSE (app/api/tickets/[id]/stream)
// langsung terbangun saat pesan/status berubah, jadi pesan tampil nyaris instan.
//
// Ini HANYA pemicu, bukan sumber data: stream tetap membaca database dan juga polling berkala
// sebagai cadangan. Jadi kalau aplikasi dijalankan >1 instance (atau serverless), pesan tetap
// sampai — hanya selisih beberapa detik (POLL_MS), bukan hilang.

const globalForBus = globalThis as unknown as { ticketBus?: EventEmitter };

const bus = globalForBus.ticketBus ?? new EventEmitter();
bus.setMaxListeners(0); // satu listener per koneksi SSE yang terbuka
globalForBus.ticketBus = bus;

const channel = (ticketId: string) => `ticket:${ticketId}`;

/** Panggil setelah pesan baru / perubahan status tiket tersimpan. */
export function notifyTicket(ticketId: string) {
  bus.emit(channel(ticketId));
}

/** Berlangganan; mengembalikan fungsi untuk berhenti. */
export function onTicketChange(ticketId: string, listener: () => void) {
  bus.on(channel(ticketId), listener);
  return () => {
    bus.off(channel(ticketId), listener);
  };
}

// "Hapus untuk semua": stream SSE hanya membaca pesan BARU, jadi penghapusan pesan lama dikabarkan
// lewat saluran sendiri yang membawa id pesannya.
const delChannel = (ticketId: string) => `ticket-del:${ticketId}`;

export function notifyMessageDeleted(ticketId: string, messageId: string) {
  bus.emit(delChannel(ticketId), messageId);
}

export function onMessageDeleted(ticketId: string, listener: (messageId: string) => void) {
  bus.on(delChannel(ticketId), listener);
  return () => {
    bus.off(delChannel(ticketId), listener);
  };
}
