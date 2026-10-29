import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { isRoleInScope } from "@/lib/admin/scope";
import { UserForm } from "@/components/admin/UserForm";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user || !isRoleInScope("CLIENT", user.role)) notFound();
  return <UserForm scope="CLIENT" mode="edit" user={user} />;
}
