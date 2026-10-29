"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function SearchBox({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  function update(q: string) {
    setValue(q);
    const params = new URLSearchParams(searchParams);
    if (q) params.set("q", q);
    else params.delete("q");
    params.delete("error");
    params.delete("success");
    startTransition(() => {
      router.replace(params.size ? `${pathname}?${params.toString()}` : pathname);
    });
  }

  return (
    <input
      type="search"
      value={value}
      onChange={(e) => update(e.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-full border border-line bg-field px-4 text-[13px] text-ink outline-none transition focus:border-brand/60 focus:bg-white focus:ring-4 focus:ring-brand/10 sm:w-56"
    />
  );
}
