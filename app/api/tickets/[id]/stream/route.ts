import { authorizeApi } from "@/lib/auth/guards";
import { onMessageDeleted, onTicketChange } from "@/lib/chat/events";
import { getMessagesSince, getTicketStatus, resolveChatViewer } from "@/lib/chat/queries";

export const runtime = "nodejs";

// Server-Sent Events untuk chat realtime satu tiket (dipakai Client DAN Petugas).
//
//   GET /api/tickets/:id/stream?after=<ISO createdAt pesan terakhir>&status=<status yang sedang tampil>
//
// Event:
//   chat     -> satu pesan baru (JSON LiveMessage)
//   deleted  -> pesan dihapus untuk semua (JSON {id})
//   status   -> status tiket berubah (JSON {status}); UI me-refresh data halaman
//   (komentar ": ping" tiap 15 dtk menjaga koneksi tidak diputus proxy)
//
// Kenapa SSE, bukan WebSocket: Next.js App Router tidak punya server WebSocket bawaan, dan chat
// ini cuma butuh server -> browser (kirim pesan tetap lewat Server Action). SSE jalan di `next start`
// biasa tanpa custom server, dan EventSource menyambung ulang sendiri.

const POLL_MS = 3000; // cadangan bila pemicu in-process tidak sampai (mis. multi-instance)
const PING_MS = 15000;
const REAUTH_MS = 60_000; // cek ulang akses: akun dinonaktifkan / tiket dipindah di tengah koneksi

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authorizeApi("CLIENT", "PETUGAS_L1", "PETUGAS_L2");
  if (!guard.ok) return guard.response;
  const { user } = guard;
  const { id: ticketId } = await params;

  const viewer = await resolveChatViewer(user, ticketId);
  if (!viewer) return Response.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const afterParam = url.searchParams.get("after");
  let cursor = afterParam && !Number.isNaN(Date.parse(afterParam)) ? new Date(afterParam) : new Date();
  let knownStatus = url.searchParams.get("status");

  const encoder = new TextEncoder();
  const sent = new Set<string>(); // id pesan yang sudah dikirim di koneksi ini (kursor inklusif -> dedupe)

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

      // Satu putaran pemeriksaan. Jika dipicu lagi saat masih berjalan, ulangi sekali setelahnya
      // (bukan menumpuk), supaya pesan tidak terlewat dan urutan tetap terjaga.
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
              const stillAllowed = await resolveChatViewer(user, ticketId);
              if (!stillAllowed) {
                send("gone", {});
                close();
                return;
              }
            }

            const messages = await getMessagesSince(ticketId, viewer, cursor);
            for (const m of messages) {
              if (sent.has(m.id)) continue;
              sent.add(m.id);
              send("chat", m);
              const at = new Date(m.createdAt);
              if (at > cursor) cursor = at;
            }
            // Jaga memori: kursor sudah maju, id lama tidak akan muncul lagi.
            if (sent.size > 500) {
              const keep = [...sent].slice(-200);
              sent.clear();
              keep.forEach((k) => sent.add(k));
            }

            const status = await getTicketStatus(ticketId);
            if (status && status !== knownStatus) {
              // knownStatus null = klien tidak mengirim status awal; jangan berisik di sambungan pertama.
              if (knownStatus !== null) send("status", { status });
              knownStatus = status;
            }
          } while (again && !closed);
        } catch (e) {
          console.error("[chat-stream]", e);
        } finally {
          running = false;
        }
      };

      const offBus = onTicketChange(ticketId, () => void tick());
      const offDeleted = onMessageDeleted(ticketId, (id) => send("deleted", { id }));
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
        offDeleted();
        req.signal.removeEventListener("abort", onAbort);
        try {
          controller.close();
        } catch {
          /* sudah tertutup */
        }
      }
      cleanup = close;

      // retry: jeda sambung ulang bawaan browser; lalu langsung kejar pesan yang terlewat.
      write("retry: 2000\n\n");
      void tick();
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
      "X-Accel-Buffering": "no", // matikan buffering di Nginx
    },
  });
}
