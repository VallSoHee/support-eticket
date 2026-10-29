"use client";

import { useEffect, useId, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import {
  DEFAULT_HSV,
  PRESETS,
  applyColor,
  hexToHsv,
  hsvToHex,
  isHex,
  readStoredColor,
  type Hsv,
} from "@/lib/theme";

const WHEEL = 200; // px
const MIN_V = 0.35; // batas terendah kecerahan supaya warna tidak hampir hitam

const wheelBg =
  "radial-gradient(circle closest-side, #fff 0%, rgba(255,255,255,0) 100%), " +
  "conic-gradient(" +
  [0, 60, 120, 180, 240, 300, 360].map((h) => `hsl(${h} 100% 50%)`).join(", ") +
  ")";

/**
 * Banner profil yang bisa diklik: membuka color wheel.
 * Memilih warna langsung mengubah warna tema seluruh aplikasi (variabel CSS --color-brand).
 */
export function BannerThemePicker() {
  const [open, setOpen] = useState(false);
  // Panel baru dirender setelah klik (client-only), jadi nilai awal dari cookie aman dari mismatch hidrasi.
  const [hsv, setHsv] = useState<Hsv>(() =>
    typeof window === "undefined" ? DEFAULT_HSV : (readStoredColor() ?? DEFAULT_HSV),
  );
  const [draft, setDraft] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const panelId = useId();

  const hex = hsvToHex(hsv);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (next: Hsv) => {
    setHsv(next);
    applyColor(next);
  };

  const fromPointer = (e: RPointerEvent) => {
    const el = wheelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    let h = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0° di atas, searah jarum jam
    if (h < 0) h += 360;
    choose({ h, s: Math.min(1, Math.hypot(dx, dy) / (r.width / 2)), v: hsv.v });
    setDraft(null);
  };

  const rad = (hsv.h * Math.PI) / 180;
  const thumbX = WHEEL / 2 + Math.sin(rad) * hsv.s * (WHEEL / 2);
  const thumbY = WHEEL / 2 - Math.cos(rad) * hsv.s * (WHEEL / 2);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Change theme color"
        className="group relative block h-24 w-full cursor-pointer bg-gradient-to-br from-brand to-brand-dark outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white/60"
      >
        <span className="absolute bottom-3 right-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur transition group-hover:bg-white/30">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-3.9-4-7.2-9-7.2z" />
            <circle cx="7.5" cy="11" r="1" />
            <circle cx="10.5" cy="7" r="1" />
            <circle cx="15.5" cy="7.5" r="1" />
          </svg>
          Theme color
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Theme color"
          className="auth-fade-up absolute right-4 top-[72px] z-30 w-[256px] rounded-2xl border border-line bg-white p-4 shadow-[0_24px_60px_-20px_rgba(28,33,48,0.35)]"
        >
          <p className="text-[14px] font-extrabold tracking-tight text-ink">Theme color</p>
          <p className="mt-0.5 text-[12px] text-muted">Pick a color to change the whole app. It stays as your default on this browser.</p>

          {/* Color wheel: sudut = hue, jarak dari tengah = saturasi */}
          <div className="mt-4 flex justify-center">
            <div
              ref={wheelRef}
              role="presentation"
              onPointerDown={(e) => {
                dragging.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                fromPointer(e);
              }}
              onPointerMove={(e) => dragging.current && fromPointer(e)}
              onPointerUp={() => (dragging.current = false)}
              onPointerCancel={() => (dragging.current = false)}
              className="relative cursor-crosshair touch-none select-none rounded-full shadow-[inset_0_0_0_1px_rgba(28,33,48,0.08)]"
              style={{ width: WHEEL, height: WHEEL, background: wheelBg }}
            >
              {/* gelapkan roda sesuai kecerahan */}
              <div className="pointer-events-none absolute inset-0 rounded-full bg-black" style={{ opacity: 1 - hsv.v }} />
              <span
                className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
                style={{ left: thumbX, top: thumbY, background: hex }}
              />
            </div>
          </div>

          <label className="mt-4 block text-[12px] font-semibold text-ink">
            Brightness
            <input
              type="range"
              min={MIN_V * 100}
              max={100}
              step={1}
              value={Math.round(hsv.v * 100)}
              onChange={(e) => choose({ ...hsv, v: Number(e.target.value) / 100 })}
              className="theme-hue mt-2 w-full"
              style={{ background: `linear-gradient(to right, ${hsvToHex({ ...hsv, v: MIN_V })}, ${hsvToHex({ ...hsv, v: 1 })})` }}
            />
          </label>

          <div className="mt-4 flex items-center gap-2">
            <span className="h-8 w-8 shrink-0 rounded-full border border-line" style={{ background: hex }} aria-hidden />
            <input
              value={draft ?? hex.toUpperCase()}
              onChange={(e) => {
                setDraft(e.target.value);
                if (isHex(e.target.value)) choose(hexToHsv(e.target.value));
              }}
              onBlur={() => setDraft(null)}
              spellCheck={false}
              maxLength={7}
              aria-label="Hex color"
              className="h-8 w-full rounded-lg border border-line bg-field px-3 font-mono text-[12px] uppercase text-ink outline-none focus:border-brand/60"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                title={p.name}
                aria-label={p.name}
                aria-pressed={hex.toLowerCase() === p.hex}
                onClick={() => {
                  setDraft(null);
                  choose(hexToHsv(p.hex));
                }}
                className="h-6 w-6 rounded-full ring-offset-2 transition hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-ink/60"
                style={{ background: p.hex }}
              />
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
