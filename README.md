# RAJAWALI EVENT ORGANIZER

Paket website Rajawali Event Organizer untuk GitHub Pages. File HTML, CSS, dan JavaScript pada paket ini berada langsung di root repository.

## Isi paket
- `index.html` — beranda dan daftar event.
- `kontak.html` — kontak penyelenggara.
- `event.html?slug=...` — halaman event dinamis; tidak perlu membuat HTML baru untuk setiap event.
- `cek-status.html` — pengecekan token peserta dan unduh PDF kartu individual ber-QR setelah disetujui/verifikasi.
- `admin.html` — Master Admin untuk login, membuat/mengedit/mempublikasikan/menghapus event, membuat kolom formulir, mengelola pendaftar, dan identitas situs.
- `logo-rajawali.jpg` — logo utama. Header, favicon, footer, dan watermark menggunakan file ini.
- `supabase/schema.sql` — skema tabel, foreign key cascade, RLS, dan bucket Storage.
- `supabase/functions/` — fungsi pendaftaran, cek status, dan penghapusan event beserta file Storage.

## A. Siapkan Supabase
1. Buat project Supabase baru.
2. Buka SQL Editor dan jalankan seluruh isi `supabase/schema.sql`.
3. Buka Authentication > Users, buat akun admin.
4. Salin UUID user admin, lalu jalankan:
   ```sql
   insert into public.organizer_admins(user_id)
   values ('UUID-USER-ADMIN');
   ```
5. Ambil Project URL dan anon/public key di Project Settings > API.
6. Isi kedua nilai tersebut di `supabase-config.js`. Jangan pernah menaruh `service_role` key di file HTML/JavaScript publik.

## B. Deploy Edge Functions
Pasang Supabase CLI dan login. Dari folder proyek, tautkan project:
```bash
supabase login
supabase link --project-ref PROJECT_REF
supabase functions deploy register-event
supabase functions deploy check-status
supabase functions deploy delete-event
```
Pastikan secret bawaan fungsi tersedia: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY`. Pada project Supabase, secret service role hanya digunakan server-side oleh Edge Functions, bukan di browser.
`register-event` dan `check-status` menerima pengunjung tanpa login dan memvalidasi input di server. `delete-event` mewajibkan sesi admin.

## C. Upload ke GitHub Pages
Upload seluruh isi paket ini langsung ke root repository (bukan folder ZIP-nya). Aktifkan Settings > Pages > Deploy from a branch > `main` > `/ (root)`.
Gunakan HTTPS. Supabase Auth URL Configuration perlu diisi dengan URL GitHub Pages, misalnya:
- Site URL: `https://USERNAME.github.io`
- Redirect URLs: `https://USERNAME.github.io/REPOSITORY/**`

## D. Alur administrasi
1. Login di `admin.html` menggunakan akun admin yang telah ditambahkan ke `organizer_admins`.
2. Buat event, pilih tipe pendaftaran, gratis atau transfer manual, dan atur kolom formulir.
3. Simpan sebagai Draft atau Publikasikan.
4. Event berstatus Published otomatis tampil di agenda beranda, dan halaman detailnya menggunakan `event.html?slug=...`.
5. Pendaftar mendapat token `SMO-XXXX-000` untuk event gratis atau `SMO-XXXX-NNN` untuk event berbayar. Nilai pembayaran dihitung server: tarif sesuai dasar perhitungan yang dipilih admin (per formulir atau per peserta) + tiga digit token unik.
6. Admin mengecek mutasi secara manual, lalu menekan **Verifikasi Bayar** pada panel Pendaftar.
7. Untuk event yang memerlukan persetujuan admin, tekan **Setujui** setelah pembayaran terverifikasi. Event gratis juga dapat disetujui langsung.
8. Peserta memeriksa status dengan token melalui `cek-status.html`.

## E. Penghapusan event dan data Supabase
Tombol Hapus di Master Admin memanggil Edge Function `delete-event`, bukan sekadar menyembunyikan kartu di browser. Fungsi ini:
1. Memastikan pengguna login dan terdaftar sebagai admin.
2. Mengambil seluruh file yang tercatat di `event_assets`.
3. Menghapus file terkait dari Supabase Storage.
4. Menghapus record event. Foreign key `ON DELETE CASCADE` menghapus event_fields, event_menus, registrations, participants, dan event_assets dalam transaksi database.

Semua unggahan file event harus dicatat pada `event_assets` agar dapat ikut dibersihkan. Mekanisme penghapusan tidak menghapus akun admin atau pengaturan identitas global. Jika penghapusan file Storage gagal, fungsi akan berhenti dan event tidak akan dihapus agar admin dapat mencoba lagi.

## F. Mengganti logo
Ganti file `logo-rajawali.jpg` di folder utama dengan gambar baru dan gunakan nama file yang sama. Tidak perlu mengubah seluruh HTML. Jika file baru PNG, konversi ke JPG terlebih dahulu atau perbarui semua referensi file secara konsisten.

## Batas implementasi saat ini
- Website ini adalah frontend dan backend starter yang sudah disiapkan, tetapi **belum terhubung ke project Supabase Anda**. URL/key, schema, akun admin, dan Edge Functions harus disiapkan sesuai panduan di atas sebelum sistem online bisa menyimpan data.
- Kartu PDF individual ber-QR sederhana sudah tersedia setelah status pendaftaran disetujui dan pembayaran (bila berbayar) diverifikasi. Desain kartu dasar memakai logo utama; fitur foto peserta, pengaturan layout kartu, dan upload banyak dokumen belum disertakan.
- Gateway pembayaran belum digunakan. Pembayaran event berbayar memakai transfer manual. Admin dapat memilih biaya dihitung per formulir/tim atau per peserta. Pembayaran berbayar yang tersedia adalah transfer manual, sesuai keputusan sebelumnya.
- `event_assets` adalah daftar sumber file yang harus selalu dicatat supaya penghapusan event dapat membersihkan Storage.
