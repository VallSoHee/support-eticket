import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { deleteShiftAction } from "@/lib/admin/shift-actions";
import { PAGE_SIZE, SHIFT_LABEL, SHIFT_TYPES } from "@/lib/admin/constants";
import { fmtDbDate, fromDbTime, toDbDate } from "@/lib/admin/time";
import type { Prisma } from "@/generated/prisma/client";
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
  ghostBtn,
  parsePage,
  primaryBtn,
  smallBtn,
} from "@/components/admin/ui";

type SP = { petugasId?: string; shiftType?: string; from?: string; to?: string; page?: string; success?: string; count?: string; skipped?: string };

const isDate = (v?: string): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

function successMessage(sp: SP) {
  if (sp.success === "created") return "Shift created.";
  if (sp.success === "updated") return "Shift updated.";
  if (sp.success === "deleted") return "Shift deleted.";
  if (sp.success === "generated") {
    const n = Number(sp.count ?? 0);
    const s = Number(sp.skipped ?? 0);
    return `${n} shift${n === 1 ? "" : "s"} created${s ? `, ${s} skipped because the petugas already had a shift that day` : ""}.`;
  }
  return null;
}

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const page = parsePage(sp.page);

  const where: Prisma.ShiftWhereInput = {
    ...(sp.petugasId ? { petugasId: sp.petugasId } : {}),
    ...(sp.shiftType && (SHIFT_TYPES as readonly string[]).includes(sp.shiftType) ? { shiftType: sp.shiftType as (typeof SHIFT_TYPES)[number] } : {}),
    ...(isDate(sp.from) || isDate(sp.to)
      ? {
          tanggalBerlaku: {
            ...(isDate(sp.from) ? { gte: toDbDate(sp.from) } : {}),
            ...(isDate(sp.to) ? { lte: toDbDate(sp.to) } : {}),
          },
        }
      : {}),
  };

  const [petugas, total, shifts] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["PETUGAS_L1", "PETUGAS_L2"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true, isActive: true },
    }),
    prisma.shift.count({ where }),
    prisma.shift.findMany({
      where,
      orderBy: [{ tanggalBerlaku: "desc" }, { jamMulai: "asc" }],
      include: { petugas: { select: { name: true, role: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const schedulable = petugas.filter((p) => p.isActive);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Shift schedule"
        description="Petugas can only go online during their scheduled shift."
        action={
          schedulable.length > 0 ? (
            <>
              <Link href="/admin/shifts/generate" className={ghostBtn}>
                Generate
              </Link>
              <Link href="/admin/shifts/new" className={primaryBtn}>
                + Add
              </Link>
            </>
          ) : undefined
        }
      />
      <Flash success={successMessage(sp)} />

      {schedulable.length === 0 && (
        <div className="rounded-3xl border border-line bg-white p-8 text-center text-[14px] text-muted shadow-sm">
          There are no active petugas to schedule.{" "}
          <Link href="/admin/petugas/new" className="font-semibold text-brand">
            Add a petugas
          </Link>{" "}
          first.
        </div>
      )}

      <FilterBar resetHref="/admin/shifts">
        <FilterSelect
          label="Petugas"
          name="petugasId"
          value={sp.petugasId}
          options={petugas.map((p) => ({ value: p.id, label: `${p.name} (${p.role === "PETUGAS_L1" ? "L1" : "L2"})` }))}
        />
        <FilterSelect label="Shift" name="shiftType" value={sp.shiftType} options={SHIFT_TYPES.map((s) => ({ value: s, label: SHIFT_LABEL[s] }))} />
        <FilterInput label="From" name="from" type="date" value={sp.from} />
        <FilterInput label="To" name="to" type="date" value={sp.to} />
      </FilterBar>

      <TableShell minWidth={680}>
        <thead>
          <tr className="border-b border-line">
            <Th>Date</Th>
            <Th>Petugas</Th>
            <Th>Level</Th>
            <Th>Shift</Th>
            <Th>Hours</Th>
            <Th right>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {shifts.length === 0 && <EmptyRow colSpan={6}>No shifts match.</EmptyRow>}
          {shifts.map((s) => (
            <tr key={s.id} className="border-b border-line last:border-0 hover:bg-field/60">
              <td className="px-5 py-4 font-semibold text-ink">{fmtDbDate(s.tanggalBerlaku)}</td>
              <td className="px-5 py-4 text-ink">{s.petugas.name}</td>
              <td className="px-5 py-4 text-muted">{s.petugas.role === "PETUGAS_L1" ? "L1" : "L2"}</td>
              <td className="px-5 py-4">
                <Badge className="bg-field text-ink">{SHIFT_LABEL[s.shiftType]}</Badge>
              </td>
              <td className="px-5 py-4 text-muted">
                {fromDbTime(s.jamMulai)} – {fromDbTime(s.jamSelesai)}
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center justify-end gap-2">
                  <Link href={`/admin/shifts/${s.id}/edit`} className={smallBtn}>
                    Edit
                  </Link>
                  <DeleteButton action={deleteShiftAction.bind(null, s.id)} message="Delete this shift?" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        basePath="/admin/shifts"
        params={{ petugasId: sp.petugasId, shiftType: sp.shiftType, from: sp.from, to: sp.to }}
      />
    </div>
  );
}
