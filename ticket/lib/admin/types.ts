// State yang dikembalikan server action CRUD user (Admin/Petugas/Client) ke form.
export type AdminFormState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  // Supaya input yang sudah diisi tidak hilang setelah error (React mereset form).
  values?: { name?: string; email?: string; role?: string };
};
