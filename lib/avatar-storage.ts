import path from "node:path";
import { uploadDir } from "@/lib/client/upload-storage";

/** Foto profil disimpan di subfolder `avatars` dari UPLOAD_DIR, di luar /public. */
export const avatarDir = () => path.join(uploadDir(), "avatars");

export const AVATAR_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * Tentukan tipe gambar dari ISI file (magic bytes), bukan dari nama/Content-Type kiriman
 * browser yang bisa dipalsukan. Hanya JPEG, PNG, WebP; selain itu null.
 */
export function sniffImageExt(buf: Buffer): ".jpg" | ".png" | ".webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ".jpg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return ".webp";
  return null;
}
