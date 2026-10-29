import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { authorizeApi } from "@/lib/auth/guards";
import { maxBytesFor, uploadTypeOf } from "@/lib/client/upload-types";
import { uploadDir } from "@/lib/client/upload-storage";
import { UPLOAD_URL_PREFIX } from "@/lib/client/sanitize";

// Unggahan dari editor deskripsi tiket (gambar & file). Hanya client yang sedang login.
export async function POST(req: Request) {
  const guard = await authorizeApi("CLIENT");
  if (!guard.ok) return guard.response;

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "No file received." }, { status: 400 });

  const type = uploadTypeOf(file.name);
  if (!type) {
    return Response.json(
      { error: "This file type is not allowed. Use images, videos (MP4, WEBM, MOV), PDF, Office documents, TXT, CSV, LOG or ZIP." },
      { status: 415 },
    );
  }
  const maxBytes = maxBytesFor(type);
  if (file.size > maxBytes) {
    return Response.json({ error: `File is too large (max ${maxBytes / 1024 / 1024} MB).` }, { status: 413 });
  }

  // Nama di disk acak: nama asli dari user tidak pernah dipakai sebagai path.
  const storedName = `${randomUUID()}${type.ext}`;
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storedName), Buffer.from(await file.arrayBuffer()));

  const row = await prisma.ticketAttachment.create({
    data: {
      storedName,
      originalName: path.basename(file.name).slice(0, 255),
      mimeType: type.mime,
      size: file.size,
      uploaderId: guard.user.id,
    },
    select: { id: true, originalName: true, size: true },
  });

  return Response.json({ id: row.id, url: `${UPLOAD_URL_PREFIX}${row.id}`, name: row.originalName, size: row.size, isImage: type.image, isVideo: type.video ?? false });
}
