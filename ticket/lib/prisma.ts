import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// Prisma ORM v7 mewajibkan driver adapter untuk semua database relasional
// (lihat prisma.config.ts untuk konfigurasi CLI-nya). PrismaMariaDb butuh
// object {host, port, user, password, database} — bukan connection string
// mentah — jadi DATABASE_URL kita parse dulu supaya cukup satu env var saja.
function parseDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
  };
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL belum diset (cek file .env, lihat .env.example).");
  }

  const adapter = new PrismaMariaDb(parseDatabaseUrl(databaseUrl));
  return new PrismaClient({ adapter });
}

// Next.js dev mode (hot reload) membuat modul di-re-import berkali-kali.
// Simpan instance di globalThis supaya tidak membuka koneksi baru tiap reload.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
