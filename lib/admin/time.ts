// Kolom shifts.tanggal_berlaku (@db.Date) dan jam_mulai/jam_selesai (@db.Time) disimpan
// tanpa zona waktu. Agar tidak bergeser oleh timezone server, semuanya diperlakukan
// sebagai "waktu dinding" (wall-clock) dan selalu dibaca/ditulis dengan UTC.

export const toDbDate = (yyyyMmDd: string) => new Date(`${yyyyMmDd}T00:00:00.000Z`);
export const toDbTime = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

export const fromDbDate = (d: Date) => d.toISOString().slice(0, 10);
export const fromDbTime = (d: Date) => d.toISOString().slice(11, 16);

export function fmtDbDate(d: Date) {
  return d.toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Iterasi tanggal (string YYYY-MM-DD) dari..sampai inklusif. */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export function isWeekend(yyyyMmDd: string) {
  const day = new Date(`${yyyyMmDd}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}
