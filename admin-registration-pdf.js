/* ================================================================
   RAJAWALI EVENT ORGANIZER
   ARSIP FORMULIR PENDAFTARAN - PDF + EXCEL

   Pasang sebagai pengganti file admin-registration-pdf.js yang lama.
   admin.html yang sekarang sudah memuat file ini, jadi tidak perlu
   menambahkan tag script baru.

   Fitur:
   - Satu PDF dan satu Excel untuk setiap pendaftaran.
   - Mengambil ulang data lengkap registrations berdasarkan ID.
   - Jawaban diambil dari registrations.custom_data memakai field_key
     yang sama persis dengan event.js.
   - Urutan mengikuti event_fields.sort_order.
   - Foto dimasukkan sebagai gambar di PDF dan Excel.
   - Dokumen menjadi tautan unduhan melalui signed URL privat.
   - Anggota tim ditampilkan pada posisi kolom nama/peran di formulir.
   - Tidak mengubah pendaftaran, pembayaran, kartu peserta, QR, atau
     proses check-in.
   ================================================================ */
(() => {
  "use strict";

  const LIST_ID = "registrant-list";
  const PRIVATE_BUCKET = "registration-files";
  const SIGNED_URL_TTL = 7 * 24 * 60 * 60;
  const PDF_BUTTON_CLASS = "reo-form-pdf-button";
  const XLSX_BUTTON_CLASS = "reo-form-excel-button";

  const clean = (value) => String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

  const identity = (field) => `${clean(field?.field_key)} ${clean(field?.label)}`;

  const isRegistrationType = (field) =>
    /jenispendaftaran|registrationtype/.test(identity(field));

  const isParticipantName = (field) =>
    /namapeserta|namalengkappeserta|namaatlet|namaathlete|namapemain|namaperenang|namapelari|namaanggota|participantname|athletename/.test(identity(field));

  const isParticipantRole = (field) =>
    /peranpeserta|perananggota|rolepeserta|participantrole/.test(identity(field));

  const isWhatsapp = (field) =>
    /whatsapp|whatsap|nomorwa|nowa|nohp|nomorhp|nomortelepon|notelp|telepon|telephone|handphone|ponsel|phonenumber|phone/.test(identity(field));

  const isTeamName = (field, event) =>
    event.registration_type !== "individual" &&
    /namatim|namaklub|namagroup|namagrup|teamname|clubname/.test(identity(field));

  // Harus sama dengan fieldKey() di event.js.
  const fieldKey = (field) => {
    const raw = String(field?.field_key || field?.label || `field_${field?.id || ""}`);
    return raw.replace(/[^a-zA-Z0-9_-]/g, "_");
  };

  const safeFileName = (value) => String(value || "formulir")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70) || "formulir";

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  function parseCustomData(raw) {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
    if (typeof raw === "string" && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch (_) {
        return {};
      }
    }
    return {};
  }

  function parseFileMetadata(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (typeof value.path !== "string" || !value.path.trim()) return null;
    return value;
  }

  function dateText(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "long",
      timeStyle: "short"
    }).format(date);
  }

  function valueText(value) {
    if (value === null || value === undefined || value === "") return "-";
    if (Array.isArray(value)) return value.map((item) => String(item)).join(", ") || "-";
    if (typeof value === "boolean") return value ? "Ya" : "Tidak";
    if (typeof value === "object") {
      if (value.file_name) return String(value.file_name);
      try { return JSON.stringify(value); } catch (_) { return "[Data tidak dapat ditampilkan]"; }
    }
    return String(value);
  }

  function styleButtons() {
    if (document.getElementById("reo-registration-export-style")) return;
    const style = document.createElement("style");
    style.id = "reo-registration-export-style";
    style.textContent = `
      .reo-registration-export-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}
      .reo-form-pdf-button,.reo-form-excel-button{display:inline-flex;align-items:center;justify-content:center;margin:2px 1px;padding:8px 10px;border:0;border-radius:7px;color:#fff;font-size:11px;font-weight:800;line-height:1.3;cursor:pointer;white-space:nowrap}
      .reo-form-pdf-button{background:#173c70}.reo-form-pdf-button:hover{background:#102d57}
      .reo-form-excel-button{background:#187548}.reo-form-excel-button:hover{background:#105d38}
      .reo-form-pdf-button:disabled,.reo-form-excel-button:disabled{opacity:.6;cursor:wait}
      @media(max-width:650px){.reo-registration-export-actions{display:grid;grid-template-columns:1fr 1fr}.reo-form-pdf-button,.reo-form-excel-button{white-space:normal}}
    `;
    document.head.appendChild(style);
  }

  function verifyRegistrationFromRow(row) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 6) return null;
    const token = (cells[1].textContent || "").trim();
    if (!token) return null;
    return (window._registrations || []).find((item) =>
      String(item.token || "").trim() === token
    ) || null;
  }

  function addExportButtons() {
    const list = document.getElementById(LIST_ID);
    if (!list) return;

    list.querySelectorAll("tbody tr").forEach((row) => {
      const cells = row.querySelectorAll("td");
      const actionCell = cells[cells.length - 1];
      if (!actionCell) return;

      const registration = verifyRegistrationFromRow(row);
      if (!registration) return;

      let actions = actionCell.querySelector(".reo-registration-export-actions");
      if (!actions) {
        actions = document.createElement("div");
        actions.className = "reo-registration-export-actions";
        actionCell.appendChild(actions);
      }

      if (!actions.querySelector(`.${PDF_BUTTON_CLASS}`)) {
        const pdfButton = document.createElement("button");
        pdfButton.type = "button";
        pdfButton.className = PDF_BUTTON_CLASS;
        pdfButton.textContent = "Formulir PDF";
        pdfButton.dataset.registrationId = registration.id;
        pdfButton.addEventListener("click", () => runExport(pdfButton, "pdf", registration));
        actions.appendChild(pdfButton);
      }

      if (!actions.querySelector(`.${XLSX_BUTTON_CLASS}`)) {
        const excelButton = document.createElement("button");
        excelButton.type = "button";
        excelButton.className = XLSX_BUTTON_CLASS;
        excelButton.textContent = "Formulir Excel";
        excelButton.dataset.registrationId = registration.id;
        excelButton.addEventListener("click", () => runExport(excelButton, "excel", registration));
        actions.appendChild(excelButton);
      }
    });
  }

  async function verifyAdminSession() {
    if (!window.db) throw new Error("Koneksi Supabase belum tersedia.");
    const userResult = await db.auth.getUser();
    if (userResult.error || !userResult.data?.user) {
      throw new Error("Sesi admin berakhir. Silakan masuk kembali ke Panel Admin.");
    }
    const adminResult = await db.rpc("is_organizer_admin");
    if (adminResult.error || adminResult.data !== true) {
      throw new Error("Akun ini tidak memiliki hak admin Rajawali.");
    }
  }

  async function fetchRegistrationBundle(registrationId) {
    // Jangan menggunakan custom_data dari window._registrations karena daftar
    // Admin memang hanya mengambil kolom ringkasan.
    const registrationResult = await db.from("registrations")
      .select("id,event_id,token,registrant_name,whatsapp,registration_type,team_name,custom_data,payment_amount,payment_status,registration_status,created_at")
      .eq("id", registrationId)
      .single();
    if (registrationResult.error || !registrationResult.data) {
      throw new Error(`Gagal mengambil formulir lengkap: ${registrationResult.error?.message || "Pendaftaran tidak ditemukan."}`);
    }

    const registration = registrationResult.data;
    const [eventResult, fieldsResult, participantsResult] = await Promise.all([
      db.from("events")
        .select("id,title,registration_type,category,venue,start_date,organizer_logo_url")
        .eq("id", registration.event_id)
        .single(),
      db.from("event_fields")
        .select("id,field_key,label,field_type,is_required,options,sort_order")
        .eq("event_id", registration.event_id)
        .order("sort_order", { ascending: true }),
      db.from("participants")
        .select("participant_no,full_name,participant_role,team_name,created_at")
        .eq("registration_id", registration.id)
        .order("created_at", { ascending: true })
    ]);

    if (eventResult.error || !eventResult.data) throw new Error(`Gagal membaca event: ${eventResult.error?.message || "Event tidak ditemukan."}`);
    if (fieldsResult.error) throw new Error(`Gagal membaca Form Builder: ${fieldsResult.error.message}`);
    if (participantsResult.error) throw new Error(`Gagal membaca peserta: ${participantsResult.error.message}`);

    return {
      registration,
      event: eventResult.data,
      fields: Array.isArray(fieldsResult.data) ? fieldsResult.data : [],
      participants: Array.isArray(participantsResult.data) ? participantsResult.data : [],
      customData: parseCustomData(registration.custom_data)
    };
  }

  async function createSignedFileUrl(metadata) {
    const bucket = metadata.bucket || PRIVATE_BUCKET;
    const { data, error } = await db.storage.from(bucket)
      .createSignedUrl(metadata.path, SIGNED_URL_TTL);
    if (error || !data?.signedUrl) {
      throw new Error(error?.message || `Tautan file ${metadata.file_name || metadata.path} tidak berhasil dibuat.`);
    }
    return data.signedUrl;
  }

  async function loadImageAsJpeg(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Foto tidak dapat diambil dari Storage (HTTP ${response.status}).`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Browser tidak dapat membaca file foto."));
        image.src = objectUrl;
      });
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) throw new Error("Ukuran foto tidak valid.");
      const maxDimension = 1600;
      const ratio = Math.min(1, maxDimension / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas foto tidak tersedia di browser.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return {
        dataUrl: canvas.toDataURL("image/jpeg", 0.9),
        width: canvas.width,
        height: canvas.height
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  function getRawAnswer(field, bundle) {
    const key = fieldKey(field);
    if (Object.prototype.hasOwnProperty.call(bundle.customData, key)) {
      return bundle.customData[key];
    }

    const normalized = identity(field);
    const registration = bundle.registration;
    if (/namatim|namaklub|namagroup|namagrup|teamname|clubname/.test(normalized)) {
      return registration.team_name || "";
    }
    if (/whatsapp|whatsap|nomorwa|nowa|nohp|nomorhp|nomortelepon|notelp|telepon|telephone|handphone|ponsel|phonenumber|phone/.test(normalized)) {
      return registration.whatsapp || "";
    }
    if (/jenispendaftaran|registrationtype/.test(normalized)) {
      return registration.registration_type === "team" ? "Tim / Grup" : "Individu";
    }
    return "";
  }

  function resolveSpecialFields(bundle) {
    const { fields, event } = bundle;
    const registrationField = fields.find(isRegistrationType) || null;
    const participantNameField = fields.find(isParticipantName) || null;
    const participantRoleField = fields.find(isParticipantRole) || null;
    const telFields = fields.filter((field) => clean(field.field_type) === "tel");
    const whatsappField = fields.find(isWhatsapp) || (telFields.length === 1 ? telFields[0] : null);
    const teamNameField = fields.find((field) => isTeamName(field, event)) || null;
    return {
      registrationField,
      participantNameField,
      participantRoleField,
      whatsappField,
      teamNameField,
      hasParticipantFields: Boolean(participantNameField || participantRoleField)
    };
  }

  async function prepareAnswerItem(field, bundle) {
    const rawValue = getRawAnswer(field, bundle);
    const item = {
      label: field.label || field.field_key || "Pertanyaan",
      required: Boolean(field.is_required),
      kind: "text",
      text: valueText(rawValue),
      fileName: "",
      signedUrl: "",
      image: null,
      fileError: ""
    };

    if (field.field_type !== "photo_upload" && field.field_type !== "document_upload") return item;

    item.kind = field.field_type === "photo_upload" ? "photo" : "document";
    const metadata = parseFileMetadata(rawValue);
    if (!metadata) {
      item.text = "-";
      return item;
    }

    item.fileName = String(metadata.file_name || "File unggahan");
    try {
      item.signedUrl = await createSignedFileUrl(metadata);
      if (item.kind === "photo") {
        item.image = await loadImageAsJpeg(item.signedUrl);
        item.text = "Foto terlampir";
      } else {
        item.text = "Unduh Dokumen";
      }
    } catch (error) {
      item.fileError = error?.message || "File tidak dapat dibuka.";
      item.text = item.kind === "photo" ? `Foto tidak dapat dimuat: ${item.fileError}` : `Tautan dokumen tidak tersedia: ${item.fileError}`;
      console.error("Arsip formulir: file gagal disiapkan", error);
    }
    return item;
  }

  async function buildSections(bundle) {
    const special = resolveSpecialFields(bundle);
    const { registration, event, fields, participants } = bundle;
    const sections = [];

    // Urutan awal mengikuti event.js: jenis pendaftaran otomatis (bila perlu),
    // lalu WhatsApp otomatis (bila Form Builder tidak menyediakan kolomnya).
    if (!special.registrationField && event.registration_type === "both") {
      sections.push({ type: "answer", item: {
        label: "Jenis Pendaftaran", required: true, kind: "text",
        text: registration.registration_type === "team" ? "Tim / Grup" : "Individu"
      }});
    }
    if (!special.whatsappField) {
      sections.push({ type: "answer", item: {
        label: "Nomor WhatsApp Aktif", required: true, kind: "text",
        text: valueText(registration.whatsapp)
      }});
    }

    let participantSectionAdded = false;
    for (const field of fields) {
      if (field === special.registrationField) {
        if (event.registration_type === "both") {
          sections.push({ type: "answer", item: await prepareAnswerItem(field, bundle) });
        }
        continue;
      }

      if (field === special.teamNameField && special.teamNameField) {
        if (registration.registration_type === "team") {
          sections.push({ type: "answer", item: {
            label: field.label,
            required: Boolean(field.is_required),
            kind: "text",
            text: valueText(registration.team_name)
          }});
        }
        continue;
      }

      if (field === special.whatsappField && special.whatsappField) {
        sections.push({ type: "answer", item: {
          label: field.label,
          required: true,
          kind: "text",
          text: valueText(registration.whatsapp)
        }});
        continue;
      }

      if (field === special.participantNameField || field === special.participantRoleField) {
        if (!participantSectionAdded) {
          sections.push({ type: "participants" });
          participantSectionAdded = true;
        }
        continue;
      }

      sections.push({ type: "answer", item: await prepareAnswerItem(field, bundle) });
    }

    if (!special.hasParticipantFields && participants.length) {
      sections.push({ type: "participants" });
    }
    return sections;
  }

  async function loadScript(src, readyTest, label) {
    if (readyTest()) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => readyTest() ? resolve() : reject(new Error(`${label} berhasil dimuat tetapi API-nya tidak tersedia.`));
      script.onerror = () => reject(new Error(`Gagal memuat ${label}. Periksa koneksi internet.`));
      document.head.appendChild(script);
    });
  }

  async function ensurePdfLibrary() {
    if (!window.jspdf?.jsPDF) {
      const urls = [
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js",
        "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js"
      ];
      let loaded = false;
      for (const url of urls) {
        try {
          await loadScript(url, () => Boolean(window.jspdf?.jsPDF), "pustaka PDF");
          loaded = true;
          break;
        } catch (error) { console.warn(error.message); }
      }
      if (!loaded) throw new Error("Pustaka PDF tidak berhasil dimuat.");
    }
    const probe = new window.jspdf.jsPDF();
    if (typeof probe.autoTable !== "function") {
      await loadScript("https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js", () => typeof probe.autoTable === "function", "plugin tabel PDF");
    }
  }

  async function ensureExcelLibrary() {
    if (window.ExcelJS?.Workbook) return;
    const urls = [
      "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js",
      "https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js"
    ];
    let loaded = false;
    for (const url of urls) {
      try {
        await loadScript(url, () => Boolean(window.ExcelJS?.Workbook), "pustaka Excel");
        loaded = true;
        break;
      } catch (error) { console.warn(error.message); }
    }
    if (!loaded) throw new Error("Pustaka Excel tidak berhasil dimuat.");
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  // =============================== PDF ===============================
  async function exportPdf(bundle, sections) {
    await ensurePdfLibrary();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const { registration, event, participants } = bundle;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 14;
    const navy = [18, 48, 91];
    const dark = [38, 48, 63];
    let cursorY = 16;

    pdf.setProperties({
      title: `Formulir Pendaftaran ${event.title || "Rajawali"}`,
      subject: `Arsip pendaftaran ${registration.token || ""}`,
      author: "Rajawali Event Organizer",
      creator: "Rajawali Event Organizer"
    });

    pdf.setFillColor(...navy);
    pdf.rect(0, 0, pageWidth, 35, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.text("RAJAWALI EVENT ORGANIZER", margin, 13);
    pdf.setFontSize(11);
    pdf.text("FORMULIR PENDAFTARAN", margin, 21);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(String(event.title || "Kegiatan"), margin, 28, { maxWidth: pageWidth - margin * 2 });

    pdf.autoTable({
      startY: 41,
      head: [["IDENTITAS ARSIP", "KETERANGAN"]],
      body: [
        ["Nomor Pendaftaran", registration.token || "-"],
        ["Nama Pendaftar", registration.registrant_name || "-"],
        ["Tanggal Pendaftaran", dateText(registration.created_at)],
        ["Nomor WhatsApp", registration.whatsapp || "-"],
        ["Jenis Pendaftaran", registration.registration_type === "team" ? "Tim / Grup" : "Individu"],
        ["Status Pembayaran", registration.payment_status || "-"],
        ["Status Pendaftaran", registration.registration_status || "-"]
      ],
      theme: "grid",
      margin: { left: margin, right: margin, bottom: 18 },
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2.4, overflow: "linebreak", textColor: dark },
      headStyles: { fillColor: navy, textColor: 255, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" } }
    });
    cursorY = pdf.lastAutoTable.finalY + 7;

    const ensureSpace = (height) => {
      if (cursorY > pageHeight - height - 13) {
        pdf.addPage();
        cursorY = 18;
      }
    };

    async function renderAnswerTable(items) {
      if (!items.length) return;
      const body = items.map((item) => {
        const label = `${item.label || "Pertanyaan"}${item.required ? " *" : ""}`;
        if (item.kind === "photo" && item.image) return [label, { content: " ", styles: { minCellHeight: 39 } }];
        if (item.kind === "document" && item.signedUrl) return [label, { content: " ", styles: { minCellHeight: 19 } }];
        return [label, item.text || "-"];
      });

      pdf.autoTable({
        startY: cursorY,
        head: [["PERTANYAAN / KOLOM FORMULIR", "JAWABAN PENDAFTAR"]],
        body,
        theme: "grid",
        margin: { left: margin, right: margin, bottom: 18 },
        rowPageBreak: "avoid",
        styles: { font: "helvetica", fontSize: 8, cellPadding: 3, overflow: "linebreak", valign: "middle", textColor: dark },
        headStyles: { fillColor: navy, textColor: 255, fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 62, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
        didDrawCell(data) {
          if (data.section !== "body" || data.column.index !== 1) return;
          const item = items[data.row.index];
          if (!item) return;

          if (item.kind === "photo" && item.image) {
            const maxW = Math.min(52, data.cell.width - 6);
            const maxH = 33;
            const scale = Math.min(maxW / item.image.width, maxH / item.image.height);
            const width = item.image.width * scale;
            const height = item.image.height * scale;
            try {
              pdf.addImage(item.image.dataUrl, "JPEG", data.cell.x + (data.cell.width - width) / 2, data.cell.y + (data.cell.height - height) / 2, width, height, undefined, "FAST");
            } catch (error) { console.error("PDF: gagal menanam foto", error); }
          }

          if (item.kind === "document" && item.signedUrl) {
            const x = data.cell.x + 3;
            const y = data.cell.y + 7;
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(8);
            pdf.setTextColor(0, 75, 155);
            pdf.textWithLink("Unduh Dokumen", x, y, { url: item.signedUrl });
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7);
            pdf.setTextColor(85, 95, 110);
            pdf.text(pdf.splitTextToSize(item.fileName, Math.max(20, data.cell.width - 6)).slice(0, 2), x, data.cell.y + 12);
            pdf.setTextColor(...dark);
          }
        }
      });
      cursorY = pdf.lastAutoTable.finalY + 6;
    }

    function renderParticipants() {
      ensureSpace(18);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(...navy);
      pdf.text("NAMA DAN DATA PESERTA", margin, cursorY);
      cursorY += 4;

      const people = participants.length ? participants : [];
      pdf.autoTable({
        startY: cursorY,
        head: [["No.", "Nama Peserta", "Peran", "Nomor Peserta"]],
        body: people.length ? people.map((person, index) => [
          index + 1, person.full_name || "-", person.participant_role || "Peserta", person.participant_no || "-"
        ]) : [["-", "Belum ada data peserta", "-", "-"]],
        theme: "grid",
        margin: { left: margin, right: margin, bottom: 18 },
        rowPageBreak: "avoid",
        styles: { font: "helvetica", fontSize: 8, cellPadding: 2.5, overflow: "linebreak", textColor: dark },
        headStyles: { fillColor: navy, textColor: 255, fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 10, halign: "center" }, 1: { cellWidth: 66 }, 2: { cellWidth: 42 }, 3: { cellWidth: "auto" } }
      });
      cursorY = pdf.lastAutoTable.finalY + 7;
    }

    let pendingAnswers = [];
    for (const section of sections) {
      if (section.type === "answer") {
        pendingAnswers.push(section.item);
      } else if (section.type === "participants") {
        await renderAnswerTable(pendingAnswers);
        pendingAnswers = [];
        renderParticipants();
      }
    }
    await renderAnswerTable(pendingAnswers);

    const hasDocs = sections.some((section) => section.type === "answer" && section.item.kind === "document" && section.item.signedUrl);
    if (hasDocs) {
      ensureSpace(12);
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(7);
      pdf.setTextColor(100, 105, 115);
      pdf.text("Catatan: tautan unduhan dokumen pada PDF berlaku selama 7 hari sejak PDF dibuat.", margin, cursorY);
      cursorY += 7;
    }

    ensureSpace(48);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...navy);
    pdf.text("PERNYATAAN", margin, cursorY);
    cursorY += 6;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...dark);
    const declaration = "Saya menyatakan bahwa seluruh data yang disampaikan dalam formulir pendaftaran ini benar dan dapat dipertanggungjawabkan.";
    const declarationLines = pdf.splitTextToSize(declaration, pageWidth - margin * 2);
    pdf.text(declarationLines, margin, cursorY);
    cursorY += declarationLines.length * 4 + 9;
    const half = (pageWidth - margin * 2) / 2;
    pdf.text("Penanggung Jawab / Perwakilan", margin, cursorY);
    pdf.text("Panitia", margin + half, cursorY);
    cursorY += 24;
    pdf.setDrawColor(120, 130, 145);
    pdf.line(margin, cursorY, margin + half - 12, cursorY);
    pdf.line(margin + half, cursorY, pageWidth - margin, cursorY);
    pdf.text(registration.registrant_name || registration.team_name || "........................", margin, cursorY + 5);
    pdf.text("Rajawali Event Organizer", margin + half, cursorY + 5);

    const totalPages = pdf.internal.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      pdf.setPage(page);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(105, 115, 130);
      pdf.text(`Dokumen arsip Rajawali · ${registration.token || ""}`, margin, pageHeight - 7);
      pdf.text(`Halaman ${page} dari ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: "right" });
    }

    pdf.save(`formulir-${safeFileName(registration.token)}.pdf`);
  }

  // =============================== EXCEL ===============================
  async function exportExcel(bundle, sections) {
    await ensureExcelLibrary();
    const workbook = new window.ExcelJS.Workbook();
    workbook.creator = "Rajawali Event Organizer";
    workbook.subject = `Arsip pendaftaran ${bundle.registration.token || ""}`;
    workbook.title = `Formulir Pendaftaran ${bundle.event.title || "Rajawali"}`;
    workbook.created = new Date();
    workbook.modified = new Date();

    const { registration, event, participants } = bundle;
    const sheet = workbook.addWorksheet("Formulir Pendaftaran", {
      properties: { defaultRowHeight: 22 },
      pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });
    sheet.columns = [
      { key: "number", width: 8 },
      { key: "question", width: 42 },
      { key: "answer", width: 48 },
      { key: "detail", width: 30 }
    ];

    sheet.mergeCells("A1:D1");
    sheet.getCell("A1").value = "RAJAWALI EVENT ORGANIZER";
    sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "left" };
    sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF12305B" } };
    sheet.getRow(1).height = 32;

    sheet.mergeCells("A2:D2");
    sheet.getCell("A2").value = "ARSIP FORMULIR PENDAFTARAN";
    sheet.getCell("A2").font = { bold: true, size: 12, color: { argb: "FF12305B" } };
    sheet.getRow(2).height = 24;
    sheet.mergeCells("A3:D3");
    sheet.getCell("A3").value = event.title || "Kegiatan";
    sheet.getCell("A3").font = { italic: true, size: 11, color: { argb: "FF53627A" } };

    let rowNumber = 5;
    const meta = [
      ["Nomor Pendaftaran", registration.token || "-"],
      ["Nama Pendaftar", registration.registrant_name || "-"],
      ["Tanggal Pendaftaran", dateText(registration.created_at)],
      ["Nomor WhatsApp", registration.whatsapp || "-"],
      ["Jenis Pendaftaran", registration.registration_type === "team" ? "Tim / Grup" : "Individu"],
      ["Status Pembayaran", registration.payment_status || "-"],
      ["Status Pendaftaran", registration.registration_status || "-"]
    ];
    for (const [label, value] of meta) {
      sheet.getCell(rowNumber, 1).value = label;
      sheet.getCell(rowNumber, 1).font = { bold: true, color: { argb: "FF26303F" } };
      sheet.mergeCells(rowNumber, 2, rowNumber, 4);
      sheet.getCell(rowNumber, 2).value = value;
      rowNumber += 1;
    }
    for (let r = 5; r < rowNumber; r += 1) {
      for (let c = 1; c <= 4; c += 1) {
        sheet.getCell(r, c).border = {
          bottom: { style: "thin", color: { argb: "FFD9E0EA" } },
          left: { style: "thin", color: { argb: "FFD9E0EA" } },
          right: { style: "thin", color: { argb: "FFD9E0EA" } }
        };
        sheet.getCell(r, c).alignment = { vertical: "middle", wrapText: true };
      }
      sheet.getRow(r).height = 22;
    }

    rowNumber += 1;
    function sectionHeader(text) {
      sheet.mergeCells(rowNumber, 1, rowNumber, 4);
      const cell = sheet.getCell(rowNumber, 1);
      cell.value = text;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF12305B" } };
      cell.alignment = { vertical: "middle" };
      sheet.getRow(rowNumber).height = 23;
      rowNumber += 1;
    }

    function addQuestionHeader() {
      ["No.", "Pertanyaan / Kolom Formulir", "Jawaban Pendaftar", "Keterangan / Tautan"].forEach((value, index) => {
        const cell = sheet.getCell(rowNumber, index + 1);
        cell.value = value;
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF244C7F" } };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      });
      sheet.getRow(rowNumber).height = 25;
      rowNumber += 1;
    }

    function borderRow(row) {
      for (let c = 1; c <= 4; c += 1) {
        sheet.getCell(row, c).border = {
          top: { style: "thin", color: { argb: "FFD9E0EA" } },
          bottom: { style: "thin", color: { argb: "FFD9E0EA" } },
          left: { style: "thin", color: { argb: "FFD9E0EA" } },
          right: { style: "thin", color: { argb: "FFD9E0EA" } }
        };
        sheet.getCell(row, c).alignment = { vertical: "middle", wrapText: true };
      }
    }

    sectionHeader("PERTANYAAN DAN JAWABAN FORMULIR");
    addQuestionHeader();
    let questionNumber = 0;

    for (const section of sections) {
      if (section.type === "participants") {
        // Bagian anggota diletakkan tepat pada posisi kolom nama/peran di Form Builder.
        sectionHeader("DAFTAR NAMA DAN PERAN PESERTA");
        ["No.", "Nama Peserta", "Peran", "Nomor Peserta"].forEach((value, index) => {
          const cell = sheet.getCell(rowNumber, index + 1);
          cell.value = value;
          cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF244C7F" } };
          cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        });
        sheet.getRow(rowNumber).height = 24;
        rowNumber += 1;
        const people = participants.length ? participants : [null];
        people.forEach((person, index) => {
          sheet.getCell(rowNumber, 1).value = person ? index + 1 : "-";
          sheet.getCell(rowNumber, 2).value = person?.full_name || "Belum ada data peserta";
          sheet.getCell(rowNumber, 3).value = person?.participant_role || "-";
          sheet.getCell(rowNumber, 4).value = person?.participant_no || "-";
          borderRow(rowNumber);
          rowNumber += 1;
        });
        rowNumber += 1;
        continue;
      }

      const item = section.item;
      questionNumber += 1;
      const currentRow = rowNumber;
      sheet.getCell(currentRow, 1).value = questionNumber;
      sheet.getCell(currentRow, 2).value = `${item.label || "Pertanyaan"}${item.required ? " *" : ""}`;
      sheet.getCell(currentRow, 2).font = { bold: true, color: { argb: "FF26303F" } };
      sheet.getCell(currentRow, 3).value = item.text || "-";
      borderRow(currentRow);
      sheet.getRow(currentRow).height = 28;

      if (item.kind === "photo" && item.image) {
        const imageId = workbook.addImage({ base64: item.image.dataUrl, extension: "jpeg" });
        sheet.getCell(currentRow, 3).value = "Foto terlampir";
        sheet.getRow(currentRow).height = 100;
        sheet.addImage(imageId, {
          tl: { col: 2.1, row: currentRow - 1 + 0.08 },
          ext: { width: 180, height: 125 },
          editAs: "oneCell"
        });
      } else if (item.kind === "document") {
        if (item.signedUrl) {
          sheet.getCell(currentRow, 3).value = {
            text: `Unduh Dokumen${item.fileName ? ` - ${item.fileName}` : ""}`,
            hyperlink: item.signedUrl,
            tooltip: "Klik untuk mengunduh dokumen pendaftaran"
          };
          sheet.getCell(currentRow, 3).font = { color: { argb: "FF0563C1" }, underline: true };
        } else {
          sheet.getCell(currentRow, 3).value = item.text || "-";
        }
      } else if (item.kind === "photo" && !item.image) {
        sheet.getCell(currentRow, 3).value = item.text || "Foto belum tersedia";
      }

      if (item.kind === "photo" || item.kind === "document") {
        sheet.getCell(currentRow, 4).value = item.fileName || (item.fileError ? item.fileError : "");
      }
      rowNumber += 1;
    }

    rowNumber += 1;
    sectionHeader("PERNYATAAN");
    sheet.mergeCells(rowNumber, 1, rowNumber, 4);
    sheet.getCell(rowNumber, 1).value = "Saya menyatakan bahwa seluruh data yang disampaikan dalam formulir pendaftaran ini benar dan dapat dipertanggungjawabkan.";
    sheet.getCell(rowNumber, 1).alignment = { wrapText: true, vertical: "middle" };
    sheet.getRow(rowNumber).height = 35;
    rowNumber += 2;
    sheet.getCell(rowNumber, 1).value = "Penanggung Jawab / Perwakilan";
    sheet.getCell(rowNumber, 3).value = "Panitia";
    sheet.getRow(rowNumber).height = 24;
    rowNumber += 4;
    sheet.getCell(rowNumber, 1).value = registration.registrant_name || registration.team_name || "........................";
    sheet.getCell(rowNumber, 3).value = "Rajawali Event Organizer";
    rowNumber += 2;
    sheet.mergeCells(rowNumber, 1, rowNumber, 4);
    sheet.getCell(rowNumber, 1).value = `Dokumen arsip Rajawali · ${registration.token || ""} · Tautan dokumen privat berlaku 7 hari sejak file dibuat.`;
    sheet.getCell(rowNumber, 1).font = { italic: true, size: 9, color: { argb: "FF68758A" } };
    sheet.getCell(rowNumber, 1).alignment = { wrapText: true };

    sheet.views = [{ state: "frozen", ySplit: 4 }];
    sheet.pageSetup.printArea = `A1:D${rowNumber}`;
    sheet.headerFooter.oddFooter = "&LRajawali Event Organizer&CHalaman &P dari &N";

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    downloadBlob(blob, `formulir-${safeFileName(registration.token)}.xlsx`);
  }

  async function runExport(button, format, registrationSummary) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = format === "pdf" ? "Menyiapkan PDF..." : "Menyiapkan Excel...";
    try {
      await verifyAdminSession();
      const bundle = await fetchRegistrationBundle(registrationSummary.id);
      const sections = await buildSections(bundle);
      if (format === "pdf") await exportPdf(bundle, sections);
      else await exportExcel(bundle, sections);
    } catch (error) {
      console.error(`Arsip formulir ${format.toUpperCase()} Rajawali:`, error);
      alert(`${format.toUpperCase()} formulir tidak dapat dibuat.\n\n${error?.message || "Terjadi kesalahan yang tidak diketahui."}`);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function initialize() {
    styleButtons();
    const list = document.getElementById(LIST_ID);
    if (!list) return;
    const observer = new MutationObserver(addExportButtons);
    observer.observe(list, { childList: true, subtree: true });
    addExportButtons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
