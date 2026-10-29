"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type AuthView = "login" | "forgot";

// Durasi (ms). Tinggi kartu berubah paling lama; isi lama memudar cepat, isi baru menyusul.
const HEIGHT_MS = 560;
const OUT_MS = 240;
const IN_MS = 380;
const IN_DELAY = 200;
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

type Size = { inner: number; face: number };

/**
 * Kartu auth: sisi depan berisi Login / Forgot password, sisi belakang berisi Register.
 *
 * Login <-> Forgot password TIDAK memutar kartu. Yang terjadi:
 *  1. tinggi kartu dianimasikan dari tinggi lama ke tinggi baru (kolom input "berkurang"),
 *  2. isi lama memudar sambil naik + blur, isi baru muncul dari bawah,
 *  3. arah sebaliknya (Back to Sign In) memakai animasi yang persis sama.
 * Login <-> Register tetap flip 3D lewat CSS (globals.css).
 */
export function FlipCard({
  view,
  flipped,
  surface,
  login,
  forgot,
  register,
}: {
  view: AuthView;
  flipped: boolean;
  surface: string;
  login: ReactNode;
  forgot: ReactNode;
  register: ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const layers = useRef<Record<AuthView, HTMLDivElement | null>>({ login: null, forgot: null });
  const size = useRef<Size | null>(null); // tinggi terakhir yang terlihat (sebelum React commit)
  const prev = useRef<AuthView>(view);
  const anims = useRef<Animation[]>([]);
  const runId = useRef(0);
  // Form forgot di-remount setelah disembunyikan, supaya pesan sukses/error lama tidak ikut kembali.
  const [forgotKey, setForgotKey] = useState(0);

  const reset = () => {
    anims.current.forEach((a) => a.cancel());
    anims.current = [];
    layers.current.login?.classList.remove("swap-leaving");
    layers.current.forgot?.classList.remove("swap-leaving");
    if (faceRef.current) faceRef.current.style.overflow = "";
  };

  // Catat tinggi kartu setiap berubah. Efek layout di bawah membaca nilai ini SEBELUM
  // perubahan view diukur, jadi ia selalu berisi tinggi "sebelum".
  useEffect(() => {
    const inner = innerRef.current;
    const face = faceRef.current;
    if (!inner || !face) return;
    const read = () => {
      size.current = { inner: inner.offsetHeight, face: face.offsetHeight };
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(inner);
    ro.observe(face);
    return () => ro.disconnect();
  }, []);

  // Layout effect: jalan sebelum paint, jadi tidak ada frame di mana kartu sudah melompat ke tinggi baru.
  useLayoutEffect(() => {
    if (prev.current === view) return;
    const from = prev.current;
    prev.current = view;

    const inner = innerRef.current;
    const face = faceRef.current;
    const outEl = layers.current[from];
    const inEl = layers.current[view];
    if (!inner || !face || !outEl || !inEl) return;

    const id = ++runId.current;
    const before = size.current;
    reset(); // hentikan animasi yang masih berjalan (klik cepat) agar tinggi alami bisa diukur

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (from === "forgot") setForgotKey((k) => k + 1);
      return;
    }

    // Tinggi tujuan = tinggi alami setelah commit (sisi lama sudah display:none).
    const after: Size = { inner: inner.offsetHeight, face: face.offsetHeight };
    const start = before ?? after;

    // Sisi lama dikeluarkan dari alur layout (absolute) tapi tetap terlihat selama memudar.
    outEl.classList.add("swap-leaving");
    face.style.overflow = "hidden"; // isi lama yang lebih tinggi tidak boleh keluar dari kartu yang mengecil

    if (start.inner !== after.inner || start.face !== after.face) {
      const opts: KeyframeAnimationOptions = { duration: HEIGHT_MS, easing: EASE_OUT };
      anims.current.push(
        inner.animate([{ height: `${start.inner}px` }, { height: `${after.inner}px` }], opts),
        face.animate([{ height: `${start.face}px` }, { height: `${after.face}px` }], opts),
      );
    }

    anims.current.push(
      outEl.animate(
        [
          { opacity: 1, transform: "translateY(0)", filter: "blur(0px)" },
          { opacity: 0, transform: "translateY(-12px)", filter: "blur(5px)" },
        ],
        { duration: OUT_MS, easing: "ease-in", fill: "forwards" },
      ),
      inEl.animate(
        [
          { opacity: 0, transform: "translateY(14px)", filter: "blur(5px)" },
          { opacity: 1, transform: "translateY(0)", filter: "blur(0px)" },
        ],
        { duration: IN_MS, delay: IN_DELAY, easing: EASE_OUT, fill: "backwards" },
      ),
    );

    Promise.all(anims.current.map((a) => a.finished))
      .then(() => {
        if (id !== runId.current) return; // sudah digantikan animasi yang lebih baru
        reset();
        if (from === "forgot") setForgotKey((k) => k + 1);
        // Link yang barusan diklik ikut nonaktif (inert) -> fokus pindah ke field pertama sisi baru.
        // Hanya di perangkat dengan mouse, supaya keyboard layar HP tidak muncul sendiri.
        if (window.matchMedia("(pointer: fine)").matches && document.activeElement === document.body) {
          inEl.querySelector<HTMLElement>("input:not([type=hidden])")?.focus({ preventScroll: true });
        }
      })
      .catch(() => {}); // animasi dibatalkan oleh klik berikutnya
  }, [view]);

  useEffect(() => {
    return () => {
      runId.current++;
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flip-scene">
      <div ref={innerRef} className="flip-inner" data-flipped={flipped}>
        {/* `inert` menonaktifkan fokus/klik/screen-reader di sisi yang sedang membelakangi */}
        <div ref={faceRef} className={`flip-face ${surface}`} inert={flipped} aria-hidden={flipped}>
          <div className="swap-stack">
            <div
              ref={(el) => {
                layers.current.login = el;
              }}
              className="swap-layer"
              data-active={view === "login"}
              inert={view !== "login"}
              aria-hidden={view !== "login"}
            >
              {login}
            </div>
            <div
              ref={(el) => {
                layers.current.forgot = el;
              }}
              className="swap-layer"
              data-active={view === "forgot"}
              inert={view !== "forgot"}
              aria-hidden={view !== "forgot"}
            >
              <Fragment key={forgotKey}>{forgot}</Fragment>
            </div>
          </div>
        </div>

        {/* Saat Forgot password, sisi belakang dilepas dari layout supaya kartu bisa lebih pendek dari Register. */}
        <div
          className={`flip-face flip-back ${surface} ${view === "forgot" ? "hidden" : ""}`}
          inert={!flipped}
          aria-hidden={!flipped}
        >
          {register}
        </div>
      </div>
    </div>
  );
}
