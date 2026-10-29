import { requireRole } from "@/lib/auth/guards";
import { UserForm } from "@/components/admin/UserForm";

export default async function NewClientPage() {
  await requireRole("ADMIN");
  return <UserForm scope="CLIENT" mode="create" />;
}
