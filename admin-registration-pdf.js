/* ================================================================
   RAJAWALI EVENT ORGANIZER
   CETAK FORMULIR PENDAFTARAN PDF — ADD-ON MASTER ADMIN

   - Satu PDF untuk satu pendaftaran.
   - Urutan pertanyaan mengikuti event_fields.sort_order.
   - Kolom Nama Peserta/Peran Peserta menampilkan seluruh anggota
     tepat pada posisi bagian peserta di formulir.
   - Foto tampil di dalam PDF.
   - Dokumen menjadi tautan unduhan privat (signed URL 7 hari).
   - Tidak mengganti alur pendaftaran, pembayaran, QR, check-in,
     admin.js, maupun ekspor laporan yang sudah ada.
   ================================================================ */
(() => {
  "use strict";

  const REGISTRANT_LIST_ID = "registrant-list";
  const PRIVATE_FILE_BUCKET = "registration-files";
  const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

  const clean = (value) => String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

  const identity = (field) =>
    `${clean(field?.field_key)} ${clean(field?.label)}`;

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

  const safeFileName = (value) =>
    String(value || "formulir")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || "formulir";

  const fieldKey = (field) => {
    const raw = String(field?.field_key || field?.label || "field");
    return raw.replace(/[^a-zA-Z0-9_-]/g, "_");
  };

  const fileMetadata = (value) =>
    value && typeof value === "object" && typeof value.path === "string"
      ? value
      : null;

  const dateText = (value) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "long",
      timeStyle: "short"
    }).format(parsed);
  };

  function installStyles() {
    if (document.getElementById("reo-registration-pdf-style")) return;

    const style = document.createElement("style");
    style.id = "reo-registration-pdf-style";
    style.textContent = `
      .reo-form-pdf-button {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        margin:4px 2px;
        padding:8px 10px;
        border:0;
        border-radius:7px;
        background:#173c70;
        color:#fff;
        font-size:11px;
        font-weight:800;
        line-height:1.35;
        cursor:pointer;
      }
      .reo-form-pdf-button:hover { background:#102d57; }
      .reo-form-pdf-button:disabled { opacity:.6; cursor:wait; }
    `;
    document.head.appendChild(style);
  }

  function getRegistrationFromRow(row) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 6) return null;

    const token = (cells[1].textContent || "").trim();
    if (!token) return null;

    return (window._registrations || []).find(
      (registration) => String(registration.token || "").trim() === token
    ) || null;
  }

  function addPrintButtons() {
    const list = document.getElementById(REGISTRANT_LIST_ID);
    if (!list) return;

    list.querySelectorAll("tbody tr").forEach((row) => {
      const cells = row.querySelectorAll("td");
      const actionCell = cells[cells.length - 1];
      if (!actionCell || actionCell.querySelector(".reo-form-pdf-button")) return;

      const registration = getRegistrationFromRow(row);
      if (!registration) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "reo-form-pdf-button";
      button.textContent = "Cetak Formulir PDF";
      button.dataset.registrationId = registration.id;
      button.addEventListener("click", () => createRegistrationPdf(registration, button));

      actionCell.appendChild(button);
    });
  }

  async function verifyAdminSession() {
    if (!window.db) {
      throw new Error("Koneksi Supabase belum tersedia.");
    }

    const userResult = await db.auth.getUser();
    if (userResult.error || !userResult.data?.user) {
      throw new Error("Sesi admin berakhir. Silakan login kembali.");
    }

    const adminResult = await db.rpc("is_organizer_admin");
    if (adminResult.error || adminResult.data !== true) {
      throw new Error("Akun ini tidak memiliki hak admin Rajawali.");
    }
  }

  async function createPrivateSignedUrl(metadata) {
    const bucket = metadata.bucket || PRIVATE_FILE_BUCKET;
    const result = await db.storage
      .from(bucket)
      .createSignedUrl(metadata.path, SIGNED_URL_TTL_SECONDS);

    if (result.error || !result.data?.signedUrl) {
      const detail = result.error?.message || "Storage tidak mengembalikan tautan.";
      throw new Error(`Tautan aman file "${metadata.file_name || metadata.path}" gagal dibuat. ${detail}`);
    }

    return result.data.signedUrl;
  }

  async function loadImageAsJpeg(signedUrl) {
    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(`Foto gagal diunduh dari penyimpanan (HTTP ${response.status}).`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Format foto tidak dapat dibaca browser."));
        image.src = objectUrl;
      });

      const originalWidth = image.naturalWidth || image.width;
      const originalHeight = image.naturalHeight || image.height;
      if (!originalWidth || !originalHeight) {
        throw new Error("Ukuran foto tidak valid.");
      }

      const maxDimension = 1400;
      const scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(originalWidth * scale));
      canvas.height = Math.max(1, Math.round(originalHeight * scale));

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Browser tidak mendukung pemrosesan foto.");

      // Latar putih memastikan foto PNG transparan tetap terlihat di PDF JPEG.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      return {
        data: canvas.toDataURL("image/jpeg", 0.88),
        width: canvas.width,
        height: canvas.height
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  function getStoredAnswer(field, registration, customData) {
    const key = fieldKey(field);

    if (Object.prototype.hasOwnProperty.call(customData, key)) {
      return customData[key];
    }

    const normalized = identity(field);

    // Kolom sistem tidak disimpan di custom_data; ambil dari registrations.
    if (/namatim|namaklub|namagroup|namagrup|teamname|clubname/.test(normalized)) {
      return registration.team_name || "-";
    }

    if (/whatsapp|whatsap|nomorwa|nowa|nohp|nomorhp|nomortelepon|notelp|telepon|telephone|handphone|ponsel|phonenumber|phone/.test(normalized)) {
      return registration.whatsapp || "-";
    }

    if (/jenispendaftaran|registrationtype/.test(normalized)) {
      return registration.registration_type === "team" ? "Tim / Grup" : "Individu";
    }

    return "-";
  }

  function printableText(value) {
    if (value === null || value === undefined || value === "") return "-";
    if (Array.isArray(value)) return value.map(String).join(", ");

    if (typeof value === "object") {
      if (value.file_name) return String(value.file_name);
      try {
        return JSON.stringify(value);
      } catch (_) {
        return "[Data tidak dapat ditampilkan]";
      }
    }

    return String(value);
  }

  function createPdfInstance() {
    if (!window.jspdf?.jsPDF) {
      throw new Error("Pustaka jsPDF belum termuat. Periksa koneksi internet pada halaman admin.");
    }

    const pdf = new window.jspdf.jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true
    });

    if (typeof pdf.autoTable !== "function") {
      throw new Error("Plugin jsPDF AutoTable belum termuat. Periksa koneksi internet pada halaman admin.");
    }

    return pdf;
  }

  function addPageFooter(pdf, registration, pageWidth, pageHeight, margin, totalPages) {
    for (let page = 1; page <= totalPages; page += 1) {
      pdf.setPage(page);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(105, 115, 130);
      pdf.text(
        `Dokumen arsip Rajawali · ${registration.token || ""}`,
        margin,
        pageHeight - 7
      );
      pdf.text(
        `Halaman ${page} dari ${totalPages}`,
        pageWidth - margin,
        pageHeight - 7,
        { align: "right" }
      );
    }
  }

  async function createRegistrationPdf(registration, button) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Menyiapkan PDF...";

    try {
      await verifyAdminSession();

      const [eventResult, fieldsResult, participantsResult] = await Promise.all([
        db.from("events")
          .select("id,title,registration_type,category,venue,start_date")
          .eq("id", registration.event_id)
          .single(),

        db.from("event_fields")
          .select("field_key,label,field_type,is_required,sort_order")
          .eq("event_id", registration.event_id)
          .order("sort_order", { ascending: true }),

        db.from("participants")
          .select("participant_no,full_name,participant_role,team_name,created_at")
          .eq("registration_id", registration.id)
          .order("created_at", { ascending: true })
      ]);

      if (eventResult.error) throw new Error(`Gagal membaca event: ${eventResult.error.message}`);
      if (fieldsResult.error) throw new Error(`Gagal membaca Form Builder: ${fieldsResult.error.message}`);
      if (participantsResult.error) throw new Error(`Gagal membaca data anggota: ${participantsResult.error.message}`);

      const event = eventResult.data;
      const fields = Array.isArray(fieldsResult.data) ? fieldsResult.data : [];
      const participants = Array.isArray(participantsResult.data) ? participantsResult.data : [];
      const customData = registration.custom_data && typeof registration.custom_data === "object"
        ? registration.custom_data
        : {};

      const registrationField = fields.find(isRegistrationType) || null;
      const participantNameField = fields.find(isParticipantName) || null;
      const participantRoleField = fields.find(isParticipantRole) || null;
      const whatsappByType = fields.filter((field) => clean(field.field_type) === "tel");
      const whatsappField = fields.find(isWhatsapp) ||
        (whatsappByType.length === 1 ? whatsappByType[0] : null);
      const teamNameField = fields.find((field) => isTeamName(field, event)) || null;

      const pdf = createPdfInstance();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 14;
      const navy = [18, 48, 91];
      const darkText = [38, 48, 63];
      let cursorY = 16;

      pdf.setProperties({
        title: `Formulir Pendaftaran ${event.title || "Rajawali"}`,
        subject: `Arsip pendaftaran ${registration.token || ""}`,
        author: "Rajawali Event Organizer",
        creator: "Rajawali Event Organizer"
      });

      // Header dokumen.
      pdf.setFillColor(navy[0], navy[1], navy[2]);
      pdf.rect(0, 0, pageWidth, 35, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.text("RAJAWALI EVENT ORGANIZER", margin, 13);
      pdf.setFontSize(11);
      pdf.text("FORMULIR PENDAFTARAN", margin, 21);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(String(event.title || "Kegiatan"), margin, 28, {
        maxWidth: pageWidth - margin * 2
      });

      // Ringkasan arsip berisi data transaksi/administrasi, sedangkan jawaban
      // Form Builder tetap diletakkan kemudian mengikuti urutan sort_order.
      const summaryRows = [
        ["Nomor Pendaftaran", registration.token || "-"],
        ["Tanggal Pendaftaran", dateText(registration.created_at)],
        ["Status Pembayaran", registration.payment_status || "-"],
        ["Status Pendaftaran", registration.registration_status || "-"]
      ];

      pdf.autoTable({
        startY: 41,
        head: [["IDENTITAS ARSIP", "KETERANGAN"]],
        body: summaryRows,
        theme: "grid",
        margin: { left: margin, right: margin, bottom: 18 },
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 2.5,
          overflow: "linebreak",
          textColor: darkText
        },
        headStyles: { fillColor: navy, textColor: 255, fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" } }
      });
      cursorY = pdf.lastAutoTable.finalY + 7;

      function ensureHeadingSpace(height = 12) {
        if (cursorY > pageHeight - height - 12) {
          pdf.addPage();
          cursorY = 18;
        }
      }

      function addSubheading(text) {
        ensureHeadingSpace(13);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(navy[0], navy[1], navy[2]);
        pdf.text(String(text), margin, cursorY);
        cursorY += 4;
      }

      const preparedQuestionItems = [];

      async function prepareQuestionItem(field) {
        const value = getStoredAnswer(field, registration, customData);
        const item = {
          label: field.label || field.field_key || "Pertanyaan",
          required: Boolean(field.is_required),
          kind: "text",
          value: printableText(value),
          image: null,
          signedUrl: null,
          fileName: ""
        };

        if (field.field_type !== "photo_upload" && field.field_type !== "document_upload") {
          preparedQuestionItems.push(item);
          return item;
        }

        const metadata = fileMetadata(value);
        item.kind = field.field_type === "photo_upload" ? "photo" : "document";

        if (!metadata) {
          item.value = "-";
          return item;
        }

        item.fileName = String(metadata.file_name || "File unggahan");

        try {
          item.signedUrl = await createPrivateSignedUrl(metadata);

          if (item.kind === "photo") {
            item.image = await loadImageAsJpeg(item.signedUrl);
            item.value = "Foto terlampir";
          } else {
            item.value = "Unduh Dokumen";
          }
        } catch (error) {
          console.error("File pendaftaran tidak dapat disiapkan:", error);
          item.value = item.kind === "photo"
            ? "Foto tidak dapat dimuat"
            : "Tautan unduhan tidak tersedia";
          item.fileError = error.message;
        }

        preparedQuestionItems.push(item);
        return item;
      }

      async function renderQuestionBlock(items) {
        if (!items.length) return;

        const body = items.map((item) => {
          const label = item.label + (item.required ? " *" : "");

          if (item.kind === "photo" && item.image) {
            return [
              label,
              {
                content: " ",
                styles: { minCellHeight: 36 }
              }
            ];
          }

          if (item.kind === "document" && item.signedUrl) {
            return [
              label,
              {
                content: " ",
                styles: { minCellHeight: 17 }
              }
            ];
          }

          return [label, item.value];
        });

        pdf.autoTable({
          startY: cursorY,
          head: [["PERTANYAAN / KOLOM FORMULIR", "JAWABAN PENDAFTAR"]],
          body,
          theme: "grid",
          margin: { left: margin, right: margin, bottom: 18 },
          styles: {
            font: "helvetica",
            fontSize: 8,
            cellPadding: 3,
            overflow: "linebreak",
            valign: "middle",
            textColor: darkText
          },
          headStyles: {
            fillColor: navy,
            textColor: 255,
            fontStyle: "bold"
          },
          columnStyles: {
            0: { cellWidth: 62, fontStyle: "bold" },
            1: { cellWidth: "auto" }
          },
          didDrawCell(data) {
            if (data.section !== "body" || data.column.index !== 1) return;

            const item = items[data.row.index];
            if (!item) return;

            if (item.kind === "photo" && item.image) {
              const maxWidth = Math.min(48, data.cell.width - 6);
              const maxHeight = 29;
              const scale = Math.min(
                maxWidth / item.image.width,
                maxHeight / item.image.height
              );
              const drawWidth = item.image.width * scale;
              const drawHeight = item.image.height * scale;
              const x = data.cell.x + (data.cell.width - drawWidth) / 2;
              const y = data.cell.y + (data.cell.height - drawHeight) / 2;

              try {
                pdf.addImage(
                  item.image.data,
                  "JPEG",
                  x,
                  y,
                  drawWidth,
                  drawHeight,
                  undefined,
                  "FAST"
                );
              } catch (error) {
                console.error("Foto gagal dimasukkan ke PDF:", error);
              }
            }

            if (item.kind === "document" && item.signedUrl) {
              const x = data.cell.x + 3;
              const linkY = data.cell.y + 6;
              pdf.setFont("helvetica", "bold");
              pdf.setFontSize(8);
              pdf.setTextColor(0, 75, 155);
              pdf.textWithLink("Unduh Dokumen", x, linkY, {
                url: item.signedUrl
              });

              pdf.setFont("helvetica", "normal");
              pdf.setFontSize(7);
              pdf.setTextColor(85, 95, 110);
              const fileLines = pdf.splitTextToSize(
                item.fileName,
                Math.max(20, data.cell.width - 6)
              );
              pdf.text(fileLines.slice(0, 2), x, data.cell.y + 11);
              pdf.setTextColor(darkText[0], darkText[1], darkText[2]);
            }
          }
        });

        cursorY = pdf.lastAutoTable.finalY + 6;
      }

      async function renderParticipantsSection() {
        const title = participantNameField?.label || "Data Anggota / Peserta";
        const roleTitle = participantRoleField?.label || "Peran";

        addSubheading(title);

        if (!participants.length) {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(darkText[0], darkText[1], darkText[2]);
          pdf.text("Tidak ada data anggota peserta yang tersimpan.", margin, cursorY + 2);
          cursorY += 9;
          return;
        }

        pdf.autoTable({
          startY: cursorY,
          head: [["No.", title, roleTitle, "Nomor Peserta"]],
          body: participants.map((person, index) => [
            index + 1,
            person.full_name || "-",
            person.participant_role || "Peserta",
            person.participant_no || "-"
          ]),
          theme: "grid",
          margin: { left: margin, right: margin, bottom: 18 },
          styles: {
            font: "helvetica",
            fontSize: 8,
            cellPadding: 2.5,
            overflow: "linebreak",
            textColor: darkText
          },
          headStyles: {
            fillColor: navy,
            textColor: 255,
            fontStyle: "bold"
          },
          columnStyles: {
            0: { cellWidth: 10, halign: "center" },
            1: { cellWidth: 67 },
            2: { cellWidth: 42 },
            3: { cellWidth: "auto" }
          }
        });

        cursorY = pdf.lastAutoTable.finalY + 7;
      }

      // Beberapa pertanyaan otomatis ditampilkan sebelum Form Builder di
      // event.js. Pertahankan urutan tampil tersebut.
      const questionItems = [];
      if (!registrationField && event.registration_type === "both") {
        questionItems.push({
          label: "Jenis Pendaftaran",
          required: true,
          kind: "text",
          value: registration.registration_type === "team" ? "Tim / Grup" : "Individu"
        });
      }

      // event.js menghasilkan WhatsApp di depan daftar pertanyaan jika admin
      // tidak membuat kolom WhatsApp tersendiri.
      if (!whatsappField) {
        questionItems.push({
          label: "Nomor WhatsApp Aktif",
          required: true,
          kind: "text",
          value: registration.whatsapp || "-"
        });
      }

      let participantSectionRendered = false;
      let hasParticipantFields = Boolean(participantNameField || participantRoleField);

      for (const field of fields) {
        if (field === registrationField) {
          if (event.registration_type === "both") {
            questionItems.push(await prepareQuestionItem(field));
          }
          continue;
        }

        if (field === teamNameField && teamNameField) {
          // Di formulir publik, nama tim disembunyikan untuk pendaftaran individu.
          if (registration.registration_type === "team") {
            questionItems.push({
              label: field.label,
              required: Boolean(field.is_required),
              kind: "text",
              value: registration.team_name || "-"
            });
          }
          continue;
        }

        if (field === whatsappField && whatsappField) {
          questionItems.push({
            label: field.label,
            required: true,
            kind: "text",
            value: registration.whatsapp || "-"
          });
          continue;
        }

        if (field === participantNameField || field === participantRoleField) {
          if (!participantSectionRendered) {
            await renderQuestionBlock(questionItems);
            questionItems.length = 0;
            await renderParticipantsSection();
            participantSectionRendered = true;
          }
          continue;
        }

        questionItems.push(await prepareQuestionItem(field));
      }

      await renderQuestionBlock(questionItems);

      // Jika formulir lama tidak lagi memiliki field nama/peran, jangan
      // hilangkan data peserta yang masih tersimpan di database.
      if (!hasParticipantFields && participants.length) {
        await renderParticipantsSection();
        participantSectionRendered = true;
      }

      // Catatan masa berlaku signed URL agar arsip digital tidak disalahartikan
      // sebagai tautan permanen.
      const containsDocumentLink = preparedQuestionItems.some(
        (item) => item.kind === "document" && Boolean(item.signedUrl)
      );

      if (containsDocumentLink) {
        ensureHeadingSpace(12);
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(7);
        pdf.setTextColor(100, 105, 115);
        pdf.text(
          "Catatan: tautan unduhan dokumen pada PDF ini berlaku selama 7 hari sejak PDF dibuat.",
          margin,
          cursorY
        );
        cursorY += 7;
      }

      // Pernyataan dan ruang tanda tangan.
      ensureHeadingSpace(48);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(navy[0], navy[1], navy[2]);
      pdf.text("PERNYATAAN", margin, cursorY);
      cursorY += 6;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(darkText[0], darkText[1], darkText[2]);

      const declaration =
        "Saya menyatakan bahwa seluruh data yang disampaikan dalam formulir pendaftaran ini benar dan dapat dipertanggungjawabkan.";
      const declarationLines = pdf.splitTextToSize(
        declaration,
        pageWidth - margin * 2
      );
      pdf.text(declarationLines, margin, cursorY);
      cursorY += declarationLines.length * 4 + 9;

      const halfWidth = (pageWidth - margin * 2) / 2;
      pdf.text("Penanggung Jawab / Perwakilan", margin, cursorY);
      pdf.text("Panitia", margin + halfWidth, cursorY);
      cursorY += 24;

      pdf.setDrawColor(120, 130, 145);
      pdf.line(margin, cursorY, margin + halfWidth - 12, cursorY);
      pdf.line(margin + halfWidth, cursorY, pageWidth - margin, cursorY);

      pdf.text(
        registration.registrant_name || registration.team_name || "........................",
        margin,
        cursorY + 5
      );
      pdf.text("Rajawali Event Organizer", margin + halfWidth, cursorY + 5);

      const totalPages = pdf.internal.getNumberOfPages();
      addPageFooter(
        pdf,
        registration,
        pageWidth,
        pageHeight,
        margin,
        totalPages
      );

      pdf.save(`formulir-${safeFileName(registration.token)}.pdf`);
    } catch (error) {
      console.error("Cetak Formulir PDF Rajawali:", error);
      alert(`PDF tidak dapat dibuat.\n\n${error?.message || "Terjadi kesalahan yang tidak diketahui."}`);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function initialize() {
    installStyles();

    const list = document.getElementById(REGISTRANT_LIST_ID);
    if (!list) return;

    const observer = new MutationObserver(() => {
      addPrintButtons();
    });

    observer.observe(list, {
      childList: true,
      subtree: true
    });

    addPrintButtons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
