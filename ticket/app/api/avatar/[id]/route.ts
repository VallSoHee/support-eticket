import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import { authorizeApi } from "@/lib/auth/guards";
import { AVATAR_MIME, avatarDir } from "@/lib/avatar-storage";

const notFound = () => Response.json({ error: "Not found" }, { status: 404 });

// Menyajikan foto profil. Semua user yang sedang login boleh melihat (petugas perlu melihat
// foto client dan sebaliknya); yang belum login ditolak oleh authorizeApi.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authorizeApi();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const owner = await prisma.user.findUnique({ where: { id }, select: { avatarName: true } });
  if (!owner?.avatarName) return notFound();

  const name = path.basename(owner.avatarName);
  const mime = AVATAR_MIME[path.extname(name).toLowerCase()];
  if (!mime) return notFound();

  const filePath = path.join(avatarDir(), name);
  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return notFound();
  }

  return new Response(Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(size),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      // URL memuat ?v=<nama file>, jadi aman di-cache lama; berganti sendiri saat foto diganti.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
