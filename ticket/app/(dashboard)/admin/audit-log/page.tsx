import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { AUDIT_ACTION_LABEL, PAGE_SIZE } from "@/lib/admin/constants";
import type { Prisma } from "@/generated/prisma/client";
import { EmptyRow, FilterBar, FilterInput, FilterSelect, PageHeader, Pagination, TableShell, Th, dateFmt, parsePage } from "@/components/admin/ui";

type SP = { action?: string; actorId?: string; q?: string; from?: string; to?: string; page?: string };
const isDate = (v?: string): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

// FR-8.2 — halaman ini SENGAJA hanya menampilkan: tidak ada tombol/aksi edit atau hapus,
// dan tidak ada server action untuk mengubah audit_logs di seluruh aplikasi.
export default async function AuditLogPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const q = sp.q?.trim();

  const where: Prisma.AuditLogWhereInput = {
    ...(sp.action ? { action: sp.action } : {}),
    ...(sp.actorId ? { actorId: sp.actorId } : {}),
    ...(q ? { OR: [{ description: { contains: q } }, { entityId: { contains: q } }] } : {}),
    ...(isDate(sp.from) || isDate(sp.to)
      ? {
          createdAt: {
            ...(isDate(sp.from) ? { gte: new Date(`${sp.from}T00:00:00+07:00`) } : {}),
            ...(isDate(sp.to) ? { lte: new Date(`${sp.to}T23:59:59.999+07:00`) } : {}),
          },
        }
      : {}),
  };

  const [actors, total, logs] = await Promise.all([
    prisma.user.findMany({
      where: { auditLogs: { some: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { name: true, role: true } } },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <PageHeader title="Audit log" description="A read-only record of important actions: sign-ins, ticket changes, escalations and account changes." />

      <FilterBar resetHref="/admin/audit-log">
        <FilterInput label="Search" name="q" value={q} placeholder="Description or entity ID" />
        <FilterSelect
          label="Action"
          name="action"
          value={sp.action}
          options={Object.entries(AUDIT_ACTION_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect label="Actor" name="actorId" value={sp.actorId} options={actors.map((a) => ({ value: a.id, label: a.name }))} />
        <FilterInput label="From" name="from" type="date" value={sp.from} />
        <FilterInput label="To" name="to" type="date" value={sp.to} />
      </FilterBar>

      <TableShell minWidth={820}>
        <thead>
          <tr className="border-b border-line">
            <Th>Time</Th>
            <Th>Actor</Th>
            <Th>Action</Th>
            <Th>Details</Th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 && <EmptyRow colSpan={4}>No audit entries match.</EmptyRow>}
          {logs.map((l) => (
            <tr key={l.id} className="border-b border-line align-top last:border-0 hover:bg-field/60">
              <td className="whitespace-nowrap px-5 py-4 text-muted">{dateFmt(l.createdAt, true)}</td>
              <td className="px-5 py-4 font-semibold text-ink">
                {l.actor?.name ?? l.actorName ?? "Unknown"}
                {!l.actor && <span className="block text-[11px] font-medium text-muted">Account deleted</span>}
              </td>
              <td className="whitespace-nowrap px-5 py-4 text-ink">{AUDIT_ACTION_LABEL[l.action] ?? l.action}</td>
              <td className="max-w-[420px] px-5 py-4 text-muted">
                <p>{l.description ?? "—"}</p>
                <p className="mt-1 text-[11px] text-muted/80">
                  {l.entityType} · {l.entityId}
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
      <Pagination page={page} totalPages={totalPages} total={total} basePath="/admin/audit-log" params={{ ...sp }} />
    </div>
  );
}
