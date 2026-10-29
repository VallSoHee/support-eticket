import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { WELCOME_COOKIE } from "@/lib/client/welcome";
import { ROLE_HOME } from "@/lib/roles";

// Form-nya dirender oleh AuthPanel (sisi belakang flip card) di layout.
export default async function RegisterPage() {
  const user = await getCurrentUser();
  // Sesaat setelah daftar, user sudah login tapi animasi transisi masih berjalan (LoginTransition
  // yang menavigasi setelahnya). Cookie penanda dari registerAction mencegah redirect memotongnya.
  const arriving = (await cookies()).has(WELCOME_COOKIE);
  if (user && !arriving) redirect(ROLE_HOME[user.role]);
  return null;
}
