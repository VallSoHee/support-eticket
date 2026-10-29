import { requireRole } from "@/lib/auth/guards";
import { CategoryForm } from "@/components/admin/CategoryForm";

export default async function NewCategoryPage() {
  await requireRole("ADMIN");
  return <CategoryForm mode="create" />;
}
