document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("forgot-form");
  const emailInput = document.getElementById("recovery-email");
  const button = document.getElementById("send-link");
  const message = document.getElementById("forgot-message");

  if (!window.db) {
    message.textContent = "Layanan pemulihan belum siap. Muat ulang halaman beberapa saat lagi.";
    button.disabled = true;
    return;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const email = emailInput.value.trim();
    if (!email || !emailInput.checkValidity()) {
      message.textContent = "Masukkan alamat email admin yang valid.";
      emailInput.focus();
      return;
    }

    button.disabled = true;
    button.textContent = "Mengirim...";
    const redirectTo = new URL("reset-password.html", window.location.href).href;
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo });

    button.disabled = false;
    button.textContent = "Kirim Tautan Pemulihan";
    message.textContent = error
      ? "Tautan belum dapat dikirim. Periksa pengaturan URL pemulihan dan layanan email Supabase."
      : "Jika email tersebut terdaftar, tautan pemulihan akan dikirim. Periksa kotak masuk dan folder spam.";
  });
});
