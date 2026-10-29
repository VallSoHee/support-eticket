"use client";

import { useState, type ReactNode } from "react";

// Tata letak detail tiket Petugas.
//  - Layar >= xl (1280px) : chat di kiri, panel info di kanan, berdampingan (masing-masing scroll sendiri).
//  - Di bawah itu: satu kolom dengan tombol tab "Chat" / "Details" supaya chat memenuhi layar HP
//                  dan info tiket tidak perlu di-scroll melewati seluruh percakapan.
// Kedua panel selalu dirender (hanya disembunyikan lewat CSS) sehingga stream chat & draft tidak hilang saat pindah tab.
export function WorkspaceLayout({ chat, side }: { chat: ReactNode; side: ReactNode }) {
  const [tab, setTab] = useState<"chat" | "details">("chat");

  const tabBtn = (id: "chat" | "details", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={`flex-1 rounded-full px-4 py-2 text-[13px] font-semibold transition ${
        tab === id ? "bg-brand text-white shadow-sm" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <div role="tablist" aria-label="Ticket sections" className="flex gap-1 rounded-full border border-line bg-white p-1 shadow-sm xl:hidden">
        {tabBtn("chat", "Chat")}
        {tabBtn("details", "Details")}
      </div>

      <div className="grid items-start gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-stretch xl:gap-6">
        <div className={`min-w-0 xl:block xl:min-h-0 ${tab === "chat" ? "block" : "hidden"}`}>{chat}</div>
        <div
          className={`min-w-0 space-y-6 xl:block xl:min-h-0 xl:overflow-y-auto xl:pr-1 ${tab === "details" ? "block" : "hidden"}`}
        >
          {side}
        </div>
      </div>
    </>
  );
}
