import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { PRIORITIES } from "@/lib/admin/constants";
import { PageHeader } from "@/components/admin/ui";
import { SlaTable } from "@/components/admin/SlaTable";

export default async function SlaPage() {
  await requireRole("ADMIN");
  const configs = await prisma.slaConfig.findMany();
  const byPriority = new Map(configs.map((c) => [c.priority, c]));

  const rows = PRIORITIES.map((priority) => {
    const c = byPriority.get(priority);
    return { priority, current: c ? { targetResponMenit: c.targetResponMenit, targetSelesaiMenit: c.targetSelesaiMenit } : null };
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="SLA targets"
        description="Time limits per priority. The clock starts when a ticket is opened, or when an escalation reaches the level that handles it."
      />
      <SlaTable rows={rows} />
    </div>
  );
}
