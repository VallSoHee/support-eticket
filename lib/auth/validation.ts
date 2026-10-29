import { z } from "zod";

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(191, "Email is too long.");

// bcrypt hanya memakai 72 byte pertama -> tolak yang lebih panjang daripada diam-diam dipotong.
export const newPassword = z
  .string()
  .min(8, "Use at least 8 characters.")
  .refine((v) => new TextEncoder().encode(v).length <= 72, "Password is too long (max 72 bytes).")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Include at least one letter and one number.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(128),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(100),
    email,
    otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code sent to your email."),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(100),
});

// currentPassword opsional: akun yang daftar via Google belum punya password (dicek di action).
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().max(128).optional(),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
