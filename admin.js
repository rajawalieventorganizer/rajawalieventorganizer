document.addEventListener("DOMContentLoaded", () => {
  const { $, apiReady, slugify, esc, date, money } = window.Rajawali;
  const login = $("#login-section"), dashboard = $("#dashboard-section"), msg = $("#login-message"), eventList = $("#admin-event-list");
  let currentEvents = [], fieldRows = [];
  const show = (el, on) => el.classList.toggle("hidden", !on);
  const statusTag = s => `<span class="status-pill ${esc(s)}">${esc(s)}</span>`;
  const fieldTypeOptions = [
    ["text", "Jawaban singkat"], ["textarea", "Paragraf"], ["number", "Angka"],
    ["date", "Tanggal"], ["time", "Waktu"], ["email", "Email"], ["tel", "Nomor telepon"],
    ["radio", "Pilihan ganda"], ["checkbox", "Kotak centang"], ["select", "Dropdown"],
    ["photo_upload", "Unggah Foto"], ["document_upload", "Unggah Dokumen"]
  ];
  const choiceTypes = new Set(["radio", "checkbox", "select"]);

  injectBuilderStyles();
  const addQuestionButton = $("#add-field-btn");
  if (addQuestionButton) addQuestionButton.textContent = "＋ Tambah Pertanyaan";
  function injectBuilderStyles() {
    if (document.getElementById("rajawali-google-form-admin-css")) return;
    const style = document.createElement("style");
    style.id = "rajawali-google-form-admin-css";
    style.textContent = `
      #field-builder{display:grid;gap:15px;margin:12px 0 20px}
      .gf-question{border:1px solid #e4e8f0;border-left:5px solid #1b3c70;border-radius:10px;background:#fff;padding:18px 18px 14px;box-shadow:0 5px 18px rgba(8,26,59,.045)}
      .gf-qhead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:13px;color:#8791a3;font-size:10px;font-weight:800;letter-spacing:.1em}
      .gf-qtools{display:flex;gap:5px;flex-wrap:wrap}.gf-icon-btn{border:1px solid #e1e6ef;background:#fff;color:#4b5870;border-radius:6px;padding:6px 9px;cursor:pointer;font-size:11px}.gf-icon-btn:hover{background:#f2f5fa}.gf-icon-btn.gf-delete{color:#b4232b;background:#fff7f7}
      .gf-question label.gf-label{display:block;margin:0 0 7px!important;color:#25334c!important;font-size:12px!important;font-weight:800!important}
      .gf-question input.gf-question-title{font-size:15px!important;font-weight:700;border:0!important;border-bottom:1px solid #dce2ec!important;border-radius:0!important;padding:10px 2px!important;box-shadow:none!important;background:transparent!important}
      .gf-question input.gf-question-title:focus{border-bottom:2px solid #315a95!important}
      .gf-type-row{display:flex;justify-content:flex-end;margin:14px 0}.gf-type-row select{max-width:245px;font-size:12px;padding:9px 11px!important;background:#f7f9fc!important}
      .gf-options{border-top:1px solid #edf0f5;padding-top:13px;margin-top:8px}.gf-options-title{font-size:11px;font-weight:800;color:#4b5870;margin-bottom:9px}
      .gf-option-row{display:flex;align-items:center;gap:9px;margin:7px 0}.gf-option-symbol{width:17px;height:17px;border:1.5px solid #9ca8ba;border-radius:50%;flex:0 0 17px}.gf-option-symbol.square{border-radius:4px}.gf-option-symbol.dropdown{width:22px;height:16px;border-radius:3px;position:relative}.gf-option-symbol.dropdown:after{content:'⌄';position:absolute;right:3px;top:-3px;font-size:12px}
      .gf-option-row input{flex:1;min-width:0;padding:9px 10px!important;font-size:12px!important}.gf-option-remove{border:0;background:transparent;color:#9a5260;font-size:18px;cursor:pointer;padding:3px 7px}.gf-add-option{border:0;background:transparent;color:#24518e;font-size:11px;font-weight:800;padding:8px 0;cursor:pointer}
      .gf-preview{background:#f7f9fc;border-radius:7px;padding:12px;margin-top:12px}.gf-preview small{display:block;color:#8a94a5;font-size:9px;font-weight:800;letter-spacing:.08em;margin-bottom:7px}.gf-preview-line{height:1px;background:#cfd6e1;width:75%;margin:11px 0 5px}.gf-preview-choice{display:flex;align-items:center;gap:8px;font-size:11px;color:#59667b;margin:7px 0}.gf-preview-box{width:14px;height:14px;border:1px solid #aab4c3;border-radius:50%}.gf-preview-box.square{border-radius:3px}
      .gf-qfoot{display:flex;justify-content:flex-end;align-items:center;border-top:1px solid #edf0f5;margin-top:13px;padding-top:11px}.gf-required{display:flex!important;align-items:center;gap:8px!important;margin:0!important;font-size:11px!important;color:#4b5870!important}.gf-required input{width:auto!important}
      .gf-empty{border:1px dashed #c9d2e0;border-radius:9px;padding:25px;text-align:center;color:#758197;font-size:12px;background:#fafbfd}
      .gf-hint{color:#78849a;font-size:10px;line-height:1.6;margin-top:6px}
      @media(max-width:560px){.gf-question{padding:14px}.gf-qhead{align-items:flex-start}.gf-type-row select{max-width:100%;width:100%}.gf-type-row{justify-content:stretch}}
    `;
    document.head.appendChild(style);
  }

  function switchTab(id) {
    document.querySelectorAll(".admin-panel").forEach(p => show(p, p.id === id));
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === id));
  }
  document.querySelectorAll(".tab-btn").forEach(b => b.addEventListener("click", () => {
    switchTab(b.dataset.tab);
    if (b.dataset.tab === "registrants-panel") loadRegistrants();
  }));
  $("#new-event-btn").addEventListener("click", () => { resetEditor(); switchTab("editor-panel"); });
  $("#cancel-edit-btn").addEventListener("click", () => { resetEditor(); switchTab("events-panel"); });
  $("#event-title").addEventListener("input", () => { if (!$("#edit-event-id").value) $("#event-slug").value = slugify($("#event-title").value); });
  $("#add-field-btn").addEventListener("click", () => addField());
  $("#logout-btn").addEventListener("click", async () => { await db.auth.signOut(); location.reload(); });
  $("#login-form").addEventListener("submit", async e => {
    e.preventDefault(); if (!apiReady()) return;
    msg.textContent = "Memeriksa akun...";
    const { error } = await db.auth.signInWithPassword({ email: $("#admin-email").value, password: $("#admin-password").value });
    if (error) { msg.textContent = error.message; return; }
    await initialize();
  });

  async function initialize() {
    const { data: { user } } = await db.auth.getUser();
    if (!user) { show(login, true); show(dashboard, false); return; }
    const { data: admin, error } = await db.from("organizer_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (error || !admin) {
      await db.auth.signOut(); msg.textContent = "Akun ini belum terdaftar sebagai admin Rajawali."; show(login, true); return;
    }
    show(login, false); show(dashboard, true); show($("#logout-btn"), true);
    await loadEvents(); await loadSettings();
  }
  async function getFunctionErrorMessage(error) {
    let message = error?.message || "Fungsi penghapusan gagal.";
    try {
      const response = error?.context?.clone ? error.context.clone() : error?.context;
      if (response?.json) { const body = await response.json(); message = body?.error || body?.message || message; }
    } catch (_) { }
    return message;
  }
  async function loadEvents() {
    eventList.innerHTML = '<div class="empty-state">Memuat event...</div>';
    const [{ data, error }, { count: regCount }] = await Promise.all([
      db.from("events").select("*").order("created_at", { ascending: false }),
      db.from("registrations").select("*", { count: "exact", head: true })
    ]);
    if (error) { eventList.innerHTML = `<div class="empty-state">Gagal memuat: ${esc(error.message)}</div>`; return; }
    currentEvents = data || [];
    $("#stat-total").textContent = currentEvents.length;
    $("#stat-live").textContent = currentEvents.filter(x => x.status === "published").length;
    $("#stat-draft").textContent = currentEvents.filter(x => x.status === "draft").length;
    $("#stat-reg").textContent = regCount || 0;
    if (!currentEvents.length) { eventList.innerHTML = '<div class="empty-state">Belum ada event. Tekan “Buat Event” untuk memulai.</div>'; return; }
    eventList.innerHTML = currentEvents.map(e => `<article class="admin-event-item"><div><h3>${esc(e.title)}</h3><p>${date(e.start_date)} · ${esc(e.venue || "Lokasi belum ditentukan")} · ${statusTag(e.status)}</p></div><div class="admin-actions"><button data-edit="${e.id}">Edit</button><a href="event.html?slug=${encodeURIComponent(e.slug)}" target="_blank">Lihat</a><button data-publish="${e.id}">${e.status === "published" ? "Jadikan Draft" : "Publikasikan"}</button><button class="danger" data-delete="${e.id}">Hapus</button></div></article>`).join("");
  }
  eventList.addEventListener("click", async e => {
    const edit = e.target.dataset.edit, pub = e.target.dataset.publish, del = e.target.dataset.delete;
    if (edit) { const item = currentEvents.find(x => x.id === edit); if (item) await editEvent(item); }
    if (pub) {
      const item = currentEvents.find(x => x.id === pub); if (!item) return;
      const next = item.status === "published" ? "draft" : "published";
      const { error } = await db.from("events").update({ status: next }).eq("id", pub);
      if (error) alert(error.message); await loadEvents();
    }
    if (del) {
      const item = currentEvents.find(x => x.id === del); if (!item) return;
      const yes = confirm(`Anda yakin ingin menghapus event “${item.title}”? Semua pendaftaran, data peserta, pembayaran/konfirmasi yang tersimpan, formulir, menu, dan file event yang tercatat akan ikut dihapus. Tindakan ini PERMANEN dan tidak dapat dibatalkan.`);
      if (!yes) return;
      const btn = e.target; btn.disabled = true; btn.textContent = "Menghapus...";
      try {
        const { data, error } = await db.functions.invoke("delete-event", { body: { event_id: del } });
        if (error) throw new Error(await getFunctionErrorMessage(error));
        if (data?.error) throw new Error(data.error);
        if (!data?.success) throw new Error("Server belum mengonfirmasi penghapusan.");
        alert(`Event “${item.title}” dan seluruh data terkait berhasil dihapus.`); await loadEvents();
      } catch (err) {
        alert(`Penghapusan gagal: ${err?.message || "Terjadi kesalahan."}\n\nData event tidak dianggap terhapus.`);
        btn.disabled = false; btn.textContent = "Hapus";
      }
    }
  });

  // GOOGLE FORMS-LIKE BUILDER: simpan state setiap input berubah, bukan membaca ulang setelah render.
  function newField(seed = {}) {
    return {
      id: seed.id || (crypto.randomUUID ? crypto.randomUUID() : `f-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      field_key: seed.field_key || "", label: seed.label || "", field_type: seed.field_type || "text",
      options: Array.isArray(seed.options) ? seed.options.map(String) : [],
      is_required: Boolean(seed.is_required), sort_order: Number(seed.sort_order || 0)
    };
  }
  function captureBuilderState() {
    const box = $("#field-builder");
    if (!box) return;
    box.querySelectorAll(".gf-question").forEach(row => {
      const f = fieldRows.find(x => x.id === row.dataset.row);
      if (!f) return;
      f.label = row.querySelector(".gf-question-title")?.value || "";
      f.field_type = row.querySelector(".gf-type")?.value || "text";
      f.is_required = Boolean(row.querySelector(".gf-required input")?.checked);
      f.options = [...row.querySelectorAll(".gf-option")].map(input => input.value);
    });
  }
  function optionSymbol(type) {
    if (type === "checkbox") return '<span class="gf-option-symbol square"></span>';
    if (type === "select") return '<span class="gf-option-symbol dropdown"></span>';
    return '<span class="gf-option-symbol"></span>';
  }
  function previewFor(f) {
    if (f.field_type === "radio" || f.field_type === "checkbox") {
      const opts = (f.options || []).filter(x => x.trim());
      return opts.slice(0, 4).map(o => `<div class="gf-preview-choice"><span class="gf-preview-box ${f.field_type === "checkbox" ? "square" : ""}"></span>${esc(o)}</div>`).join("") || '<div class="gf-preview-choice">Opsi jawaban akan tampil di sini</div>';
    }
    if (f.field_type === "select") return `<div class="gf-preview-choice">Pilih jawaban <span style="margin-left:auto">⌄</span></div>`;
    if (f.field_type === "textarea") return '<div class="gf-preview-line" style="height:42px;border:1px solid #d6dce6;border-radius:5px;width:100%"></div>';
    if (f.field_type === "photo_upload") {
      return '<div class="gf-preview-choice"><span>▧</span> Pilih atau unggah foto</div><div class="gf-hint">JPG, JPEG, PNG, atau WebP</div>';
    }
    if (f.field_type === "document_upload") {
      return '<div class="gf-preview-choice"><span>▤</span> Pilih atau unggah dokumen</div><div class="gf-hint">PDF, DOC, DOCX, XLS, XLSX, dan format dokumen lainnya</div>';
    }
    return '<div class="gf-preview-line"></div>';
  }
  function renderFields() {
    const box = $("#field-builder");
    if (!fieldRows.length) {
      box.innerHTML = '<div class="gf-empty">Belum ada pertanyaan. Tekan <b>+ Tambah Pertanyaan</b> untuk mulai membuat formulir.</div>';
      return;
    }
    box.innerHTML = fieldRows.map((f, i) => {
      const typeOpts = fieldTypeOptions.map(([value, label]) => `<option value="${value}" ${f.field_type === value ? "selected" : ""}>${label}</option>`).join("");
      const options = choiceTypes.has(f.field_type) ? `
        <div class="gf-options"><div class="gf-options-title">Pilihan jawaban</div>
          <div class="gf-option-list">${(f.options.length ? f.options : [""]).map((o, oi) => `<div class="gf-option-row">${optionSymbol(f.field_type)}<input class="gf-option" value="${esc(o)}" placeholder="Opsi ${oi + 1}" aria-label="Opsi ${oi + 1}"><button type="button" class="gf-option-remove" data-remove-option="${oi}" aria-label="Hapus opsi">×</button></div>`).join("")}</div>
          <button type="button" class="gf-add-option" data-add-option>＋ Tambahkan opsi</button>
          <div class="gf-hint">Tambahkan setiap jawaban sebagai opsi tersendiri. Peserta akan melihat opsi ini saat mendaftar.</div>
        </div>` : "";
      return `<article class="gf-question" data-row="${f.id}">
        <div class="gf-qhead"><span>PERTANYAAN ${i + 1}</span><div class="gf-qtools">
          <button type="button" class="gf-icon-btn" data-up title="Pindah ke atas">↑</button>
          <button type="button" class="gf-icon-btn" data-down title="Pindah ke bawah">↓</button>
          <button type="button" class="gf-icon-btn" data-duplicate title="Duplikat pertanyaan">Duplikat</button>
          <button type="button" class="gf-icon-btn gf-delete" data-delete-field title="Hapus pertanyaan">Hapus</button>
        </div></div>
        <label class="gf-label">Pertanyaan</label>
        <input class="gf-question-title" type="text" value="${esc(f.label)}" placeholder="Ketik pertanyaan Anda di sini..." maxlength="180">
        <div class="gf-type-row"><select class="gf-type" aria-label="Jenis pertanyaan">${typeOpts}</select></div>
        ${options}
        <div class="gf-preview"><small>PRATINJAU JAWABAN PESERTA</small>${previewFor(f)}</div>
        <div class="gf-qfoot"><label class="gf-required"><input type="checkbox" ${f.is_required ? "checked" : ""}> Wajib diisi</label></div>
      </article>`;
    }).join("");
  }
  function addField() {
    captureBuilderState();
    fieldRows.push(newField({ field_type: "text", options: [] }));
    renderFields();
    const last = $("#field-builder .gf-question:last-child .gf-question-title");
    last?.focus();
  }
  $("#field-builder").addEventListener("input", e => {
    const row = e.target.closest(".gf-question"); if (!row) return;
    const f = fieldRows.find(x => x.id === row.dataset.row); if (!f) return;
    if (e.target.classList.contains("gf-question-title")) f.label = e.target.value;
    if (e.target.classList.contains("gf-option")) f.options = [...row.querySelectorAll(".gf-option")].map(input => input.value);
  });
  $("#field-builder").addEventListener("change", e => {
    const row = e.target.closest(".gf-question"); if (!row) return;
    const f = fieldRows.find(x => x.id === row.dataset.row); if (!f) return;
    if (e.target.classList.contains("gf-type")) { f.field_type = e.target.value; f.options = f.options.length ? f.options : ["", ""]; renderFields(); }
    if (e.target.closest(".gf-required")) f.is_required = e.target.checked;
  });
  $("#field-builder").addEventListener("click", e => {
    const row = e.target.closest(".gf-question");
    if (!row) return;
    captureBuilderState();
    const index = fieldRows.findIndex(x => x.id === row.dataset.row);
    if (index < 0) return;
    if (e.target.closest("[data-add-option]")) { fieldRows[index].options.push(""); renderFields(); return; }
    const removeOption = e.target.closest("[data-remove-option]");
    if (removeOption) {
      const oi = Number(removeOption.dataset.removeOption);
      fieldRows[index].options.splice(oi, 1);
      if (!fieldRows[index].options.length) fieldRows[index].options = [""];
      renderFields(); return;
    }
    if (e.target.closest("[data-delete-field]")) { fieldRows.splice(index, 1); renderFields(); return; }
    if (e.target.closest("[data-duplicate]")) {
      const copy = newField({ ...fieldRows[index], id: undefined, field_key: "", label: fieldRows[index].label ? `${fieldRows[index].label} (salinan)` : "" });
      fieldRows.splice(index + 1, 0, copy); renderFields(); return;
    }
    if (e.target.closest("[data-up]") && index > 0) { [fieldRows[index - 1], fieldRows[index]] = [fieldRows[index], fieldRows[index - 1]]; renderFields(); return; }
    if (e.target.closest("[data-down]") && index < fieldRows.length - 1) { [fieldRows[index + 1], fieldRows[index]] = [fieldRows[index], fieldRows[index + 1]]; renderFields(); }
  });
  function readFields() {
    captureBuilderState();
    const result = [];
    const usedKeys = new Set();
    for (let i = 0; i < fieldRows.length; i++) {
      const f = fieldRows[i];
      const label = String(f.label || "").trim();
      if (!label) continue;
      let key = f.field_key || `${slugify(label).replace(/-/g, "_") || "pertanyaan"}_${i + 1}`;
      const base = key; let suffix = 2;
      while (usedKeys.has(key)) key = `${base}_${suffix++}`;
      usedKeys.add(key);
      const options = (f.options || []).map(x => String(x).trim()).filter(Boolean);
      if (choiceTypes.has(f.field_type) && options.length < 2) throw new Error(`Pertanyaan “${label}” harus memiliki minimal 2 pilihan jawaban.`);
      result.push({ field_key: key, label, field_type: f.field_type, options, is_required: Boolean(f.is_required), sort_order: result.length });
    }
    return result;
  }
  function resetEditor() {
    $("#event-form").reset(); $("#edit-event-id").value = ""; $("#editor-title").textContent = "Buat Event Baru";
    fieldRows = []; renderFields(); $("#event-fee").value = 0; $("#fee-basis").value = "registration";
  }
  async function editEvent(e) {
    resetEditor(); $("#editor-title").textContent = "Edit Event"; $("#edit-event-id").value = e.id;
    $("#event-title").value = e.title; $("#event-slug").value = e.slug; $("#event-category").value = e.category || "Lainnya";
    $("#event-status").value = e.status; $("#event-start").value = e.start_date || ""; $("#event-end").value = e.end_date || "";
    $("#event-deadline").value = e.registration_deadline || ""; $("#event-venue").value = e.venue || "";
    $("#registration-type").value = e.registration_type; $("#fee-mode").value = e.fee_mode; $("#event-fee").value = e.fee_amount || 0;
    $("#fee-basis").value = e.fee_basis || "registration"; $("#bank-name").value = e.bank_name || "";
    $("#bank-number").value = e.bank_account_number || ""; $("#bank-holder").value = e.bank_account_holder || "";
    $("#approval-required").checked = e.approval_required; $("#event-description-input").value = e.description || "";
    const { data, error } = await db.from("event_fields").select("*").eq("event_id", e.id).order("sort_order");
    if (error) { alert(`Gagal memuat formulir: ${error.message}`); return; }
    fieldRows = (data || []).map(f => newField(f)); renderFields(); switchTab("editor-panel");
  }

  $("#event-form").addEventListener("submit", async e => {
    e.preventDefault(); const button = e.submitter || $("#event-form button[type=submit]");
    button.disabled = true; $("#save-message").textContent = "Memvalidasi dan menyimpan...";
    try {
      const fields = readFields();
      const id = $("#edit-event-id").value, feeMode = $("#fee-mode").value, fee = feeMode === "free" ? 0 : Number($("#event-fee").value || 0);
      const slug = slugify($("#event-slug").value || $("#event-title").value);
      if (!slug) throw new Error("Nama event wajib diisi.");
      const payload = {
        title: $("#event-title").value.trim(), slug, category: $("#event-category").value, status: $("#event-status").value,
        start_date: $("#event-start").value, end_date: $("#event-end").value || null,
        registration_deadline: $("#event-deadline").value || null, venue: $("#event-venue").value,
        registration_type: $("#registration-type").value, fee_mode: feeMode, fee_amount: fee,
        fee_basis: $("#fee-basis").value, bank_name: $("#bank-name").value,
        bank_account_number: $("#bank-number").value, bank_account_holder: $("#bank-holder").value,
        approval_required: $("#approval-required").checked, description: $("#event-description-input").value
      };
      let saved;
      if (id) {
        const { data, error } = await db.from("events").update(payload).eq("id", id).select("id").single();
        if (error) throw error; saved = data;
      } else {
        const { data, error } = await db.from("events").insert(payload).select("id").single();
        if (error) throw error; saved = data;
      }
      const image = $("#event-cover").files[0];
      if (image) {
        const path = `${saved.id}/${Date.now()}-${image.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await db.storage.from("event-assets").upload(path, image, { upsert: false }); if (upErr) throw upErr;
        const { data: urlData } = db.storage.from("event-assets").getPublicUrl(path);
        const { error: assetErr } = await db.from("event_assets").insert({ event_id: saved.id, bucket_name: "event-assets", object_path: path }); if (assetErr) throw assetErr;
        const { error: updateErr } = await db.from("events").update({ cover_url: urlData.publicUrl }).eq("id", saved.id); if (updateErr) throw updateErr;
      }
      // Simpan pertanyaan ke event_fields menggunakan format JSONB yang sudah dipakai.
      const { error: delErr } = await db.from("event_fields").delete().eq("event_id", saved.id); if (delErr) throw delErr;
      if (fields.length) {
        const { error: fieldErr } = await db.from("event_fields").insert(fields.map(f => ({ ...f, event_id: saved.id })));
        if (fieldErr) throw fieldErr;
      }
      $("#save-message").textContent = "Event dan formulir berhasil disimpan.";
      resetEditor(); switchTab("events-panel"); await loadEvents();
    } catch (err) {
      console.error(err); $("#save-message").textContent = `Gagal menyimpan: ${err.message || "Periksa data."}`;
    } finally { button.disabled = false; }
  });

  async function loadRegistrants() {
    const box = $("#registrant-list"); box.textContent = "Memuat data...";
    const { data, error } = await db.from("registrations").select("id,event_id,token,registrant_name,registration_type,team_name,payment_amount,payment_status,registration_status,created_at,events(title)").order("created_at", { ascending: false }).limit(300);
    if (error) { box.textContent = error.message; return; }
    window._registrations = data || []; renderRegistrants();
  }
  function renderRegistrants() {
    const q = ($("#registrant-search").value || "").toLowerCase();
    const rows = (window._registrations || []).filter(r => [r.token, r.registrant_name, r.team_name].join(" ").toLowerCase().includes(q));
    if (!rows.length) { $("#registrant-list").innerHTML = '<div class="empty-state">Belum ada pendaftar.</div>'; return; }
    $("#registrant-list").innerHTML = `<table class="data-table"><thead><tr><th>Event / Nama</th><th>Token</th><th>Biaya</th><th>Pembayaran</th><th>Pendaftaran</th><th>Aksi</th></tr></thead><tbody>${rows.map(r => `<tr><td><b>${esc(r.events?.title || "Event")}</b><br>${esc(r.registrant_name || r.team_name || "Peserta")}</td><td>${esc(r.token)}</td><td>${money(r.payment_amount)}</td><td>${statusTag(r.payment_status)}</td><td>${statusTag(r.registration_status)}</td><td>${r.payment_status === "pending" ? `<button data-verify="${r.id}" class="btn btn-small btn-primary">Verifikasi Bayar</button>` : ""} ${r.registration_status === "pending" && (r.payment_status === "verified" || r.payment_status === "not_required") ? `<button data-approve="${r.id}" class="btn btn-small btn-primary">Setujui</button>` : ""} ${r.registration_status !== "rejected" && r.registration_status !== "approved" ? `<button data-reject="${r.id}" class="btn btn-small btn-ghost">Tolak</button>` : ""}</td></tr>`).join("")}</tbody></table>`;
  }
  $("#registrant-search").addEventListener("input", renderRegistrants);
  $("#registrant-list").addEventListener("click", async e => {
    const verify = e.target.dataset.verify, approve = e.target.dataset.approve, reject = e.target.dataset.reject, id = verify || approve || reject;
    if (!id) return; const row = (window._registrations || []).find(r => r.id === id); if (!row) return;
    let update = {};
    if (verify) { if (!confirm("Konfirmasi pembayaran peserta ini sudah diterima di rekening?")) return; update = { payment_status: "verified", payment_verified_at: new Date().toISOString(), payment_verified_by: (await db.auth.getUser()).data.user.id }; }
    if (approve) { if (row.payment_status !== "verified" && row.payment_status !== "not_required") { alert("Verifikasi pembayaran terlebih dahulu."); return; } if (!confirm("Setujui pendaftaran peserta ini?")) return; update = { registration_status: "approved" }; }
    if (reject) { if (!confirm("Tolak pendaftaran ini? Status akan ditandai ditolak.")) return; update = { registration_status: "rejected", ...(row.payment_status === "pending" ? { payment_status: "rejected" } : {}) }; }
    const { error } = await db.from("registrations").update(update).eq("id", id); if (error) alert(error.message); await loadRegistrants();
  });
  async function loadSettings() {
    const { data } = await db.from("site_settings").select("*").eq("id", 1).maybeSingle(); if (!data) return;
    $("#setting-email").value = data.contact_email || ""; $("#setting-phone").value = data.contact_phone || "";
    $("#setting-address").value = data.contact_address || ""; $("#setting-social").value = data.social_url || "";
  }
  $("#settings-form").addEventListener("submit", async e => {
    e.preventDefault();
    const { error } = await db.from("site_settings").upsert({ id: 1, contact_email: $("#setting-email").value, contact_phone: $("#setting-phone").value, contact_address: $("#setting-address").value, social_url: $("#setting-social").value });
    $("#settings-message").textContent = error ? error.message : "Identitas berhasil disimpan.";
  });
  if (!window.db) { show(login, true); msg.textContent = "Isi URL dan anon key Supabase pada supabase-config.js terlebih dahulu."; return; }
  initialize();
});
