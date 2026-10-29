// Sumber kebenaran role di sisi aplikasi. Nilainya HARUS sama dengan enum Role di
// prisma/schema.prisma. Sengaja tidak meng-import Prisma di sini supaya file ini
// aman dipakai di proxy.ts dan komponen client (tanpa menarik driver database).
export const ROLES = ["ADMIN", "PETUGAS_L1", "PETUGAS_L2", "CLIENT"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  PETUGAS_L1: "Petugas L1 (Customer Support)",
  PETUGAS_L2: "Petugas L2 (Technical Support)",
  CLIENT: "Client",
};

// Halaman utama tiap role setelah login.
export const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/admin",
  PETUGAS_L1: "/l1",
  PETUGAS_L2: "/l2",
  CLIENT: "/client",
};
