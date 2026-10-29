import { ROLE_HOME, type Role } from "@/lib/roles";

// Aturan akses berbasis path. Dipakai proxy.ts sebagai lapisan PERTAMA (cepat, tanpa DB).
// Lapisan KEDUA yang otoritatif ada di lib/auth/guards.ts (requireRole / authorizeApi),
// yang dipanggil di tiap halaman & route handler (NFR-4: server-side, bukan cuma hide UI).

type Rule = { prefix: string; roles: readonly Role[] };

const ROLE_RULES: readonly Rule[] = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/api/admin", roles: ["ADMIN"] },
  { prefix: "/l1", roles: ["PETUGAS_L1"] },
  { prefix: "/api/l1", roles: ["PETUGAS_L1"] },
  { prefix: "/l2", roles: ["PETUGAS_L2"] },
  { prefix: "/api/l2", roles: ["PETUGAS_L2"] },
  { prefix: "/client", roles: ["CLIENT"] },
  { prefix: "/api/client", roles: ["CLIENT"] },
];

const PUBLIC_PATHS = ["/", "/login", "/register", "/forgot-password", "/reset-password"];
const PUBLIC_PREFIXES = ["/api/auth"]; // endpoint internal Auth.js

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export type AccessDecision =
  | { type: "allow" }
  | { type: "redirect"; to: string }
  | { type: "unauthorized" } // API, belum login  -> 401
  | { type: "forbidden" }; //   API, role salah   -> 403

export function resolveAccess(pathname: string, role: Role | undefined): AccessDecision {
  const isApi = pathname === "/api" || pathname.startsWith("/api/");

  if (PUBLIC_PATHS.includes(pathname)) return { type: "allow" };
  if (PUBLIC_PREFIXES.some((p) => matches(pathname, p))) return { type: "allow" };

  // Semua path lain WAJIB login (termasuk API tiket -> "client belum login tidak bisa buat tiket").
  if (!role) return isApi ? { type: "unauthorized" } : { type: "redirect", to: "/login" };

  const rule = ROLE_RULES.find((r) => matches(pathname, r.prefix));
  if (rule && !rule.roles.includes(role)) {
    return isApi ? { type: "forbidden" } : { type: "redirect", to: ROLE_HOME[role] };
  }

  return { type: "allow" };
}
