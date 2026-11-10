RAJAWALI EVENT ORGANIZER — UPDATE FORM BUILDER

Tujuan
Halaman pendaftaran publik hanya menampilkan pertanyaan yang dibuat di Master Admin > Buat/Edit Event > Formulir Pendaftaran Dinamis.

File dalam paket
- event.js: pengganti file event.js pada root repository.

File lain sengaja tidak diubah. admin.js, admin-attendance.js, admin-exports.js, admin-registrant-actions.js, status.js, registrasi-ulang.js, skema database, dan Edge Functions tetap dipertahankan.

Konfigurasi tiap event melalui Form Builder
Buat pertanyaan inti ini. Gunakan label seperti di bawah agar dikenali sebagai komponen sistem:
1. Jenis Pendaftaran — tipe Dropdown — pilihan: Individu; Tim / Grup. Wajib dibuat bila Model Pendaftaran event = Individu dan Tim.
2. Nama Tim / Klub — tipe Jawaban singkat. Wajib bila event menerima pendaftaran Tim / Grup.
3. Nama Peserta — tipe Jawaban singkat.
4. Peran Peserta — tipe Dropdown — opsi sesuai kebutuhan, contoh: Atlet; Ketua Tim; Pelatih; Manajer Tim; Ofisial; Peserta.
5. Nomor WhatsApp Pendaftar — tipe Nomor telepon (atau Jawaban singkat).

Urutan pertanyaan inti dan pertanyaan tambahan dapat diatur dengan tombol naik/turun di Form Builder. Pertanyaan lain tetap disimpan ke custom_data seperti sebelumnya.

Aturan peserta
- Individu: satu peserta utama; peran pendamping (Pelatih, Coach, Manajer, Manager, Ofisial, Official, Pendamping atau Support) dapat ditambahkan secara opsional jika peran tersebut tersedia pada pilihan Peran Peserta.
- Tim/Grup: peserta dapat ditambahkan sampai 50 orang dan setiap orang memilih peran dari pilihan Form Builder.
- Setiap orang tetap dikirim dalam struktur participants [{name, role}] yang sudah digunakan oleh quick-responder agar penerbitan nomor peserta dan QR per orang tetap kompatibel.
- Payload quick-responder, alur token, pembayaran, persetujuan admin, status, dan kartu tidak diubah.

Langkah pemasangan aman
1. Unduh/cadangkan repository saat ini terlebih dahulu.
2. Di GitHub, buka file event.js pada repository Rajawali Event Organizer.
3. Ganti seluruh isi event.js dengan file event.js dari paket ini, lalu Commit.
4. Setelah GitHub Pages selesai memperbarui website, buka Master Admin dan edit setiap event yang sudah ada.
5. Tambahkan pertanyaan inti di atas ke Form Builder, simpan event, lalu uji pendaftaran pada event Draft atau event uji terlebih dahulu.
6. Uji individu, tim, tambahan pelatih/manajer, token, pengecekan status, persetujuan, unduh kartu PDF, dan QR registrasi ulang sebelum memakai untuk event aktif.

Penting
Koneksi GitHub yang digunakan saat menyiapkan paket ini hanya memiliki izin baca. Karena itu file ini belum di-commit atau dipublikasikan ke repository. Penggantian file dilakukan oleh pemilik repository.
