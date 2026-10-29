import { requireRole } from "@/lib/auth/guards";
import { getProfileBase } from "@/lib/profile-data";
import { getClientCounts } from "@/lib/client/queries";
import { AccountProfile } from "@/components/profile/AccountProfile";
import { ProfilePageShell } from "@/components/profile/ProfilePageShell";

// Aksi simpan profil & ganti password bersifat role-agnostic (selalu mengubah akun dari sesi),
// jadi tampilan & aksinya dipakai bersama oleh Client, Admin, L1 dan L2.
export default async function ClientProfilePage() {
  const user = await requireRole("CLIENT");
  const [base, counts] = await Promise.all([getProfileBase(user.id), getClientCounts(user.id)]);

  return (
    <ProfilePageShell>
      <AccountProfile
        userId={user.id}
        avatarName={user.avatarName}
        name={user.name}
        email={user.email}
        roleLabel="Client"
        stats={[
          { label: "Total", value: counts.total, href: "/client/tickets" },
          { label: "Active", value: counts.active, href: "/client/tickets?view=active" },
          { label: "Resolved", value: counts.done, href: "/client/tickets?view=done" },
        ]}
        {...base}
      />
    </ProfilePageShell>
  );
}
