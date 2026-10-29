// State umum server action modul Admin (kategori, FAQ, SLA, shift, tiket).
export type MasterFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  // Nilai input dikembalikan supaya form tidak kosong lagi setelah error validasi.
  values?: Record<string, string>;
};
