
document.addEventListener("DOMContentLoaded", async () => {
  const { $, esc, date, money } = window.Rajawali;
  const slug = new URLSearchParams(location.search).get("slug");
  const top = $("#event-top"), desc = $("#event-description"), area = $("#registration-area");

  if (!window.db) {
    top.innerHTML = '<div class="empty-state">Supabase belum dikonfigurasi.</div>';
    return;
  }

  if (!slug) {
    top.innerHTML = '<div class="empty-state">Alamat event tidak lengkap. Kembali ke halaman agenda.</div>';
    return;
  }

  const { data: event, error } = await db.from("events")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !event) {
    top.innerHTML = '<div class="empty-state">Event tidak ditemukan atau belum dipublikasikan.</div>';
    return;
  }

  document.title = `${event.title} | Rajawali`;

  top.innerHTML = `
    <span class="eyebrow">${esc(event.category || "EVENT RAJAWALI")}</span>
    <h1 class="event-title">${esc(event.title)}</h1>
    <p class="event-subtitle">${esc(event.summary || "Informasi resmi kegiatan Rajawali Event Organizer.")}</p>
    <div class="event-hero-meta">
      <span>▦ ${date(event.start_date)}</span>
      <span>⌖ ${esc(event.venue || "Lokasi menyusul")}</span>
      <span>◈ ${event.fee_mode === "free" ? "Gratis" : money(event.fee_amount)}</span>
    </div>`;

  desc.innerHTML = `
    <h2>Tentang Event</h2>
    <p>${esc(event.description || event.summary || "Deskripsi event belum tersedia.")}</p>
    <div class="event-facts">
      <p><b>Tanggal mulai:</b> ${date(event.start_date)}</p>
      <p><b>Tanggal selesai:</b> ${date(event.end_date)}</p>
      <p><b>Batas pendaftaran:</b> ${date(event.registration_deadline)}</p>
      <p><b>Lokasi:</b> ${esc(event.venue || "Belum ditentukan")}</p>
    </div>`;

  const { data: fields, error: fieldError } = await db.from("event_fields")
    .select("*")
    .eq("event_id", event.id)
    .order("sort_order");

  if (fieldError) {
    area.innerHTML = `<div class="notice">Formulir pendaftaran tidak dapat dimuat: ${esc(fieldError.message)}</div>`;
    return;
  }

  injectRegistrationStyles();

  function renderCustomField(f) {
    const key = String(f.field_key || `field_${f.id}`).replace(/[^a-zA-Z0-9_-]/g, "_");
    const required = Boolean(f.is_required);
    const requiredMark = required ? ' <span class="gf-required-mark">*</span>' : "";
    const options = Array.isArray(f.options) ? f.options.map(String).filter(x => x.trim()) : [];
    const label = `<span class="gf-public-title">${esc(f.label)}${requiredMark}</span>`;

    if (f.field_type === "select") {
      return `
        <div class="gf-public-question">
          <label for="custom-${esc(key)}">
            ${label}
            <select id="custom-${esc(key)}" name="${esc(key)}" ${required ? "required" : ""}>
              <option value="">Pilih jawaban</option>
              ${options.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join("")}
            </select>
          </label>
        </div>`;
    }

    if (f.field_type === "radio" || f.field_type === "checkbox") {
      const type = f.field_type;
      const choices = options.map(o => `
        <label class="gf-public-choice">
          <input type="${type}" name="${esc(key)}" value="${esc(o)}"
            ${type === "radio" && required ? "required" : ""}>
          <span>${esc(o)}</span>
        </label>`).join("");

      return `
        <fieldset class="gf-public-question gf-public-choice-group"
          data-custom-type="${type}"
          data-custom-key="${esc(key)}"
          data-custom-required="${required ? "true" : "false"}">
          <legend>${label}</legend>
          ${choices || '<p class="gf-public-empty">Opsi jawaban belum tersedia.</p>'}
          ${type === "checkbox" && required ? '<small class="gf-public-help">Pilih minimal satu jawaban.</small>' : ""}
        </fieldset>`;
    }

    if (f.field_type === "textarea") {
      return `
        <div class="gf-public-question">
          <label for="custom-${esc(key)}">
            ${label}
            <textarea id="custom-${esc(key)}" name="${esc(key)}" rows="4"
              placeholder="Ketik jawaban Anda..." ${required ? "required" : ""}></textarea>
          </label>
        </div>`;
    }

    const allowedTypes = ["text", "number", "date", "time", "email", "tel"];
    const inputType = allowedTypes.includes(f.field_type) ? f.field_type : "text";

    let placeholder = "Ketik jawaban Anda...";
    if (inputType === "number") placeholder = "Masukkan angka";
    if (inputType === "tel") placeholder = "Masukkan nomor telepon";

    return `
      <div class="gf-public-question">
        <label for="custom-${esc(key)}">
          ${label}
          <input id="custom-${esc(key)}" name="${esc(key)}" type="${inputType}"
            placeholder="${placeholder}" ${required ? "required" : ""}>
        </label>
      </div>`;
  }

  const fieldsHtml = (fields || []).map(renderCustomField).join("");
  const closed = event.registration_deadline &&
    event.registration_deadline < new Date().toISOString().slice(0, 10);

  area.innerHTML = closed
    ? '<div class="notice">Pendaftaran untuk event ini telah ditutup.</div>'
    : `
      <form id="register-form">
        <div class="gf-public-intro">
          <span class="eyebrow">FORMULIR PENDAFTARAN</span>
          <h2>Daftar Event</h2>
          <p>Isi data dengan benar. Kolom bertanda <b>*</b> wajib diisi.</p>
        </div>

        <div class="gf-public-question">
          <label>Jenis Pendaftaran
            <select id="reg-type" name="registration_type">
              ${event.registration_type !== "team" ? '<option value="individual">Individu</option>' : ""}
              ${event.registration_type !== "individual" ? '<option value="team">Tim / Grup</option>' : ""}
            </select>
          </label>
        </div>

        <div id="team-name-wrap" class="gf-public-question hidden">
          <label>Nama Tim / Klub
            <span class="gf-required-mark">*</span>
            <input name="team_name" id="team-name" placeholder="Masukkan nama tim atau klub">
          </label>
        </div>

        <section class="gf-public-question gf-participant-section">
          <h3>Data Peserta</h3>
          <p>Isi nama dan peran setiap peserta.</p>
          <div id="people-list">
            <div class="person-row">
              <h4>Data Peserta 1</h4>
              <label>Nama Lengkap *
                <input name="person_name" required maxlength="100" placeholder="Nama sesuai identitas">
              </label>
              <label>Peran
                <select name="person_role">
                  <option>Atlet</option>
                  <option>Ketua Tim</option>
                  <option>Pelatih</option>
                  <option>Manajer Tim</option>
                  <option>Peserta</option>
                </select>
              </label>
            </div>
          </div>
          <button type="button" id="add-person" class="btn btn-secondary btn-small hidden">
            + Tambah Anggota
          </button>
        </section>

        ${fieldsHtml}

        <div class="gf-public-question">
          <label>Nomor WhatsApp Pendaftar
            <span class="gf-required-mark">*</span>
            <input name="whatsapp" type="tel" required placeholder="08xxxxxxxxxx">
          </label>
        </div>

        ${event.fee_mode === "manual_transfer" && Number(event.fee_amount || 0) > 0 ? `
          <div class="notice">
            <b>Pembayaran transfer manual</b><br>
            Bank: ${esc(event.bank_name || "Informasi bank belum tersedia")}<br>
            Nomor rekening: ${esc(event.bank_account_number || "Belum diatur")}<br>
            Atas nama: ${esc(event.bank_account_holder || "Belum diatur")}<br>
            <small>Nominal transfer akan ditampilkan setelah pendaftaran dan mencakup tiga digit unik pada token.</small>
          </div>` : ""}

        <button type="submit" class="btn btn-primary full gf-submit">
          Kirim Pendaftaran
        </button>
        <p class="field-hint">Pastikan data benar. Token pendaftaran akan ditampilkan setelah berhasil.</p>
      </form>
      <div id="registration-result"></div>`;

  const form = $("#register-form");
  const type = $("#reg-type");
  const people = $("#people-list");
  const add = $("#add-person");
  const team = $("#team-name-wrap");

  if (!form) return;

  function refreshType() {
    const isTeam = type.value === "team";
    team.classList.toggle("hidden", !isTeam);
    add.classList.toggle("hidden", !isTeam);

    const teamInput = $("#team-name");
    if (teamInput) teamInput.required = isTeam;
  }

  type.addEventListener("change", refreshType);
  refreshType();

  add.addEventListener("click", () => {
    const n = people.querySelectorAll(".person-row").length + 1;
    if (n > 50) return alert("Maksimal 50 anggota per formulir.");

    const row = document.createElement("div");
    row.className = "person-row";

    row.innerHTML = `
      <h4>Data Peserta ${n} <button type="button" class="remove-person">Hapus</button></h4>
      <label>Nama Lengkap *
        <input name="person_name" required maxlength="100" placeholder="Nama sesuai identitas">
      </label>
      <label>Peran
        <select name="person_role">
          <option>Atlet</option>
          <option>Ketua Tim</option>
          <option>Pelatih</option>
          <option>Manajer Tim</option>
          <option>Peserta</option>
        </select>
      </label>`;

    row.querySelector(".remove-person").addEventListener("click", () => {
      row.remove();
      renumberPeople();
    });

    people.append(row);
  });

  function renumberPeople() {
    people.querySelectorAll(".person-row h4").forEach((h, i) => {
      if (h.firstChild && h.firstChild.nodeType === Node.TEXT_NODE) {
        h.firstChild.textContent = `Data Peserta ${i + 1} `;
      }
    });
  }

  form.addEventListener("submit", async ev => {
    ev.preventDefault();

    const missingCheckbox = [
      ...form.querySelectorAll('[data-custom-type="checkbox"][data-custom-required="true"]')
    ].find(group => !group.querySelector('input[type="checkbox"]:checked'));

    if (missingCheckbox) {
      alert(`Pertanyaan wajib belum dijawab: ${missingCheckbox.querySelector("legend")?.textContent || "pilihan"}`);
      missingCheckbox.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    button.textContent = "Mengirim...";

    const fd = new FormData(form);
    const names = fd.getAll("person_name");
    const roles = fd.getAll("person_role");
    const custom = {};

    (fields || []).forEach(f => {
      const key = String(f.field_key || "").replace(/[^a-zA-Z0-9_-]/g, "_");
      if (!key) return;

      if (f.field_type === "checkbox") {
        const values = fd.getAll(key);
        if (values.length) custom[key] = values;
      } else {
        const value = fd.get(key);
        if (value !== null && value !== "") custom[key] = value;
      }
    });

    const payload = {
      event_id: event.id,
      registration_type: type.value,
      team_name: fd.get("team_name") || "",
      whatsapp: fd.get("whatsapp"),
      participants: names.map((name, i) => ({
        name,
        role: roles[i] || "Peserta"
      })),
      custom_data: custom
    };

    try {
      // Endpoint disesuaikan dengan URL aktif di Supabase.
      const { data, error } = await db.functions.invoke("quick-responder", {
        body: payload
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      $("#registration-result").innerHTML = `
        <div class="status-result">
          <b>Pendaftaran diterima.</b>
          <p>Simpan token ini untuk cek status.</p>
          <div class="token-text">${esc(data.token)}</div>
          <p>Biaya: <b>${money(data.payment_amount)}</b></p>
          <p>${data.payment_amount > 0
            ? "Lakukan transfer ke rekening yang dicantumkan panitia, lalu tunggu verifikasi admin."
            : "Pendaftaran gratis berhasil dicatat."}</p>
          <a class="btn btn-secondary btn-small" href="cek-status.html">
            Cek Status Pendaftaran
          </a>
        </div>`;

      form.reset();

      people.innerHTML = `
        <div class="person-row">
          <h4>Data Peserta 1</h4>
          <label>Nama Lengkap *
            <input name="person_name" required maxlength="100">
          </label>
          <label>Peran
            <select name="person_role">
              <option>Atlet</option>
              <option>Ketua Tim</option>
              <option>Pelatih</option>
              <option>Manajer Tim</option>
              <option>Peserta</option>
            </select>
          </label>
        </div>`;

      refreshType();

    } catch (err) {
      console.error(err);
      $("#registration-result").innerHTML =
        `<p class="form-message">Pendaftaran gagal: ${esc(err.message || "Periksa koneksi dan konfigurasi Supabase.")}</p>`;
    } finally {
      button.disabled = false;
      button.textContent = "Kirim Pendaftaran";
    }
  });

  function injectRegistrationStyles() {
    if (document.getElementById("rajawali-google-form-public-css")) return;

    const style = document.createElement("style");
    style.id = "rajawali-google-form-public-css";

    style.textContent = `
      .gf-public-intro {
        padding: 0 0 13px;
        border-bottom: 1px solid #e8ecf2;
        margin-bottom: 16px;
      }
      .gf-public-intro h2 {
        font-size: 22px;
        margin: 7px 0;
      }
      .gf-public-intro p,
      .gf-participant-section>p {
        font-size: 11px;
        color: #78849a;
        margin: 0;
      }
      .gf-public-question {
        background: #fff;
        border: 1px solid #e5e9f0;
        border-radius: 9px;
        padding: 15px 15px 12px;
        margin: 12px 0;
        min-width: 0;
      }
      .gf-public-question label {
        display: grid;
        gap: 8px;
        margin: 0 !important;
        color: #34415b;
        font-size: 12px;
        font-weight: 700;
      }
      .gf-public-title {
        display: block;
        font-size: 13px;
        font-weight: 800;
        color: #202e47;
        line-height: 1.5;
        margin-bottom: 3px;
      }
      .gf-required-mark {
        color: #d0343b;
        font-weight: 900;
      }
      .gf-public-choice-group {
        border: 1px solid #e5e9f0;
      }
      .gf-public-choice-group legend {
        padding: 0 3px;
      }
      .gf-public-choice {
        display: flex !important;
        grid-template-columns: none !important;
        align-items: center;
        gap: 10px !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        padding: 7px 3px;
        cursor: pointer;
      }
      .gf-public-choice input {
        width: 17px !important;
        height: 17px;
        margin: 0;
        accent-color: #173c70;
        flex: 0 0 17px;
      }
      .gf-public-choice span {
        font-weight: 500;
      }
      .gf-public-help {
        display: block;
        color: #8a94a5;
        font-size: 10px;
        margin-top: 4px;
      }
      .gf-public-empty {
        font-size: 11px;
        color: #9b5360;
      }
      .gf-participant-section h3 {
        font-size: 15px;
        margin: 0 0 5px;
      }
      .gf-participant-section .person-row {
        background: #f8f9fc;
      }
      .gf-submit {
        margin-top: 10px;
      }
      @media(max-width:700px) {
        .gf-public-question {
          padding: 13px;
        }
        .gf-public-title {
          font-size: 12px;
        }
      }
    `;

    document.head.appendChild(style);
  }
});
