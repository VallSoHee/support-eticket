import type { ReactNode } from "react";

/**
 * Kartu ukuran sedang untuk hiasan animasi di halaman profil.
 * Tanpa `children` -> memakai animasi CSS bawaan di bawah (cincin berdenyut + orbit + partikel).
 * Isi `children` untuk mengganti dengan animasi sendiri (Lottie, video, canvas, dsb.); kartu hanya
 * menyediakan wadah (tinggi tetap, sudut membulat, overflow disembunyikan) dan bersifat dekoratif.
 */
export function ProfileAnimation({ children }: { children?: ReactNode }) {
  return (
    <div
      aria-hidden
      className="profile-anim relative mt-6 h-56 overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-brand-soft/70 via-white to-white md:h-64"
    >
      {children ?? <DefaultScene />}
    </div>
  );
}

const PARTICLES = [
  { left: "12%", size: 6, delay: 0, dur: 6 },
  { left: "26%", size: 4, delay: 2.2, dur: 7 },
  { left: "40%", size: 8, delay: 1.1, dur: 8 },
  { left: "58%", size: 5, delay: 3.4, dur: 6.5 },
  { left: "72%", size: 7, delay: 0.7, dur: 7.5 },
  { left: "86%", size: 4, delay: 2.9, dur: 6 },
];

function DefaultScene() {
  return (
    <>
      {/* Partikel naik pelan dari bawah */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="absolute bottom-0 rounded-full bg-brand/40"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animation: `profile-rise ${p.dur}s ease-in infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {/* Cincin berdenyut keluar dari tengah */}
      <div className="absolute inset-0 grid place-items-center">
        {[0, 1.2, 2.4].map((d) => (
          <span
            key={d}
            className="col-start-1 row-start-1 h-24 w-24 rounded-full border border-brand/35"
            style={{ animation: "profile-ring 3.6s ease-out infinite", animationDelay: `${d}s` }}
          />
        ))}
      </div>

      {/* Titik yang mengorbit */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative h-40 w-40 animate-[profile-orbit_14s_linear_infinite]">
          <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-brand" />
          <span className="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-brand/60" />
          <span className="absolute bottom-3 right-3 h-1.5 w-1.5 rounded-full bg-brand-dark/50" />
        </div>
      </div>

      {/* Ikon tiket di tengah, melayang pelan */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="animate-[profile-float_4s_ease-in-out_infinite]">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-[0_18px_36px_-12px_color-mix(in_srgb,var(--color-brand)_80%,transparent)]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9a2 2 0 0 0 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a2 2 0 0 1 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z" />
              <path d="M13 5v2M13 11v2M13 17v2" />
            </svg>
          </span>
        </div>
      </div>
    </>
  );
}
