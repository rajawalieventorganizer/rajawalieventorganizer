document.addEventListener("DOMContentLoaded", async () => {
  const authMessage = document.getElementById("checkin-auth-message");
  const area = document.getElementById("checkin-area");
  const resultBox = document.getElementById("checkin-result");
  const manualForm = document.getElementById("manual-checkin-form");
  const manualInput = document.getElementById("manual-participant-code");
  let scanner = null;
  let busy = false;

  function showResult(data, error) {
    resultBox.className = "reo-checkin-result " + (error ? "bad" : data.already_checked_in ? "warn" : "ok");
    if (error) {
      resultBox.innerHTML = "<h3>Registrasi ulang gagal</h3><p></p>";
      resultBox.querySelector("p").textContent = error;
      return;
    }
    const participant = data.participant || {};
    const heading = data.already_checked_in ? "Peserta sudah terdaftar ulang" : "Registrasi ulang berhasil";
    resultBox.innerHTML = "<h3></h3><p class=\"reo-checkin-name\"></p><p class=\"reo-checkin-role\"></p><p class=\"reo-checkin-team\"></p><p class=\"reo-checkin-no\"></p><p class=\"reo-checkin-time\"></p><p class=\"reo-checkin-message\"></p>";
    resultBox.querySelector("h3").textContent = heading;
    resultBox.querySelector(".reo-checkin-name").textContent = "Nama: " + (participant.full_name || "-");
    resultBox.querySelector(".reo-checkin-role").textContent = "Peran: " + (participant.participant_role || "Peserta");
    resultBox.querySelector(".reo-checkin-team").textContent = "Tim / Klub: " + (participant.team_name || "Individu");
    resultBox.querySelector(".reo-checkin-no").textContent = "Nomor peserta: " + (participant.participant_no || "-");
    resultBox.querySelector(".reo-checkin-time").textContent = data.checked_in_at ? "Waktu: " + new Date(data.checked_in_at).toLocaleString("id-ID") : "";
    resultBox.querySelector(".reo-checkin-message").textContent = data.message || "";
  }

  async function checkIn(code) {
    if (busy) return;
    const participantNo = String(code || "").trim().toUpperCase();
    if (!participantNo) return;
    if (!window.db) {
      showResult(null, "Supabase belum siap.");
      return;
    }
    busy = true;
    try {
      const { data, error } = await db.functions.invoke("checkin-participant", {
        body: { participant_no: participantNo },
      });
      if (error || !data || data.error) {
        let message = data?.error || error?.message || "QR tidak dapat diproses.";
        try {
          const response = error?.context?.clone ? error.context.clone() : error?.context;
          if (response?.json) {
            const body = await response.json();
            message = body?.error || body?.message || message;
          }
        } catch (_) { /* gunakan pesan awal */ }
        throw new Error(message);
      }
      showResult(data);
      manualInput.value = "";
    } catch (error) {
      showResult(null, error.message || "Registrasi ulang gagal.");
    } finally {
      busy = false;
    }
  }

  manualForm.addEventListener("submit", (event) => {
    event.preventDefault();
    checkIn(manualInput.value);
  });

  try {
    if (!window.db) throw new Error("Supabase belum dikonfigurasi.");
    const { data, error } = await db.auth.getUser();
    if (error || !data?.user) throw new Error("Anda belum login. Silakan login melalui Panel Admin terlebih dahulu.");
    const admin = await db.rpc("is_organizer_admin");
    if (admin.error || admin.data !== true) throw new Error("Akun ini tidak memiliki hak Petugas Registrasi Ulang.");
    authMessage.textContent = "Akses petugas terverifikasi. Kamera siap digunakan.";
    authMessage.className = "notice";
    area.classList.remove("hidden");

    if (window.Html5Qrcode) {
      scanner = new Html5Qrcode("qr-reader");
      const config = { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 };
      scanner.start(
        { facingMode: "environment" },
        config,
        async (decodedText) => {
          await checkIn(decodedText);
          if (scanner && scanner.isScanning) {
            await scanner.pause(true).catch(() => {});
            setTimeout(() => scanner?.resume().catch(() => {}), 1800);
          }
        },
        () => {}
      ).catch((error) => {
        authMessage.textContent = "Kamera tidak dapat dibuka. Izinkan akses kamera atau gunakan input manual di bawah.";
        authMessage.className = "notice";
        console.warn("QR camera error:", error);
      });
    } else {
      authMessage.textContent = "Pemindai QR tidak termuat. Gunakan input nomor peserta secara manual.";
    }
  } catch (error) {
    authMessage.textContent = error.message;
    authMessage.className = "notice";
    area.classList.add("hidden");
  }
});
