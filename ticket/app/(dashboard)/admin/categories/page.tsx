import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { deleteCategoryAction } from "@/lib/admin/category-actions";
import { PRIORITY_BADGE, PRIORITY_LABEL } from "@/lib/admin/constants";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { SearchBox } from "@/components/admin/SearchBox";
import { Badge, EmptyRow, Flash, PageHeader, TableShell, Th, primaryBtn, smallBtn } from "@/components/admin/ui";

const ERRORS: Record<string, string> = {
  "in-use": "This category is used by existing tickets, so it can't be deleted. Rename it instead.",
  "delete-failed": "Could not delete this category.",
};
const SUCCESS: Record<string, string> = { created: "Category created.", updated: "Category updated.", deleted: "Category deleted." };

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; success?: string }>;
}) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  const categories = await prisma.category.findMany({
    where: q ? { nama: { contains: q } } : {},
    orderBy: { nama: "asc" },
    include: { _count: { select: { tickets: true, faqEntries: true } } },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ticket categories"
        description={`${categories.length} categor${categories.length === 1 ? "y" : "ies"}${q ? ` matching "${q}"` : ""}. Each category sets the default priority of new tickets.`}
        action={
          <>
            <SearchBox placeholder="Search categories..." />
            <Link href="/admin/categories/new" className={primaryBtn}>
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
            <Th>Default priority</Th>
            <Th>FAQ entries</Th>
            <Th>Tickets</Th>
            <Th right>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {categories.length === 0 && <EmptyRow colSpan={5}>{q ? `No results for "${q}".` : "No categories yet. Add the first one."}</EmptyRow>}
          {categories.map((c) => (
            <tr key={c.id} className="border-b border-line last:border-0 hover:bg-field/60">
              <td className="px-5 py-4 font-semibold text-ink">
                <Link href={`/admin/categories/${c.id}/edit`} className="hover:text-brand">
                  {c.nama}
                </Link>
              </td>
              <td className="px-5 py-4">
                <Badge className={PRIORITY_BADGE[c.defaultPriority]}>{PRIORITY_LABEL[c.defaultPriority]}</Badge>
              </td>
              <td className="px-5 py-4 text-muted">
                <Link href={`/admin/faq?categoryId=${c.id}`} className="hover:text-brand">
                  {c._count.faqEntries}
                </Link>
              </td>
              <td className="px-5 py-4 text-muted">{c._count.tickets}</td>
              <td className="px-5 py-4">
                <div className="flex items-center justify-end gap-2">
                  <Link href={`/admin/categories/${c.id}/edit`} className={smallBtn}>
                    Edit
                  </Link>
                  {c._count.tickets === 0 && (
                    <DeleteButton
                      action={deleteCategoryAction.bind(null, c.id)}
                      message={`Delete "${c.nama}"${c._count.faqEntries ? ` and its ${c._count.faqEntries} FAQ entries` : ""}? This cannot be undone.`}
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}
