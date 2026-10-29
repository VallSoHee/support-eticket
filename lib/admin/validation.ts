import { z } from "zod";
import type { Role } from "@/lib/roles";
import { SCOPE_ROLES, type UserScope } from "@/lib/admin/scope";

const name = z.string().trim().min(2, "Enter a full name.").max(100);

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(191, "Email is too long.");

// Sama dengan aturan di lib/auth/validation.ts (bcrypt hanya memakai 72 byte pertama).
const newPassword = z
  .string()
  .min(8, "Use at least 8 characters.")
  .refine((v) => new TextEncoder().encode(v).length <= 72, "Password is too long (max 72 bytes).")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Include at least one letter and one number.");

function roleField(scope: UserScope) {
  const roles = SCOPE_ROLES[scope];
  return z.enum(roles as [Role, ...Role[]]);
}

export function createUserSchema(scope: UserScope) {
  return z.object({
    name,
    email,
    role: roleField(scope),
    password: newPassword,
  });
}

export function updateUserSchema(scope: UserScope) {
  return z.object({
    name,
    email,
    role: roleField(scope),
    // Kosong -> password tidak diubah (lihat updateUserAction).
    password: z.union([z.literal(""), newPassword]),
  });
}
