import { logoutAction } from "@/lib/auth/actions";

// Server Action lewat <form>: tetap jalan tanpa JS di browser (FR-1.6).
export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="rounded-full border border-line bg-white px-5 py-2 text-[14px] font-semibold text-ink transition hover:border-brand hover:text-brand"
      >
        Log out
      </button>
    </form>
  );
}
