import { requireRole } from "@/lib/auth/guards";
import { UserListView } from "@/components/admin/UserListView";

export default async function PetugasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; success?: string }>;
}) {
  const user = await requireRole("ADMIN");
  const sp = await searchParams;
  return <UserListView scope="PETUGAS" currentUserId={user.id} searchParams={sp} />;
}
