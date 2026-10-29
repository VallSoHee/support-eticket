import { requireRole } from "@/lib/auth/guards";
import { NotificationRuleForm } from "@/components/admin/NotificationRuleForm";

export default async function NewAnnouncementPage() {
  await requireRole("ADMIN");
  return <NotificationRuleForm kind="announcement" mode="create" />;
}
