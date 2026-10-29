import type { Role } from "@/lib/roles";

// Satu sumber kebenaran untuk 3 CRUD user di modul Admin. "Scope" berbeda dengan
// Role: scope PETUGAS mencakup 2 role sekaligus (L1 & L2) supaya bisa dikelola
// dalam satu halaman dengan pilihan level.
export const USER_SCOPES = ["ADMIN", "PETUGAS", "CLIENT"] as const;
export type UserScope = (typeof USER_SCOPES)[number];

export const SCOPE_ROLES: Record<UserScope, readonly Role[]> = {
  ADMIN: ["ADMIN"],
  PETUGAS: ["PETUGAS_L1", "PETUGAS_L2"],
  CLIENT: ["CLIENT"],
};

export const SCOPE_LABEL: Record<UserScope, string> = {
  ADMIN: "Admin",
  PETUGAS: "Petugas",
  CLIENT: "Client",
};

export const SCOPE_BASE_PATH: Record<UserScope, string> = {
  ADMIN: "/admin/admins",
  PETUGAS: "/admin/petugas",
  CLIENT: "/admin/clients",
};

export function isRoleInScope(scope: UserScope, role: Role): boolean {
  return SCOPE_ROLES[scope].includes(role);
}
