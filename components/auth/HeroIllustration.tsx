// Ilustrasi sisi kiri halaman auth (phone mockup + kartu melayang) — murni dekoratif.
export function HeroIllustration() {
  return (
    <div aria-hidden className="relative mx-auto h-[590px] w-[560px] max-w-full select-none">
      {/* Phone */}
      <div className="absolute left-[115px] top-0 h-[590px] w-[310px] rounded-[46px] border-[6px] border-[#272c3d] bg-[#0f1219] shadow-[0_30px_60px_-20px_rgba(15,18,25,0.6)]">
        <div className="absolute left-1/2 top-3 flex h-[22px] w-[112px] -translate-x-1/2 items-center gap-2 rounded-full bg-black px-3">
          <span className="h-2 w-2 rounded-full bg-[#2b3142]" />
          <span className="h-[3px] w-10 rounded-full bg-[#2b3142]" />
        </div>

        <div className="px-5 pt-[68px]">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3b1420] text-[10px] font-bold text-brand">
              CS
            </span>
            <div className="leading-tight">
              <p className="text-[12px] font-semibold text-white">Live Support Queue</p>
              <p className="mt-0.5 text-[10px] font-medium text-emerald-400">Avg reply: &lt; 1m</p>
            </div>
            <span className="ml-auto rounded-md bg-white/10 px-2 py-0.5 text-[9px] font-semibold tracking-wider text-white/60">
              #LIVE
            </span>
          </div>
          <div className="mt-4 h-px bg-white/10" />
          <div className="mt-[190px] space-y-3">
            <div className="h-1.5 w-[70%] rounded-full bg-white/10" />
            <div className="h-1.5 w-[55%] rounded-full bg-white/10" />
          </div>
        </div>

        <div className="absolute inset-x-4 bottom-4 flex h-11 items-center gap-2 rounded-2xl bg-[#1a1f2b] px-3 text-[11px]">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="font-medium text-white/80">Ticket Desk Bot</span>
          <span className="ml-auto font-bold text-brand">Active</span>
        </div>
      </div>

      {/* Kartu tiket baru */}
      <div className="absolute left-[236px] top-20 w-[320px] rounded-[26px] bg-brand p-5 text-white shadow-[0_28px_50px_-18px_color-mix(in_srgb,var(--color-brand)_70%,transparent)]">
        <div className="flex items-center justify-between">
          <span className="rounded-lg bg-white/20 px-2.5 py-1 text-[10px] font-bold tracking-wider">NEW TICKET #8492</span>
          <span className="text-[10px] text-white/80">Just now</span>
        </div>
        <p className="mt-3.5 text-[14px] font-bold leading-snug">
          &ldquo;Urgent: Integration webhook requires SSL certificate revalidation.&rdquo;
        </p>
        <div className="mt-3 flex items-center gap-2 border-t border-white/25 pt-3 text-[11px] text-white/90">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          Priority: High Customer Impact
        </div>
      </div>

      {/* Kartu SLA */}
      <div className="absolute left-0 top-[253px] flex w-[288px] items-center gap-3 rounded-[26px] bg-white/95 p-4 shadow-[0_24px_50px_-20px_rgba(30,35,60,0.35)] ring-1 ring-black/5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 12l3-3" />
          </svg>
        </span>
        <div className="leading-tight">
          <p className="text-[13px] font-bold text-ink">Response SLA: &lt; 1 min</p>
          <p className="mt-1 text-[11px] text-muted">Resolution rate at 99.4%</p>
        </div>
      </div>

      {/* Chip gateway */}
      <div className="absolute left-[268px] top-[460px] flex w-[256px] items-center gap-3 rounded-full bg-white/80 py-3 pl-5 pr-4 shadow-[0_20px_40px_-18px_rgba(30,35,60,0.35)] ring-1 ring-white backdrop-blur">
        <span className="h-2.5 w-2.5 rounded-full bg-brand" />
        <p className="text-[12px] font-bold leading-tight text-ink">
          Chat
          <br />
          Gateway
        </p>
        <span className="ml-auto rounded-lg bg-emerald-50 px-2.5 py-1 font-mono text-[10px] font-medium text-emerald-600">
          Synchronized
        </span>
      </div>
    </div>
  );
}
