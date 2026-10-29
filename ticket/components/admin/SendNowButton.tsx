"use client";

import { useFormStatus } from "react-dom";

function Inner({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send now"}
    </button>
  );
}

// Kirim pengumuman tersimpan SEKARANG. Konfirmasi dulu (tidak bisa ditarik kembali) dan menyebut jumlah penerimanya.
export function SendNowButton({ action, title, count }: { action: () => Promise<void>; title: string; count: number }) {
  return (
    <form
      action={action}
      title={count === 0 ? "No active users match this audience." : undefined}
      onSubmit={(e) => {
        if (!confirm(`Send "${title}" now to ${count} user${count === 1 ? "" : "s"}? This can't be undone.`)) e.preventDefault();
      }}
    >
      <Inner disabled={count === 0} />
    </form>
  );
}
