// Prisma ORM v7 memindahkan konfigurasi koneksi CLI (migrate, studio, db pull, dll)
// dari schema.prisma ke file ini. Koneksi runtime Prisma Client (dipakai di app/)
// tetap lewat driver adapter di lib/prisma.ts, terpisah dari file ini.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Dijalankan manual lewat `znpm run db:seed` (Prisma 7 tidak auto-seed saat migrate).
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
