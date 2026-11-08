RAJAWALI EVENT ORGANIZER — PAKET PERBAIKAN GITHUB

PENTING: Paket ini disusun mengikuti bentuk file di repository GitHub Anda yang terlihat pada screenshot: file HTML, style.css, dan file JavaScript berada langsung di halaman utama repository (root).

CARA MEMASANG:
1. Ekstrak ZIP ini.
2. Buka folder rajawali-github-siap-upload.
3. Pilih SEMUA ISI folder (jangan upload folder pembungkusnya).
4. Upload ke repository GitHub yang sama.
5. Pilih Commit changes dan setujui penggantian file lama.
6. Pastikan index.html, style.css, common.js, home.js, event.js, contact.js, status.js, admin.js, dan supabase-config.js tampil sejajar di root repository.
7. Pastikan folder supabase ikut ter-upload.
8. Buka ulang website. Jika masih tampilan lama, lakukan refresh atau hapus cache browser.

JANGAN menghapus logo-rajawali.jpg. File itu dipakai untuk logo dan watermark. Jika ingin mengganti logo kelak, gunakan nama file yang sama.

PENTING UNTUK SUPABASE:
Paket ini memperbaiki jalur CSS dan JavaScript agar sesuai dengan struktur root repository. Konfigurasi URL dan anon key Supabase Anda tetap perlu benar di supabase-config.js. File SQL schema.sql dan fungsi di supabase/functions perlu diterapkan ke project Supabase secara terpisah.
