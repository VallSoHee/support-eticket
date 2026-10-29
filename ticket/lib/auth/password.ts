import { compare, hash } from "bcryptjs";

// FR-1.4 / NFR-3: password di-hash dengan bcrypt, tidak pernah disimpan plaintext.
// bcryptjs = implementasi JS murni (tanpa build native), aman untuk Vercel/Windows.
const COST = 12;

export function hashPassword(plain: string) {
  return hash(plain, COST);
}

let dummyHash: Promise<string> | undefined;

// Kalau user tidak ditemukan, tetap lakukan compare ke hash palsu supaya waktu
// respons login tidak membocorkan apakah email terdaftar.
export async function verifyPassword(plain: string, hashed: string | null | undefined) {
  if (!hashed) {
    dummyHash ??= hash("dummy-password-for-timing", COST);
    await compare(plain, await dummyHash);
    return false;
  }
  return compare(plain, hashed);
}
