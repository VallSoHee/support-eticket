import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { ShiftForm } from "@/components/admin/ShiftForm";

export default async function NewShiftPage() {
  await requireRole("ADMIN");
  const petugas = await prisma.user.findMany({
    where: { role: { in: ["PETUGAS_L1", "PETUGAS_L2"] }, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });
  if (petugas.length === 0) redirect("/admin/shifts");
  return <ShiftForm mode="create" petugas={petugas as { id: string; name: string; role: "PETUGAS_L1" | "PETUGAS_L2" }[]} />;
}
