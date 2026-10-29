"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AVATAR_ACCEPT, AVATAR_MAX_BYTES, avatarSrc } from "@/lib/avatar";

const PICK_MAX_BYTES = 15 * 1024 * 1024; // batas file mentah yang boleh dipilih (akan diperkecil)
const SIZE = 512;

/** Potong persegi dari tengah, perkecil ke 512px, simpan JPEG -> ringan & rasio selalu 1:1. */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#fff"; // PNG transparan -> latar putih
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bmp.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/jpeg", 0.9),
  );
}

const camera = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

export function AvatarUploader({
  userId,
  name,
  avatarName,
  initials,
}: {
  userId: string;
  name: string;
  avatarName: string | null;
  initials: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Bebaskan object URL saat preview diganti / komponen dilepas.
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview.url)), [preview]);

  const shown = preview?.url ?? (avatarName ? avatarSrc(userId, avatarName) : null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // boleh memilih file yang sama lagi
    if (!file) return;
    setError(null);
    if (!AVATAR_ACCEPT.split(",").includes(file.type)) return setError("Use a JPG, PNG or WebP image.");
    if (file.size > PICK_MAX_BYTES) return setError("That image is too large (max 15 MB).");
    try {
      const blob = await toSquareJpeg(file);
      if (blob.size > AVATAR_MAX_BYTES) return setError("Image is still too large, try a smaller one.");
      setPreview({ url: URL.createObjectURL(blob), blob });
    } catch {
      setError("We couldn't read that image. Try another one.");
    }
  }

  async function save() {
    if (!preview) return;
    setBusy("save");
    setError(null);
    try {
      const body = new FormData();
      body.set("file", new File([preview.blob], "avatar.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/avatar", { method: "POST", body });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Upload failed.");
      setPreview(null);
      router.refresh(); // header + kartu profil membaca foto baru
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    setError(null);
    try {
      const res = await fetch("/api/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Couldn't remove the photo. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="-mt-10">
      <div className="relative h-20 w-20">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy !== null}
          aria-label={shown ? "Change profile photo" : "Upload profile photo"}
          className={`group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 bg-brand-soft text-[26px] font-extrabold text-brand shadow-sm transition duration-300 ${
            preview ? "border-brand" : "border-white"
          }`}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={shown} src={shown} alt={`${name}'s photo`} className="h-full w-full animate-[avatar-in_0.35s_ease] object-cover" />
          ) : (
            initials
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-ink/45 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
            {camera}
          </span>
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/70">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            </span>
          )}
        </button>
        <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-brand text-white shadow">
          {camera}
        </span>
        <input ref={input} type="file" accept={AVATAR_ACCEPT} onChange={onPick} className="sr-only" tabIndex={-1} />
      </div>

      <div className="mt-3 text-[12px]">
        {preview ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy !== null}
              className="rounded-full bg-brand px-3.5 py-1.5 font-semibold text-white shadow-[0_8px_18px_-8px_color-mix(in_srgb,var(--color-brand)_70%,transparent)] transition hover:bg-brand-dark active:scale-95 disabled:opacity-70"
            >
              {busy === "save" ? "Saving…" : "Save photo"}
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              disabled={busy !== null}
              className="rounded-full border border-line px-3.5 py-1.5 font-semibold text-ink transition hover:border-brand hover:text-brand active:scale-95"
            >
              Discard
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy !== null}
              className="font-semibold text-brand transition hover:text-brand-dark"
            >
              {avatarName ? "Change photo" : "Upload photo"}
            </button>
            {avatarName && (
              <button
                type="button"
                onClick={remove}
                disabled={busy !== null}
                className="font-semibold text-muted transition hover:text-brand-dark"
              >
                {busy === "remove" ? "Removing…" : "Remove"}
              </button>
            )}
          </div>
        )}
        <p className="mt-1.5 text-muted">JPG, PNG or WebP. We crop it to a square.</p>
        {error && (
          <p role="alert" className="mt-1.5 font-medium text-brand-dark">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
