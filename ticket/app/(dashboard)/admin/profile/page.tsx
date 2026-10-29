import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getProfileBase } from "@/lib/profile-data";
import { AccountProfile } from "@/components/profile/AccountProfile";
import { ProfilePageShell } from "@/components/profile/ProfilePageShell";

export default async function AdminProfilePage() {
  const user = await requireRole("ADMIN");
  const [base, clients, staff, tickets] = await Promise.all([
    getProfileBase(user.id),
    prisma.user.count({ where: { role: "CLIENT" } }),
    prisma.user.count({ where: { role: { in: ["PETUGAS_L1", "PETUGAS_L2"] } } }),
    prisma.ticket.count(),
  ]);

  return (
    <ProfilePageShell>
      <AccountProfile
        userId={user.id}
        avatarName={user.avatarName}
        name={user.name}
        email={user.email}
        roleLabel="Admin"
        stats={[
          { label: "Clients", value: clients, href: "/admin/clients" },
          { label: "Staff", value: staff, href: "/admin/petugas" },
          { label: "Tickets", value: tickets, href: "/admin/tickets" },
        ]}
        {...base}
      />
    </ProfilePageShell>
  );
}
