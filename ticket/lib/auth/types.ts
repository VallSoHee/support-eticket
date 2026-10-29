// State yang dikembalikan server action ke form (useActionState).
export type AuthFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  // Dikembalikan supaya input non-sensitif tidak hilang setelah error (React mereset form).
  values?: { name?: string; email?: string };
  // Diisi loginAction saat sukses: client yang menavigasi (supaya animasi transisi sempat main).
  redirectTo?: string;
  animate?: boolean;
  welcomeName?: string;
  // true = sudah pernah login sebelumnya -> "Welcome back"; false = login pertama -> "Welcome".
  returning?: boolean;
};

// Hasil aksi OTP (kirim / verifikasi) yang dipanggil langsung dari komponen client.
export type OtpActionResult = {
  ok: boolean;
  error?: string;
  message?: string;
  // Detik sampai boleh kirim ulang (untuk hitung mundur di tombol).
  retryAfter?: number;
  // Hanya ganti email: email baru yang sudah diverifikasi.
  email?: string;
};
