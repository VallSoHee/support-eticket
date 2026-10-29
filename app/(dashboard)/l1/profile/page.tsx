import { requireRole } from "@/lib/auth/guards";
import { getProfileBase } from "@/lib/profile-data";
import { getStaffCounts } from "@/lib/staff/queries";
import { STAFF_LEVEL } from "@/lib/staff/rules";
import { AccountProfile } from "@/components/profile/AccountProfile";
import { ProfilePageShell } from "@/components/profile/ProfilePageShell";

const LEVEL = "L1" as const;

export default async function PetugasL1ProfilePage() {
  const user = await requireRole(STAFF_LEVEL[LEVEL].role);
  const [base, counts] = await Promise.all([getProfileBase(user.id), getStaffCounts(LEVEL, user.id)]);
  const tickets = `${STAFF_LEVEL[LEVEL].base}/tickets`;

  return (
    <ProfilePageShell>
      <AccountProfile
        userId={user.id}
        avatarName={user.avatarName}
        name={user.name}
        email={user.email}
        roleLabel={`${STAFF_LEVEL[LEVEL].short} · ${STAFF_LEVEL[LEVEL].title}`}
        stats={[
          { label: "In queue", value: counts.queue, href: `${tickets}?view=queue` },
          { label: "Mine", value: counts.mine, href: `${tickets}?view=mine` },
          { label: "Resolved", value: counts.done, href: `${tickets}?view=done` },
        ]}
        {...base}
      />
    </ProfilePageShell>
  );
}
