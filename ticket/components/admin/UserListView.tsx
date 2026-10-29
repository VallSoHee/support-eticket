import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SCOPE_BASE_PATH, SCOPE_LABEL, SCOPE_ROLES, type UserScope } from "@/lib/admin/scope";
import { ROLE_LABEL } from "@/lib/roles";
import { RowActions } from "@/components/admin/RowActions";
import { SearchBox } from "@/components/admin/SearchBox";

export async function UserListView({
  scope,
  currentUserId,
  searchParams,
}: {
  scope: UserScope;
  currentUserId: string;
  searchParams: { q?: string; error?: string; success?: string };
}) {
  const q = searchParams.q?.trim() ?? "";
  const roles = SCOPE_ROLES[scope];
  const basePath = SCOPE_BASE_PATH[scope];
  const showLevelColumn = roles.length > 1;
  // FR-2.4 — admin bisa melihat petugas mana yang sedang online.
  const showPresence = scope === "PETUGAS";
  const colCount = 5 + (showLevelColumn ? 1 : 0) + (showPresence ? 1 : 0);

  const users = await prisma.user.findMany({
    where: {
      role: { in: [...roles] },
      ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink">{SCOPE_LABEL[scope]} accounts</h2>
          <p className="text-[13px] text-muted">
            {users.length} account{users.length === 1 ? "" : "s"}
            {q ? ` matching "${q}"` : ""}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SearchBox placeholder={`Search ${SCOPE_LABEL[scope].toLowerCase()}...`} />
          <Link
            href={`${basePath}/new`}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-brand px-5 text-[14px] font-semibold text-white shadow-[0_14px_30px_-10px_color-mix(in_srgb,var(--color-brand)_75%,transparent)] transition hover:bg-brand-dark"
          >
            + Add
          </Link>
        </div>
      </div>

      {searchParams.error && (
        <div
          role="alert"
          className="rounded-2xl border border-brand/20 bg-brand-soft/70 px-4 py-3 text-[13px] font-medium text-brand-dark"
        >
          {searchParams.error === "has-tickets"
            ? "This client still has tickets, so the account can't be deleted. Deactivate it instead."
            : searchParams.error === "delete-failed"
              ? "Could not delete this account. Please try again."
              : "Something went wrong."}
        </div>
      )}
      {searchParams.success === "deleted" && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-700"
        >
          Account deleted.
        </div>
      )}

      <div className="overflow-x-auto rounded-3xl border border-line bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
              <th className="px-5 py-3.5 font-semibold">Name</th>
              <th className="px-5 py-3.5 font-semibold">Email</th>
              {showLevelColumn && <th className="px-5 py-3.5 font-semibold">Level</th>}
              <th className="px-5 py-3.5 font-semibold">Status</th>
              {showPresence && <th className="px-5 py-3.5 font-semibold">Presence</th>}
              <th className="px-5 py-3.5 font-semibold">Joined</th>
              <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-5 py-10 text-center text-muted">
                  {q ? `No results for "${q}".` : "No accounts yet."}
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0 hover:bg-field/60">
                <td className="px-5 py-4 font-semibold text-ink">
                  <Link href={`${basePath}/${u.id}/edit`} className="hover:text-brand">
                    {u.name}
                  </Link>
                </td>
                <td className="px-5 py-4 text-muted">{u.email}</td>
                {showLevelColumn && <td className="px-5 py-4 text-muted">{ROLE_LABEL[u.role]}</td>}
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-field text-muted"
                    }`}
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                {showPresence && (
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${
                        u.isActive && u.isOnline ? "text-emerald-700" : "text-muted"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${u.isActive && u.isOnline ? "bg-emerald-500" : "bg-line"}`} />
                      {u.isActive && u.isOnline ? "Online" : "Offline"}
                    </span>
                  </td>
                )}
                <td className="px-5 py-4 text-muted">
                  {u.createdAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
                <td className="px-5 py-4">
                  <RowActions scope={scope} id={u.id} active={u.isActive} isSelf={u.id === currentUserId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
