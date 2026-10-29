import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { ROLE_HOME } from "@/lib/roles";

// Pintu masuk: arahkan sesuai role, atau ke /login kalau belum login.
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? ROLE_HOME[user.role] : "/login");
}
