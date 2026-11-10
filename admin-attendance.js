/* RAJAWALI EVENT ORGANIZER — Rekap Registrasi Ulang Peserta
   Sumber data: participants, registrations, participant_checkins.
   Hanya peserta yang disetujui dan pembayaran valid yang masuk rekap kehadiran.
*/
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const db = window.db;
    const dashboard = document.getElementById("dashboard-section");
    const tabs = document.querySelector(".admin-tabs");
    if (!db || !dashboard || !tabs) return;

    // Hindari pemasangan ganda bila skrip dimuat ulang.
    if (document.getElementById("attendance-panel")) return;

    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tab-btn";
    tab.dataset.tab = "attendance-panel";
    tab.textContent = "Rekap Kehadiran";
    tabs.appendChild(tab);

    const panel = document.createElement("section");
    panel.id = "attendance-panel";
    panel.className = "admin-panel hidden";
    panel.innerHTML = `
      <div class="panel-heading reo-att-head">
        <div>
          <span class="eyebrow">MONITORING PESERTA</span>
          <h2>Rekap Registrasi Ulang</h2>
          <p>Periksa kehadiran setiap atlet dan pelatih. Data diperbarui setelah petugas melakukan pemindaian QR atau input nomor peserta.</p>
        </div>
        <button type="button" id="reo-att-refresh" class="btn btn-secondary">↻ Perbarui Data</button>
      </div>

      <div class="reo-att-filters">
        <label>Event
          <select id="reo-att-event"><option value="">Memuat event...</option></select>
        </label>
        <label>Peran peserta
          <select id="reo-att-role">
            <option value="all">Semua peran</option>
            <option value="atlet">Atlet</option>
            <option value="pelatih">Pelatih</option>
            <option value="lainnya">Peran lainnya</option>
          </select>
        </label>
        <label>Status kehadiran
          <select id="reo-att-status">
            <option value="all">Semua status</option>
            <option value="belum">Belum registrasi ulang</option>
            <option value="sudah">Sudah registrasi ulang</option>
          </select>
        </label>
        <label>Cari peserta
          <input id="reo-att-search" type="search" placeholder="Nama, nomor peserta, tim...">
        </label>
      </div>

      <div id="reo-att-message" class="reo-att-message" role="status">Memuat rekap...</div>

      <div class="reo-att-stats">
        <article class="reo-att-stat"><span>Total peserta memenuhi syarat</span><strong id="reo-att-total">0</strong><small>Disetujui dan pembayaran valid</small></article>
        <article class="reo-att-stat is-present"><span>Sudah registrasi ulang</span><strong id="reo-att-present">0</strong><small>Check-in tersimpan</small></article>
        <article class="reo-att-stat is-absent"><span>Belum registrasi ulang</span><strong id="reo-att-absent">0</strong><small>Belum tercatat hadir</small></article>
        <article class="reo-att-stat"><span>Persentase kehadiran</span><strong id="reo-att-percent">0%</strong><small id="reo-att-progress-label">0 dari 0 peserta</small></article>
      </div>

      <div class="reo-att-progress"><span id="reo-att-progress-bar"></span></div>

      <div class="reo-att-exportbar">
        <div>
          <strong id="reo-att-visible-count">0 peserta ditampilkan</strong>
          <small>Unduhan mengikuti pilihan event, peran, status, dan pencarian di atas.</small>
        </div>
        <div class="reo-att-export-actions">
          <button type="button" id="reo-att-excel" class="btn btn-small btn-primary">Unduh Excel</button>
          <button type="button" id="reo-att-pdf" class="btn btn-small btn-secondary">Unduh PDF</button>
        </div>
      </div>

      <div class="reo-att-table-wrap">
        <table class="data-table reo-att-table">
          <thead><tr>
            <th>No.</th><th>Nama Peserta</th><th>Peran</th><th>Tim / Klub</th>
            <th>Nomor Peserta</th><th>Status</th><th>Waktu Check-in</th>
          </tr></thead>
          <tbody id="reo-att-rows"><tr><td colspan="7">Memuat data peserta...</td></tr></tbody>
        </table>
      </div>
      <p class="reo-att-footnote">Catatan: peserta dengan status pendaftaran belum disetujui atau pembayaran belum valid tidak dihitung dalam rekap kehadiran resmi.</p>
    `;
    dashboard.appendChild(panel);

    const style = document.createElement("style");
    style.id = "reo-attendance-css";
    style.textContent = `
      .reo-att-head{align-items:flex-start;gap:14px}
      .reo-att-head h2{margin:5px 0 6px}
      .reo-att-head p{max-width:690px}
      .reo-att-filters{display:grid;grid-template-columns:1.15fr .8fr 1fr 1.2fr;gap:10px;padding:15px;margin:14px 0;background:#f7f9fc;border:1px solid #e6ebf2;border-radius:12px}
      .reo-att-filters label{display:grid;gap:6px;font-size:11px;font-weight:700;color:#516078;min-width:0}
      .reo-att-filters select,.reo-att-filters input{width:100%;min-width:0;padding:10px 11px;border:1px solid #dce3ed;border-radius:7px;background:#fff;color:#24334d;font:inherit;font-size:12px}
      .reo-att-message{padding:10px 12px;margin:10px 0;border-radius:8px;background:#f3f6fa;color:#52617a;font-size:12px}
      .reo-att-message.error{background:#fff0f0;color:#a52b32}
      .reo-att-message.success{background:#eaf7ef;color:#176b43}
      .reo-att-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}
      .reo-att-stat{padding:15px;border:1px solid #e5eaf2;border-radius:10px;background:#fff;display:grid;gap:5px;min-width:0}
      .reo-att-stat span{font-size:11px;color:#6d7a90;line-height:1.4}
      .reo-att-stat strong{font-size:27px;line-height:1.1;color:#142b50;font-variant-numeric:tabular-nums}
      .reo-att-stat small{font-size:10px;color:#8994a5}
      .reo-att-stat.is-present strong{color:#18834f}
      .reo-att-stat.is-absent strong{color:#b23a42}
      .reo-att-progress{height:9px;background:#edf1f6;border-radius:99px;overflow:hidden;margin:0 0 20px}
      .reo-att-progress span{display:block;width:0;height:100%;background:#198754;border-radius:99px;transition:width .25s ease}
      .reo-att-exportbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:14px 0;padding:13px 15px;border:1px solid #e6ebf2;border-radius:10px;background:#fbfcfe}
      .reo-att-exportbar>div:first-child{display:grid;gap:4px;min-width:0}
      .reo-att-exportbar strong{font-size:12px;color:#22334f}
      .reo-att-exportbar small{font-size:10px;color:#7d899c;line-height:1.5}
      .reo-att-export-actions{display:flex;gap:7px;flex-wrap:wrap}
      .reo-att-table-wrap{overflow-x:auto;border:1px solid #e7ecf2;border-radius:10px;background:#fff}
      .reo-att-table{min-width:850px;margin:0}
      .reo-att-table td,.reo-att-table th{vertical-align:middle}
      .reo-att-name{font-weight:800;color:#20324e}
      .reo-att-sub{display:block;margin-top:3px;font-size:10px;color:#7b8799}
      .reo-att-badge{display:inline-block;border-radius:99px;padding:5px 9px;font-size:10px;font-weight:800;white-space:nowrap}
      .reo-att-badge.present{background:#e7f7ee;color:#187448}
      .reo-att-badge.absent{background:#fff2e5;color:#9a5b18}
      .reo-att-empty{text-align:center!important;padding:25px!important;color:#7c8799!important}
      .reo-att-footnote{font-size:10px;color:#7d899c;line-height:1.6;margin-top:12px}
      @media(max-width:800px){.reo-att-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.reo-att-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:520px){.reo-att-head{display:grid}.reo-att-head button{width:100%}.reo-att-filters{grid-template-columns:1fr}.reo-att-exportbar{align-items:stretch;flex-direction:column}.reo-att-export-actions{display:grid;grid-template-columns:1fr 1fr}.reo-att-stat{padding:12px}.reo-att-stat strong{font-size:24px}}
    `;
    document.head.appendChild(style);

    const $ = (selector) => panel.querySelector(selector);
    const eventSelect = $("#reo-att-event");
    const roleSelect = $("#reo-att-role");
    const statusSelect = $("#reo-att-status");
    const searchInput = $("#reo-att-search");
    const rowsBody = $("#reo-att-rows");
    const message = $("#reo-att-message");

    let baseRows = [];
    let visibleRows = [];
    let loading = false;
    let refreshQueued = false;
    let lastLoadedAt = null;
    let realtimeChannel = null;
    let pollHandle = null;

    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);

    const formatDate = (value) => {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "-";
      return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      }).format(date);
    };

    const safeFilePart = (value) => String(value || "semua-event")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "semua-event";

    function tell(text, kind = "") {
      message.textContent = text;
      message.className = "reo-att-message" + (kind ? " " + kind : "");
    }

    async function fetchAll(table, columns, eventId, sortColumn) {
      const output = [];
      const pageSize = 1000;
      let start = 0;
      while (true) {
        let query = db.from(table).select(columns).order(sortColumn || "created_at", { ascending: true });
        if (eventId) query = query.eq("event_id", eventId);
        const { data, error } = await query.range(start, start + pageSize - 1);
        if (error) throw new Error("Gagal membaca " + table + ": " + error.message);
        const page = data || [];
        output.push(...page);
        if (page.length < pageSize) break;
        start += pageSize;
      }
      return output;
    }

    async function loadEvents() {
      const { data, error } = await db.from("events")
        .select("id,title,start_date,status")
        .order("start_date", { ascending: false });
      if (error) throw new Error("Gagal memuat event: " + error.message);
      const previous = eventSelect.value;
      eventSelect.innerHTML = '<option value="">Semua event</option>' +
        (data || []).map((event) => `<option value="${esc(event.id)}">${esc(event.title)}</option>`).join("");
      if (previous && [...eventSelect.options].some((option) => option.value === previous)) {
        eventSelect.value = previous;
      }
    }

    function roleMatches(role, selected) {
      const value = String(role || "").toLowerCase();
      if (selected === "atlet") return /atlet|athlete/.test(value);
      if (selected === "pelatih") return /pelatih|coach/.test(value);
      if (selected === "lainnya") return !/atlet|athlete|pelatih|coach/.test(value);
      return true;
    }

    function filterRows() {
      const role = roleSelect.value;
      const status = statusSelect.value;
      const term = searchInput.value.trim().toLowerCase();
      visibleRows = baseRows.filter((row) => {
        if (!roleMatches(row.role, role)) return false;
        if (status === "sudah" && !row.checked) return false;
        if (status === "belum" && row.checked) return false;
        if (term) {
          const haystack = [row.event, row.name, row.role, row.team, row.no, row.token]
            .join(" ").toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        return true;
      });
      renderTable();
    }

    function renderSummary() {
      const total = baseRows.length;
      const present = baseRows.filter((row) => row.checked).length;
      const absent = total - present;
      const percent = total ? Math.round((present / total) * 100) : 0;
      $("#reo-att-total").textContent = total.toLocaleString("id-ID");
      $("#reo-att-present").textContent = present.toLocaleString("id-ID");
      $("#reo-att-absent").textContent = absent.toLocaleString("id-ID");
      $("#reo-att-percent").textContent = percent + "%";
      $("#reo-att-progress-label").textContent = `${present.toLocaleString("id-ID")} dari ${total.toLocaleString("id-ID")} peserta`;
      $("#reo-att-progress-bar").style.width = percent + "%";
    }

    function renderTable() {
      $("#reo-att-visible-count").textContent = visibleRows.length.toLocaleString("id-ID") + " peserta ditampilkan";
      if (!visibleRows.length) {
        rowsBody.innerHTML = '<tr><td colspan="7" class="reo-att-empty">Tidak ada peserta yang sesuai dengan filter. Periksa event, status persetujuan, atau pilihan pencarian.</td></tr>';
        return;
      }
      rowsBody.innerHTML = visibleRows.map((row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><span class="reo-att-name">${esc(row.name)}</span><span class="reo-att-sub">Token: ${esc(row.token || "-")}</span></td>
          <td>${esc(row.role || "Peserta")}</td>
          <td>${esc(row.team || "Individu")}</td>
          <td><b>${esc(row.no || "-")}</b></td>
          <td><span class="reo-att-badge ${row.checked ? "present" : "absent"}">${row.checked ? "Sudah hadir" : "Belum hadir"}</span></td>
          <td>${esc(row.checkedAt ? formatDate(row.checkedAt) : "-")}</td>
        </tr>
      `).join("");
    }

    async function loadAttendance(options = {}) {
      if (loading) {
        refreshQueued = true;
        return;
      }
      loading = true;
      const quiet = Boolean(options.quiet);
      if (!quiet) tell("Mengambil data peserta dan registrasi ulang...");
      try {
        const eventId = eventSelect.value || null;
        const [participants, registrations, checkins] = await Promise.all([
          fetchAll("participants", "id,event_id,registration_id,participant_no,full_name,participant_role,team_name,created_at", eventId, "created_at"),
          fetchAll("registrations", "id,event_id,token,registrant_name,registration_type,team_name,whatsapp,payment_amount,payment_status,registration_status,created_at", eventId, "created_at"),
          fetchAll("participant_checkins", "id,event_id,participant_id,checked_in_at,checked_in_by", eventId, "checked_in_at")
        ]);

        const regMap = new Map(registrations.map((registration) => [registration.id, registration]));
        const checkinMap = new Map(checkins.map((checkin) => [checkin.participant_id, checkin]));
        const eventName = eventSelect.selectedOptions[0]?.textContent || "Semua event";

        baseRows = participants.flatMap((participant) => {
          const registration = regMap.get(participant.registration_id);
          // Kehadiran resmi hanya untuk peserta yang sudah disetujui dan pembayarannya valid.
          if (!registration) return [];
          const approved = registration.registration_status === "approved";
          const paid = registration.payment_status === "verified" || registration.payment_status === "not_required";
          if (!approved || !paid) return [];

          const checkin = checkinMap.get(participant.id);
          return [{
            event: eventName === "Semua event"
              ? (eventSelect.selectedOptions[0]?.textContent || "Event")
              : eventName,
            eventId: participant.event_id,
            registrationId: participant.registration_id,
            participantId: participant.id,
            no: participant.participant_no || "",
            name: participant.full_name || registration.registrant_name || "Tanpa nama",
            role: participant.participant_role || "Peserta",
            team: participant.team_name || registration.team_name || "Individu",
            token: registration.token || "",
            whatsapp: registration.whatsapp || "",
            amount: Number(registration.payment_amount || 0),
            payment: registration.payment_status || "",
            registrationStatus: registration.registration_status || "",
            createdAt: participant.created_at || registration.created_at || "",
            checked: Boolean(checkin),
            checkedAt: checkin?.checked_in_at || ""
          }];
        });

        // Untuk pilihan Semua Event, gunakan nama event yang sebenarnya.
        if (!eventId && baseRows.length) {
          const eventResult = await db.from("events").select("id,title");
          if (!eventResult.error) {
            const names = new Map((eventResult.data || []).map((event) => [event.id, event.title]));
            baseRows.forEach((row) => { row.event = names.get(row.eventId) || row.event; });
          }
        }

        renderSummary();
        filterRows();
        lastLoadedAt = new Date();
        tell("Data berhasil diperbarui pukul " + lastLoadedAt.toLocaleTimeString("id-ID") + ".", "success");
      } catch (error) {
        console.error("Rekap kehadiran Rajawali:", error);
        tell(error.message || "Gagal memuat rekap kehadiran.", "error");
        rowsBody.innerHTML = `<tr><td colspan="7" class="reo-att-empty">${esc(error.message || "Gagal memuat data")}</td></tr>`;
      } finally {
        loading = false;
        if (refreshQueued) {
          refreshQueued = false;
          loadAttendance({ quiet: true });
        }
      }
    }

    function exportRows() {
      if (!visibleRows.length) throw new Error("Tidak ada data peserta untuk diunduh.");
      return visibleRows.map((row, index) => ({
        "No": index + 1,
        "Nama Event": row.event,
        "Nomor Peserta": row.no,
        "Nama Peserta": row.name,
        "Peran": row.role,
        "Tim / Klub": row.team,
        "Token Pendaftaran": row.token,
        "WhatsApp Pendaftar": row.whatsapp,
        "Status Pembayaran": row.payment,
        "Status Pendaftaran": row.registrationStatus,
        "Status Registrasi Ulang": row.checked ? "Sudah registrasi ulang" : "Belum registrasi ulang",
        "Waktu Registrasi Ulang": row.checkedAt ? formatDate(row.checkedAt) : "Belum hadir"
      }));
    }

    function exportExcel() {
      if (!window.XLSX) throw new Error("Pustaka Excel belum termuat di admin.html.");
      const records = exportRows();
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(records);
      worksheet["!cols"] = [
        { wch: 6 }, { wch: 28 }, { wch: 22 }, { wch: 28 }, { wch: 16 },
        { wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 19 }, { wch: 19 },
        { wch: 25 }, { wch: 25 }
      ];
      if (worksheet["!ref"]) worksheet["!autofilter"] = { ref: worksheet["!ref"] };
      XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Kehadiran");

      const summary = [
        ["REKAP REGISTRASI ULANG — RAJAWALI EVENT ORGANIZER"],
        ["Event", eventSelect.selectedOptions[0]?.textContent || "Semua Event"],
        ["Tanggal Ekspor", formatDate(new Date())],
        ["Total peserta memenuhi syarat", baseRows.length],
        ["Sudah registrasi ulang", baseRows.filter((row) => row.checked).length],
        ["Belum registrasi ulang", baseRows.filter((row) => !row.checked).length],
        ["Jumlah pada hasil filter", visibleRows.length],
        ["Filter peran", roleSelect.selectedOptions[0]?.textContent || "Semua peran"],
        ["Filter status", statusSelect.selectedOptions[0]?.textContent || "Semua status"]
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summary), "Ringkasan");
      XLSX.writeFile(workbook, "rekap-registrasi-ulang-" + safeFilePart(eventSelect.selectedOptions[0]?.textContent) + ".xlsx");
    }

    function exportPdf() {
      if (!window.jspdf?.jsPDF) throw new Error("Pustaka PDF belum termuat di admin.html.");
      const records = exportRows();
      const pdf = new window.jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const total = baseRows.length;
      const present = baseRows.filter((row) => row.checked).length;
      const absent = total - present;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("REKAP REGISTRASI ULANG PESERTA", 14, 15);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text("RAJAWALI EVENT ORGANIZER", 14, 21);
      pdf.text("Event: " + (eventSelect.selectedOptions[0]?.textContent || "Semua Event"), 14, 27);
      pdf.text("Total: " + total + " | Sudah hadir: " + present + " | Belum hadir: " + absent, 14, 33);
      pdf.text("Hasil filter: " + records.length + " peserta | Dicetak: " + formatDate(new Date()), 14, 39);

      if (typeof pdf.autoTable !== "function") {
        throw new Error("Komponen tabel PDF belum termuat. Muat ulang Panel Admin.");
      }

      pdf.autoTable({
        head: [["No", "Event", "No. Peserta", "Nama Peserta", "Peran", "Tim / Klub", "Status", "Waktu Check-in"]],
        body: visibleRows.map((row, index) => [
          index + 1, row.event, row.no, row.name, row.role, row.team,
          row.checked ? "Sudah hadir" : "Belum hadir",
          row.checkedAt ? formatDate(row.checkedAt) : "-"
        ]),
        startY: 45,
        theme: "grid",
        styles: { font: "helvetica", fontSize: 7, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [11, 30, 70], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 248, 252] },
        margin: { left: 10, right: 10, bottom: 14 },
        didDrawPage: () => {
          const pageHeight = pdf.internal.pageSize.getHeight();
          pdf.setFontSize(7);
          pdf.setTextColor(110);
          pdf.text("Rajawali Event Organizer · Halaman " + pdf.internal.getNumberOfPages(), 14, pageHeight - 7);
        }
      });

      pdf.save("rekap-registrasi-ulang-" + safeFilePart(eventSelect.selectedOptions[0]?.textContent) + ".pdf");
    }

    function runExport(kind) {
      const button = kind === "excel" ? $("#reo-att-excel") : $("#reo-att-pdf");
      const original = button.textContent;
      button.disabled = true;
      button.textContent = "Menyiapkan...";
      try {
        if (kind === "excel") exportExcel();
        else exportPdf();
        tell("Laporan " + (kind === "excel" ? "Excel" : "PDF") + " berhasil disiapkan.", "success");
      } catch (error) {
        tell(error.message || "Gagal membuat laporan.", "error");
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    }

    function openPanel() {
      document.querySelectorAll(".admin-panel").forEach((item) => item.classList.add("hidden"));
      document.querySelectorAll(".tab-btn").forEach((item) => item.classList.toggle("active", item === tab));
      panel.classList.remove("hidden");
      loadAttendance();
      if (!realtimeChannel && typeof db.channel === "function") {
        realtimeChannel = db.channel("reo-attendance-live")
          .on("postgres_changes", {
            event: "*", schema: "public", table: "participant_checkins"
          }, () => loadAttendance({ quiet: true }))
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              console.warn("Realtime check-in tidak aktif; pembaruan otomatis tetap menggunakan polling.");
            }
          });
      }
    }

    tab.addEventListener("click", openPanel);
    $("#reo-att-refresh").addEventListener("click", () => loadAttendance());
    eventSelect.addEventListener("change", () => loadAttendance());
    roleSelect.addEventListener("change", filterRows);
    statusSelect.addEventListener("change", filterRows);
    searchInput.addEventListener("input", filterRows);
    $("#reo-att-excel").addEventListener("click", () => runExport("excel"));
    $("#reo-att-pdf").addEventListener("click", () => runExport("pdf"));

    window.addEventListener("focus", () => {
      if (!panel.classList.contains("hidden")) loadAttendance({ quiet: true });
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !panel.classList.contains("hidden")) loadAttendance({ quiet: true });
    });

    // Polling cadangan agar rekap tetap mengikuti check-in meskipun Realtime belum diaktifkan di Supabase.
    pollHandle = window.setInterval(() => {
      if (!panel.classList.contains("hidden") && !document.hidden) {
        loadAttendance({ quiet: true });
      }
    }, 30000);

    loadEvents().then(() => {
      eventSelect.value = "";
      tell("Pilih event untuk melihat rekap seluruh atlet dan pelatih yang sudah disetujui.", "success");
    }).catch((error) => tell(error.message, "error"));

    // Bersihkan timer/channel ketika halaman ditinggalkan.
    window.addEventListener("beforeunload", () => {
      if (pollHandle) window.clearInterval(pollHandle);
      if (realtimeChannel) db.removeChannel(realtimeChannel);
    });
  });
})();
