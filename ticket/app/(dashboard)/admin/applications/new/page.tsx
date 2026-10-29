import { requireRole } from "@/lib/auth/guards";
import { ApplicationForm } from "@/components/admin/ApplicationForm";

export default async function NewApplicationPage() {
  await requireRole("ADMIN");
  return <ApplicationForm mode="create" />;
}
