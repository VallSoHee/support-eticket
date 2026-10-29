import "dotenv/config";
import { hash } from "bcryptjs";
import { prisma } from "../lib/prisma";
import { seedFaqKnowledge } from "./faq-seed";

type SeedUser = { name: string; email: string; password: string; role: "ADMIN" | "PETUGAS_L1" | "PETUGAS_L2" | "CLIENT" };

// upsert dengan update kosong: aman dijalankan berulang dan tidak menimpa password yang sudah diganti.
async function ensureUser(u: SeedUser) {
  await prisma.user.upsert({
    where: { email: u.email },
    update: {},
    create: { name: u.name, email: u.email, passwordHash: await hash(u.password, 12), role: u.role },
  });
  console.log(`  ✓ ${u.role.padEnd(10)} ${u.email}`);
}

// Data master awal (FR-2.5, FR-4.2, FR-6.1). Semua idempotent: aman dijalankan berulang
// dan tidak menimpa nilai yang sudah diubah Admin lewat UI.
const DEFAULT_SLA = [
  { priority: "LOW", targetResponMenit: 480, targetSelesaiMenit: 4320 },
  { priority: "MEDIUM", targetResponMenit: 240, targetSelesaiMenit: 2880 },
  { priority: "HIGH", targetResponMenit: 60, targetSelesaiMenit: 1440 },
  { priority: "CRITICAL", targetResponMenit: 15, targetSelesaiMenit: 480 },
] as const;

const DEFAULT_CATEGORIES = [
  {
    nama: "Account & login",
    defaultPriority: "MEDIUM",
    faq: {
      keywords: "lupa password, reset password, tidak bisa login, forgot password",
      jawaban: "Klik \"Forgot password\" di halaman login, masukkan email Anda, lalu ikuti tautan reset yang kami kirim. Tautan berlaku singkat, jadi segera gunakan.",
    },
  },
  {
    nama: "Bug / technical error",
    defaultPriority: "HIGH",
    faq: {
      keywords: "error, bug, tidak berfungsi, crash, gagal",
      jawaban: "Coba muat ulang halaman atau keluar lalu masuk kembali. Jika masalah berlanjut, klik \"Chat dengan Petugas\" agar tim kami membantu.",
    },
  },
  { nama: "General inquiry", defaultPriority: "LOW", faq: null },
] as const;

async function seedMasterData() {
  console.log("Seeding master data...");
  for (const sla of DEFAULT_SLA) {
    await prisma.slaConfig.upsert({ where: { priority: sla.priority }, update: {}, create: sla });
  }
  for (const c of DEFAULT_CATEGORIES) {
    const cat = await prisma.category.upsert({
      where: { nama: c.nama },
      update: {},
      create: { nama: c.nama, defaultPriority: c.defaultPriority },
    });
    if (c.faq && (await prisma.faqEntry.count({ where: { categoryId: cat.id } })) === 0) {
      await prisma.faqEntry.create({ data: { categoryId: cat.id, ...c.faq } });
    }
    console.log(`  ✓ ${c.nama}`);
  }
  // Basis pengetahuan chatbot (idempotent; tidak menimpa entri yang diedit Admin).
  console.log(`  ✓ FAQ chatbot: ${await seedFaqKnowledge()} entri baru`);
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD wajib diisi di .env");
  }

  console.log("Seeding users...");
  await ensureUser({
    name: process.env.SEED_ADMIN_NAME ?? "Administrator",
    email: adminEmail.toLowerCase(),
    password: adminPassword,
    role: "ADMIN",
  });

  await seedMasterData();

  if (process.env.SEED_DEMO_USERS === "true") {
    if (process.env.NODE_ENV === "production") throw new Error("SEED_DEMO_USERS tidak boleh di production.");
    const pw = process.env.SEED_DEMO_PASSWORD ?? "Password123";
    await ensureUser({ name: "Demo Petugas L1", email: "l1@example.com", password: pw, role: "PETUGAS_L1" });
    await ensureUser({ name: "Demo Petugas L2", email: "l2@example.com", password: pw, role: "PETUGAS_L2" });
    await ensureUser({ name: "Demo Client", email: "client@example.com", password: pw, role: "CLIENT" });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
