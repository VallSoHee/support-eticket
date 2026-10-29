import "dotenv/config";
import { prisma } from "../lib/prisma";
import { seedFaqKnowledge } from "../prisma/faq-seed";

// Menambahkan basis pengetahuan awal chatbot ke database yang SUDAH berjalan (seed.ts hanya mengisi
// FAQ bila tabelnya masih kosong). Aman dijalankan berulang; entri yang sudah ada/diedit tidak diubah.
//   npm run db:faq
seedFaqKnowledge()
  .then((n) => console.log(`FAQ knowledge: ${n} entri baru ditambahkan.`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
