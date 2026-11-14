document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("recovery-form");
  const message = document.getElementById("recovery-message");
  const saveButton = document.getElementById("save-password");
  const passwordInput = document.getElementById("new-password");
  const confirmInput = document.getElementById("confirm-password");

  if (!window.db) {
    message.textContent = "Layanan pemulihan belum siap. Muat ulang halaman beberapa saat lagi.";
    saveButton.disabled = true;
    return;
  }

  // Supabase JS membaca token pemulihan dari URL dan membentuk sesi sementara.
  const { data: { session }, error } = await db.auth.getSession();
  if (error || !session) {
    message.textContent = "Tautan pemulihan tidak valid atau sudah kedaluwarsa. Kembali ke halaman lupa password dan minta tautan baru.";
    saveButton.disabled = true;
    return;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const password = passwordInput.value;
    if (password.length < 8) {
      message.textContent = "Password minimal 8 karakter.";
      return;
    }
    if (password !== confirmInput.value) {
      message.textContent = "Kedua password belum sama.";
      confirmInput.focus();
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Menyimpan...";
    message.textContent = "Memperbarui password akun...";
    const { error: updateError } = await db.auth.updateUser({ password });

    if (updateError) {
      message.textContent = "Password belum berhasil diperbarui: " + updateError.message;
      saveButton.disabled = false;
      saveButton.textContent = "Simpan Password Baru";
      return;
    }

    await db.auth.signOut();
    form.reset();
    message.textContent = "Password berhasil diperbarui. Silakan kembali ke halaman login dan masuk menggunakan password baru.";
    saveButton.textContent = "Password Tersimpan";
  });
});
