
/* RAJAWALI EVENT ORGANIZER
   Cek status pendaftaran dan cetak kartu PDF setiap peserta.
   QR menggunakan QRCode.js yang kompatibel dengan browser HP.
*/

document.addEventListener("DOMContentLoaded", () => {
  const { $, esc, money } = window.Rajawali;
  const form = $("#status-form");
  const result = $("#status-result");

  if (!form || !result) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!window.db) {
      result.innerHTML = '<div class="notice">Supabase belum dikonfigurasi.</div>';
      return;
    }

    const token = $("#token").value.trim().toUpperCase();
    if (!token) return;

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Memeriksa...";
    result.innerHTML = "<p>Memeriksa token dan data peserta...</p>";

    try {
      const { data, error } = await db.functions.invoke(
        "check-status",
        { body: { token } }
      );

      if (error || !data || data.error) {
        let detail = data?.error || error?.message || "Token tidak ditemukan.";

        try {
          const response = error?.context?.clone
            ? error.context.clone()
            : error?.context;

          if (response?.json) {
            const payload = await response.json();
            detail = payload?.error || payload?.message || detail;
          }
        } catch (_) {}

        throw new Error(detail);
      }

      renderStatus(data);

    } catch (error) {
      console.error("Cek status pendaftaran:", error);

      result.innerHTML =
        '<div class="notice"><b>Belum berhasil memeriksa pendaftaran.</b><p>' +
        esc(error.message || "Periksa token dan koneksi.") +
        "</p></div>";

    } finally {
      button.disabled = false;
      button.textContent = "Periksa Status";
    }
  });

  function statusLabel(value) {
    const labels = {
      pending: "Menunggu",
      approved: "Disetujui",
      rejected: "Ditolak",
      verified: "Terverifikasi",
      not_required: "Tidak perlu pembayaran"
    };

    return labels[value] || value || "-";
  }

  function renderStatus(data) {
    const people = Array.isArray(data.participants)
      ? data.participants
      : [];

    const event = data.event || {};
    const canPrint = Boolean(data.can_print_card);

    const peopleHtml = people.map((p) => `
      <div class="reo-person-status">
        <div>
          <b>${esc(p.full_name || "Peserta")}</b>
          <small>
            ${esc(p.participant_role || "Peserta")}
            · ${esc(p.participant_no || "-")}
          </small>
        </div>
        <span>
          ${
            p.checked_in_at
              ? '<b class="reo-checked">Sudah registrasi ulang</b>'
              : '<span class="reo-not-checked">Belum registrasi ulang</span>'
          }
        </span>
      </div>
    `).join("");

    result.innerHTML = `
      <section class="reo-status-result">

        <div class="reo-status-success">
          <b>Pendaftaran ditemukan</b>
          <span>Token: ${esc(data.token)}</span>
        </div>

        <div class="reo-status-grid">

          <div>
            <span>Event</span>
            <b>${esc(data.event_title || "-")}</b>
          </div>

          <div>
            <span>Jenis pendaftaran</span>
            <b>${esc(data.registration_type || "-")}</b>
          </div>

          <div>
            <span>Tim / Klub</span>
            <b>${esc(data.team_name || "Individu")}</b>
          </div>

          <div>
            <span>Jumlah peserta</span>
            <b>${people.length}</b>
          </div>

          <div>
            <span>Status pembayaran</span>
            <b>${esc(statusLabel(data.payment_status))}</b>
          </div>

          <div>
            <span>Tagihan</span>
            <b>${money(data.payment_amount || 0)}</b>
          </div>

          <div>
            <span>Status pendaftaran</span>
            <b>${esc(statusLabel(data.registration_status))}</b>
          </div>

          <div>
            <span>Lokasi</span>
            <b>${esc(event.venue || "Belum ditentukan")}</b>
          </div>

        </div>

        <h3>Daftar Pemegang Kartu</h3>

        <div class="reo-person-list">
          ${peopleHtml || "<p>Data peserta belum tersedia.</p>"}
        </div>

        ${
          canPrint
            ? `
              <div class="reo-card-actions">
                <button type="button"
                  id="reo-preview-cards"
                  class="btn btn-secondary">
                  Lihat Kartu
                </button>

                <button type="button"
                  id="download-cards"
                  class="btn btn-primary">
                  Unduh Semua Kartu (PDF)
                </button>
              </div>

              <p class="reo-card-note">
                Setiap atlet dan pelatih memperoleh kartu sendiri.
                Tunjukkan kartu saat memasuki lokasi pertandingan.
              </p>
            `
            : `
              <div class="notice">
                Kartu peserta belum dapat diterbitkan.
                Pembayaran harus terverifikasi dan pendaftaran harus disetujui panitia.
              </div>
            `
        }

      </section>
    `;

    if (canPrint) {
      $("#download-cards").addEventListener(
        "click",
        () => handleCardAction(data, false)
      );

      $("#reo-preview-cards").addEventListener(
        "click",
        () => handleCardAction(data, true)
      );
    }

    injectStatusStyles();
  }

  function injectStatusStyles() {
    if (document.getElementById("reo-status-card-css")) return;

    const style = document.createElement("style");
    style.id = "reo-status-card-css";

    style.textContent = `
      .reo-status-result {
        margin-top: 18px;
        text-align: left;
        color: #142b50;
      }

      .reo-status-success {
        display: grid;
        gap: 4px;
        padding: 15px;
        background: #e9f8ef;
        border-radius: 9px;
        color: #145b37;
      }

      .reo-status-success span {
        font-size: 12px;
      }

      .reo-status-grid {
        display: grid;
        grid-template-columns: repeat(2,minmax(0,1fr));
        gap: 0 14px;
        margin: 12px 0;
        border: 1px solid #e4eaf2;
        border-radius: 8px;
        padding: 8px 12px;
      }

      .reo-status-grid div {
        display: grid;
        gap: 3px;
        padding: 8px 0;
        border-bottom: 1px solid #edf0f5;
        min-width: 0;
      }

      .reo-status-grid span {
        font-size: 10px;
        color: #748197;
      }

      .reo-status-grid b {
        font-size: 12px;
        overflow-wrap: anywhere;
      }

      .reo-status-result h3 {
        font-size: 14px;
        margin: 16px 0 8px;
      }

      .reo-person-list {
        border: 1px solid #e5eaf2;
        border-radius: 8px;
        overflow: hidden;
      }

      .reo-person-status {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-bottom: 1px solid #edf0f5;
      }

      .reo-person-status:last-child {
        border-bottom: 0;
      }

      .reo-person-status div {
        display: grid;
        gap: 3px;
        min-width: 0;
      }

      .reo-person-status b {
        font-size: 12px;
      }

      .reo-person-status small {
        font-size: 10px;
        color: #78849a;
        overflow-wrap: anywhere;
      }

      .reo-checked {
        color: #18834f;
      }

      .reo-not-checked {
        font-size: 10px;
        color: #9a6a27;
      }

      .reo-card-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 15px;
      }

      .reo-card-actions .btn {
        flex: 1;
        min-width: 150px;
      }

      .reo-card-note {
        font-size: 11px;
        color: #6b778c;
        line-height: 1.5;
        margin-top: 9px;
      }

      @media(max-width:520px) {
        .reo-status-grid {
          grid-template-columns: 1fr;
        }

        .reo-person-status {
          align-items: flex-start;
          flex-direction: column;
        }

        .reo-card-actions {
          display: grid;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // Memuat PDF dan pustaka QR yang benar.
  async function loadScript(src, test, label) {
    if (test()) return;

    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;

      script.onload = () => {
        if (test()) resolve();
        else reject(new Error(label + " tidak menyediakan fungsi yang dibutuhkan."));
      };

      script.onerror = () => reject(new Error("Gagal memuat " + label));

      document.head.appendChild(script);
    });
  }

  async function ensureCardLibraries() {
    if (!window.jspdf?.jsPDF) {
      const pdfUrls = [
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js",
        "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js"
      ];

      let loaded = false;

      for (const url of pdfUrls) {
        try {
          await loadScript(
            url,
            () => Boolean(window.jspdf?.jsPDF),
            "Pustaka PDF"
          );
          loaded = true;
          break;
        } catch (error) {
          console.warn(error.message);
        }
      }

      if (!loaded) {
        throw new Error("Pustaka PDF tidak berhasil dimuat.");
      }
    }

    if (typeof window.QRCode !== "function") {
      const qrUrls = [
        "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js",
        "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"
      ];

      let loaded = false;

      for (const url of qrUrls) {
        try {
          await loadScript(
            url,
            () => typeof window.QRCode === "function",
            "Pustaka QR Code"
          );
          loaded = true;
          break;
        } catch (error) {
          console.warn(error.message);
        }
      }

      if (!loaded) {
        throw new Error(
          "Pustaka QR Code belum dapat dimuat. Periksa koneksi internet."
        );
      }
    }
  }

  // QRCode.js menghasilkan canvas, kemudian diubah menjadi PNG untuk PDF.
  async function createQrDataUrl(value, size = 260) {
    if (typeof window.QRCode !== "function") {
      throw new Error("Mesin QR Code belum tersedia.");
    }

    const holder = document.createElement("div");

    holder.style.position = "fixed";
    holder.style.left = "-10000px";
    holder.style.top = "0";
    holder.style.width = size + "px";
    holder.style.height = size + "px";

    document.body.appendChild(holder);

    try {
      new window.QRCode(holder, {
        text: String(value),
        width: size,
        height: size,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.H
      });

      const canvas = holder.querySelector("canvas");

      if (canvas) {
        return canvas.toDataURL("image/png");
      }

      const image = holder.querySelector("img");

      if (image) {
        if (!image.complete) {
          await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(
              new Error("Gambar QR Code gagal dibuat.")
            );
          });
        }

        const output = document.createElement("canvas");
        output.width = size;
        output.height = size;

        const context = output.getContext("2d");
        if (!context) throw new Error("Canvas QR tidak tersedia.");

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size, size);
        context.drawImage(image, 0, 0, size, size);

        return output.toDataURL("image/png");
      }

      throw new Error("QR Code tidak menghasilkan gambar.");

    } finally {
      holder.remove();
    }
  }

  // Mengubah gambar logo menjadi data PNG agar dapat dimasukkan ke PDF.
  async function imageAsDataUrl(url) {
    if (!url) return null;

    const response = await fetch(url, { mode: "cors" });

    if (!response.ok) {
      throw new Error("Logo tidak dapat diunduh: " + url);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    try {
      return await new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = image.naturalWidth || image.width;
            canvas.height = image.naturalHeight || image.height;

            const context = canvas.getContext("2d");
            if (!context) throw new Error("Canvas gambar tidak tersedia.");

            context.drawImage(image, 0, 0);
            resolve(canvas.toDataURL("image/png"));

          } catch (error) {
            reject(error);
          }
        };

        image.onerror = () => reject(
          new Error("Gagal membaca gambar logo.")
        );

        image.src = objectUrl;
      });

    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  function fitImage(pdf, data, x, y, maxW, maxH) {
    const props = pdf.getImageProperties(data);
    const ratio = Math.min(maxW / props.width, maxH / props.height);

    const w = props.width * ratio;
    const h = props.height * ratio;

    pdf.addImage(
      data,
      "PNG",
      x + (maxW - w) / 2,
      y + (maxH - h) / 2,
      w,
      h
    );
  }

  function drawSponsorRows(pdf, sponsors, dataByUrl, startY, pageWidth) {
    if (!sponsors.length) return 0;

    const columns = 7;
    const rows = Math.ceil(sponsors.length / columns);
    const rowH = 6.2;
    const left = 6;
    const available = pageWidth - 12;
    const cellW = available / columns;

    for (let i = 0; i < sponsors.length; i++) {
      const row = Math.floor(i / columns);
      const col = i % columns;
      const image = dataByUrl.get(sponsors[i].logo_url);

      if (!image) continue;

      fitImage(
        pdf,
        image,
        left + col * cellW + 1,
        startY + row * rowH + 0.5,
        cellW - 2,
        rowH - 1
      );
    }

    return rows * rowH;
  }

  async function buildCards(data) {
    await ensureCardLibraries();

    const { jsPDF } = window.jspdf;
    const people = data.participants || [];

    if (!people.length) {
      throw new Error("Belum ada data peserta untuk dibuatkan kartu.");
    }

    const sponsors = Array.isArray(data.sponsors)
      ? data.sponsors
      : [];

    const topSponsors = sponsors.filter(
      (x) => x.position === "top"
    );

    const bottomSponsors = sponsors.filter(
      (x) => x.position !== "top"
    );

    const topHeight = Math.ceil(topSponsors.length / 7) * 6.2;
    const bottomHeight = Math.ceil(bottomSponsors.length / 7) * 6.2;

    const pageWidth = 148;
    const pageHeight = 84 + topHeight + bottomHeight;

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [pageWidth, pageHeight]
    });

    const imageMap = new Map();

    const logoUrl =
      data.event?.organizer_logo_url || "logo-rajawali.jpg";

    const urls = [
      logoUrl,
      ...sponsors.map((x) => x.logo_url)
    ].filter(Boolean);

    for (const url of new Set(urls)) {
      try {
        imageMap.set(url, await imageAsDataUrl(url));
      } catch (error) {
        console.warn("Logo tidak dapat ditampilkan:", error);
      }
    }

    for (let index = 0; index < people.length; index++) {
      if (index > 0) {
        pdf.addPage([pageWidth, pageHeight], "landscape");
      }

      const p = people[index];

      // HEADER KARTU
      pdf.setFillColor(10, 28, 65);
      pdf.rect(0, 0, pageWidth, 18, "F");

      pdf.setFillColor(220, 35, 43);
      pdf.triangle(124, 0, 139, 0, 128, 18, "F");

      pdf.setFillColor(234, 186, 89);
      pdf.triangle(139, 0, 148, 0, 133, 18, "F");

      const organizer = imageMap.get(logoUrl);

      if (organizer) {
        fitImage(pdf, organizer, 5, 2, 31, 14);
      }

      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("RAJAWALI EVENT ORGANIZER", 40, 8);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      pdf.text(
        String(data.event_title || "EVENT RAJAWALI")
          .toUpperCase()
          .slice(0, 65),
        40,
        13
      );

      // SPONSOR ATAS
      if (topSponsors.length) {
        pdf.setFillColor(246, 248, 251);
        pdf.rect(0, 18, pageWidth, topHeight, "F");

        drawSponsorRows(
          pdf,
          topSponsors,
          imageMap,
          18,
          pageWidth
        );
      }

      const contentY = 18 + topHeight;

      // BAGIAN ISI
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, contentY, pageWidth, 56, "F");

      // KOTAK FOTO 3 X 4
      pdf.setDrawColor(170, 181, 198);
      pdf.setLineWidth(0.35);
      pdf.setLineDashPattern([1.2, 1.2], 0);

      pdf.roundedRect(
        5,
        contentY + 4,
        30,
        40,
        1.5,
        1.5,
        "S"
      );

      pdf.setLineDashPattern([], 0);

      pdf.setTextColor(95, 108, 128);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.text("TEMPEL FOTO", 20, contentY + 21, {
        align: "center"
      });

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6);
      pdf.text("3 x 4 cm", 20, contentY + 26, {
        align: "center"
      });

      // JUDUL KARTU
      pdf.setFillColor(185, 34, 42);
      pdf.roundedRect(
        39,
        contentY + 4,
        48,
        7,
        1.2,
        1.2,
        "F"
      );

      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.text("KARTU PESERTA", 63, contentY + 8.8, {
        align: "center"
      });

      // IDENTITAS PESERTA
      pdf.setTextColor(22, 42, 75);
      pdf.setFontSize(8);
      pdf.text("NAMA", 39, contentY + 17);

      pdf.setFontSize(10);
      pdf.text(
        String(p.full_name || "-").slice(0, 34),
        39,
        contentY + 23
      );

      pdf.setFontSize(7);
      pdf.text("PERAN", 39, contentY + 30);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(185, 34, 42);

      pdf.text(
        String(p.participant_role || "Peserta")
          .toUpperCase()
          .slice(0, 26),
        39,
        contentY + 35
      );

      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(22, 42, 75);
      pdf.setFontSize(7);
      pdf.text("TIM / KLUB", 39, contentY + 42);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);

      pdf.text(
        String(p.team_name || data.team_name || "Individu")
          .slice(0, 32),
        39,
        contentY + 47
      );

      // QR CODE UNIK SETIAP PESERTA
      const qrValue = String(
        p.qr_value || p.participant_no || ""
      );

      if (!qrValue) {
        throw new Error(
          "Nomor peserta kosong untuk " + (p.full_name || "peserta")
        );
      }

      const qrImage = await createQrDataUrl(qrValue, 300);

      pdf.addImage(
        qrImage,
        "PNG",
        111,
        contentY + 7,
        29,
        29
      );

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.5);
      pdf.setTextColor(15, 35, 66);

      pdf.text(
        "QR REGISTRASI ULANG",
        125.5,
        contentY + 40,
        { align: "center" }
      );

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6);

      pdf.text(
        "No: " + String(p.participant_no || "-").slice(0, 26),
        111,
        contentY + 47
      );

      // SPONSOR BAWAH
      const footerY = contentY + 56;

      if (bottomSponsors.length) {
        pdf.setFillColor(246, 248, 251);
        pdf.rect(
          0,
          footerY,
          pageWidth,
          bottomHeight,
          "F"
        );

        drawSponsorRows(
          pdf,
          bottomSponsors,
          imageMap,
          footerY,
          pageWidth
        );
      }

      // FOOTER KARTU
      const tokenY = footerY + bottomHeight;

      pdf.setFillColor(10, 28, 65);
      pdf.rect(0, tokenY, pageWidth, 10, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);

      pdf.text(
        "TOKEN: " + String(data.token || "-"),
        6,
        tokenY + 6.5
      );

      pdf.text(
        "TIKET MASUK PERTANDINGAN - TUNJUKKAN SAAT REGISTRASI ULANG",
        142,
        tokenY + 6.5,
        { align: "right" }
      );
    }

    return pdf;
  }

  async function handleCardAction(data, openPreview) {
    const button = openPreview
      ? $("#reo-preview-cards")
      : $("#download-cards");

    const original = button.textContent;

    button.disabled = true;
    button.textContent = "Menyiapkan kartu...";

    try {
      const pdf = await buildCards(data);

      const filename =
        "kartu-peserta-rajawali-" +
        String(data.token || "event").replace(/[^A-Z0-9-]/gi, "-") +
        ".pdf";

      if (openPreview) {
        const url = URL.createObjectURL(pdf.output("blob"));
        window.open(url, "_blank");
      } else {
        pdf.save(filename);
      }

    } catch (error) {
      console.error("Pembuatan kartu peserta:", error);

      alert(
        "Kartu peserta belum dapat dibuat: " +
        (error.message || "Terjadi kesalahan.")
      );

    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }
});
