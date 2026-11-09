# Paket Pembaruan Rajawali Event Organizer

Pembaruan ini dirancang untuk menambahkan branding kartu peserta per event, sponsor tak terbatas, ekspor Excel/PDF, dan registrasi ulang QR tanpa menghapus atau mengganti `admin.js`, `event.js`, tabel pendaftaran, atau Edge Function pendaftaran `quick-responder` yang saat ini dipanggil oleh halaman event.

## 1. Backup terlebih dahulu

Sebelum memasang, unduh salinan repository dan ekspor skema/data Supabase. Jangan menghapus file lama.

## 2. Jalankan migrasi database

Buka Supabase Dashboard → SQL Editor, lalu jalankan seluruh isi:

`supabase/migrations/20261109_event_branding_and_checkin.sql`

Migrasi ini hanya menambahkan:
- `organizer_logo_url` dan `organizer_logo_path` ke `events`;
- tabel `event_sponsors` tanpa batas jumlah baris per event;
- tabel `participant_checkins` dengan aturan satu check-in berhasil per peserta.

Tabel lama tetap dipertahankan. Bucket Storage lama `event-assets` tetap digunakan. Logo yang diunggah dicatat di `event_assets` sehingga ikut dibersihkan oleh fungsi `delete-event` yang sudah ada.

## 3. Salin berkas ke repository GitHub Pages

Salin berkas berikut ke folder utama repository, menimpa hanya berkas yang namanya sama:
- `admin.html`
- `admin-branding.js`
- `admin-exports.js`
- `status.js`
- `registrasi-ulang.html`
- `registrasi-ulang.js`

Salin folder `supabase/` dari paket ini ke root repository. Jangan menimpa `schema.sql` lama atau file `index.ts` yang sudah ada di root.

## 4. Deploy Edge Function cek status

Buka Supabase → Edge Functions → `check-status` → `index.ts`. Ganti isi fungsi `check-status` dengan file:

`supabase/functions/check-status/index.ts`

Deploy ulang fungsi tersebut. Pastikan `verify_jwt = false` karena orang tua/peserta mengecek token tanpa login.

Fungsi ini memerlukan secret server Supabase: `SUPABASE_SECRET_KEYS` (JSON dengan properti `default` berisi secret key) atau `SUPABASE_SERVICE_ROLE_KEY`. Secret hanya disimpan di Edge Function Secrets, jangan di GitHub atau browser.

## 5. Buat Edge Function registrasi ulang QR

Buat Edge Function baru bernama `checkin-participant`, lalu pasang file:

`supabase/functions/checkin-participant/index.ts`

Deploy dengan `verify_jwt = true`. Fungsi hanya menerima sesi pengguna yang login dan lolos `is_organizer_admin()`. Jangan mengubah fungsi `quick-responder` yang saat ini menerima pendaftaran.

## 6. Cara menguji setelah deploy

1. Login ke Panel Admin.
2. Buat event uji coba. Upload satu logo Rajawali khusus event jika diperlukan, lalu pilih beberapa logo sponsor sekaligus.
3. Atur setiap sponsor ke posisi atas atau bawah. Simpan event. Untuk edit event, daftar sponsor yang tersimpan akan tampil dan posisinya dapat diubah atau dihapus.
4. Lakukan satu pendaftaran uji coba. Gunakan alur pembayaran/persetujuan seperti biasa.
5. Buka `cek-status.html`, masukkan token. Sebelum persyaratan penerbitan terpenuhi, tombol kartu tidak muncul.
6. Setelah disetujui dan pembayaran (jika berbayar) terverifikasi, peserta dapat melihat pratinjau atau mengunduh PDF. Setiap atlet dan pelatih memperoleh kartu terpisah. Area foto disediakan kosong untuk ditempel foto ukuran 3 × 4 cm.
7. Login sebagai admin, buka `registrasi-ulang.html`, lalu pindai QR kartu. Hasil pertama tercatat berhasil; scan kedua untuk peserta yang sama ditandai sudah registrasi ulang.
8. Panel Admin → Pendaftar menyediakan filter dan unduhan Excel/PDF. Setiap peserta mendapat baris tersendiri, dan laporan memuat status registrasi ulang.

## 7. Hal yang perlu diketahui

- Sponsor tidak dibatasi jumlahnya di database atau formulir unggahan. PDF menambah baris logo sesuai jumlah logo pada area atas/bawah; karena itu tinggi halaman kartu dapat bertambah ketika sponsor sangat banyak.
- QR Code kartu berisi `participant_no` unik, bukan token tim. Ini memungkinkan atlet dan pelatih diproses satu per satu.
- Area foto kartu sengaja kosong dan diberi garis panduan agar foto dapat ditempel secara manual.
- Registrasi ulang saat ini dibatasi untuk akun yang memiliki hak Admin Rajawali (`organizer_admins`). Sistem belum menambahkan role petugas terpisah.
- Ekspor membutuhkan koneksi internet saat pertama kali memuat pustaka SheetJS dan jsPDF dari CDN.
- Pembaruan kode ini tidak otomatis mengubah project Supabase atau repository. Berkas harus disalin dan Edge Functions/migrasi dipasang sesuai langkah di atas.
