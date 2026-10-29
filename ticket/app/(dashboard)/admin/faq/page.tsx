import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { deleteFaqAction } from "@/lib/admin/faq-actions";
import { PAGE_SIZE } from "@/lib/admin/constants";
import { DeleteButton } from "@/components/admin/DeleteButton";
import {
  Badge,
  EmptyRow,
  FilterBar,
  FilterInput,
  FilterSelect,
  Flash,
  PageHeader,
  Pagination,
  TableShell,
  Th,
  parsePage,
  primaryBtn,
  smallBtn,
} from "@/components/admin/ui";

const SUCCESS: Record<string, string> = { created: "FAQ created.", updated: "FAQ updated.", deleted: "FAQ deleted." };

export default async function FaqPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoryId?: string; page?: string; success?: string }>;
}) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = parsePage(sp.page);

  const where = {
    ...(sp.categoryId ? { categoryId: sp.categoryId } : {}),
    ...(q ? { OR: [{ keywords: { contains: q } }, { jawaban: { contains: q } }] } : {}),
  };

  const [categories, total, faqs] = await Promise.all([
    prisma.category.findMany({ orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
    prisma.faqEntry.count({ where }),
    prisma.faqEntry.findMany({
      where,
      orderBy: [{ category: { nama: "asc" } }, { id: "asc" }],
      include: { category: { select: { nama: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bot FAQ"
        description="Keyword-based answers the chatbot uses before a ticket is escalated to a petugas."
        action={
          categories.length > 0 ? (
            <Link href={`/admin/faq/new${sp.categoryId ? `?categoryId=${sp.categoryId}` : ""}`} className={primaryBtn}>
              + Add
            </Link>
          ) : undefined
        }
      />
      <Flash success={sp.success ? SUCCESS[sp.success] : null} />

      {categories.length === 0 ? (
        <div className="rounded-3xl border border-line bg-white p-8 text-center text-[14px] text-muted shadow-sm">
          Create a{" "}
          <Link href="/admin/categories/new" className="font-semibold text-brand">
            ticket category
          </Link>{" "}
          first — every FAQ entry belongs to one.
        </div>
      ) : (
        <>
          <FilterBar resetHref="/admin/faq">
            <FilterInput label="Search" name="q" value={q} placeholder="Keyword or answer text" />
            <FilterSelect label="Category" name="categoryId" value={sp.categoryId} options={categories.map((c) => ({ value: c.id, label: c.nama }))} />
          </FilterBar>

          <TableShell minWidth={720}>
            <thead>
              <tr className="border-b border-line">
                <Th>Category</Th>
                <Th>Keywords</Th>
                <Th>Answer</Th>
                <Th right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {faqs.length === 0 && <EmptyRow colSpan={4}>No FAQ entries match.</EmptyRow>}
              {faqs.map((f) => (
                <tr key={f.id} className="border-b border-line align-top last:border-0 hover:bg-field/60">
                  <td className="px-5 py-4 font-semibold text-ink">{f.category.nama}</td>
                  <td className="max-w-[260px] px-5 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {f.keywords
                        .split(",")
                        .map((k) => k.trim())
                        .filter(Boolean)
                        .map((k) => (
                          <Badge key={k} className="bg-field text-ink">
                            {k}
                          </Badge>
                        ))}
                    </div>
                  </td>
                  <td className="max-w-[360px] px-5 py-4 text-muted">
                    <p className="line-clamp-3 whitespace-pre-line">{f.jawaban}</p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/faq/${f.id}/edit`} className={smallBtn}>
                        Edit
                      </Link>
                      <DeleteButton action={deleteFaqAction.bind(null, f.id)} message="Delete this FAQ entry? This cannot be undone." />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
          <Pagination page={page} totalPages={totalPages} total={total} basePath="/admin/faq" params={{ q, categoryId: sp.categoryId }} />
        </>
      )}
    </div>
  );
}
