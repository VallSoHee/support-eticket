import { LogoutButton } from "@/components/auth/LogoutButton";
import type { CurrentUser } from "@/lib/auth/guards";
import { ROLE_LABEL } from "@/lib/roles";

// Placeholder halaman utama tiap role — diganti dashboard asli di modul selanjutnya.
export function RolePlaceholder({ user, title }: { user: CurrentUser; title: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <div className="rounded-3xl border border-line bg-white p-8 text-ink shadow-sm">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-brand">{ROLE_LABEL[user.role]}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-3 text-muted">
          Signed in as <span className="font-semibold text-ink">{user.name}</span> ({user.email}).
        </p>
        <p className="mt-1 text-sm text-muted">Placeholder — fitur modul ini dibuat di langkah berikutnya.</p>
        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
