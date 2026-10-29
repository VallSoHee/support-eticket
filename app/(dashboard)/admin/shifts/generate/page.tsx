import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { ShiftGenerateForm } from "@/components/admin/ShiftForm";

export default async function GenerateShiftsPage() {
  await requireRole("ADMIN");
  const petugas = await prisma.user.findMany({
    where: { role: { in: ["PETUGAS_L1", "PETUGAS_L2"] }, isActive: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, role: true },
  });
  if (petugas.length === 0) redirect("/admin/shifts");
  return <ShiftGenerateForm petugas={petugas as { id: string; name: string; role: "PETUGAS_L1" | "PETUGAS_L2" }[]} />;
}
