import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { authorizeApi } from "@/lib/auth/guards";
import { AVATAR_MAX_BYTES, avatarSrc } from "@/lib/avatar";
import { avatarDir, sniffImageExt } from "@/lib/avatar-storage";

const removeFile = (name: string | null | undefined) =>
  name ? unlink(path.join(avatarDir(), path.basename(name))).catch(() => {}) : Promise.resolve();

// Ganti foto profil milik SENDIRI (id selalu dari sesi, bukan dari request).
export async function POST(req: Request) {
  const guard = await authorizeApi();
  if (!guard.ok) return guard.response;
  const { user } = guard;

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "No file received." }, { status: 400 });
  if (file.size > AVATAR_MAX_BYTES) {
    return Response.json({ error: `Photo is too large (max ${AVATAR_MAX_BYTES / 1024 / 1024} MB).` }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniffImageExt(buf);
  if (!ext) return Response.json({ error: "Use a JPG, PNG or WebP image." }, { status: 415 });

  // Nama di disk acak: nama asli dari user tidak pernah dipakai sebagai path.
  const avatarName = `${randomUUID()}${ext}`;
  await mkdir(avatarDir(), { recursive: true });
  await writeFile(path.join(avatarDir(), avatarName), buf);

  const prev = await prisma.user.findUnique({ where: { id: user.id }, select: { avatarName: true } });
  await prisma.user.update({ where: { id: user.id }, data: { avatarName } });
  await removeFile(prev?.avatarName);

  return Response.json({ avatarName, url: avatarSrc(user.id, avatarName) });
}

// Hapus foto profil sendiri -> kembali memakai inisial.
export async function DELETE() {
  const guard = await authorizeApi();
  if (!guard.ok) return guard.response;
  const { user } = guard;

  const prev = await prisma.user.findUnique({ where: { id: user.id }, select: { avatarName: true } });
  await prisma.user.update({ where: { id: user.id }, data: { avatarName: null } });
  await removeFile(prev?.avatarName);

  return Response.json({ ok: true });
}
