"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type BurnView = "login" | "forgot";

/* ------------------------------------------------------------------------------------------
   Efek "terbakar" = filter SVG (noise + threshold) yang dianimasikan lewat requestAnimationFrame.

   progress p:  0 = utuh,  1 = habis terbakar.
   Noise fraktal dipakai sebagai peta: piksel dengan nilai noise di bawah ambang `t` hilang.
   `t` naik dari p=0 ke p=1, jadi lubang-lubang membesar secara acak seperti kertas terbakar.
   Tepi lubang dibagi tiga pita (dari dalam ke luar): konten normal -> arang gelap -> bara oranye.

   Animasi masuk = p turun dari 1 ke 0 (pola noise yang sama, arah dibalik) -> "reverse".
------------------------------------------------------------------------------------------- */

const SLOPE = 24; // makin besar = tepi makin tajam
const BAND = 0.22; // lebar pita arang + bara (ruang noise 0..1)
const T_MIN = -(BAND + 0.05); // p=0: semua piksel lolos ambang
const T_MAX = 1.05; // p=1: tidak ada piksel yang lolos

const OUT_MS = 950; // durasi terbakar habis
const IN_MS = 950; // durasi muncul kembali (reverse)
const IN_DELAY = 480; // sisi baru mulai muncul saat sisi lama separuh terbakar

const FILTER_ID: Record<BurnView, string> = { login: "burn-fx-login", forgot: "burn-fx-forgot" };

type Anim = { p: number; raf: number };

const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

function setProgress(id: string, p: number) {
  const t = T_MIN + p * (T_MAX - T_MIN);
  const set = (part: string, threshold: number) =>
    document.getElementById(`${id}-${part}`)?.setAttribute("intercept", String(-SLOPE * threshold));
  set("ember", t);
  set("char", t + BAND * 0.4);
  set("body", t + BAND);
}

/** Animasikan `a.p` menuju `to`. Filter hanya dipasang selama animasi (teks tetap tajam saat diam). */
function run(el: HTMLElement, id: string, a: Anim, to: number, ms: number, delay: number, onDone?: () => void) {
  cancelAnimationFrame(a.raf);
  const from = a.p;

  const finish = () => {
    a.p = to;
    el.style.filter = "";
    el.style.visibility = ""; // selanjutnya diatur CSS lewat data-active
    onDone?.();
  };
  if (from === to) return finish();

  el.style.visibility = "visible"; // sisi yang sedang keluar masih harus terlihat
  el.style.filter = `url(#${id})`;
  setProgress(id, from);

  const duration = ms * Math.abs(to - from);
  const start = performance.now() + delay;
  const tick = (now: number) => {
    const k = Math.min(1, Math.max(0, (now - start) / duration));
    a.p = from + (to - from) * ease(k);
    setProgress(id, a.p);
    if (k < 1) a.raf = requestAnimationFrame(tick);
    else finish();
  };
  a.raf = requestAnimationFrame(tick);
}

function BurnFilter({ id }: { id: string }) {
  const fn = (part: string) => (
    <feComponentTransfer in="noise" result={part}>
      <feFuncA id={`${id}-${part}`} type="linear" slope={SLOPE} intercept={0} />
    </feComponentTransfer>
  );
  return (
    <filter id={id} x="-4%" y="-4%" width="108%" height="108%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.016 0.022" numOctaves={3} seed={11} result="raw" />
      {/* Ambil kanal R sebagai alpha & regangkan kontrasnya supaya noise mengisi rentang 0..1 */}
      <feColorMatrix in="raw" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.6 0 0 0 -0.8" result="noise" />

      {/* Tiga peta ambang: bara (paling longgar), arang, konten utuh (paling ketat) */}
      {fn("ember")}
      {fn("char")}
      {fn("body")}

      <feComposite in="SourceGraphic" in2="body" operator="in" result="bodyPart" />

      <feComposite in="char" in2="body" operator="out" result="charBand" />
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="0.22 0 0 0 0.03  0 0.17 0 0 0.015  0 0 0.15 0 0.01  0 0 0 1 0"
        result="charSrc"
      />
      <feComposite in="charSrc" in2="charBand" operator="in" result="charPart" />

      <feComposite in="ember" in2="char" operator="out" result="emberBand" />
      <feFlood floodColor="#ff7a1f" result="emberColor" />
      <feComposite in="emberColor" in2="emberBand" operator="in" result="emberRaw" />
      <feComposite in="emberRaw" in2="SourceAlpha" operator="in" result="emberPart" />
      <feGaussianBlur in="emberPart" stdDeviation="3" result="glow" />

      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="bodyPart" />
        <feMergeNode in="charPart" />
        <feMergeNode in="emberPart" />
      </feMerge>
    </filter>
  );
}

/**
 * Dua "sisi" (login & forgot password) ditumpuk di kartu yang sama. Saat `view` berganti,
 * sisi lama terbakar habis lalu sisi baru terbentuk kembali dari bara. Berpindah balik
 * (Back to Sign In) menjalankan urutan yang sama dengan arah dibalik.
 */
export function BurnSwap({ view, login, forgot }: { view: BurnView; login: ReactNode; forgot: ReactNode }) {
  const els = useRef<Record<BurnView, HTMLDivElement | null>>({ login: null, forgot: null });
  const anims = useRef<Record<BurnView, Anim>>({
    login: { p: view === "login" ? 0 : 1, raf: 0 },
    forgot: { p: view === "forgot" ? 0 : 1, raf: 0 },
  });
  const prev = useRef<BurnView>(view);
  // Form forgot di-remount setelah terbakar habis, supaya pesan sukses/error lama tidak ikut kembali.
  const [forgotKey, setForgotKey] = useState(0);

  // Layout effect: berjalan sebelum paint, jadi sisi lama tidak sempat berkedip hilang.
  useLayoutEffect(() => {
    if (prev.current === view) return;
    const from = prev.current;
    prev.current = view;

    const outEl = els.current[from];
    const inEl = els.current[view];
    if (!outEl || !inEl) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const v of ["login", "forgot"] as const) {
        cancelAnimationFrame(anims.current[v].raf);
        anims.current[v].p = v === view ? 0 : 1;
        const el = els.current[v];
        if (el) {
          el.style.filter = "";
          el.style.visibility = "";
        }
      }
      if (from === "forgot") setForgotKey((k) => k + 1);
      return;
    }

    run(outEl, FILTER_ID[from], anims.current[from], 1, OUT_MS, 0, () => {
      if (from === "forgot") setForgotKey((k) => k + 1);
    });
    run(inEl, FILTER_ID[view], anims.current[view], 0, IN_MS, IN_DELAY, () => {
      // Link yang barusan diklik ikut nonaktif (inert) -> fokus pindah ke field pertama sisi baru.
      // Hanya di perangkat dengan mouse, supaya keyboard layar HP tidak muncul sendiri.
      if (window.matchMedia("(pointer: fine)").matches && document.activeElement === document.body) {
        inEl.querySelector<HTMLElement>("input:not([type=hidden])")?.focus({ preventScroll: true });
      }
    });
  }, [view]);

  useEffect(() => {
    const a = anims.current;
    return () => {
      cancelAnimationFrame(a.login.raf);
      cancelAnimationFrame(a.forgot.raf);
    };
  }, []);

  return (
    <div className="burn-stack">
      {/* SVG harus punya ukuran (bukan display:none) agar filter-nya bisa dipakai Safari/Firefox */}
      <svg width="0" height="0" aria-hidden focusable="false" style={{ position: "absolute" }}>
        <defs>
          <BurnFilter id={FILTER_ID.login} />
          <BurnFilter id={FILTER_ID.forgot} />
        </defs>
      </svg>

      <div
        ref={(el) => {
          els.current.login = el;
        }}
        className="burn-layer"
        data-active={view === "login"}
        inert={view !== "login"}
        aria-hidden={view !== "login"}
      >
        {login}
      </div>

      <div
        ref={(el) => {
          els.current.forgot = el;
        }}
        className="burn-layer flex flex-col justify-center"
        data-active={view === "forgot"}
        inert={view !== "forgot"}
        aria-hidden={view !== "forgot"}
      >
        <Fragment key={forgotKey}>{forgot}</Fragment>
      </div>
    </div>
  );
}
