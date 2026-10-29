import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { FaqForm } from "@/components/admin/FaqForm";

export default async function NewFaqPage({ searchParams }: { searchParams: Promise<{ categoryId?: string }> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const categories = await prisma.category.findMany({ orderBy: { nama: "asc" }, select: { id: true, nama: true } });
  if (categories.length === 0) redirect("/admin/faq");
  return <FaqForm mode="create" categories={categories} defaultCategoryId={sp.categoryId} />;
}
