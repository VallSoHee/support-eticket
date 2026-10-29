"use client";

import { useEffect, useState } from "react";
import { ghostBtn, primaryBtn } from "@/components/admin/ui";

export type ForwardTarget = { id: "public" | "internal"; label: string; hint: string; visibleToClient: boolean };

// Dialog "Teruskan pesan": pilih kanal tujuan. Pesan disalin sebagai pesan baru atas nama petugas.
export function ForwardDialog(props: {
  open: boolean;
  count: number;
  targets: ForwardTarget[];
  defaultTarget: ForwardTarget["id"];
  pending: boolean;
  error: string | null;
  onConfirm: (target: ForwardTarget["id"]) => void;
  onClose: () => void;
}) {
  // Isi dialog dipasang ulang tiap dibuka, jadi pilihan tujuan selalu mulai dari bawaan.
  return props.open ? <ForwardDialogBody {...props} /> : null;
}

function ForwardDialogBody({
  count,
  targets,
  defaultTarget,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  count: number;
  targets: ForwardTarget[];
  defaultTarget: ForwardTarget["id"];
  pending: boolean;
  error: string | null;
  onConfirm: (target: ForwardTarget["id"]) => void;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<ForwardTarget["id"]>(defaultTarget);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !pending && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pending, onClose]);

  const chosen = targets.find((t) => t.id === target) ?? targets[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="presentation">
      <button aria-label="Close dialog" className="absolute inset-0 bg-ink/40" onClick={() => !pending && onClose()} tabIndex={-1} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="forward-title"
        className="relative w-full max-w-md rounded-3xl border border-line bg-white p-6 shadow-[0_30px_60px_-20px_rgba(30,35,60,0.45)] md:p-7"
      >
        <h2 id="forward-title" className="text-xl font-extrabold tracking-tight text-ink">
          Forward {count} {count === 1 ? "message" : "messages"}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          The {count === 1 ? "message is" : "messages are"} sent again as new {count === 1 ? "message" : "messages"} under your name, in the
          original order.
        </p>

        <div role="radiogroup" aria-label="Forward to" className="mt-5 space-y-2">
          {targets.map((t) => {
            const active = t.id === chosen?.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTarget(t.id)}
                className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  active ? "border-brand bg-brand/5 ring-2 ring-brand/15" : "border-line hover:bg-field"
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-brand" : "border-line"}`}
                >
                  {active && <span className="h-2 w-2 rounded-full bg-brand" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-ink">{t.label}</span>
                  <span className="block text-[12px] text-muted">{t.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        {chosen?.visibleToClient && (
          <p className="mt-3 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-[12px] font-medium leading-relaxed text-amber-900">
            The client will see {count === 1 ? "this message" : "these messages"}. Check that nothing internal is included.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-[12px] font-medium text-brand-dark">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={pending} className={ghostBtn}>
            Cancel
          </button>
          <button type="button" onClick={() => chosen && onConfirm(chosen.id)} disabled={pending || !chosen} className={primaryBtn}>
            {pending ? "Forwarding…" : "Forward"}
          </button>
        </div>
      </div>
    </div>
  );
}
