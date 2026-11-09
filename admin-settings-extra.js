(() => {
  function initRajawaliExtraSettings() {
    if (!window.db) return;
    const form = document.getElementById("settings-form");
    const dashboard = document.getElementById("dashboard-section");
    if (!form || !dashboard || form.dataset.extraSettingsReady === "1") return;
    form.dataset.extraSettingsReady = "1";

    const fields = [
      ["organization_name","Nama Organisasi","RAJAWALI EVENT ORGANIZER","text"],
      ["tagline","Slogan / Tagline","Sport and Music Event","text"],
      ["logo_url","URL Logo (opsional)","https://.../logo.png","url"],
      ["hero_title","Judul Halaman Utama","Tempat Semangat Menjadi Prestasi.","text"],
      ["hero_description","Deskripsi Halaman Utama","Informasi dan pendaftaran event olahraga dan musik.","textarea"],
      ["contact_whatsapp","Nomor WhatsApp (format 628...)","62812xxxxxxxx","text"],
      ["contact_phone_alt","Telepon Alternatif","Nomor telepon","text"],
      ["instagram_url","Instagram URL","https://instagram.com/akun","url"],
      ["facebook_url","Facebook URL","https://facebook.com/akun","url"],
      ["youtube_url","YouTube URL","https://youtube.com/@akun","url"],
      ["tiktok_url","TikTok URL","https://tiktok.com/@akun","url"],
      ["maps_url","Google Maps URL","https://maps.google.com/...","url"],
      ["bank_name","Nama Bank Utama Rajawali","Bank ...","text"],
      ["bank_account_number","Nomor Rekening Utama","Nomor rekening","text"],
      ["bank_account_holder","Nama Pemilik Rekening","Nama sesuai rekening","text"],
      ["bank_qris_url","URL Gambar QRIS (opsional)","https://.../qris.png","url"],
      ["footer_text","Teks Footer","Rajawali Event Organizer. Hak cipta dilindungi.","text"]
    ];

    const section = document.createElement("div");
    section.innerHTML = `
      <div class="form-divider"></div><h3>Profil & Tampilan Organisasi</h3>
      <div class="form-grid" id="extra-profile-fields"></div>
      <div class="form-divider"></div><h3>Kontak & Media Sosial</h3>
      <div class="form-grid" id="extra-contact-fields"></div>
      <div class="form-divider"></div><h3>Rekening Utama Rajawali</h3>
      <p class="muted">Rekening ini adalah rekening organisasi. Rekening khusus event tetap diatur pada halaman Buat/Edit Event.</p>
      <div class="form-grid" id="extra-bank-fields"></div>`;
    form.insertBefore(section, form.querySelector('button[type="submit"]') || null);

    const groups = {
      profile: ["organization_name","tagline","logo_url","hero_title","hero_description"],
      contact: ["contact_whatsapp","contact_phone_alt","instagram_url","facebook_url","youtube_url","tiktok_url","maps_url"],
      bank: ["bank_name","bank_account_number","bank_account_holder","bank_qris_url","footer_text"]
    };
    const byId = Object.fromEntries(fields.map(f => [f[0], f]));
    for (const [group, ids] of Object.entries(groups)) {
      const target = document.getElementById(`extra-${group}-fields`);
      ids.forEach(id => {
        const [key,label,placeholder,type] = byId[id];
        const wrap = document.createElement("label");
        wrap.textContent = label;
        const input = type === "textarea" ? document.createElement("textarea") : document.createElement("input");
        input.id = `setting-${key}`;
        input.placeholder = placeholder;
        if (type !== "textarea") input.type = type;
        if (type === "textarea") input.rows = 3;
        wrap.appendChild(input);
        target.appendChild(wrap);
      });
    }

    let loaded = false;
    async function loadExtraSettings() {
      if (loaded || dashboard.classList.contains("hidden")) return;
      const {data,error} = await window.db.from("site_settings").select("*").eq("id",1).maybeSingle();
      if (error) { console.error("Gagal memuat pengaturan:", error.message); return; }
      if (!data) return;
      fields.forEach(([key]) => {
        const input = document.getElementById(`setting-${key}`);
        if (input) input.value = data[key] || "";
      });
      loaded = true;
    }

    form.addEventListener("submit", async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const button = form.querySelector('button[type="submit"]');
      const message = document.getElementById("settings-message");
      if (button) button.disabled = true;
      if (message) message.textContent = "Menyimpan seluruh pengaturan...";
      const payload = {id:1};
      fields.forEach(([key]) => {
        const input = document.getElementById(`setting-${key}`);
        payload[key] = input && input.value.trim() ? input.value.trim() : null;
      });
      payload.contact_email = document.getElementById("setting-email")?.value.trim() || null;
      payload.contact_phone = document.getElementById("setting-phone")?.value.trim() || null;
      payload.contact_address = document.getElementById("setting-address")?.value.trim() || null;
      payload.social_url = document.getElementById("setting-social")?.value.trim() || null;
      const {error} = await window.db.from("site_settings").upsert(payload,{onConflict:"id"});
      if (message) message.textContent = error ? `Gagal menyimpan: ${error.message}` : "Semua pengaturan Rajawali berhasil disimpan.";
      if (button) button.disabled = false;
    }, true);

    const observer = new MutationObserver(() => {
      if (!dashboard.classList.contains("hidden")) loadExtraSettings();
    });
    observer.observe(dashboard,{attributes:true,attributeFilter:["class"]});
    loadExtraSettings();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRajawaliExtraSettings, {once:true});
  } else {
    initRajawaliExtraSettings();
  }
})();
