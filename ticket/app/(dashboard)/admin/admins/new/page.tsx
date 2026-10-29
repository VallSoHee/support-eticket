import { requireRole } from "@/lib/auth/guards";
import { UserForm } from "@/components/admin/UserForm";

export default async function NewAdminPage() {
  await requireRole("ADMIN");
  return <UserForm scope="ADMIN" mode="create" />;
}
