import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { ROLE_HOME } from "@/lib/roles";
import { WELCOME_COOKIE, WELCOME_MAX_AGE } from "@/lib/client/welcome";
import { welcomeKindFor } from "@/lib/client/welcome-server";

// Titik pendaratan setelah login Google (googleSignInAction -> redirectTo "/welcome").
// Server Component tidak boleh menyetel cookie, jadi ini Route Handler: menentukan sapaan
// (Welcome / Welcome back), menyetel cookie penanda animasi, lalu meneruskan ke dashboard role-nya.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const res = NextResponse.redirect(new URL(ROLE_HOME[user.role], req.url));
  // Animasi kedatangan berlaku untuk semua role (Client, Admin, Petugas).
  res.cookies.set(WELCOME_COOKIE, await welcomeKindFor(user.id), {
    path: "/",
    maxAge: WELCOME_MAX_AGE,
    sameSite: "lax",
  });
  return res;
}
