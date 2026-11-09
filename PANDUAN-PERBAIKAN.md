RAJAWALI EVENT ORGANIZER — PERBAIKAN KARTU DAN AKSI ADMIN

Isi paket ini adalah pembaruan atas paket rajawali-update sebelumnya.

1) GitHub Pages (folder utama repository)
- Ganti status.js dengan versi di paket ini.
- Ganti admin.html dengan versi di paket ini (script add-on baru sudah ditambahkan).
- Ganti registrasi-ulang.html dengan versi di paket ini.
- Tambahkan admin-registrant-actions.js yang baru ke folder utama repository.
- Jangan mengganti admin.js utama. Add-on admin dibuat terpisah untuk menjaga fungsi lama.

2) Supabase Edge Functions
- Buka Edge Functions > checkin-participant.
- Ganti index.ts dengan versi dalam supabase/functions/checkin-participant/index.ts, lalu Deploy ulang.
- check-status tidak perlu diubah untuk perbaikan ini.

3) Perubahan fitur
- status.js mencoba CDN cadangan untuk memuat jsPDF dan QRCode sebelum membuat kartu.
- Pemindai membedakan token pendaftaran dengan nomor peserta unik. QR pada setiap kartu tetap berisi participant_no.
- Panel Pendaftar mendapatkan tombol Batalkan Persetujuan dan Hapus Pendaftaran.
- Batalkan Persetujuan mengembalikan registration_status menjadi pending dan tidak mengubah payment_status.
- Hapus Pendaftaran menghapus registration; menurut schema.sql, data participants terkait terhapus dengan ON DELETE CASCADE, dan check-in peserta juga ikut terhapus sesuai migrasi.

4) Jangan unggah secret/service-role key ke GitHub.
5) Simpan backup repository dan database sebelum mengganti file.
