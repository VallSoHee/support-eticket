# KelolaSupport (laporan-pkl) — sistem tiket + chat realtime

## Menjalankan

```bash
npm install
cp .env.example .env        # isi DATABASE_URL, AUTH_SECRET, SEED_ADMIN_*
npx prisma migrate deploy   # buat tabel (atau: npm run prisma:migrate saat development)
npm run db:seed             # admin + data master (+ akun demo bila SEED_DEMO_USERS=true)
npm run dev                 # http://localhost:3000
```

Jika sudah ada tiket lama yang statusnya `OPEN` (dibuat sebelum antrean dipasang), masukkan ke antrean L1:

```bash
npm run db:requeue
```

## Chatbot (Bot -> L1)

Alur tiket sekarang: **client submit tiket -> chat dengan bot -> (belum puas) klik "Talk to a support agent" -> antrean L1**.

- Tiket baru berstatus `BOT_HANDLING` dan *belum* muncul di antrean petugas. Balasan pertama bot membaca isi tiket.
- Selama fase bot, client punya dua tombol di atas kolom chat: **It's solved** (tiket `RESOLVED` tanpa petugas) dan
  **Talk to a support agent** (`WAITING_AGENT_L1` + masuk antrean L1). Bot tidak pernah mengeskalasi sendiri.
- Seluruh percakapan dengan bot tetap terlihat oleh L1 di Public chat yang sama (FR-4.5).

Cara bot menjawab (`lib/bot/`), dari yang paling murah:

1. **FAQ** — kata kunci dari `/admin/faq` cocok yakin -> jawab langsung, tanpa panggilan API.
2. **Gemini** (opsional) — bila `GEMINI_API_KEY` diisi, pertanyaan di luar FAQ dijawab model, dengan FAQ sebagai pedoman.
3. **Cadangan** — tanpa kunci / kuota habis / error: bot menampilkan FAQ yang mirip atau menyarankan tombol petugas. Chat tidak pernah rusak.

Aktifkan Gemini (free tier, tanpa kartu kredit): buat API key di https://aistudio.google.com/apikey lalu tambahkan ke `.env`:

```bash
GEMINI_API_KEY=isi_key_anda
# opsional
GEMINI_MODEL=gemini-flash-lite-latest   # model Flash/Flash-Lite yang tersedia di free tier
BOT_MAX_REPLIES=20                      # batas balasan bot per tiket (menjaga kuota)
```

Catatan free tier: kuota per menit/hari terbatas dan berubah dari waktu ke waktu (cek
https://ai.google.dev/gemini-api/docs/rate-limits), dan Google dapat memakai data free tier untuk meningkatkan
produknya. Jangan kirim data pelanggan yang sensitif; bila aplikasi sudah dipakai sungguhan, pakai tier berbayar atau
penyedia lain. Mengganti penyedia cukup mengubah `lib/bot/gemini.ts` dan `lib/bot/index.ts`.

Basis pengetahuan awal (±25 entri: akun & login, tiket & chat, profil, troubleshooting; dwibahasa ID/EN) ikut terisi
saat `npm run db:seed`. Untuk database yang sudah berjalan, jalankan `npm run db:faq` (aman diulang, entri yang sudah
diedit Admin tidak ditimpa).

Perlu menambah jawaban bot? Tambah entri FAQ di `/admin/faq` (kata kunci dipisah koma; frasa lebih spesifik = lebih akurat).

## Mencoba chat realtime

Akun demo (`SEED_DEMO_USERS=true`, password `Password123`): `client@example.com`, `l1@example.com`, `l2@example.com`.

1. Browser A (login **client**) → *My tickets* → buat tiket baru. Bot membalas dulu; klik **Talk to a support agent**
   agar tiket masuk antrean L1.
2. Browser B / jendela incognito (login **l1**) → *Tickets* → tab **Queue** → buka tiket → **Take ticket**.
   Di browser A, status berubah menjadi "With support" tanpa reload.
3. Kirim pesan dari A dan B bergantian — muncul di sisi lain seketika. Indikator **Live** di kepala chat
   menunjukkan koneksi aktif.
4. L1 → **Escalate to L2** membuka tab *Internal note* (hanya petugas). L2 (`l2@example.com`) bisa
   mengambil tiket dan membalas client; client tidak pernah melihat Internal note.

## Cara kerja realtime

- `GET /api/tickets/[id]/stream` — Server-Sent Events. Event `chat` (pesan baru) dan `status` (status tiket
  berubah). Otorisasi sama dengan halaman detail tiket: client hanya tiketnya sendiri dan hanya Public chat;
  petugas hanya tiket antrean levelnya / yang ditugaskan padanya.
- Kirim pesan lewat Server Action (`sendClientMessageAction`, `sendMessageAction`); setelah tersimpan,
  `notifyTicket()` (`lib/chat/events.ts`) membangunkan stream sehingga pesan terkirim nyaris instan.
- Stream juga membaca database tiap 3 detik sebagai cadangan, jadi tetap jalan bila aplikasi berjalan di
  lebih dari satu instance (pesannya hanya tertunda ≤3 dtk). Browser menyambung ulang otomatis.
- Daftar tiket / dashboard petugas disegarkan tiap 10 detik (`AutoRefresh`) agar tiket baru muncul di antrean.

Catatan deployment: SSE butuh proses Node yang hidup lama (`next start`, Docker, VPS). Di platform serverless
dengan batas durasi (mis. Vercel) koneksi akan diputus berkala lalu tersambung ulang otomatis; untuk skala
besar pertimbangkan Pusher/Ably atau Redis pub/sub.

## Notifikasi (bel di samping profil)

Ikon bel ada di header semua role (Admin, Petugas L1/L2, Client), tepat di sebelah menu profil. Badge merah = jumlah yang belum dibaca.
Notifikasi baru masuk **realtime** (toast kecil + bel berayun); membuka halaman sebuah tiket otomatis menandai notifikasi tiket itu terbaca.

Setelah menarik perubahan ini, jalankan migrasi (sekaligus meng-generate ulang Prisma Client):

```bash
npx prisma migrate dev      # atau: npx prisma migrate deploy && npx prisma generate
```

**Kapan notifikasi dikirim** (semua bisa diubah di Admin > Notifications, nilai bawaan di `lib/notify/events.ts`):

| Kejadian | Bawaan penerima |
| --- | --- |
| Client membuat tiket | Admin |
| Client klik "Talk to a support agent" | Semua L1 (antrean) |
| L1 mengambil tiket | Client |
| L2 mengambil tiket | L1 pemegang tiket |
| Client mengirim pesan (fase petugas) | L1 pemegang tiket |
| L1 membalas client | Client |
| Bot membalas | Client |
| Internal note (L1 <-> L2) | L1 + L2 pemegang tiket (pengirim dikecualikan) |
| Tiket dieskalasi ke L2 | Semua L2 (antrean) |
| Tiket selesai (resolved) | Client |

**Admin > Notifications** (`/admin/notifications`):

- *Automatic notifications* — per kejadian: nyalakan/matikan, ubah judul & isi (placeholder `{ticket}`, `{client}`, `{actor}`, `{app}`,
  `{priority}`, `{preview}`), pilih penerima, dan **ke mana notifikasi mengarah saat diklik** (halaman tiket, daftar tiket, dashboard, atau path kustom).
  Tombol *Reset* mengembalikan ke nilai bawaan. Selama Admin belum menyimpan, nilai bawaan kode yang dipakai (tanpa seed).
- *Announcements* — template pesan buatan Admin untuk pemberitahuan mendadak. Tombol **Send now** mengirimnya saat itu juga ke semua
  client / L1 / L2 / admin sesuai audiens yang dipilih (ada konfirmasi + jumlah penerima, dan tercatat di Audit log).

Catatan teknis: pengiriman lewat `lib/notify/dispatch.ts` (dipanggil dari server action tiket/chat/petugas dan bot, selalu setelah respons
dikirim dan tidak pernah menggagalkan aksi utama). Realtime memakai SSE `/api/notifications/stream` — semua tab dalam satu browser berbagi
satu koneksi (Web Locks + BroadcastChannel) supaya tidak menghabiskan batas ±6 koneksi per origin. Pesan chat beruntun untuk tiket yang sama
digabung jadi satu notifikasi selama belum dibaca. Notifikasi SLA (`SLA_WARNING`/`SLA_BREACH`) belum dikirim karena belum ada penjadwal SLA.
