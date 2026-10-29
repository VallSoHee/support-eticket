import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { parsePlatforms } from "@/lib/admin/constants";
import { ApplicationForm } from "@/components/admin/ApplicationForm";

export default async function EditApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;
  const app = await prisma.application.findUnique({ where: { id } });
  if (!app) notFound();
  return <ApplicationForm mode="edit" application={{ id: app.id, nama: app.nama, platforms: parsePlatforms(app.platforms) }} />;
}
