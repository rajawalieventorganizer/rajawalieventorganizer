/* RAJAWALI — aksi tambahan pendaftar: batalkan persetujuan dan hapus. */
document.addEventListener("DOMContentLoaded", () => {
  const box = document.getElementById("registrant-list");
  if (!box) return;

  const style = document.createElement("style");
  style.textContent = `
    .reo-registration-extra-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}
    .reo-registration-extra-actions button{font-size:10px!important;padding:6px 8px!important;white-space:normal}
    .reo-registration-extra-actions .reo-delete-registration{color:#a3232b;border:1px solid #e7b9bd;background:#fff7f7}
  `;
  document.head.appendChild(style);

  function addActions() {
    const regs = Array.isArray(window._registrations) ? window._registrations : [];
    box.querySelectorAll("tbody tr").forEach((tr) => {
      const cells = tr.querySelectorAll("td");
      if (cells.length < 6) return;
      const token = (cells[1].textContent || "").trim();
      const row = regs.find((item) => item.token === token);
      if (!row) return;
      const actionCell = cells[5];
      if (actionCell.querySelector("[data-reo-registration-extra]")) return;

      const holder = document.createElement("div");
      holder.className = "reo-registration-extra-actions";
      holder.setAttribute("data-reo-registration-extra", "1");

      if (row.registration_status === "approved") {
        const undo = document.createElement("button");
        undo.type = "button";
        undo.className = "btn btn-small btn-ghost";
        undo.textContent = "Batalkan Persetujuan";
        undo.dataset.reoUnapprove = row.id;
        holder.appendChild(undo);
      }

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn btn-small reo-delete-registration";
      remove.textContent = "Hapus Pendaftaran";
      remove.dataset.reoDeleteRegistration = row.id;
      holder.appendChild(remove);
      actionCell.appendChild(holder);
    });
  }

  const observer = new MutationObserver(addActions);
  observer.observe(box, { childList: true, subtree: true });
  addActions();

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-reo-unapprove], [data-reo-delete-registration]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const unapproveId = button.dataset.reoUnapprove;
    const deleteId = button.dataset.reoDeleteRegistration;
    const id = unapproveId || deleteId;
    const row = (window._registrations || []).find((item) => item.id === id);
    if (!row || !window.db) {
      alert("Data pendaftaran tidak tersedia. Muat ulang panel admin.");
      return;
    }

    const yes = unapproveId
      ? confirm("Batalkan persetujuan pendaftaran " + row.token + "? Status akan kembali menjadi Menunggu. Pembayaran yang sudah terverifikasi tetap dipertahankan.")
      : confirm("Hapus pendaftaran " + row.token + " atas nama " + (row.registrant_name || row.team_name || "Peserta") + "? Seluruh data atlet/pelatih dan riwayat registrasi ulang terkait akan ikut terhapus. Tindakan ini permanen.");
    if (!yes) return;

    button.disabled = true;
    const oldText = button.textContent;
    button.textContent = "Memproses...";
    try {
      const { data: userData, error: userError } = await db.auth.getUser();
      if (userError || !userData?.user) throw new Error("Sesi admin berakhir. Silakan login kembali.");
      const admin = await db.rpc("is_organizer_admin");
      if (admin.error || admin.data !== true) throw new Error("Akun ini tidak memiliki hak admin Rajawali.");

      const result = unapproveId
        ? await db.from("registrations").update({ registration_status: "pending" }).eq("id", id)
        : await db.from("registrations").delete().eq("id", id);
      if (result.error) throw new Error(result.error.message);

      alert(unapproveId ? "Persetujuan dibatalkan. Status kembali menjadi Menunggu." : "Pendaftaran dan data peserta terkait berhasil dihapus.");
      const tab = document.querySelector('.tab-btn[data-tab="registrants-panel"]');
      if (tab) tab.click();
    } catch (error) {
      alert("Aksi gagal: " + (error?.message || "Terjadi kesalahan."));
      button.disabled = false;
      button.textContent = oldText;
    }
  }, true);
});
