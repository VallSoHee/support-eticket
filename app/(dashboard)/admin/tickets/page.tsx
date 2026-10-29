import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { PAGE_SIZE, PRIORITIES, PRIORITY_BADGE, PRIORITY_LABEL, STATUS_BADGE, STATUS_LABEL, TICKET_STATUSES } from "@/lib/admin/constants";
import { buildTicketWhere } from "@/lib/admin/metrics";
import {
  Badge,
  EmptyRow,
  FilterBar,
  FilterInput,
  FilterSelect,
  PageHeader,
  Pagination,
  TableShell,
  Th,
  dateFmt,
  parsePage,
} from "@/components/admin/ui";

type SP = { q?: string; status?: string; priority?: string; categoryId?: string; level?: string; from?: string; to?: string; page?: string };

// FR-3.7 — Admin melihat & memfilter semua tiket lintas status/level.
export default async function AdminTicketsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const where = buildTicketWhere(sp);

  const [categories, total, tickets] = await Promise.all([
    prisma.category.findMany({ orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: { select: { name: true } },
        category: { select: { nama: true } },
        assignedL1: { select: { name: true } },
        assignedL2: { select: { name: true } },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <PageHeader title="All tickets" description="Every ticket across statuses and support levels. Open a ticket to see its timeline or adjust its priority." />

      <FilterBar resetHref="/admin/tickets">
        <FilterInput label="Search" name="q" value={sp.q} placeholder="Title, client name or email" />
        <FilterSelect label="Status" name="status" value={sp.status} options={TICKET_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
        <FilterSelect label="Priority" name="priority" value={sp.priority} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
        <FilterSelect label="Category" name="categoryId" value={sp.categoryId} options={categories.map((c) => ({ value: c.id, label: c.nama }))} />
        <FilterSelect
          label="Handled by"
          name="level"
          value={sp.level}
          options={[
            { value: "L1", label: "Level 1" },
            { value: "L2", label: "Level 2" },
          ]}
        />
        <FilterInput label="From" name="from" type="date" value={sp.from} />
        <FilterInput label="To" name="to" type="date" value={sp.to} />
      </FilterBar>

      <TableShell minWidth={900}>
        <thead>
          <tr className="border-b border-line">
            <Th>Ticket</Th>
            <Th>Client</Th>
            <Th>Category</Th>
            <Th>Priority</Th>
            <Th>Status</Th>
            <Th>L1 / L2</Th>
            <Th>Created</Th>
          </tr>
        </thead>
        <tbody>
          {tickets.length === 0 && <EmptyRow colSpan={7}>No tickets match these filters.</EmptyRow>}
          {tickets.map((t) => (
            <tr key={t.id} className="border-b border-line last:border-0 hover:bg-field/60">
              <td className="max-w-[280px] px-5 py-4">
                <Link href={`/admin/tickets/${t.id}`} className="line-clamp-2 font-semibold text-ink hover:text-brand">
                  {t.judul}
                </Link>
              </td>
              <td className="px-5 py-4 text-muted">{t.client.name}</td>
              <td className="px-5 py-4 text-muted">{t.category.nama}</td>
              <td className="px-5 py-4">
                <Badge className={PRIORITY_BADGE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
              </td>
              <td className="px-5 py-4">
                <Badge className={STATUS_BADGE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
              </td>
              <td className="px-5 py-4 text-muted">
                {t.assignedL1?.name ?? "—"}
                {t.assignedL2 && <span className="block text-[12px]">{t.assignedL2.name}</span>}
              </td>
              <td className="whitespace-nowrap px-5 py-4 text-muted">{dateFmt(t.createdAt, true)}</td>
            </tr>
          ))}
        </tbody>
      </TableShell>
      <Pagination page={page} totalPages={totalPages} total={total} basePath="/admin/tickets" params={{ ...sp }} />
    </div>
  );
}
