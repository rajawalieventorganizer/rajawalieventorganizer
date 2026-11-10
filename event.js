document.addEventListener("DOMContentLoaded", async () => {
  const { $, esc, date, money } = window.Rajawali;
  const slug = new URLSearchParams(location.search).get("slug");
  const top = $("#event-top"), desc = $("#event-description"), area = $("#registration-area");
  const SYSTEM_KEYS = new Set(["registration_type", "team_name", "whatsapp"]);

  if (!window.db) {
    top.innerHTML = '<div class="empty-state">Supabase belum dikonfigurasi.</div>';
    return;
  }
  if (!slug) {
    top.innerHTML = '<div class="empty-state">Alamat event tidak lengkap. Kembali ke halaman agenda.</div>';
    return;
  }

  const { data: event, error } = await db.from("events")
    .select("*").eq("slug", slug).eq("status", "published").maybeSingle();
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
    .select("*").eq("event_id", event.id).order("sort_order");
  if (fieldError) {
    area.innerHTML = `<div class="notice">Formulir pendaftaran tidak dapat dimuat: ${esc(fieldError.message)}</div>`;
    return;
  }

  injectRegistrationStyles();

  const clean = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const fieldIdentity = f => `${clean(f.field_key)} ${clean(f.label)}`;
  const isRegistrationType = f => /jenispendaftaran|registrationtype/.test(fieldIdentity(f));
  const isTeamName = f => /namatim|namaklub/.test(fieldIdentity(f));
  const isParticipantName = f => /namapeserta|namalengkappeserta/.test(fieldIdentity(f));
  const isParticipantRole = f => /peranpeserta|perananggota|rolepeserta/.test(fieldIdentity(f));
  const isRegistrantWhatsapp = f => /whatsapp.*pendaftar|pendaftar.*whatsapp|nomorwhatsapp$/.test(fieldIdentity(f));

  const formFields = fields || [];
  const registrationField = formFields.find(isRegistrationType);
  const teamNameField = formFields.find(isTeamName);
  const participantNameField = formFields.find(isParticipantName);
  const participantRoleField = formFields.find(isParticipantRole);
  const whatsappField = formFields.find(isRegistrantWhatsapp);
  const roles = Array.isArray(participantRoleField?.options)
    ? participantRoleField.options.map(x => String(x).trim()).filter(Boolean)
    : [];
  const supportRoles = roles.filter(role => /pelatih|coach|manajer|manager|ofisial|official|pendamping|support/i.test(role));
  const isSystemField = f => [registrationField, teamNameField, participantNameField, participantRoleField, whatsappField].includes(f);

  const missing = [];
  if (!participantNameField) missing.push("Nama Peserta (Jawaban singkat)");
  if (!participantRoleField) missing.push("Peran Peserta (Dropdown dengan pilihan peran)");
  if (!roles.length) missing.push("minimal satu pilihan pada Peran Peserta");
  if (!whatsappField) missing.push("Nomor WhatsApp Pendaftar (Nomor telepon)");
  if (event.registration_type !== "individual" && !teamNameField) missing.push("Nama Tim / Klub (Jawaban singkat)");
  const registrationOptions = (registrationField?.options || []).map(String);
  const hasIndividualOption = registrationOptions.some(x => /individu|perorangan/i.test(x));
  const hasTeamOption = registrationOptions.some(x => /tim|grup|team|group/i.test(x));
  if (event.registration_type === "both" && (!registrationField || !hasIndividualOption || !hasTeamOption)) {
    missing.push("Jenis Pendaftaran (Dropdown berisi opsi Individu dan Tim / Grup)");
  }
  if (participantNameField && !["text"].includes(participantNameField.field_type)) {
    missing.push("Jenis Nama Peserta harus Jawaban singkat");
  }
  if (participantRoleField && !["select"].includes(participantRoleField.field_type)) {
    missing.push("Jenis Peran Peserta harus Dropdown");
  }
  if (whatsappField && !["tel", "text"].includes(whatsappField.field_type)) {
    missing.push("Jenis WhatsApp Pendaftar harus Nomor telepon atau Jawaban singkat");
  }

  const closed = event.registration_deadline &&
    event.registration_deadline < new Date().toISOString().slice(0, 10);
  if (closed) {
    area.innerHTML = '<div class="notice">Pendaftaran untuk event ini telah ditutup.</div>';
    return;
  }
  if (missing.length) {
    area.innerHTML = `
      <div class="notice">
        <b>Formulir event belum lengkap.</b>
        <p>Formulir publik hanya menampilkan kolom yang dibuat melalui Panel Admin → Edit Event → Form Builder.</p>
        <p>Admin perlu menambahkan atau memperbaiki:</p>
        <ul>${missing.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
        <p>Setelah disimpan, buka kembali halaman event.</p>
      </div>`;
    return;
  }

  function requiredMark(f, force = false) {
    return (force || Boolean(f?.is_required)) ? ' <span class="gf-required-mark">*</span>' : "";
  }
  function renderCustomField(f) {
    const key = String(f.field_key || `field_${f.id}`).replace(/[^a-zA-Z0-9_-]/g, "_");
    const required = Boolean(f.is_required);
    const options = Array.isArray(f.options) ? f.options.map(String).filter(x => x.trim()) : [];
    const label = `<span class="gf-public-title">${esc(f.label)}${requiredMark(f)}</span>`;
    if (f.field_type === "select") {
      return `<div class="gf-public-question"><label for="custom-${esc(key)}">${label}
        <select id="custom-${esc(key)}" name="${esc(key)}" ${required ? "required" : ""}>
          <option value="">Pilih jawaban</option>${options.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join("")}
        </select></label></div>`;
    }
    if (f.field_type === "radio" || f.field_type === "checkbox") {
      const type = f.field_type;
      const choices = options.map(o => `<label class="gf-public-choice"><input type="${type}" name="${esc(key)}" value="${esc(o)}" ${type === "radio" && required ? "required" : ""}><span>${esc(o)}</span></label>`).join("");
      return `<fieldset class="gf-public-question gf-public-choice-group" data-custom-type="${type}" data-custom-key="${esc(key)}" data-custom-required="${required ? "true" : "false"}">
        <legend>${label}</legend>${choices || '<p class="gf-public-empty">Opsi jawaban belum tersedia.</p>'}
        ${type === "checkbox" && required ? '<small class="gf-public-help">Pilih minimal satu jawaban.</small>' : ""}</fieldset>`;
    }
    if (f.field_type === "textarea") {
      return `<div class="gf-public-question"><label for="custom-${esc(key)}">${label}
        <textarea id="custom-${esc(key)}" name="${esc(key)}" rows="4" placeholder="Ketik jawaban Anda..." ${required ? "required" : ""}></textarea>
      </label></div>`;
    }
    const allowedTypes = ["text", "number", "date", "time", "email", "tel"];
    const inputType = allowedTypes.includes(f.field_type) ? f.field_type : "text";
    const placeholder = inputType === "number" ? "Masukkan angka" : inputType === "tel" ? "Masukkan nomor telepon" : "Ketik jawaban Anda...";
    return `<div class="gf-public-question"><label for="custom-${esc(key)}">${label}
      <input id="custom-${esc(key)}" name="${esc(key)}" type="${inputType}" placeholder="${placeholder}" ${required ? "required" : ""}>
    </label></div>`;
  }

  const typeOptions = registrationOptions.map(option => {
    const value = /individu|perorangan/i.test(option) ? "individual" : /tim|grup|team|group/i.test(option) ? "team" : "";
    return value ? { value, label: option } : null;
  }).filter(Boolean);

  function renderSystemField(f) {
    if (f === registrationField) {
      if (event.registration_type !== "both") {
        return `<input type="hidden" id="reg-type" name="registration_type" value="${esc(event.registration_type)}">`;
      }
      return `<div class="gf-public-question"><label for="reg-type"><span class="gf-public-title">${esc(f.label)}${requiredMark(f, true)}</span>
        <select id="reg-type" name="registration_type" required>${typeOptions.map(x => `<option value="${x.value}">${esc(x.label)}</option>`).join("")}</select>
      </label></div>`;
    }
    if (f === teamNameField) {
      return `<div id="team-name-wrap" class="gf-public-question hidden"><label for="team-name"><span class="gf-public-title">${esc(f.label)}${requiredMark(f, true)}</span>
        <input id="team-name" name="team_name" type="text" maxlength="160" placeholder="Masukkan nama tim atau klub">
      </label></div>`;
    }
    if (f === participantNameField || f === participantRoleField) {
      const firstParticipantField = Math.min(formFields.indexOf(participantNameField), formFields.indexOf(participantRoleField));
      if (formFields.indexOf(f) !== firstParticipantField) return "";
      return `<section class="gf-public-question gf-participant-section">
        <h3>${esc(participantNameField.label)}</h3>
        <p>${esc(participantRoleField.label)}. Setiap orang yang didaftarkan memperoleh nomor peserta dan kartu QR sendiri.</p>
        <div id="people-list"></div>
        <button type="button" id="add-person" class="btn btn-secondary btn-small">＋ Tambah Peserta</button>
        <p class="gf-public-help" id="participant-add-help"></p>
      </section>`;
    }
    if (f === whatsappField) {
      return `<div class="gf-public-question"><label for="registrant-whatsapp"><span class="gf-public-title">${esc(f.label)}${requiredMark(f, true)}</span>
        <input id="registrant-whatsapp" name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" required placeholder="08xxxxxxxxxx">
      </label></div>`;
    }
    return "";
  }

  const fieldsHtml = formFields.map(f => isSystemField(f) ? renderSystemField(f) : renderCustomField(f)).join("");
  const hiddenRegistrationType = !registrationField && event.registration_type !== "both"
    ? `<input type="hidden" id="reg-type" name="registration_type" value="${esc(event.registration_type)}">`
    : "";
  area.innerHTML = `
    <form id="register-form">
      <div class="gf-public-intro"><span class="eyebrow">FORMULIR PENDAFTARAN</span><h2>Daftar Event</h2>
        <p>Isi pertanyaan sesuai petunjuk. Kolom bertanda <b>*</b> wajib diisi.</p>
      </div>
      ${hiddenRegistrationType}
      ${fieldsHtml}
      ${event.fee_mode === "manual_transfer" && Number(event.fee_amount || 0) > 0 ? `
        <div class="notice"><b>Pembayaran transfer manual</b><br>
          Bank: ${esc(event.bank_name || "Informasi bank belum tersedia")}<br>
          Nomor rekening: ${esc(event.bank_account_number || "Belum diatur")}<br>
          Atas nama: ${esc(event.bank_account_holder || "Belum diatur")}<br>
          <small>Nominal transfer akan ditampilkan setelah pendaftaran dan mencakup tiga digit unik pada token.</small>
        </div>` : ""}
      <button type="submit" class="btn btn-primary full gf-submit">Kirim Pendaftaran</button>
      <p class="field-hint">Pastikan data benar. Token pendaftaran akan ditampilkan setelah berhasil.</p>
    </form>
    <div id="registration-result"></div>`;

  const form = $("#register-form");
  const type = $("#reg-type");
  const people = $("#people-list");
  const add = $("#add-person");
  const teamWrap = $("#team-name-wrap");
  const teamInput = $("#team-name");

  if (!form || !type || !people || !add) return;

  function isTeamMode() { return type.value === "team"; }
  function optionList(values) {
    return values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
  }
  function primaryDefaultRole() {
    return roles.find(role => !supportRoles.includes(role)) || roles[0] || "Peserta";
  }
  function createPersonRow(index, extra = false) {
    const availableRoles = extra && !isTeamMode() ? supportRoles : roles;
    const selectedRole = extra ? (availableRoles[0] || "") : primaryDefaultRole();
    const row = document.createElement("div");
    row.className = "person-row reo-builder-person";
    row.innerHTML = `
      <div class="reo-person-row-head"><b>Data orang ${index + 1}</b>
        ${extra ? '<button type="button" class="remove-person" aria-label="Hapus data orang">Hapus</button>' : ""}
      </div>
      <label><span class="gf-public-title">${esc(participantNameField.label)}${requiredMark(participantNameField, true)}</span>
        <input name="person_name" required maxlength="100" placeholder="Nama sesuai identitas">
      </label>
      <label><span class="gf-public-title">${esc(participantRoleField.label)}${requiredMark(participantRoleField, true)}</span>
        <select name="person_role" required>${optionList(availableRoles)}</select>
      </label>`;
    const roleSelect = row.querySelector('[name="person_role"]');
    if (roleSelect && availableRoles.includes(selectedRole)) roleSelect.value = selectedRole;
    const remove = row.querySelector(".remove-person");
    if (remove) remove.addEventListener("click", () => { row.remove(); renumberPeople(); });
    return row;
  }
  function renumberPeople() {
    people.querySelectorAll(".person-row-head b").forEach((label, index) => { label.textContent = `Data orang ${index + 1}`; });
  }
  function setPeopleForMode() {
    const teamMode = isTeamMode();
    const rows = [...people.querySelectorAll(".reo-builder-person")];
    if (!teamMode && rows.length > 1) {
      rows.slice(1).forEach(row => {
        const currentRole = row.querySelector('[name="person_role"]')?.value || "";
        if (!supportRoles.includes(currentRole)) row.remove();
      });
      renumberPeople();
    }
    teamWrap?.classList.toggle("hidden", !teamMode);
    if (teamInput) teamInput.required = teamMode;
    if (teamMode) {
      add.textContent = "＋ Tambah Anggota Tim";
      add.classList.remove("hidden");
    } else if (supportRoles.length) {
      add.textContent = "＋ Tambah Pelatih / Manajer (Opsional)";
      add.classList.remove("hidden");
    } else {
      add.classList.add("hidden");
    }
  }
  function resetPeople() {
    people.innerHTML = "";
    people.append(createPersonRow(0, false));
    setPeopleForMode();
  }

  add.addEventListener("click", () => {
    const currentCount = people.querySelectorAll(".reo-builder-person").length;
    if (currentCount >= 50) return alert("Maksimal 50 orang per formulir.");
    if (!isTeamMode() && !supportRoles.length) return;
    people.append(createPersonRow(currentCount, true));
    renumberPeople();
  });
  type.addEventListener("change", () => setPeopleForMode());
  resetPeople();

  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    const missingCheckbox = [...form.querySelectorAll('[data-custom-type="checkbox"][data-custom-required="true"]')]
      .find(group => !group.querySelector('input[type="checkbox"]:checked'));
    if (missingCheckbox) {
      alert(`Pertanyaan wajib belum dijawab: ${missingCheckbox.querySelector("legend")?.textContent || "pilihan"}`);
      missingCheckbox.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const fd = new FormData(form);
    const names = fd.getAll("person_name").map(x => String(x).trim());
    const roleValues = fd.getAll("person_role").map(x => String(x).trim());
    const registrationType = String(fd.get("registration_type") || event.registration_type);
    const teamName = String(fd.get("team_name") || "").trim();
    const whatsapp = String(fd.get("whatsapp") || "").trim();
    if (!names.length || names.some(x => !x)) return alert("Nama setiap orang wajib diisi.");
    if (names.length !== roleValues.length || roleValues.some(x => !roles.includes(x))) return alert("Periksa kembali peran setiap orang.");
    if (!whatsapp) return alert("Nomor WhatsApp pendaftar wajib diisi.");
    if (registrationType === "team" && !teamName) return alert("Nama tim atau klub wajib diisi untuk pendaftaran tim.");
    if (registrationType === "individual" && names.length > 1 && roleValues.slice(1).some(role => !supportRoles.includes(role))) {
      return alert("Pada pendaftaran individu, orang tambahan hanya dapat berperan sebagai pelatih, manajer, ofisial, atau pendamping sesuai pilihan di Form Builder.");
    }

    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = "Mengirim...";
    const custom = {};
    formFields.filter(f => !isSystemField(f)).forEach(f => {
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

    // Bentuk payload dipertahankan agar tetap cocok dengan Edge Function quick-responder yang sudah digunakan.
    const payload = {
      event_id: event.id,
      registration_type: registrationType,
      team_name: teamName,
      whatsapp,
      participants: names.map((name, i) => ({ name, role: roleValues[i] || "Peserta" })),
      custom_data: custom
    };

    try {
      const { data, error } = await db.functions.invoke("quick-responder", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.token) throw new Error("Pendaftaran belum dikonfirmasi server. Silakan periksa kembali status sebelum mengirim ulang.");

      $("#registration-result").innerHTML = `
        <div class="status-result">
          <b>Pendaftaran diterima.</b>
          <p>Simpan token ini untuk cek status.</p>
          <div class="token-text">${esc(data.token)}</div>
          <p>Biaya: <b>${money(data.payment_amount)}</b></p>
          <p>${Number(data.payment_amount || 0) > 0
            ? "Lakukan transfer ke rekening yang dicantumkan panitia, lalu tunggu verifikasi admin."
            : "Pendaftaran gratis berhasil dicatat."}</p>
          <a class="btn btn-secondary btn-small" href="cek-status.html">Cek Status Pendaftaran</a>
        </div>`;
      form.reset();
      if (event.registration_type === "both" && typeOptions.some(x => x.value === "individual")) type.value = "individual";
      if (event.registration_type !== "both") type.value = event.registration_type;
      resetPeople();
    } catch (err) {
      console.error(err);
      $("#registration-result").innerHTML = `<p class="form-message">Pendaftaran gagal: ${esc(err.message || "Periksa koneksi dan konfigurasi Supabase.")}</p>`;
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
      .gf-public-intro{padding:0 0 13px;border-bottom:1px solid #e8ecf2;margin-bottom:16px}
      .gf-public-intro h2{font-size:22px;margin:7px 0}
      .gf-public-intro p,.gf-participant-section>p{font-size:11px;color:#78849a;margin:0}
      .gf-public-question{background:#fff;border:1px solid #e5e9f0;border-radius:9px;padding:15px 15px 12px;margin:12px 0;min-width:0}
      .gf-public-question label{display:grid;gap:8px;margin:0 0 10px!important;color:#34415b;font-size:12px;font-weight:700}
      .gf-public-title{display:block;font-size:13px;font-weight:800;color:#202e47;line-height:1.5;margin-bottom:3px}
      .gf-required-mark{color:#d0343b;font-weight:900}
      .gf-public-choice-group{border:1px solid #e5e9f0}.gf-public-choice-group legend{padding:0 3px}
      .gf-public-choice{display:flex!important;grid-template-columns:none!important;align-items:center;gap:10px!important;font-size:12px!important;font-weight:500!important;padding:7px 3px;cursor:pointer}
      .gf-public-choice input{width:17px!important;height:17px;margin:0;accent-color:#173c70;flex:0 0 17px}
      .gf-public-choice span{font-weight:500}.gf-public-help{display:block;color:#8a94a5;font-size:10px;margin-top:4px}
      .gf-public-empty{font-size:11px;color:#9b5360}.gf-participant-section h3{font-size:15px;margin:0 0 5px}
      .gf-participant-section .person-row{background:#f8f9fc}.reo-builder-person{background:#f8f9fc;border:1px solid #e6ebf2;border-radius:8px;padding:12px;margin:10px 0}
      .reo-person-row-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;color:#233653;font-size:12px}
      .reo-person-row-head button{border:0;background:#fff0f0;color:#a33b43;border-radius:5px;padding:5px 9px;font-size:11px}
      .gf-submit{margin-top:10px}
      @media(max-width:700px){.gf-public-question{padding:13px}.gf-public-title{font-size:12px}}
    `;
    document.head.appendChild(style);
  }
});
