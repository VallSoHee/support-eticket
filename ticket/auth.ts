import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/auth/validation";
import { verifyPassword } from "@/lib/auth/password";
import { syncGoogleUser } from "@/lib/auth/google";
import { writeAudit } from "@/lib/admin/audit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    // Satu provider untuk semua role (Client, Admin, L1, L2). Bedanya hanya kolom
    // users.role -> 1 akun = 1 role. Akun petugas dibuat Admin, bukan lewat register.
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });

        // verifyPassword tetap jalan walau user tidak ada / akun Google-only (passwordHash null).
        const valid = await verifyPassword(password, user?.passwordHash);
        if (!user || !valid || !user.isActive) return null;

        // FR-8.1 — catat login berhasil.
        await writeAudit({ actorId: user.id, action: "LOGIN", entityType: "User", entityId: user.id, description: "Signed in with email & password." });

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
    // Membaca AUTH_GOOGLE_ID & AUTH_GOOGLE_SECRET dari .env secara otomatis.
    Google({ authorization: { params: { prompt: "select_account" } } }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    // Simpan/hubungkan user Google ke database SEBELUM sesi dibuat.
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;

      // Tolak email Google yang belum terverifikasi (mencegah pengambilalihan akun via email).
      if (!profile?.email || profile.email_verified !== true || !account.providerAccountId) return false;

      const user = await syncGoogleUser({
        providerAccountId: account.providerAccountId,
        email: profile.email,
        name: profile.name,
      });
      if (user.isActive) {
        await writeAudit({ actorId: user.id, action: "LOGIN", entityType: "User", entityId: user.id, description: "Signed in with Google." });
      }
      return user.isActive; // false -> /login?error=AccessDenied
    },

    // Untuk Google, `user` di sini adalah profil Google (id-nya BUKAN id database),
    // jadi id & role diambil dari tabel users.
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: profile.email.toLowerCase() } });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
        return token;
      }
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
  },
});
