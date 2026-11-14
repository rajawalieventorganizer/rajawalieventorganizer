/* RAJAWALI EVENT ORGANIZER — PEMULIHAN KATA SANDI MASTER ADMIN
 * Membutuhkan supabase-config.js yang sudah dipakai aplikasi.
 * Otorisasi halaman ini hanya diberikan oleh event PASSWORD_RECOVERY Supabase.
 */
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("recovery-form");
    const passwordInput = document.getElementById("new-password");
    const confirmInput = document.getElementById("confirm-password");
    const button = document.getElementById("save-password");
    const message = document.getElementById("recovery-message");

    if (!form || !passwordInput || !confirmInput || !button || !message) return;

    const setState = (enabled, text, buttonText) => {
      passwordInput.disabled = !enabled;
      confirmInput.disabled = !enabled;
      button.disabled = !enabled;
      button.textContent = buttonText;
      message.textContent = text;
    };

    const auth = window.db?.auth;
    if (!auth) {
      setState(false,
        "Koneksi Supabase belum siap. Periksa supabase-config.js dan muat ulang halaman.",
        "Layanan Belum Siap");
      return;
    }

    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const authError = query.get("error_description") || query.get("error") ||
      hash.get("error_description") || hash.get("error");

    if (authError) {
      setState(false,
        "Tautan pemulihan ditolak atau sudah kedaluwarsa. Silakan minta tautan pemulihan yang baru.",
        "Tautan Tidak Valid");
      return;
    }

    let recoveryAuthorized = false;
    let finished = false;

    // PASSWORD_RECOVERY adalah bukti bahwa Supabase memvalidasi tautan pemulihan.
    // Pendekatan ini mendukung alur implicit maupun PKCE tanpa mengandalkan format URL tertentu.
    const { data: listener } = auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session?.user) {
        recoveryAuthorized = true;
        setState(true,
          "Tautan pemulihan berhasil diverifikasi. Silakan buat kata sandi baru.",
          "Simpan Kata Sandi Baru");
      }
    });

    try {
      // Memastikan Supabase menyelesaikan pembacaan URL / pertukaran kode PKCE.
      const { data, error } = await auth.getSession();
      if (error) throw error;

      // Fallback untuk URL PKCE (?code=...) maupun implicit (#type=recovery).
      // Sesi harus sudah berhasil dibuat oleh Supabase dan URL harus berasal dari alur pemulihan.
      const recoveryUrl = query.has("code") || hash.get("type") === "recovery";
      if (!recoveryAuthorized && data?.session?.user && recoveryUrl) {
        recoveryAuthorized = true;
        setState(true,
          "Tautan pemulihan berhasil diverifikasi. Silakan buat kata sandi baru.",
          "Simpan Kata Sandi Baru");
      }

      if (!recoveryAuthorized) {
        setState(false,
          "Sesi pemulihan tidak ditemukan atau tautan sudah kedaluwarsa. Kembali ke halaman lupa kata sandi untuk meminta tautan baru.",
          "Tautan Tidak Valid");
      }
    } catch (error) {
      console.error("Validasi sesi pemulihan gagal:", error);
      setState(false,
        "Sesi pemulihan tidak dapat diverifikasi. Silakan minta tautan pemulihan yang baru.",
        "Tautan Tidak Valid");
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!recoveryAuthorized || finished) {
        setState(false,
          "Sesi pemulihan tidak aktif. Silakan minta tautan pemulihan yang baru.",
          "Tautan Tidak Valid");
        return;
      }

      const password = passwordInput.value;
      const confirmation = confirmInput.value;

      if (password.length < 8) {
        message.textContent = "Kata sandi minimal 8 karakter.";
        passwordInput.focus();
        return;
      }
      if (password.length > 72) {
        message.textContent = "Kata sandi maksimal 72 karakter.";
        passwordInput.focus();
        return;
      }
      if (password !== confirmation) {
        message.textContent = "Kedua kata sandi belum sama.";
        confirmInput.focus();
        return;
      }

      button.disabled = true;
      passwordInput.disabled = true;
      confirmInput.disabled = true;
      button.textContent = "Menyimpan...";
      message.textContent = "Memperbarui kata sandi akun Supabase...";

      try {
        const { error } = await auth.updateUser({ password });
        if (error) throw error;

        finished = true;
        recoveryAuthorized = false;
        form.reset();
        try { await auth.signOut(); } catch (signOutError) {
          console.warn("Kata sandi sudah diperbarui; proses keluar otomatis tidak selesai:", signOutError);
        }

        // Hilangkan token / kode dari bilah alamat setelah proses selesai.
        window.history.replaceState({}, document.title, window.location.pathname);
        setState(false,
          "Kata sandi berhasil diperbarui. Silakan kembali ke halaman login admin dan masuk menggunakan kata sandi baru.",
          "Kata Sandi Tersimpan");
      } catch (error) {
        console.error("Pembaruan kata sandi gagal:", error);
        let stillValid = false;
        try {
          const { data } = await auth.getSession();
          stillValid = Boolean(data?.session && recoveryAuthorized && !finished);
        } catch (_) { /* sesi tidak dapat diverifikasi */ }

        setState(stillValid,
          stillValid
            ? "Kata sandi belum berhasil diperbarui. Pastikan memenuhi ketentuan layanan, lalu coba kembali."
            : "Sesi pemulihan sudah tidak aktif. Silakan minta tautan pemulihan yang baru.",
          stillValid ? "Coba Simpan Lagi" : "Tautan Tidak Valid");
      }
    });

    window.addEventListener("pagehide", () => {
      listener?.subscription?.unsubscribe?.();
    }, { once: true });
  });
})();
