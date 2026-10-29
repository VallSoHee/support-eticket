import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { FaqForm } from "@/components/admin/FaqForm";

export default async function EditFaqPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;
  const [faq, categories] = await Promise.all([
    prisma.faqEntry.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
  ]);
  if (!faq) notFound();
  return <FaqForm mode="edit" categories={categories} faq={faq} />;
}
