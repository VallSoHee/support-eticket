import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { fromDbDate, fromDbTime } from "@/lib/admin/time";
import { ShiftForm } from "@/components/admin/ShiftForm";

export default async function EditShiftPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;
  const [shift, petugas] = await Promise.all([
    prisma.shift.findUnique({ where: { id } }),
    prisma.user.findMany({
      // Petugas yang dinonaktifkan tetap muncul kalau memang pemilik shift ini.
      where: { role: { in: ["PETUGAS_L1", "PETUGAS_L2"] }, OR: [{ isActive: true }, { shifts: { some: { id } } }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);
  if (!shift) notFound();

  return (
    <ShiftForm
      mode="edit"
      petugas={petugas as { id: string; name: string; role: "PETUGAS_L1" | "PETUGAS_L2" }[]}
      shift={{
        id: shift.id,
        petugasId: shift.petugasId,
        shiftType: shift.shiftType,
        tanggalBerlaku: fromDbDate(shift.tanggalBerlaku),
        jamMulai: fromDbTime(shift.jamMulai),
        jamSelesai: fromDbTime(shift.jamSelesai),
      }}
    />
  );
}
