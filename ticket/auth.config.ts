import type { NextAuthConfig } from "next-auth";

// Config yang "edge/proxy-safe": TIDAK meng-import Prisma atau bcrypt.
// Provider Credentials (yang butuh database) didaftarkan di auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  session: {
    strategy: "jwt", // FR-1.4
    maxAge: 60 * 60 * 8, // 8 jam
  },
  providers: [],
  callbacks: {
    // `user` hanya ada saat login pertama; setelah itu id & role dibaca dari token.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
