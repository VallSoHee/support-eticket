import { prisma } from "../lib/prisma";

// Basis pengetahuan awal chatbot (tabel faq_entries). Isinya hanya hal yang memang ada di aplikasi
// ini (batas upload, masa berlaku kode, nama menu/tombol, arti status), supaya jawaban bot tidak
// menjanjikan sesuatu yang tidak benar.
//
// Format kata kunci = format yang dipakai bot (lib/bot/faq.ts): huruf kecil, dipisah koma. Frasa 2 kata
// ke atas dihitung lebih kuat daripada kata tunggal, jadi utamakan frasa spesifik. Jawaban sengaja
// dwibahasa karena jawaban FAQ yang cocok kuat dikirim apa adanya (tanpa lewat LLM).
//
// IDEMPOTENT: entri yang kata kuncinya sudah ada di kategori yang sama dilewati, jadi entri yang
// sudah diedit Admin lewat /admin/faq tidak pernah ditimpa. Jalankan: npm run db:faq

type Entry = { keywords: string; jawaban: string };
type Group = { nama: string; defaultPriority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; entries: Entry[] };

export const FAQ_KNOWLEDGE: Group[] = [
  {
    nama: "Account & login",
    defaultPriority: "MEDIUM",
    entries: [
      {
        keywords: "cara daftar, buat akun, daftar akun, register akun, sign up, create account, how to register",
        jawaban:
          "Buka halaman login lalu pilih daftar. Isi nama lengkap, email, dan password (minimal 8 karakter). Kami mengirim kode 6 digit ke email Anda; masukkan kode itu untuk menyelesaikan pendaftaran.\n\nEnglish: Open the login page and choose sign up. Enter your full name, email and a password (at least 8 characters). We email you a 6-digit code; enter it to finish registering.",
      },
      {
        keywords:
          "kode otp tidak masuk, otp tidak masuk, kode verifikasi tidak masuk, otp kedaluwarsa, kode kedaluwarsa, kirim ulang kode, code not received, verification code expired, resend code, otp not received",
        jawaban:
          "Kode 6 digit berlaku 10 menit dan bisa dikirim ulang setelah jeda 60 detik. Salah memasukkan kode 5 kali membuat kode hangus, jadi minta kode baru. Cek juga folder spam dan pastikan email yang diketik benar.\n\nEnglish: The 6-digit code is valid for 10 minutes and can be resent after a 60-second wait. Five wrong attempts invalidate the code, so request a new one. Also check your spam folder and make sure the email address is correct.",
      },
      {
        keywords:
          "link reset kedaluwarsa, link reset password kedaluwarsa, link reset password tidak masuk, link reset tidak masuk, email reset tidak masuk, email reset password tidak masuk, tautan reset password, tautan reset kedaluwarsa, reset link expired, reset password link expired, reset email not received, password reset link",
        jawaban:
          "Tautan reset password berlaku 1 jam. Jika sudah kedaluwarsa atau tidak masuk, buka \"Forgot password\" di halaman login dan minta tautan baru, lalu cek folder spam. Demi keamanan, pesan yang tampil sama baik email terdaftar maupun tidak.\n\nEnglish: A password reset link is valid for 1 hour. If it expired or didn't arrive, use \"Forgot password\" on the login page to get a new one and check your spam folder. For security the confirmation message is the same whether or not the email is registered.",
      },
      {
        keywords: "login google, login dengan google, login google gagal, gagal login google, masuk dengan google, continue with google, sign in with google, google sign in, akun google ditolak, google login failed",
        jawaban:
          "Pilih \"Continue with Google\" di halaman login. Akun Google harus memiliki email yang terverifikasi dan akun Anda di sistem harus aktif. Akun yang dibuat lewat Google belum punya password; untuk membuatnya gunakan \"Forgot password\".\n\nEnglish: Choose \"Continue with Google\" on the login page. The Google account needs a verified email and your account here must be active. Accounts created through Google have no password yet; use \"Forgot password\" to create one.",
      },
      {
        keywords: "ganti password, ubah password, change password, syarat password, password minimal, password requirements",
        jawaban:
          "Password baru minimal 8 karakter. Anda bisa mengubahnya dari halaman Profile. Jika lupa password saat ini, gunakan \"Forgot password\" di halaman login.\n\nEnglish: A new password must be at least 8 characters. You can change it from the Profile page. If you forgot your current password, use \"Forgot password\" on the login page.",
      },
      {
        keywords:
          "akun dinonaktifkan, akun saya dinonaktifkan, akun tidak aktif, akun saya tidak aktif, akun diblokir, akun saya diblokir, account deactivated, my account is deactivated, account disabled, account is disabled, account blocked, akun petugas, staff account",
        jawaban:
          "Akun yang dinonaktifkan tidak bisa login. Hanya Admin yang dapat mengaktifkannya kembali; hubungi Admin organisasi Anda. Akun petugas dan admin dibuatkan oleh Admin dan tidak bisa mendaftar sendiri.\n\nEnglish: A deactivated account cannot sign in. Only an Admin can reactivate it, so contact your organisation's Admin. Staff and admin accounts are created by an Admin and cannot self-register.",
      },
    ],
  },
  {
    nama: "Tickets & chat",
    defaultPriority: "LOW",
    entries: [
      {
        keywords: "apa itu kelolasupport, cara kerja, alur tiket, how does it work, how it works, how tickets work, cara kerja tiket",
        jawaban:
          "Alurnya: Anda membuat tiket, asisten (bot) membalas lebih dulu. Jika belum terbantu, tekan \"Talk to a support agent\" dan tiket masuk antrean petugas. Petugas membalas di chat yang sama dan menandai tiket selesai.\n\nEnglish: You create a ticket and the assistant (bot) replies first. If that doesn't help, press \"Talk to a support agent\" and your ticket joins the agent queue. An agent replies in the same chat and marks the ticket resolved.",
      },
      {
        keywords: "cara buat tiket, buat tiket baru, ajukan tiket, kirim tiket, create ticket, submit ticket, new ticket, how to open a ticket",
        jawaban:
          "Buka My tickets lalu buat tiket baru. Isi Title (minimal 5 karakter), Application, Platform, Urgency level, dan Description (minimal 10 karakter, atau sertakan screenshot). Setelah dikirim, asisten langsung membalas.\n\nEnglish: Go to My tickets and create a new ticket. Fill in Title (at least 5 characters), Application, Platform, Urgency level and Description (at least 10 characters, or attach a screenshot). The assistant replies right after you submit.",
      },
      {
        keywords: "tingkat urgensi, urgency level, pilih prioritas, prioritas tiket, ticket priority, which urgency",
        jawaban:
          "Low: masalah kecil atau pertanyaan, tidak mendesak. Medium: ada yang janggal tapi masih bisa bekerja. High: fitur penting rusak. Critical: aplikasi mati atau menghambat semua pekerjaan. Pilih yang paling sesuai agar tiket ditangani dengan tepat.\n\nEnglish: Low: minor issue or question, no rush. Medium: something is off but you can still work. High: an important feature is broken. Critical: the app is down or blocking everything. Pick the closest match so the ticket is handled appropriately.",
      },
      {
        keywords:
          "kirim screenshot, upload file, unggah file, file terlalu besar, upload gagal, tipe file, attach file, file too large, upload failed, file type, kirim video",
        jawaban:
          "Anda bisa melampirkan gambar, video (MP4, WEBM, MOV), PDF, dokumen Office, TXT, CSV, LOG, atau ZIP di deskripsi tiket maupun chat. Batasnya 10 MB per file dan 50 MB per video. Jika terlalu besar, kecilkan atau kompres (mis. ZIP) dulu.\n\nEnglish: You can attach images, videos (MP4, WEBM, MOV), PDF, Office documents, TXT, CSV, LOG or ZIP in the ticket description or in the chat. The limit is 10 MB per file and 50 MB per video. If a file is too big, shrink or compress it (e.g. ZIP) first.",
      },
      {
        keywords:
          "arti status tiket, status tiket, ticket status, what does status mean, waiting for an agent, with support, with technical team, assistant replying",
        jawaban:
          "Assistant replying: asisten sedang membantu. Waiting for an agent: Anda di antrean petugas. With support: petugas sedang menangani. With technical team: tim teknis ikut membantu di balik layar. Resolved/Closed: tiket selesai dan chat menjadi read-only.\n\nEnglish: Assistant replying: the assistant is helping. Waiting for an agent: you're in the agent queue. With support: an agent is handling it. With technical team: our technical team is helping behind the scenes. Resolved/Closed: the ticket is finished and the chat is read-only.",
      },
      {
        keywords:
          "bicara dengan petugas, chat dengan petugas, hubungi petugas, talk to agent, human agent, speak to a person, talk to a person, talk to a support agent",
        jawaban:
          "Tekan tombol \"Talk to a support agent\" di atas kolom chat. Tiket Anda masuk antrean petugas dan seluruh percakapan dengan asisten ikut terlihat oleh petugas, jadi Anda tidak perlu mengulang dari awal.\n\nEnglish: Press the \"Talk to a support agent\" button above the chat box. Your ticket joins the agent queue and the agent can see your whole conversation with the assistant, so you won't need to repeat yourself.",
      },
      {
        keywords:
          "lama menunggu petugas, belum dibalas petugas, antrean lama, belum ada balasan, waiting for agent, no reply from agent, still in queue, agent not replying",
        jawaban:
          "Petugas bekerja dalam shift. Tiket Anda tetap di antrean dan diambil begitu ada petugas yang online; statusnya berubah menjadi With support saat diambil. Sambil menunggu, Anda boleh menambahkan detail atau screenshot di chat, dan pastikan Urgency level sudah sesuai.\n\nEnglish: Agents work in shifts. Your ticket stays in the queue and is picked up as soon as an agent is online; its status changes to With support once taken. While you wait you can add details or screenshots in the chat, and make sure the Urgency level fits.",
      },
      {
        keywords:
          "tiket sudah selesai, tiket ditutup, buka kembali tiket, masalah muncul lagi, reopen ticket, ticket resolved, ticket closed, problem came back, masalah kembali",
        jawaban:
          "Tiket yang Resolved atau Closed tidak bisa dibalas lagi (chat read-only). Jika masalahnya muncul lagi, buat tiket baru dan sebutkan judul tiket sebelumnya agar lebih cepat dipahami.\n\nEnglish: A Resolved or Closed ticket can't be replied to (the chat is read-only). If the problem comes back, open a new ticket and mention the earlier ticket's title so it's understood faster.",
      },
      {
        keywords: "hapus pesan, balas pesan, hapus untuk semua, delete message, reply to message, delete for everyone, delete for me",
        jawaban:
          "Buka menu pada pesan di chat: Anda bisa membalas (reply) pesan tertentu, menghapusnya untuk diri sendiri, atau menghapusnya untuk semua orang. Hapus untuk semua hanya berlaku untuk pesan Anda sendiri dan selama chat masih terbuka.\n\nEnglish: Open the menu on a chat message: you can reply to a specific message, delete it for yourself, or delete it for everyone. Delete for everyone only works on your own messages while the chat is still open.",
      },
      {
        keywords: "tim teknis, technical team, diteruskan ke teknis, eskalasi teknis, passed to technical team, bug diteruskan",
        jawaban:
          "Jika masalah Anda bersifat teknis, petugas support dapat meminta bantuan tim teknis. Anda tetap hanya berkomunikasi dengan petugas support yang sama; solusi dari tim teknis disampaikan olehnya.\n\nEnglish: If your problem is technical, the support agent may bring in our technical team. You keep chatting with the same support agent, who passes on the technical team's solution.",
      },
    ],
  },
  {
    nama: "Profile & settings",
    defaultPriority: "LOW",
    entries: [
      {
        keywords: "ganti email, ubah email, email baru, change email, update email, change my email address",
        jawaban:
          "Buka halaman Profile lalu ubah email. Prosesnya dua langkah: kode dikirim ke email lama untuk membuktikan Anda pemiliknya, lalu kode kedua dikirim ke email baru. Setiap kode berlaku 10 menit.\n\nEnglish: Open the Profile page and change your email. It takes two steps: a code is sent to your old email to prove it's you, then a second code goes to the new email. Each code is valid for 10 minutes.",
      },
      {
        keywords: "foto profil, ganti foto, ubah avatar, profile picture, upload avatar, change profile photo",
        jawaban:
          "Unggah foto dari halaman Profile. Ukuran maksimal 2 MB dan foto otomatis diperkecil. Tanpa foto, aplikasi menampilkan inisial nama Anda.\n\nEnglish: Upload a photo from the Profile page. Maximum 2 MB, and the photo is resized automatically. Without a photo the app shows your initials.",
      },
      {
        keywords: "warna tema, ganti warna, tema aplikasi, ganti tampilan, theme color, change theme, change color, app colour",
        jawaban:
          "Pilih warna tema dari halaman Profile. Pilihan disimpan di akun Anda, jadi tampil sama di perangkat atau browser mana pun.\n\nEnglish: Pick a theme colour on the Profile page. It's saved to your account, so it looks the same on any device or browser.",
      },
    ],
  },
  {
    nama: "Bug / technical error",
    defaultPriority: "HIGH",
    entries: [
      {
        keywords:
          "halaman kosong, halaman tidak termuat, loading terus, tidak mau loading, aplikasi lambat, blank page, page not loading, stuck loading, app slow",
        jawaban:
          "Coba muat ulang paksa (Ctrl+F5 / Cmd+Shift+R), hapus cache browser, atau buka di browser lain dan periksa koneksi internet. Jika masih sama, tekan \"Talk to a support agent\" dan sertakan screenshot beserta nama browser Anda.\n\nEnglish: Try a hard refresh (Ctrl+F5 / Cmd+Shift+R), clear the browser cache, or open it in another browser and check your connection. If it still happens, press \"Talk to a support agent\" and include a screenshot and your browser name.",
      },
      {
        keywords:
          "chat tidak muncul, pesan tidak masuk, chat tidak update, koneksi terputus, messages not showing, chat not updating, connection lost, live indicator",
        jawaban:
          "Indikator Live di kepala chat menandakan koneksi aktif. Jika terputus, chat menyambung ulang otomatis. Bila pesan tetap tidak muncul, muat ulang halaman, periksa internet, dan matikan VPN atau proxy yang mungkin memutus koneksi.\n\nEnglish: The Live indicator in the chat header shows an active connection. If it drops, the chat reconnects automatically. If messages still don't show, reload the page, check your internet, and turn off any VPN or proxy that may cut the connection.",
      },
      {
        keywords:
          "cara melaporkan bug, laporkan masalah, langkah mereproduksi, informasi yang dibutuhkan, report a bug, steps to reproduce, what to include, bug report",
        jawaban:
          "Laporan yang mudah ditangani memuat: nama aplikasi dan platform, langkah-langkah sampai masalah muncul, hasil yang diharapkan vs yang terjadi, pesan error persis, serta screenshot atau video. Tambahkan di deskripsi tiket atau chat.\n\nEnglish: A report that's easy to act on includes: the app name and platform, the steps leading to the problem, expected vs actual result, the exact error message, and a screenshot or video. Add them to the ticket description or chat.",
      },
      {
        keywords:
          "error 500, internal server error, server error, 500 error, halaman error 500",
        jawaban:
          "Error 500 berarti ada masalah di sisi server, bukan di perangkat Anda. Tunggu beberapa menit lalu coba lagi. Jika terus muncul, tekan \"Talk to a support agent\" dan sertakan URL halaman serta waktu kejadian agar tim teknis bisa menelusurinya.\n\nEnglish: A 500 error means something went wrong on the server side, not on your device. Wait a few minutes and try again. If it persists, press \"Talk to a support agent\" and include the page URL and the time it happened so our technical team can investigate.",
      },
      {
        keywords:
          "error 404, halaman tidak ditemukan, page not found, 404 error, 404 not found",
        jawaban:
          "Error 404 berarti halaman yang dituju tidak ada. Cek kembali URL-nya. Jika Anda mengikuti tautan dari dalam aplikasi dan tetap 404, muat ulang halaman utama lalu navigasikan dari menu. Bila masih muncul, buat tiket baru dan sertakan URL lengkapnya.\n\nEnglish: A 404 error means the page doesn't exist. Double-check the URL. If you followed a link inside the app and still get a 404, reload the homepage and navigate from the menu. If it persists, open a new ticket and include the full URL.",
      },
      {
        keywords:
          "error 403, akses ditolak, access denied, forbidden, 403 error, tidak punya akses, permission denied",
        jawaban:
          "Error 403 berarti Anda tidak punya izin untuk halaman/fitur tersebut. Pastikan Anda login dengan akun yang benar dan akun tersebut aktif. Jika merasa seharusnya bisa mengakses, hubungi Admin organisasi Anda untuk memeriksa peran akun.\n\nEnglish: A 403 error means you don't have permission for that page or feature. Make sure you're logged in with the correct account and that it's active. If you believe you should have access, contact your organisation's Admin to check your account role.",
      },
      {
        keywords:
          "logout otomatis, sesi habis, session expired, tiba tiba logout, automatically logged out, token expired, sesi berakhir",
        jawaban:
          "Sesi login berlaku untuk jangka waktu tertentu demi keamanan. Jika Anda sering logout otomatis, pastikan browser tidak memblokir cookie, tidak dalam mode incognito, dan koneksi internet stabil. Login kembali seperti biasa.\n\nEnglish: Login sessions expire after a set period for security. If you're frequently logged out, make sure your browser isn't blocking cookies, you're not in incognito mode, and your internet connection is stable. Just log in again normally.",
      },
      {
        keywords:
          "notifikasi tidak muncul, notifikasi tidak ada, notification not showing, no notification, pemberitahuan tidak muncul, alert not working",
        jawaban:
          "Notifikasi muncul di dalam aplikasi (bukan push notification ke handphone). Pastikan Anda sudah login dan muat ulang halaman. Notifikasi terkait SLA hanya muncul untuk petugas, bukan untuk client.\n\nEnglish: Notifications appear inside the app (not as phone push notifications). Make sure you're logged in and reload the page. SLA-related notifications only appear for agents, not for clients.",
      },
      {
        keywords:
          "tampilan rusak, layout berantakan, tampilan aneh, display broken, layout broken, css rusak, ui rusak, tampilan tidak rapi, render issue",
        jawaban:
          "Coba bersihkan cache browser (Ctrl+Shift+Delete), lalu muat ulang paksa (Ctrl+F5). Jika masih rusak, coba browser lain (Chrome, Firefox, Edge). Sertakan screenshot dan nama browser + versinya saat membuat tiket.\n\nEnglish: Try clearing your browser cache (Ctrl+Shift+Delete), then hard refresh (Ctrl+F5). If still broken, try a different browser (Chrome, Firefox, Edge). Include a screenshot and your browser name + version when creating a ticket.",
      },
    ],
  },
  {
    nama: "Networking & connectivity",
    defaultPriority: "MEDIUM",
    entries: [
      {
        keywords:
          "internet lambat, koneksi lambat, lambat, slow connection, slow internet, connection slow, akses lambat, response lambat",
        jawaban:
          "Jika aplikasi terasa lambat, cek kecepatan internet Anda di speedtest.net. Koneksi minimal 1 Mbps disarankan. Coba juga matikan VPN, tutup tab browser yang tidak dipakai, atau pindah ke jaringan lain (misalnya dari WiFi ke data seluler).\n\nEnglish: If the app feels slow, check your internet speed at speedtest.net. At least 1 Mbps is recommended. Also try turning off your VPN, closing unused browser tabs, or switching to another network (e.g. from WiFi to mobile data).",
      },
      {
        keywords:
          "tidak bisa akses, tidak bisa buka, cannot access, can't access, website down, situs down, server down, server mati, website tidak bisa dibuka",
        jawaban:
          "Pastikan internet Anda berjalan (coba buka situs lain). Jika hanya aplikasi ini yang tidak bisa diakses, mungkin sedang dalam pemeliharaan. Tunggu beberapa menit dan coba lagi. Jika lewat 30 menit masih tidak bisa, hubungi petugas support lewat jalur lain (misalnya email).\n\nEnglish: Make sure your internet is working (try opening another site). If only this app is unreachable, it might be under maintenance. Wait a few minutes and try again. If it's still down after 30 minutes, contact support through an alternative channel (e.g. email).",
      },
      {
        keywords:
          "timeout, request timeout, koneksi timeout, connection timeout, waktu habis, timed out",
        jawaban:
          "Timeout biasanya disebabkan koneksi internet yang tidak stabil atau server yang sedang sibuk. Coba muat ulang halaman dan pastikan koneksi internet lancar. Jika sering terjadi, sertakan detail waktu dan halaman yang timeout saat membuat tiket.\n\nEnglish: Timeouts are usually caused by an unstable internet connection or a busy server. Try reloading the page and check that your internet is working well. If it happens often, include the time and the page that timed out when creating a ticket.",
      },
    ],
  },
  {
    nama: "Security & privacy",
    defaultPriority: "HIGH",
    entries: [
      {
        keywords:
          "akun diretas, akun dihack, account hacked, someone accessed my account, akses tidak sah, unauthorized access, akun dibobol",
        jawaban:
          "Segera ganti password Anda lewat \"Forgot password\" di halaman login. Jika tidak bisa login, tekan \"Talk to a support agent\" dari akun lain atau hubungi Admin organisasi Anda agar menonaktifkan akun yang dicurigai. Jangan bagikan password kepada siapa pun.\n\nEnglish: Immediately change your password via \"Forgot password\" on the login page. If you can't log in, press \"Talk to a support agent\" from another account or contact your organisation's Admin to deactivate the suspected account. Never share your password with anyone.",
      },
      {
        keywords:
          "data pribadi, privasi data, data privacy, personal data, keamanan data, data aman, data security, is my data safe",
        jawaban:
          "Password Anda disimpan dalam bentuk hash (tidak bisa dibaca balik). Sesi login diamankan dengan token terenkripsi. Hanya Anda yang bisa melihat tiket Anda sendiri; petugas hanya melihat tiket yang ditugaskan kepada mereka. Untuk pertanyaan lebih lanjut tentang kebijakan privasi, hubungi Admin.\n\nEnglish: Your password is stored as a hash (it can't be read back). Login sessions are secured with encrypted tokens. Only you can see your own tickets; agents only see tickets assigned to them. For further questions about privacy policy, contact your Admin.",
      },
      {
        keywords:
          "phishing, email mencurigakan, suspicious email, email palsu, fake email, penipuan email, scam email",
        jawaban:
          "Kami tidak pernah meminta password atau informasi sensitif lewat email selain tautan reset password resmi. Jika menerima email mencurigakan yang mengaku dari KelolaSupport, jangan klik tautannya. Laporkan ke Admin dan periksa alamat pengirimnya.\n\nEnglish: We never ask for passwords or sensitive information via email, except through the official password reset link. If you receive a suspicious email claiming to be from KelolaSupport, don't click its links. Report it to your Admin and check the sender's address.",
      },
      {
        keywords:
          "two factor, 2fa, autentikasi dua faktor, two factor authentication, verifikasi dua langkah, two step verification, mfa",
        jawaban:
          "Saat ini KelolaSupport menggunakan verifikasi kode OTP via email untuk pendaftaran dan perubahan email. Fitur 2FA tambahan (seperti authenticator app) belum tersedia. Pastikan email Anda aman karena digunakan untuk verifikasi.\n\nEnglish: Currently KelolaSupport uses email OTP verification for registration and email changes. Additional 2FA features (like an authenticator app) are not yet available. Make sure your email account is secure since it's used for verification.",
      },
    ],
  },
  {
    nama: "Mobile & browser compatibility",
    defaultPriority: "MEDIUM",
    entries: [
      {
        keywords:
          "browser yang didukung, browser apa, supported browsers, which browser, rekomendasi browser, browser terbaik, browser recommended",
        jawaban:
          "Gunakan browser modern versi terbaru: Google Chrome, Mozilla Firefox, Microsoft Edge, atau Safari. Browser lama atau tidak umum mungkin menampilkan halaman dengan tidak sempurna. Pastikan JavaScript diaktifkan.\n\nEnglish: Use the latest version of a modern browser: Google Chrome, Mozilla Firefox, Microsoft Edge or Safari. Older or uncommon browsers may not display pages correctly. Make sure JavaScript is enabled.",
      },
      {
        keywords:
          "buka di hp, akses di hp, mobile, buka di handphone, akses di handphone, mobile browser, responsive, tampilan hp, tampilan mobile",
        jawaban:
          "KelolaSupport bisa diakses dari browser handphone (Chrome, Safari, dll). Tidak perlu install aplikasi khusus. Jika tampilan terlalu kecil, pastikan tidak dalam mode desktop di browser HP. Putar layar ke landscape jika tabel terlihat terpotong.\n\nEnglish: KelolaSupport can be accessed from a phone browser (Chrome, Safari, etc.). No special app needs to be installed. If the display is too small, make sure you're not in desktop mode on your phone browser. Rotate to landscape if tables look cut off.",
      },
      {
        keywords:
          "cache browser, hapus cache, clear cache, clear browser data, bersihkan cache, cara hapus cache",
        jawaban:
          "Untuk menghapus cache: Chrome/Edge: Ctrl+Shift+Delete > pilih \"Cached images and files\" > hapus. Firefox: Ctrl+Shift+Delete > pilih \"Cache\" > hapus. Safari: Develop > Empty Caches. Setelah itu muat ulang halaman (Ctrl+F5).\n\nEnglish: To clear cache: Chrome/Edge: Ctrl+Shift+Delete > select \"Cached images and files\" > clear. Firefox: Ctrl+Shift+Delete > select \"Cache\" > clear. Safari: Develop > Empty Caches. Then hard-reload the page (Ctrl+F5).",
      },
    ],
  },
  {
    nama: "Greetings & general conversation",
    defaultPriority: "LOW",
    entries: [
      {
        keywords:
          "halo, hai, hi, hello, hey, selamat pagi, selamat siang, selamat sore, selamat malam, good morning, good afternoon, good evening",
        jawaban:
          "Halo! Ada yang bisa saya bantu? Silakan jelaskan masalah atau pertanyaan Anda, dan saya akan berusaha membantu.\n\nEnglish: Hello! How can I help you? Please describe your problem or question and I'll do my best to assist.",
      },
      {
        keywords:
          "terima kasih, makasih, thanks, thank you, thx, ty, appreciate, terimakasih",
        jawaban:
          "Sama-sama! Senang bisa membantu. Jika ada pertanyaan lain, jangan ragu untuk bertanya.\n\nEnglish: You're welcome! Happy to help. If you have any other questions, don't hesitate to ask.",
      },
      {
        keywords:
          "siapa kamu, kamu siapa, kamu bot, apakah kamu bot, are you a bot, who are you, are you human, apakah kamu manusia, kamu ai",
        jawaban:
          "Saya adalah asisten virtual KelolaSupport. Saya membantu menjawab pertanyaan umum berdasarkan basis pengetahuan kami. Jika masalah Anda membutuhkan penanganan manusia, tekan \"Talk to a support agent\" dan petugas kami akan membantu.\n\nEnglish: I'm KelolaSupport's virtual assistant. I help answer common questions based on our knowledge base. If your problem needs human attention, press \"Talk to a support agent\" and our team will help.",
      },
      {
        keywords:
          "bisa bahasa apa, bahasa apa, what language, language support, apakah bisa bahasa inggris, do you speak indonesian",
        jawaban:
          "Saya bisa membalas dalam Bahasa Indonesia dan English. Saya akan menyesuaikan bahasa balasan dengan bahasa yang Anda gunakan.\n\nEnglish: I can reply in Bahasa Indonesia and English. I'll match my reply language to the language you write in.",
      },
      {
        keywords:
          "jam operasional, jam kerja, jam buka, working hours, business hours, operating hours, kapan buka, office hours",
        jawaban:
          "Asisten virtual (bot) ini tersedia 24/7. Untuk petugas manusia, mereka bekerja dalam shift (Pagi, Siang, Malam). Jika tidak ada petugas yang sedang online, tiket Anda tetap di antrean dan diambil begitu ada petugas yang masuk shift.\n\nEnglish: This virtual assistant (bot) is available 24/7. Human agents work in shifts (Morning, Afternoon, Night). If no agent is currently online, your ticket stays in the queue and will be picked up as soon as an agent starts their shift.",
      },
      {
        keywords:
          "ada promo, diskon, harga, pricing, price, berapa biaya, how much, subscription, berlangganan, paket harga",
        jawaban:
          "Maaf, saya tidak memiliki informasi tentang harga atau promo. Silakan hubungi Admin atau tim penjualan organisasi Anda untuk pertanyaan seputar biaya dan langganan.\n\nEnglish: Sorry, I don't have information about pricing or promotions. Please contact your Admin or your organisation's sales team for questions about costs and subscriptions.",
      },
    ],
  },
  {
    nama: "Admin & management features",
    defaultPriority: "LOW",
    entries: [
      {
        keywords:
          "cara kelola user, kelola pengguna, manage users, user management, tambah pengguna, add user, buat akun petugas",
        jawaban:
          "Masuk sebagai Admin, buka menu Petugas atau Admins. Klik tombol tambah, isi nama, email, dan password. Akun petugas (L1/L2) dan Admin hanya bisa dibuat oleh Admin, tidak bisa mendaftar sendiri. Akun bisa dinonaktifkan jika tidak diperlukan lagi.\n\nEnglish: Log in as Admin, open the Petugas or Admins menu. Click the add button, fill in name, email and password. Agent (L1/L2) and Admin accounts can only be created by an Admin, they cannot self-register. Accounts can be deactivated when no longer needed.",
      },
      {
        keywords:
          "cara kelola kategori, kelola kategori, manage categories, tambah kategori, buat kategori, category management, edit kategori, hapus kategori",
        jawaban:
          "Admin bisa mengelola kategori tiket dari menu Categories. Setiap kategori punya default priority yang otomatis diterapkan. Nama kategori harus unik. Kategori yang sudah dipakai tiket tidak bisa dihapus.\n\nEnglish: Admins can manage ticket categories from the Categories menu. Each category has a default priority that's applied automatically. Category names must be unique. Categories already used by tickets cannot be deleted.",
      },
      {
        keywords:
          "sla, target sla, atur sla, configure sla, sla config, sla setting, service level agreement, sla target",
        jawaban:
          "Admin mengatur target SLA dari menu SLA. Targetnya berdasarkan priority (bukan kategori): waktu respon pertama dan waktu penyelesaian dalam menit. SLA hanya mengukur kinerja petugas; tiket yang diselesaikan oleh bot tidak dihitung.\n\nEnglish: Admins set SLA targets from the SLA menu. Targets are per priority (not per category): first response time and resolution time in minutes. SLA only measures agent performance; tickets resolved by the bot are excluded.",
      },
      {
        keywords:
          "cara kelola shift, kelola shift, manage shifts, jadwal shift, shift schedule, atur shift, buat jadwal shift, generate shift",
        jawaban:
          "Admin bisa membuat shift individu dari menu Shifts, atau generate jadwal otomatis untuk semua petugas. Tiap shift memiliki tipe (Pagi/Siang/Malam), tanggal berlaku, dan jam mulai/selesai. Petugas melihat shift mereka di dashboard.\n\nEnglish: Admins can create individual shifts from the Shifts menu, or auto-generate schedules for all agents. Each shift has a type (Pagi/Siang/Malam), effective date, and start/end time. Agents see their shifts on their dashboard.",
      },
      {
        keywords:
          "audit log, log aktivitas, activity log, riwayat aktivitas, history log, jejak audit, siapa mengubah, who changed",
        jawaban:
          "Setiap aksi penting (login, buat/ubah/hapus user, perubahan tiket, export laporan) dicatat di Audit Log. Admin bisa melihatnya di menu Audit Log. Log bersifat read-only dan tidak bisa dihapus atau diedit oleh siapa pun.\n\nEnglish: Every important action (login, create/update/delete user, ticket changes, report export) is recorded in the Audit Log. Admins can view it from the Audit Log menu. Logs are read-only and cannot be deleted or edited by anyone.",
      },
      {
        keywords:
          "laporan, report, export laporan, export report, download laporan, download report, export csv, unduh laporan",
        jawaban:
          "Admin bisa melihat laporan tiket dari menu Reports. Laporan bisa difilter berdasarkan tanggal, status, priority, kategori, level, dan petugas. Data bisa di-export ke CSV. Angka rata-rata respon dan penyelesaian juga ditampilkan.\n\nEnglish: Admins can view ticket reports from the Reports menu. Reports can be filtered by date, status, priority, category, level and agent. Data can be exported to CSV. Average response and resolution times are also displayed.",
      },
      {
        keywords:
          "kelola faq, manage faq, tambah faq, edit faq, hapus faq, faq management, basis pengetahuan, knowledge base",
        jawaban:
          "Admin mengelola FAQ dari menu FAQ. Setiap entri punya kata kunci (dipisah koma) dan jawaban. Bot menggunakan kata kunci ini untuk mencocokkan pertanyaan client. Frasa 2+ kata lebih akurat daripada kata tunggal. Jawaban sebaiknya dwibahasa (ID/EN).\n\nEnglish: Admins manage FAQ from the FAQ menu. Each entry has keywords (comma-separated) and an answer. The bot uses these keywords to match client questions. Phrases of 2+ words are more accurate than single words. Answers should ideally be bilingual (ID/EN).",
      },
      {
        keywords:
          "kelola aplikasi, manage application, tambah aplikasi, application management, daftar aplikasi, app list, edit aplikasi, hapus aplikasi",
        jawaban:
          "Admin mengelola daftar aplikasi/produk dari menu Applications. Tiap aplikasi bisa dikaitkan dengan satu atau lebih platform (Web, Android, iOS, Desktop, Other). Client memilih aplikasi dan platform saat mengajukan tiket.\n\nEnglish: Admins manage the list of applications/products from the Applications menu. Each application can be linked to one or more platforms (Web, Android, iOS, Desktop, Other). Clients choose an application and platform when submitting a ticket.",
      },
    ],
  },
  {
    nama: "Troubleshooting common issues",
    defaultPriority: "MEDIUM",
    entries: [
      {
        keywords:
          "lupa email, tidak ingat email, forgot email, forgot my email, don't remember email, email apa yang saya pakai",
        jawaban:
          "Coba periksa kotak masuk email-email Anda untuk pesan dari KelolaSupport (misalnya email verifikasi saat mendaftar). Jika tetap tidak ingat, hubungi Admin organisasi Anda karena mereka bisa melihat daftar akun terdaftar.\n\nEnglish: Try checking the inboxes of your email accounts for messages from KelolaSupport (e.g. the verification email from registration). If you still can't remember, contact your organisation's Admin as they can see the list of registered accounts.",
      },
      {
        keywords:
          "password salah, wrong password, incorrect password, login gagal, login failed, tidak bisa login, can't login, cannot login, gagal masuk",
        jawaban:
          "Pastikan Caps Lock tidak aktif dan email diketik dengan benar (huruf kecil). Jika tetap gagal, gunakan \"Forgot password\" untuk membuat password baru. Akun yang dinonaktifkan juga tidak bisa login; hubungi Admin jika perlu.\n\nEnglish: Make sure Caps Lock is off and the email is typed correctly (lowercase). If it still fails, use \"Forgot password\" to create a new password. Deactivated accounts also can't log in; contact your Admin if needed.",
      },
      {
        keywords:
          "tombol tidak berfungsi, tombol tidak bekerja, button not working, button doesn't work, klik tidak respon, click not responding, tombol error",
        jawaban:
          "Coba muat ulang halaman (F5 atau Ctrl+R). Jika tetap tidak berfungsi, bersihkan cache browser dan coba browser lain. Pastikan JavaScript diaktifkan. Jika masih bermasalah, buat tiket dan sertakan screenshot tombol mana yang tidak berfungsi.\n\nEnglish: Try reloading the page (F5 or Ctrl+R). If it still doesn't work, clear the browser cache and try a different browser. Make sure JavaScript is enabled. If the issue persists, create a ticket and include a screenshot of which button isn't working.",
      },
      {
        keywords:
          "editor tidak muncul, editor error, editor rusak, editor not loading, editor broken, ckeditor error, rich text editor error, text editor not working",
        jawaban:
          "Editor teks (untuk deskripsi tiket) membutuhkan JavaScript dan browser modern. Jika tidak muncul, matikan pemblokir iklan (ad blocker) atau ekstensi browser yang mungkin mengganggu, lalu muat ulang halaman. Coba juga di browser lain.\n\nEnglish: The text editor (for ticket descriptions) requires JavaScript and a modern browser. If it doesn't load, disable any ad blockers or browser extensions that might interfere, then reload the page. Also try a different browser.",
      },
      {
        keywords:
          "gambar tidak muncul, gambar rusak, image not loading, image broken, gambar tidak tampil, broken image, foto tidak muncul",
        jawaban:
          "Jika gambar di deskripsi tiket atau chat tidak muncul, coba muat ulang halaman. Pastikan koneksi internet stabil. Jika gambar Anda sendiri yang gagal terunggah, pastikan ukurannya di bawah 10 MB dan formatnya JPG, PNG, GIF, atau WebP.\n\nEnglish: If images in a ticket description or chat don't appear, try reloading the page. Make sure your internet connection is stable. If your own image failed to upload, ensure it's under 10 MB and in JPG, PNG, GIF or WebP format.",
      },
      {
        keywords:
          "email tidak masuk, email tidak diterima, email not received, didn't get email, email tidak terkirim, email not sent, tidak dapat email",
        jawaban:
          "Periksa folder spam/junk di email Anda. Pastikan alamat email yang terdaftar benar. Email (OTP, reset password) dikirim secara otomatis dan mungkin butuh 1-2 menit. Jika tetap tidak masuk setelah beberapa menit, coba kirim ulang atau gunakan email lain.\n\nEnglish: Check your spam/junk folder. Make sure the registered email address is correct. Emails (OTP, password reset) are sent automatically and may take 1-2 minutes. If it still doesn't arrive after a few minutes, try resending or use a different email.",
      },
    ],
  },
  {
    nama: "Feature requests & feedback",
    defaultPriority: "LOW",
    entries: [
      {
        keywords:
          "saran fitur, usul fitur, request fitur, feature request, saran perbaikan, suggest feature, new feature, ide fitur, fitur baru",
        jawaban:
          "Terima kasih atas saran Anda! Untuk mengusulkan fitur baru, buat tiket dengan judul yang jelas (misalnya \"Saran: [nama fitur]\") dan jelaskan apa yang diinginkan serta manfaatnya. Tim kami akan meninjau dan mempertimbangkannya.\n\nEnglish: Thanks for your suggestion! To propose a new feature, create a ticket with a clear title (e.g. \"Suggestion: [feature name]\") and explain what you want and why it would be useful. Our team will review and consider it.",
      },
      {
        keywords:
          "keluhan, komplain, complaint, kecewa, dissatisfied, tidak puas, unhappy, pelayanan buruk, bad service, poor service",
        jawaban:
          "Kami mohon maaf atas ketidaknyamanannya. Silakan buat tiket baru atau tekan \"Talk to a support agent\" agar petugas kami bisa menangani keluhan Anda secara langsung. Sertakan detail masalahnya agar bisa ditindaklanjuti dengan cepat.\n\nEnglish: We apologize for the inconvenience. Please create a new ticket or press \"Talk to a support agent\" so our team can address your complaint directly. Include details about the problem so it can be followed up quickly.",
      },
      {
        keywords:
          "rating, penilaian, beri nilai, rate, give feedback, review, kasih bintang, survey kepuasan, satisfaction survey",
        jawaban:
          "Saat ini belum ada fitur rating atau survey kepuasan di dalam aplikasi. Jika ingin memberikan masukan tentang pengalaman Anda, silakan sampaikan di chat ini atau buat tiket baru.\n\nEnglish: There is currently no rating or satisfaction survey feature in the app. If you'd like to give feedback about your experience, feel free to share it in this chat or create a new ticket.",
      },
    ],
  },
  {
    nama: "Common tasks & how-to",
    defaultPriority: "LOW",
    entries: [
      {
        keywords:
          "cara melihat tiket, lihat tiket saya, cek tiket, check ticket, view my tickets, my tickets, daftar tiket saya, tiket saya dimana",
        jawaban:
          "Buka menu \"My tickets\" setelah login. Di sana terlihat semua tiket Anda beserta statusnya. Klik tiket untuk membuka detail dan melanjutkan percakapan.\n\nEnglish: Open \"My tickets\" after logging in. You'll see all your tickets and their statuses. Click a ticket to view its details and continue the conversation.",
      },
      {
        keywords:
          "cara cari tiket, cari tiket, search ticket, filter tiket, find ticket, filter tickets, pencarian tiket",
        jawaban:
          "Di halaman tiket, gunakan kotak pencarian untuk mencari berdasarkan judul, nama client, atau email. Anda juga bisa memfilter berdasarkan status, priority, dan lainnya (untuk Admin).\n\nEnglish: On the tickets page, use the search box to search by title, client name or email. You can also filter by status, priority and more (for Admins).",
      },
      {
        keywords:
          "cara forward pesan, forward message, teruskan pesan, forward chat, kirim ulang pesan, resend message, meneruskan pesan",
        jawaban:
          "Petugas bisa meneruskan pesan dari Internal Notes ke Public chat (dan sebaliknya) menggunakan menu pada pesan. Ini berguna saat L1 ingin menyampaikan info dari L2 ke client. Pesan yang diteruskan ditandai sebagai \"forwarded\".\n\nEnglish: Agents can forward messages from Internal Notes to Public chat (and vice versa) using the message menu. This is useful when L1 wants to pass information from L2 to the client. Forwarded messages are marked as \"forwarded\".",
      },
      {
        keywords:
          "cara eskalasi, eskalasi tiket, escalate ticket, escalate to l2, kirim ke l2, pindah ke l2, forward to technical",
        jawaban:
          "Hanya petugas L1 yang bisa mengeskalasi tiket ke L2. Di halaman tiket yang sedang ditangani, klik \"Escalate to L2\" dan isi catatan eskalasi. Tab Internal Notes akan terbuka untuk komunikasi dengan L2. Client tetap berkomunikasi dengan L1.\n\nEnglish: Only L1 agents can escalate a ticket to L2. On the ticket page you're handling, click \"Escalate to L2\" and fill in the escalation note. The Internal Notes tab opens for communication with L2. The client keeps talking to L1.",
      },
      {
        keywords:
          "cara ambil tiket, take ticket, claim ticket, ambil dari antrean, pick up ticket, take from queue, klaim tiket",
        jawaban:
          "Buka tab Queue di halaman Tickets. Tiket yang belum diambil bisa diklaim dengan menekan \"Take ticket\". Setelah diambil, status berubah dan tiket ditugaskan kepada Anda. Anda bisa mulai membalas di chat.\n\nEnglish: Open the Queue tab on the Tickets page. Unclaimed tickets can be taken by pressing \"Take ticket\". Once taken, the status changes and the ticket is assigned to you. You can start replying in the chat.",
      },
      {
        keywords:
          "cara selesaikan tiket, resolve tiket, selesaikan tiket, mark resolved, close ticket, tutup tiket, tandai selesai",
        jawaban:
          "Hanya petugas L1 pemegang tiket yang bisa menandai tiket sebagai Resolved. Klik tombol \"Resolve\" di halaman tiket setelah masalah terselesaikan. Setelah resolved, chat menjadi read-only. Client bisa membuat tiket baru jika masalah muncul lagi.\n\nEnglish: Only the L1 agent assigned to the ticket can mark it as Resolved. Click the \"Resolve\" button on the ticket page after the issue is fixed. Once resolved, the chat becomes read-only. Clients can open a new ticket if the problem returns.",
      },
    ],
  },
];

/** Tambahkan entri yang belum ada. Mengembalikan jumlah entri baru. Tidak pernah mengubah entri yang sudah ada. */
export async function seedFaqKnowledge(): Promise<number> {
  let added = 0;
  for (const group of FAQ_KNOWLEDGE) {
    const category = await prisma.category.upsert({
      where: { nama: group.nama },
      update: {},
      create: { nama: group.nama, defaultPriority: group.defaultPriority },
    });
    for (const entry of group.entries) {
      const exists = await prisma.faqEntry.findFirst({
        where: { categoryId: category.id, keywords: entry.keywords },
        select: { id: true },
      });
      if (exists) continue;
      await prisma.faqEntry.create({ data: { categoryId: category.id, ...entry } });
      added++;
    }
  }
  return added;
}
