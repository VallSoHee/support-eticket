"use client";

import { smallDangerBtn } from "@/components/admin/ui";

// Tombol hapus generik: konfirmasi dulu di browser, lalu jalankan server action
// (yang sudah di-bind ke id-nya) lewat <form>.
export function DeleteButton({
  action,
  message = "Delete this item? This cannot be undone.",
  label = "Delete",
}: {
  action: () => Promise<void>;
  message?: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <button type="submit" className={smallDangerBtn}>
        {label}
      </button>
    </form>
  );
}
