import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { resolveAccess } from "@/lib/access";

// Next.js 16 mengganti "middleware.ts" menjadi "proxy.ts". Ini hanya pagar pertama
// (membaca JWT, tanpa query DB). Pengecekan otoritatif tetap di lib/auth/guards.ts.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const decision = resolveAccess(req.nextUrl.pathname, req.auth?.user?.role);

  switch (decision.type) {
    case "redirect":
      return NextResponse.redirect(new URL(decision.to, req.nextUrl));
    case "unauthorized":
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    case "forbidden":
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    default:
      return NextResponse.next();
  }
});

export const config = {
  // Lewati aset statis Next.js & file gambar di /public.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
