import { authorizeApi, getCurrentUser } from "@/lib/auth/guards";
import { onUserNotified } from "@/lib/notify/bus";
import { countUnread, getNotificationsSince } from "@/lib/notify/queries";

export const runtime = "nodejs";

// Server-Sent Events untuk bel notifikasi (semua role). Pola sama dengan /api/tickets/:id/stream.
//
//   GET /api/notifications/stream
//
// Event:
//   notification -> { item, unread }  notifikasi baru (atau yang diperbarui); `unread` = jumlah belum dibaca terkini
//   gone         -> akun dinonaktifkan di tengah koneksi; koneksi ditutup
//   (komentar ": ping" tiap 15 dtk menjaga koneksi tidak diputus proxy)
//
// Stream hanya mengirim yang terjadi SETELAH tersambung. Klien mengambil daftar awal lewat GET /api/notifications
// setiap kali koneksi (re)open, jadi tidak ada celah di antara keduanya.

const POLL_MS = 5000; // cadangan bila pemicu in-process tidak sampai (mis. multi-instance)
const PING_MS = 15000;
const REAUTH_MS = 60_000;

export async function GET(req: Request) {
  const guard = await authorizeApi();
  if (!guard.ok) return guard.response;
  const { user } = guard;

  let cursor = new Date();
  const sent = new Set<string>(); // "id@createdAt": notifikasi yang diperbarui (createdAt baru) tetap terkirim ulang
  const encoder = new TextEncoder();

  let closed = false;
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const send = (event: string, data: unknown) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      let running = false;
      let again = false;
      let lastAuth = Date.now();

      const tick = async () => {
        if (closed) return;
        if (running) {
          again = true;
          return;
        }
        running = true;
        try {
          do {
            again = false;

            if (Date.now() - lastAuth > REAUTH_MS) {
              lastAuth = Date.now();
              if (!(await getCurrentUser())) {
                send("gone", {});
                close();
                return;
              }
            }

            const items = (await getNotificationsSince(user.id, cursor)).filter((n) => !sent.has(`${n.id}@${n.createdAt}`));
            if (items.length > 0) {
              const unread = await countUnread(user.id);
              for (const item of items) {
                sent.add(`${item.id}@${item.createdAt}`);
                send("notification", { item, unread });
                const at = new Date(item.createdAt);
                if (at > cursor) cursor = at;
              }
              if (sent.size > 300) {
                const keep = [...sent].slice(-100);
                sent.clear();
                keep.forEach((k) => sent.add(k));
              }
            }
          } while (again && !closed);
        } catch (e) {
          console.error("[notify-stream]", e);
        } finally {
          running = false;
        }
      };

      const offBus = onUserNotified(user.id, () => void tick());
      const poll = setInterval(() => void tick(), POLL_MS);
      const ping = setInterval(() => write(": ping\n\n"), PING_MS);
      const onAbort = () => close();
      req.signal.addEventListener("abort", onAbort);

      function close() {
        if (closed) return;
        closed = true;
        clearInterval(poll);
        clearInterval(ping);
        offBus();
        req.signal.removeEventListener("abort", onAbort);
        try {
          controller.close();
        } catch {
          /* sudah tertutup */
        }
      }
      cleanup = close;

      write("retry: 3000\n\n");
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
