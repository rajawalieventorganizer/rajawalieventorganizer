(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("forgot-form");
    const emailInput = document.getElementById("recovery-email");
    const button = document.getElementById("send-link");
    const message = document.getElementById("forgot-message");

    if (!form || !emailInput || !button || !message) return;

    if (!window.db?.auth) {
      message.textContent = "Koneksi layanan belum siap. Periksa supabase-config.js, lalu muat ulang halaman.";
      button.disabled = true;
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      message.textContent = "";

      const email = emailInput.value.trim();
      if (!email || !emailInput.checkValidity()) {
        message.textContent = "Masukkan alamat email dengan format yang benar.";
        emailInput.focus();
        return;
      }

      button.disabled = true;
      button.textContent = "Memproses...";

      try {
        const redirectTo = new URL("reset-password.html", window.location.href).href;
        const { error } = await window.db.auth.resetPasswordForEmail(email, { redirectTo });

        if (error) {
          console.error("Permintaan pemulihan Supabase gagal:", error);
          message.textContent = "Permintaan belum berhasil diproses. Periksa konfigurasi Redirect URLs dan layanan email Supabase, lalu coba kembali.";
          return;
        }

        // Pesan netral untuk tidak mengungkap apakah sebuah email terdaftar.
        message.textContent = "Permintaan diproses. Jika email tersebut terdaftar, tautan pemulihan akan dikirim. Periksa Kotak Masuk, Spam, atau Junk.";
        form.reset();
      } catch (error) {
        console.error("Kesalahan halaman pemulihan:", error);
        message.textContent = "Terjadi kendala saat menghubungi layanan. Periksa koneksi internet dan coba kembali.";
      } finally {
        button.disabled = false;
        button.textContent = "Kirim Tautan Pemulihan";
      }
    });
  });
})();
