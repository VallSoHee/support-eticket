import { requireRole } from "@/lib/auth/guards";
import { UserForm } from "@/components/admin/UserForm";

export default async function NewPetugasPage() {
  await requireRole("ADMIN");
  return <UserForm scope="PETUGAS" mode="create" />;
}
