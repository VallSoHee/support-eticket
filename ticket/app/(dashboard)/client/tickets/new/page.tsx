import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parsePlatforms } from "@/lib/admin/constants";
import { requireRole } from "@/lib/auth/guards";
import { TicketForm } from "@/components/client/TicketForm";

export default async function NewClientTicketPage() {
  await requireRole("CLIENT");
  const apps = await prisma.application.findMany({ orderBy: { nama: "asc" } });
  const applications = apps.map((a) => ({ id: a.id, nama: a.nama, platforms: parsePlatforms(a.platforms) }));

  return (
    // Lebar mengikuti kontainer ClientShell (sama dengan navbar), jadi form dua kolom lapang dan sejajar.
    <div className="space-y-6">
      <Link href="/client/tickets" className="text-[13px] font-semibold text-muted transition hover:text-brand">
        ← My tickets
      </Link>
      <TicketForm applications={applications} />
    </div>
  );
}
