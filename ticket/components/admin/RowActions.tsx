"use client";

import { deleteUserAction, toggleActiveAction } from "@/lib/admin/actions";
import type { UserScope } from "@/lib/admin/scope";

export function RowActions({
  scope,
  id,
  active,
  isSelf,
}: {
  scope: UserScope;
  id: string;
  active: boolean;
  isSelf: boolean;
}) {
  if (isSelf) {
    return <span className="text-[12px] italic text-muted">This is you</span>;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <form action={toggleActiveAction.bind(null, scope, id)}>
        <button
          type="submit"
          className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:border-brand hover:text-brand"
        >
          {active ? "Deactivate" : "Activate"}
        </button>
      </form>
      <form
        action={deleteUserAction.bind(null, scope, id)}
        onSubmit={(e) => {
          if (!confirm("Delete this account? This cannot be undone.")) e.preventDefault();
        }}
      >
        <button
          type="submit"
          className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-brand-dark transition hover:border-brand hover:bg-brand-soft/60"
        >
          Delete
        </button>
      </form>
    </div>
  );
}
