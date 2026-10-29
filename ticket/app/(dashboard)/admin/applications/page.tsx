import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { deleteApplicationAction } from "@/lib/admin/application-actions";
import { PLATFORM_LABEL, parsePlatforms } from "@/lib/admin/constants";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { SearchBox } from "@/components/admin/SearchBox";
import { Badge, EmptyRow, Flash, PageHeader, TableShell, Th, primaryBtn, smallBtn } from "@/components/admin/ui";

const ERRORS: Record<string, string> = { "delete-failed": "Could not delete this application." };
const SUCCESS: Record<string, string> = { created: "Application created.", updated: "Application updated.", deleted: "Application deleted." };

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; success?: string }>;
}) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  const apps = await prisma.application.findMany({
    where: q ? { nama: { contains: q } } : {},
    orderBy: { nama: "asc" },
    include: { _count: { select: { tickets: true } } },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Applications"
        description={`${apps.length} application${apps.length === 1 ? "" : "s"}${q ? ` matching "${q}"` : ""}. Clients choose from this list when submitting a ticket.`}
        action={
          <>
            <SearchBox placeholder="Search applications..." />
            <Link href="/admin/applications/new" className={primaryBtn}>
              + Add
            </Link>
          </>
        }
      />
      <Flash error={sp.error ? (ERRORS[sp.error] ?? "Something went wrong.") : null} success={sp.success ? SUCCESS[sp.success] : null} />

      <TableShell minWidth={640}>
        <thead>
          <tr className="border-b border-line">
            <Th>Name</Th>
            <Th>Platforms</Th>
            <Th>Tickets</Th>
            <Th right>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {apps.length === 0 && <EmptyRow colSpan={4}>{q ? `No results for "${q}".` : "No applications yet. Add the first one."}</EmptyRow>}
          {apps.map((a) => (
            <tr key={a.id} className="border-b border-line last:border-0 hover:bg-field/60">
              <td className="px-5 py-4 font-semibold text-ink">
                <Link href={`/admin/applications/${a.id}/edit`} className="hover:text-brand">
                  {a.nama}
                </Link>
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-1.5">
                  {parsePlatforms(a.platforms).map((p) => (
                    <Badge key={p} className="bg-field text-ink">
                      {PLATFORM_LABEL[p]}
                    </Badge>
                  ))}
                </div>
              </td>
              <td className="px-5 py-4 text-muted">{a._count.tickets}</td>
              <td className="px-5 py-4">
                <div className="flex items-center justify-end gap-2">
                  <Link href={`/admin/applications/${a.id}/edit`} className={smallBtn}>
                    Edit
                  </Link>
                  <DeleteButton
                    action={deleteApplicationAction.bind(null, a.id)}
                    message={`Delete "${a.nama}"? ${a._count.tickets ? `Its ${a._count.tickets} existing ticket(s) keep the application name. ` : ""}This cannot be undone.`}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}
