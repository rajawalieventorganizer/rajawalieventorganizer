document.addEventListener("DOMContentLoaded", async () => {
  const { $, esc, date, money } = window.Rajawali;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  const top = $("#event-top");
  const description = $("#event-description");
  const area = $("#registration-area");

  if (!window.db) {
    top.innerHTML = '<div class="empty-state">Supabase belum dikonfigurasi.</div>';
    return;
  }

  if (!slug) {
    top.innerHTML = '<div class="empty-state">Alamat event tidak lengkap. Kembali ke halaman agenda.</div>';
    return;
  }

  // ------------------------------------------------
  // 1. MEMUAT EVENT
  // ------------------------------------------------

  const { data: event, error: eventError } = await db
    .from("events")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (eventError || !event) {
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
    </div>
  `;

  description.innerHTML = `
    <h2>Tentang Event</h2>
    <p>${esc(event.description || event.summary || "Deskripsi event belum tersedia.")}</p>
    <div class="event-facts">
      <p><b>Tanggal mulai:</b> ${date(event.start_date)}</p>
      <p><b>Tanggal selesai:</b> ${date(event.end_date)}</p>
      <p><b>Batas pendaftaran:</b> ${date(event.registration_deadline)}</p>
      <p><b>Lokasi:</b> ${esc(event.venue || "Belum ditentukan")}</p>
    </div>
  `;

  // ------------------------------------------------
  // 2. MEMUAT FORM BUILDER DARI ADMIN
  // ------------------------------------------------

  const { data: storedFields, error: fieldError } = await db
    .from("event_fields")
    .select("*")
    .eq("event_id", event.id)
    .order("sort_order", { ascending: true });

  if (fieldError) {
    area.innerHTML = `
      <div class="notice">
        Formulir pendaftaran tidak dapat dimuat:
        ${esc(fieldError.message)}
      </div>
    `;
    return;
  }

  const fields = Array.isArray(storedFields) ? storedFields : [];

  if (!fields.length) {
    area.innerHTML = `
      <div class="notice">
        <b>Formulir belum dibuat.</b>
        <p>Silakan buka Panel Admin → Edit Event → Form Builder untuk membuat pertanyaan pendaftaran.</p>
      </div>
    `;
    return;
  }

  injectRegistrationStyles();

  // ------------------------------------------------
  // 3. MENGENALI KOLOM INTI BERDASARKAN LABEL ADMIN
  // ------------------------------------------------

  const clean = value =>
    String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  const identity = field =>
    `${clean(field.field_key)} ${clean(field.label)}`;

  const isRegistrationType = field =>
    /jenispendaftaran|registrationtype/.test(identity(field));

  // Mendukung label: Nama Peserta, Nama Atlet, Nama Pemain,
  // Nama Perenang, Nama Anggota, dan variasi sejenis.
  const isParticipantName = field =>
    /namapeserta|namalengkappeserta|namaatlet|namaathlete|namapemain|namaperenang|namapelari|namaanggota|participantname|athletename/.test(identity(field));

  const isParticipantRole = field =>
    /peranpeserta|perananggota|rolepeserta|participantrole/.test(identity(field));

  // Mendukung "Nomor Whatsapp Aktif", bukan hanya "Nomor WhatsApp".
  const isWhatsapp = field =>
    /whatsapp|nohpaktif|nomorhpaktif|nomorteleponpendaftar/.test(identity(field));

  // Nama Klub hanya diperlakukan sebagai nama tim jika event memang
  // memakai model Tim/Grup. Untuk event Individu, ini tetap pertanyaan Admin.
  const isTeamName = field =>
    event.registration_type !== "individual" &&
    /namatim|namaklub|namagroup|namagrup|teamname|clubname/.test(identity(field));

  const registrationField = fields.find(isRegistrationType);
  const participantNameField = fields.find(isParticipantName);
  const participantRoleField = fields.find(isParticipantRole);
  const whatsappField = fields.find(isWhatsapp);
  const teamNameField = fields.find(isTeamName);

  const roles = Array.isArray(participantRoleField?.options)
    ? participantRoleField.options.map(x => String(x).trim()).filter(Boolean)
    : [];

  const supportRoles = roles.filter(role =>
    /pelatih|coach|manajer|manager|ofisial|official|pendamping|support/i.test(role)
  );

  const participantDefaultRole =
    /atlet|athlete|pemain|perenang|pelari/i.test(participantNameField?.label || "")
      ? "Atlet"
      : "Peserta";

  const defaultRole = roles.includes(participantDefaultRole)
    ? participantDefaultRole
    : (roles[0] || participantDefaultRole);

  const systemFields = new Set(
    [
      registrationField,
      participantNameField,
      participantRoleField,
      whatsappField,
      teamNameField
    ].filter(Boolean)
  );

  // ------------------------------------------------
  // 4. VALIDASI KOLOM WAJIB SISTEM
  // ------------------------------------------------

  const missing = [];

  if (!participantNameField) {
    missing.push("Nama Atlet atau Nama Peserta (Jawaban singkat)");
  }

  if (
    participantNameField &&
    !["text"].includes(participantNameField.field_type)
  ) {
    missing.push("Kolom Nama Atlet harus menggunakan Jawaban singkat");
  }

  if (
    participantRoleField &&
    participantRoleField.field_type !== "select"
  ) {
    missing.push("Kolom Peran Peserta harus menggunakan Dropdown");
  }

  if (
    participantRoleField &&
    !roles.length
  ) {
    missing.push("Tambahkan pilihan pada kolom Peran Peserta");
  }

  if (!whatsappField) {
    missing.push("Nomor WhatsApp Aktif (Nomor telepon)");
  }

  if (
    whatsappField &&
    !["tel", "text"].includes(whatsappField.field_type)
  ) {
    missing.push("Kolom WhatsApp harus menggunakan Nomor telepon atau Jawaban singkat");
  }

  if (
    event.registration_type !== "individual" &&
    !teamNameField
  ) {
    missing.push("Nama Tim atau Nama Klub untuk pendaftaran Tim/Grup");
  }

  const registrationOptions = Array.isArray(registrationField?.options)
    ? registrationField.options.map(String)
    : [];

  const typeOptions = registrationOptions
    .map(option => {
      const normalized = clean(option);

      if (/individu|perorangan/.test(normalized)) {
        return { value: "individual", label: option };
      }

      if (/tim|grup|team|group/.test(normalized)) {
        return { value: "team", label: option };
      }

      return null;
    })
    .filter(Boolean);

  if (
    event.registration_type === "both" &&
    registrationField &&
    (!typeOptions.some(x => x.value === "individual") ||
      !typeOptions.some(x => x.value === "team"))
  ) {
    missing.push("Jenis Pendaftaran harus memiliki pilihan Individu dan Tim/Grup");
  }

  const today = new Date().toISOString().slice(0, 10);
  const closed =
    event.registration_deadline &&
    event.registration_deadline < today;

  if (closed) {
    area.innerHTML = '<div class="notice">Pendaftaran untuk event ini telah ditutup.</div>';
    return;
  }

  if (missing.length) {
    area.innerHTML = `
      <div class="notice">
        <b>Formulir Admin perlu diperbaiki.</b>
        <p>Halaman ini membaca pertanyaan dari Form Builder pada Panel Admin.</p>
        <p>Periksa kolom berikut:</p>
        <ul>${missing.map(item => `<li>${esc(item)}</li>`).join("")}</ul>
        <p>Simpan kembali event setelah memperbaiki pertanyaan.</p>
      </div>
    `;
    return;
  }

  // ------------------------------------------------
  // 5. FUNGSI PEMBANTU FORM
  // ------------------------------------------------

  function requiredMark(field, force = false) {
    return (force || Boolean(field?.is_required))
      ? ' <span class="gf-required-mark">*</span>'
      : "";
  }

  function fieldKey(field) {
    const raw = String(field.field_key || field.label || `field_${field.id}`);
    return raw.replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  function fileHint(field) {
    if (field.field_type === "photo_upload") {
      return "Format foto: JPG, JPEG, PNG, atau WebP. Maksimal 5 MB.";
    }

    return "Format dokumen: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, atau TXT. Maksimal 10 MB.";
  }

  function renderCustomField(field) {
    const key = fieldKey(field);
    const required = Boolean(field.is_required);
    const options = Array.isArray(field.options)
      ? field.options.map(String).filter(x => x.trim())
      : [];

    const label = `
      <span class="gf-public-title">
        ${esc(field.label)}${requiredMark(field)}
      </span>
    `;

    if (field.field_type === "select") {
      return `
        <div class="gf-public-question">
          <label for="custom-${esc(key)}">
            ${label}
            <select
              id="custom-${esc(key)}"
              name="${esc(key)}"
              ${required ? "required" : ""}
            >
              <option value="">Pilih jawaban</option>
              ${options.map(option =>
                `<option value="${esc(option)}">${esc(option)}</option>`
              ).join("")}
            </select>
          </label>
        </div>
      `;
    }

    if (field.field_type === "radio" || field.field_type === "checkbox") {
      const type = field.field_type;

      const choices = options.map(option => `
        <label class="gf-public-choice">
          <input
            type="${type}"
            name="${esc(key)}"
            value="${esc(option)}"
            ${type === "radio" && required ? "required" : ""}
          >
          <span>${esc(option)}</span>
        </label>
      `).join("");

      return `
        <fieldset
          class="gf-public-question gf-public-choice-group"
          data-custom-type="${type}"
          data-custom-key="${esc(key)}"
          data-custom-required="${required ? "true" : "false"}"
        >
          <legend>${label}</legend>
          ${choices || '<p class="gf-public-empty">Opsi jawaban belum tersedia.</p>'}
          ${type === "checkbox" && required
            ? '<small class="gf-public-help">Pilih minimal satu jawaban.</small>'
            : ""}
        </fieldset>
      `;
    }

    if (field.field_type === "textarea") {
      return `
        <div class="gf-public-question">
          <label for="custom-${esc(key)}">
            ${label}
            <textarea
              id="custom-${esc(key)}"
              name="${esc(key)}"
              rows="4"
              placeholder="Ketik jawaban Anda..."
              ${required ? "required" : ""}
            ></textarea>
          </label>
        </div>
      `;
    }

    if (field.field_type === "photo_upload" || field.field_type === "document_upload") {
      const isPhoto = field.field_type === "photo_upload";
      const accept = isPhoto
        ? "image/jpeg,image/png,image/webp"
        : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";

      return `
        <div class="gf-public-question gf-upload-question">
          <label for="custom-${esc(key)}">
            ${label}
            <input
              id="custom-${esc(key)}"
              name="${esc(key)}"
              type="file"
              accept="${accept}"
              data-upload-field="true"
              data-upload-kind="${isPhoto ? "photo" : "document"}"
              data-upload-key="${esc(key)}"
              ${required ? "required" : ""}
            >
          </label>
          <small class="gf-public-help">${fileHint(field)}</small>
          <div class="gf-upload-preview" data-upload-preview="${esc(key)}" hidden></div>
          <small class="gf-upload-note">
            Pemilihan file tersedia. Penyimpanan file ke server perlu diaktifkan
            melalui konfigurasi Storage dan fungsi server.
          </small>
        </div>
      `;
    }

    const allowedTypes = ["text", "number", "date", "time", "email", "tel"];
    const inputType = allowedTypes.includes(field.field_type)
      ? field.field_type
      : "text";

    const placeholder = inputType === "number"
      ? "Masukkan angka"
      : inputType === "tel"
        ? "Masukkan nomor telepon"
        : "Ketik jawaban Anda...";

    return `
      <div class="gf-public-question">
        <label for="custom-${esc(key)}">
          ${label}
          <input
            id="custom-${esc(key)}"
            name="${esc(key)}"
            type="${inputType}"
            placeholder="${placeholder}"
            ${required ? "required" : ""}
          >
        </label>
      </div>
    `;
  }

  // ------------------------------------------------
  // 6. MERENDER KOLOM KHUSUS YANG DIATUR ADMIN
  // ------------------------------------------------

  function renderRegistrationTypeField(field) {
    if (event.registration_type !== "both") {
      return `
        <input
          type="hidden"
          id="reg-type"
          name="registration_type"
          value="${esc(event.registration_type)}"
        >
      `;
    }

    return `
      <div class="gf-public-question">
        <label for="reg-type">
          <span class="gf-public-title">
            ${esc(field.label)}${requiredMark(field, true)}
          </span>
          <select id="reg-type" name="registration_type" required>
            ${typeOptions.map(option => `
              <option value="${option.value}">
                ${esc(option.label)}
              </option>
            `).join("")}
          </select>
        </label>
      </div>
    `;
  }

  function renderParticipantSection() {
    const roleText = participantRoleField
      ? esc(participantRoleField.label)
      : `Peran peserta otomatis: ${esc(defaultRole)}`;

    return `
      <section class="gf-public-question gf-participant-section">
        <h3>${esc(participantNameField.label)}</h3>
        <p>
          ${roleText}.
          Setiap peserta memperoleh nomor peserta dan QR sendiri.
        </p>
        <div id="people-list"></div>
        <button
          type="button"
          id="add-person"
          class="btn btn-secondary btn-small"
        >＋ Tambah Anggota Tim</button>
        <p class="gf-public-help" id="participant-add-help"></p>
      </section>
    `;
  }

  function renderTeamName(field) {
    return `
      <div id="team-name-wrap" class="gf-public-question hidden">
        <label for="team-name">
          <span class="gf-public-title">
            ${esc(field.label)}${requiredMark(field, true)}
          </span>
          <input
            id="team-name"
            name="team_name"
            type="text"
            maxlength="160"
            placeholder="Masukkan nama tim atau klub"
          >
        </label>
      </div>
    `;
  }

  function renderWhatsapp(field) {
    return `
      <div class="gf-public-question">
        <label for="registrant-whatsapp">
          <span class="gf-public-title">
            ${esc(field.label)}${requiredMark(field, true)}
          </span>
          <input
            id="registrant-whatsapp"
            name="whatsapp"
            type="tel"
            inputmode="tel"
            autocomplete="tel"
            required
            maxlength="30"
            placeholder="08xxxxxxxxxx"
          >
        </label>
      </div>
    `;
  }

  const renderedSpecial = new Set();

  function renderFieldInAdminOrder(field) {
    if (field === registrationField) {
      renderedSpecial.add(field);
      return renderRegistrationTypeField(field);
    }

    if (field === teamNameField) {
      renderedSpecial.add(field);
      return renderTeamName(field);
    }

    if (field === whatsappField) {
      renderedSpecial.add(field);
      return renderWhatsapp(field);
    }

    if (
      field === participantNameField ||
      field === participantRoleField
    ) {
      if (renderedSpecial.has(participantNameField)) return "";

      renderedSpecial.add(participantNameField);
      if (participantRoleField) renderedSpecial.add(participantRoleField);

      return renderParticipantSection();
    }

    return renderCustomField(field);
  }

  const generatedRegistrationType =
    !registrationField && event.registration_type !== "both"
      ? `
        <input
          type="hidden"
          id="reg-type"
          name="registration_type"
          value="${esc(event.registration_type)}"
        >
      `
      : "";

  const generatedBothType =
    !registrationField && event.registration_type === "both"
      ? `
        <div class="gf-public-question">
          <label for="reg-type">
            <span class="gf-public-title">Jenis Pendaftaran *</span>
            <select id="reg-type" name="registration_type" required>
              <option value="individual">Individu</option>
              <option value="team">Tim / Grup</option>
            </select>
          </label>
        </div>
      `
      : "";

  const fieldsHtml = fields.map(renderFieldInAdminOrder).join("");

  area.innerHTML = `
    <form id="register-form" novalidate>
      <div class="gf-public-intro">
        <span class="eyebrow">FORMULIR PENDAFTARAN</span>
        <h2>Daftar Event</h2>
        <p>
          Isi seluruh pertanyaan yang disediakan panitia.
          Kolom bertanda <b>*</b> wajib diisi.
        </p>
      </div>

      ${generatedRegistrationType}
      ${generatedBothType}
      ${fieldsHtml}

      ${event.fee_mode === "manual_transfer" && Number(event.fee_amount || 0) > 0 ? `
        <div class="notice">
          <b>Pembayaran transfer manual</b><br>
          Bank: ${esc(event.bank_name || "Informasi bank belum tersedia")}<br>
          Nomor rekening: ${esc(event.bank_account_number || "Belum diatur")}<br>
          Atas nama: ${esc(event.bank_account_holder || "Belum diatur")}<br>
          <small>
            Nominal transfer final akan diinformasikan setelah server membuat token pendaftaran.
          </small>
        </div>
      ` : ""}

      <button type="submit" class="btn btn-primary full gf-submit">
        Kirim Pendaftaran
      </button>

      <p class="field-hint">
        Pastikan seluruh data benar sebelum mengirim pendaftaran.
      </p>
    </form>

    <div id="registration-result"></div>
  `;

  const form = $("#register-form");
  const type = $("#reg-type");
  const people = $("#people-list");
  const addPersonButton = $("#add-person");
  const teamWrap = $("#team-name-wrap");
  const teamInput = $("#team-name");

  if (!form || !type || !people || !addPersonButton) {
    area.innerHTML = `
      <div class="notice">
        Formulir tidak dapat dibentuk. Pastikan kolom Nama Atlet/Nama Peserta
        dan Nomor WhatsApp sudah dibuat di Form Builder Admin.
      </div>
    `;
    return;
  }

  // ------------------------------------------------
  // 7. BARIS PESERTA DAN PERAN
  // ------------------------------------------------

  function isTeamMode() {
    return type.value === "team";
  }

  function isSupportRole(role) {
    return /pelatih|coach|manajer|manager|ofisial|official|pendamping|support/i.test(role);
  }

  function optionList(values) {
    return values.map(value =>
      `<option value="${esc(value)}">${esc(value)}</option>`
    ).join("");
  }

  function createPersonRow(index, extra = false) {
    const selectedRole = extra
      ? (supportRoles[0] || roles[0] || defaultRole)
      : defaultRole;

    const row = document.createElement("div");
    row.className = "person-row reo-builder-person";

    const roleHtml = participantRoleField
      ? `
        <label>
          <span class="gf-public-title">
            ${esc(participantRoleField.label)}${requiredMark(participantRoleField, true)}
          </span>
          <select name="person_role" required>
            ${optionList(roles)}
          </select>
        </label>
      `
      : `
        <input
          type="hidden"
          name="person_role"
          value="${esc(defaultRole)}"
        >
      `;

    row.innerHTML = `
      <div class="reo-person-row-head">
        <b class="person-row-label">Data peserta ${index + 1}</b>
        ${extra
          ? '<button type="button" class="remove-person" aria-label="Hapus peserta">Hapus</button>'
          : ""}
      </div>

      <label>
        <span class="gf-public-title">
          ${esc(participantNameField.label)}${requiredMark(participantNameField, true)}
        </span>
        <input
          name="person_name"
          type="text"
          required
          maxlength="150"
          autocomplete="name"
          placeholder="Nama lengkap sesuai identitas"
        >
      </label>

      ${roleHtml}
    `;

    const roleSelect = row.querySelector('[name="person_role"]');

    if (roleSelect && roles.includes(selectedRole)) {
      roleSelect.value = selectedRole;
    }

    const removeButton = row.querySelector(".remove-person");

    if (removeButton) {
      removeButton.addEventListener("click", () => {
        row.remove();
        renumberPeople();
      });
    }

    return row;
  }

  function renumberPeople() {
    people.querySelectorAll(".person-row-label").forEach((label, index) => {
      label.textContent = `Data peserta ${index + 1}`;
    });
  }

  function updateRegistrationMode() {
    const teamMode = isTeamMode();
    const rows = [...people.querySelectorAll(".reo-builder-person")];

    if (!teamMode && rows.length > 1) {
      rows.slice(1).forEach(row => row.remove());
      renumberPeople();
    }

    if (teamWrap) {
      teamWrap.classList.toggle("hidden", !teamMode);
    }

    if (teamInput) {
      teamInput.required = teamMode;
    }

    if (teamMode) {
      addPersonButton.textContent = "＋ Tambah Anggota Tim";
      addPersonButton.classList.remove("hidden");
    } else {
      addPersonButton.classList.add("hidden");
    }

    const help = $("#participant-add-help");
    if (help) {
      help.textContent = teamMode
        ? "Anda dapat menambahkan anggota tim. Maksimal 50 peserta dalam satu pendaftaran."
        : "Mode individu: satu peserta untuk satu pendaftaran.";
    }
  }

  function resetPeople() {
    people.innerHTML = "";
    people.append(createPersonRow(0, false));
    updateRegistrationMode();
  }

  addPersonButton.addEventListener("click", () => {
    const currentCount =
      people.querySelectorAll(".reo-builder-person").length;

    if (!isTeamMode()) return;

    if (currentCount >= 50) {
      alert("Maksimal 50 peserta dalam satu pendaftaran.");
      return;
    }

    people.append(createPersonRow(currentCount, true));
    renumberPeople();
  });

  type.addEventListener("change", updateRegistrationMode);
  resetPeople();

  // ------------------------------------------------
  // 8. PRATINJAU PILIHAN FILE
  // ------------------------------------------------

  form.addEventListener("change", event => {
    const input = event.target.closest("[data-upload-field]");
    if (!input) return;

    const file = input.files?.[0];
    const key = input.dataset.uploadKey;
    const preview = form.querySelector(
      `[data-upload-preview="${CSS.escape(key)}"]`
    );

    if (!file || !preview) {
      if (preview) {
        preview.hidden = true;
        preview.textContent = "";
      }
      return;
    }

    const isPhoto = input.dataset.uploadKind === "photo";
    const maxBytes = isPhoto ? 5 * 1024 * 1024 : 10 * 1024 * 1024;

    if (file.size > maxBytes) {
      input.value = "";
      preview.hidden = true;
      alert(
        isPhoto
          ? "Ukuran foto maksimal 5 MB."
          : "Ukuran dokumen maksimal 10 MB."
      );
      return;
    }

    if (isPhoto && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      input.value = "";
      preview.hidden = true;
      alert("Format foto harus JPG, JPEG, PNG, atau WebP.");
      return;
    }

    if (!isPhoto) {
      const allowedExtensions =
        /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv)$/i;

      if (!allowedExtensions.test(file.name)) {
        input.value = "";
        preview.hidden = true;
        alert("Format dokumen belum didukung.");
        return;
      }
    }

    preview.textContent = `File dipilih: ${file.name}`;
    preview.hidden = false;
  });

  // ------------------------------------------------
  // 9. VALIDASI DAN SIMPAN PENDAFTARAN
  // ------------------------------------------------

  form.addEventListener("submit", async submitEvent => {
    submitEvent.preventDefault();

    // Validasi kelompok checkbox wajib.
    const missingCheckbox = [
      ...form.querySelectorAll(
        '[data-custom-type="checkbox"][data-custom-required="true"]'
      )
    ].find(group =>
      !group.querySelector('input[type="checkbox"]:checked')
    );

    if (missingCheckbox) {
      alert(
        `Pertanyaan wajib belum dijawab: ${
          missingCheckbox.querySelector("legend")?.textContent || "Pilihan"
        }`
      );

      missingCheckbox.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

      return;
    }

    // Validasi isian wajib lainnya.
    if (!form.reportValidity()) return;

    const fd = new FormData(form);

    const names = fd.getAll("person_name")
      .map(value => String(value).trim());

    const roleValues = fd.getAll("person_role")
      .map(value => String(value).trim());

    const registrationType = String(
      fd.get("registration_type") || event.registration_type
    );

    const teamName = String(
      fd.get("team_name") || ""
    ).trim();

    const whatsapp = String(
      fd.get("whatsapp") || ""
    ).trim();

    if (!names.length || names.some(name => !name)) {
      alert("Nama setiap peserta wajib diisi.");
      return;
    }

    if (names.length !== roleValues.length) {
      alert("Data peran peserta tidak sesuai. Periksa kembali formulir.");
      return;
    }

    if (!whatsapp) {
      alert("Nomor WhatsApp aktif wajib diisi.");
      return;
    }

    if (registrationType === "team" && !teamName) {
      alert("Nama tim atau klub wajib diisi.");
      return;
    }

    if (
      registrationType === "individual" &&
      names.length > 1
    ) {
      alert("Mode individu hanya menerima satu peserta dalam satu pendaftaran.");
      return;
    }

    // File input baru ditampilkan dan divalidasi di tahap ini.
    // File belum dikirim ke Storage karena upload publik belum dikonfigurasi.
    const selectedUploads = [
      ...form.querySelectorAll("[data-upload-field]")
    ].filter(input => input.files && input.files.length > 0);

    if (selectedUploads.length) {
      alert(
        "Kolom unggah sudah tampil, tetapi penyimpanan foto/dokumen ke Supabase belum diaktifkan. File belum dikirim. Kosongkan kolom unggah untuk melanjutkan pendaftaran, atau tunggu integrasi Storage."
      );
      return;
    }

    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = "Mengirim...";

    const custom = {};

    // Hanya field yang bukan kolom sistem yang disimpan ke custom_data.
    fields
      .filter(field => !systemFields.has(field))
      .forEach(field => {
        const key = fieldKey(field);

        if (!key) return;

        if (
          field.field_type === "photo_upload" ||
          field.field_type === "document_upload"
        ) {
          return;
        }

        if (field.field_type === "checkbox") {
          const values = fd.getAll(key).map(String);
          if (values.length) custom[key] = values;
          return;
        }

        const value = fd.get(key);

        if (value !== null && value !== "") {
          custom[key] = String(value);
        }
      });

    // Kontrak payload dipertahankan agar tetap sesuai dengan
    // Edge Function quick-responder yang digunakan saat ini.
    const payload = {
      event_id: event.id,
      registration_type: registrationType,
      team_name: teamName,
      whatsapp,
      participants: names.map((name, index) => ({
        name,
        role: roleValues[index] || defaultRole || "Peserta"
      })),
      custom_data: custom
    };

    try {
      const { data, error } = await db.functions.invoke(
        "quick-responder",
        { body: payload }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (!data?.token) {
        throw new Error(
          "Pendaftaran belum dikonfirmasi server. Periksa status sebelum mengirim ulang."
        );
      }

      $("#registration-result").innerHTML = `
        <div class="status-result">
          <b>Pendaftaran diterima.</b>
          <p>Simpan token berikut untuk memeriksa status pendaftaran.</p>
          <div class="token-text">${esc(data.token)}</div>
          <p>Biaya: <b>${money(data.payment_amount)}</b></p>
          <p>
            ${
              Number(data.payment_amount || 0) > 0
                ? "Lakukan transfer sesuai nominal tagihan dan tunggu verifikasi admin."
                : "Pendaftaran gratis berhasil dicatat."
            }
          </p>
          <a class="btn btn-secondary btn-small" href="cek-status.html">
            Cek Status Pendaftaran
          </a>
        </div>
      `;

      form.reset();

      if (
        event.registration_type === "both" &&
        typeOptions.some(option => option.value === "individual")
      ) {
        type.value = "individual";
      }

      if (event.registration_type !== "both") {
        type.value = event.registration_type;
      }

      resetPeople();

      $("#registration-result").scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

    } catch (error) {
      console.error("Pendaftaran event:", error);

      $("#registration-result").innerHTML = `
        <p class="form-message">
          Pendaftaran gagal:
          ${esc(error.message || "Periksa koneksi dan konfigurasi Supabase.")}
        </p>
      `;

    } finally {
      button.disabled = false;
      button.textContent = "Kirim Pendaftaran";
    }
  });


  // ------------------------------------------------
  // 10. STYLE FORMULIR PUBLIK
  // ------------------------------------------------

  function injectRegistrationStyles() {
    if (document.getElementById("rajawali-google-form-public-css")) return;

    const style = document.createElement("style");
    style.id = "rajawali-google-form-public-css";

    style.textContent = `
      .gf-public-intro{
        padding:0 0 13px;
        border-bottom:1px solid #e8ecf2;
        margin-bottom:16px
      }

      .gf-public-intro h2{
        font-size:22px;
        margin:7px 0
      }

      .gf-public-intro p,
      .gf-participant-section>p{
        font-size:11px;
        color:#78849a;
        margin:0;
        line-height:1.6
      }

      .gf-public-question{
        background:#fff;
        border:1px solid #e5e9f0;
        border-radius:9px;
        padding:15px 15px 12px;
        margin:12px 0;
        min-width:0
      }

      .gf-public-question label{
        display:grid;
        gap:8px;
        margin:0 0 10px!important;
        color:#34415b;
        font-size:12px;
        font-weight:700
      }

      .gf-public-title{
        display:block;
        font-size:13px;
        font-weight:800;
        color:#202e47;
        line-height:1.5;
        margin-bottom:3px
      }

      .gf-required-mark{
        color:#d0343b;
        font-weight:900
      }

      .gf-public-choice-group{
        border:1px solid #e5e9f0
      }

      .gf-public-choice-group legend{
        padding:0 3px
      }

      .gf-public-choice{
        display:flex!important;
        grid-template-columns:none!important;
        align-items:center;
        gap:10px!important;
        font-size:12px!important;
        font-weight:500!important;
        padding:7px 3px;
        cursor:pointer
      }

      .gf-public-choice input{
        width:17px!important;
        height:17px;
        margin:0;
        accent-color:#173c70;
        flex:0 0 17px
      }

      .gf-public-choice span{
        font-weight:500
      }

      .gf-public-help{
        display:block;
        color:#8a94a5;
        font-size:10px;
        margin-top:4px;
        line-height:1.5
      }

      .gf-public-empty{
        font-size:11px;
        color:#9b5360
      }

      .gf-participant-section h3{
        font-size:15px;
        margin:0 0 5px
      }

      .reo-builder-person{
        background:#f8f9fc;
        border:1px solid #e6ebf2;
        border-radius:8px;
        padding:12px;
        margin:10px 0
      }

      .reo-person-row-head{
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-bottom:10px;
        color:#233653;
        font-size:12px
      }

      .reo-person-row-head button{
        border:0;
        background:#fff0f0;
        color:#a33b43;
        border-radius:5px;
        padding:5px 9px;
        font-size:11px
      }

      .gf-upload-question input[type="file"]{
        display:block;
        width:100%;
        max-width:100%;
        padding:10px;
        border:1px dashed #cbd5e1;
        border-radius:7px;
        background:#f8fafc;
        font-size:11px
      }

      .gf-upload-preview{
        margin-top:8px;
        padding:8px 10px;
        border-radius:6px;
        background:#edf5ff;
        color:#234a7c;
        font-size:11px;
        overflow-wrap:anywhere
      }

      .gf-upload-note{
        display:block;
        margin-top:7px;
        color:#9a6a27;
        font-size:10px;
        line-height:1.5
      }

      .gf-submit{
        margin-top:10px
      }

      @media(max-width:700px){
        .gf-public-question{padding:13px}
        .gf-public-title{font-size:12px}
      }
    `;

    document.head.appendChild(style);
  }
});
