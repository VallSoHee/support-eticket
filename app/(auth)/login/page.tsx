import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { WELCOME_COOKIE } from "@/lib/client/welcome";
import { ROLE_HOME } from "@/lib/roles";

// Form-nya dirender oleh AuthPanel (sisi depan flip card) di layout.
// Halaman ini hanya menjaga: user yang sudah login diarahkan ke home role-nya.
export default async function LoginPage() {
  const user = await getCurrentUser();
  // Pengecualian: sesaat setelah login Client, loginAction menyetel cookie penanda. Server Action yang
  // menyetel cookie membuat halaman ini dirender ulang; tanpa pengecualian ini redirect di bawah akan
  // memotong animasi transisi sebelum sempat main (LoginTransition yang menavigasi setelah animasi).
  const arriving = (await cookies()).has(WELCOME_COOKIE);
  if (user && !arriving) redirect(ROLE_HOME[user.role]);
  return null;
}
