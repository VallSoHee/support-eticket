import { prisma } from "@/lib/prisma";

const PROVIDER = "google";

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
}

type GoogleIdentity = {
  providerAccountId: string; // "sub" dari Google (stabil, tidak berubah walau email diganti)
  email: string;
  name?: string | null;
};

/**
 * Dipanggil saat login Google (hanya dengan email yang sudah terverifikasi oleh Google):
 *  1. Akun Google ini sudah pernah terhubung  -> pakai user tersebut.
 *  2. Email sudah terdaftar (mis. register manual / akun petugas) -> hubungkan, role TIDAK berubah.
 *  3. Belum ada sama sekali -> buat user baru dengan role CLIENT (petugas/admin tidak bisa
 *     self-register lewat Google, sama seperti aturan FR-1.2).
 */
export async function syncGoogleUser(input: GoogleIdentity, retry = true) {
  const email = input.email.trim().toLowerCase();
  const link = { provider: PROVIDER, providerAccountId: input.providerAccountId };

  const linked = await prisma.account.findUnique({
    where: { provider_providerAccountId: link },
    include: { user: true },
  });
  if (linked) return linked.user;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.account.create({ data: { ...link, userId: existing.id } });
      return existing;
    }

    return await prisma.user.create({
      data: {
        name: (input.name?.trim() || email.split("@")[0]).slice(0, 100),
        email,
        passwordHash: null,
        role: "CLIENT",
        accounts: { create: link },
      },
    });
  } catch (e) {
    // Dua request bersamaan (double click) bisa bentrok di unique index -> ulangi sekali.
    if (retry && isUniqueViolation(e)) return syncGoogleUser(input, false);
    throw e;
  }
}
