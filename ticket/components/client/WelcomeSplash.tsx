// Isi layar merah saat transisi login -> dashboard (semua role). Dipakai DUA kali dengan tampilan identik:
//  1. overlay "keluar" di halaman login (components/auth/LoginTransition.tsx)
//  2. tirai "masuk" di dashboard (ClientShell / ArrivalCurtain untuk Admin & Petugas)
// Karena sama persis (warna, posisi, teks), pergantian halaman di antaranya tidak terlihat.
export function WelcomeSplash({ name, returning = true }: { name?: string; returning?: boolean }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 text-white">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-brand shadow-[0_18px_40px_-14px_rgba(0,0,0,0.35)]">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 15l6-6 6 6" />
        </svg>
      </span>
      <p className="px-6 text-center text-[22px] font-extrabold tracking-tight">
        {name ? `${returning ? "Welcome back" : "Welcome"}, ${name}` : "Signing you in"}
      </p>
    </div>
  );
}
