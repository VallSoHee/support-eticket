import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import { authorizeApi } from "@/lib/auth/guards";
import { uploadTypeOf } from "@/lib/client/upload-types";
import { uploadDir } from "@/lib/client/upload-storage";

const notFound = () => Response.json({ error: "Not found" }, { status: 404 });

// Menyajikan lampiran tiket. Boleh diakses: pengunggahnya, pemilik tiket, dan semua staf
// (admin/L1/L2). Client lain mendapat 404 (sengaja tidak dibedakan dari "tidak ada").
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authorizeApi();
  if (!guard.ok) return guard.response;
  const { user } = guard;
  const { id } = await params;

  const att = await prisma.ticketAttachment.findUnique({
    where: { id },
    include: { ticket: { select: { clientId: true } } },
  });
  if (!att) return notFound();

  const allowed = user.role !== "CLIENT" || att.uploaderId === user.id || att.ticket?.clientId === user.id;
  if (!allowed) return notFound();

  const filePath = path.join(uploadDir(), path.basename(att.storedName));
  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return notFound();
  }

  const type = uploadTypeOf(att.storedName);
  // Gambar & video tampil inline (video butuh Range supaya bisa diputar/digeser); file lain selalu diunduh.
  const inline = (type?.image ?? false) || (type?.video ?? false);
  const asciiName = att.originalName.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const headers: Record<string, string> = {
    "Content-Type": att.mimeType,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(att.originalName)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=3600",
    "Accept-Ranges": "bytes",
  };

  const range = req.headers.get("range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    let start = m && m[1] !== "" ? Number(m[1]) : NaN;
    let end = m && m[2] !== "" ? Number(m[2]) : NaN;
    if (m && Number.isNaN(start) && !Number.isNaN(end)) {
      // "bytes=-N" = N byte terakhir
      start = Math.max(0, size - end);
      end = size - 1;
    } else if (m && !Number.isNaN(start) && Number.isNaN(end)) {
      end = size - 1;
    }
    if (!m || Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    end = Math.min(end, size - 1);
    const part = Readable.toWeb(createReadStream(filePath, { start, end })) as unknown as ReadableStream;
    return new Response(part, {
      status: 206,
      headers: { ...headers, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${size}` },
    });
  }

  const body = Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream;
  return new Response(body, { headers: { ...headers, "Content-Length": String(size) } });
}
