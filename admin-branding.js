/* Branding per event. Dipasang sebagai add-on agar logika admin.js utama tetap utuh. */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("event-form");
  const saveMessage = document.getElementById("save-message");
  const eventList = document.getElementById("admin-event-list");
  const organizerInput = document.getElementById("event-organizer-logo");
  const sponsorInput = document.getElementById("event-sponsor-files");
  const pendingBox = document.getElementById("event-sponsor-pending");
  const currentBox = document.getElementById("event-sponsor-current");
  const organizerPreview = document.getElementById("event-organizer-preview");
  if (!form || !saveMessage || !organizerInput || !sponsorInput) return;

  let pendingSponsors = [];
  let currentEventId = "";
  let existingSponsors = [];
  let observer = null;
  let saveSnapshot = null;
  let processing = false;

  const safeName = (value) => String(value || "sponsor")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100) || "Sponsor";

  function note(text, isError = false) {
    saveMessage.textContent = text;
    saveMessage.style.color = isError ? "#b42332" : "#17734e";
  }

  function resetBranding() {
    pendingSponsors = [];
    currentEventId = "";
    existingSponsors = [];
    organizerInput.value = "";
    sponsorInput.value = "";
    renderPending();
    renderCurrent();
    organizerPreview.innerHTML = '<span class="reo-muted">Belum ada logo event khusus. Header kartu akan menggunakan logo utama website.</span>';
  }

  function renderPending() {
    pendingBox.replaceChildren();
    if (!pendingSponsors.length) {
      pendingBox.textContent = "Belum ada logo sponsor baru yang dipilih.";
      return;
    }
    pendingSponsors.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "reo-brand-row";
      const name = document.createElement("input");
      name.type = "text";
      name.maxLength = 100;
      name.value = item.name;
      name.placeholder = "Nama sponsor";
      name.setAttribute("aria-label", "Nama sponsor " + (index + 1));
      name.addEventListener("input", () => item.name = name.value.trim());
      const position = document.createElement("select");
      position.innerHTML = '<option value="top">Bagian atas kartu</option><option value="bottom">Bagian bawah kartu</option>';
      position.value = item.position;
      position.addEventListener("change", () => item.position = position.value);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn btn-ghost btn-small";
      remove.textContent = "Hapus";
      remove.addEventListener("click", () => {
        pendingSponsors.splice(index, 1);
        renderPending();
      });
      row.append(name, position, remove);
      const wrapper = document.createElement("div");
      wrapper.className = "reo-brand-pending-item";
      const fileName = document.createElement("small");
      fileName.textContent = item.file.name;
      wrapper.append(fileName, row);
      pendingBox.append(wrapper);
    });
  }

  function renderCurrent() {
    currentBox.replaceChildren();
    if (!existingSponsors.length) {
      currentBox.textContent = "Belum ada logo sponsor yang tersimpan untuk event ini.";
      return;
    }
    existingSponsors.forEach((sponsor) => {
      const row = document.createElement("div");
      row.className = "reo-brand-existing-row";
      const img = document.createElement("img");
      img.src = sponsor.logo_url;
      img.alt = sponsor.sponsor_name;
      img.loading = "lazy";
      const name = document.createElement("strong");
      name.textContent = sponsor.sponsor_name;
      const position = document.createElement("select");
      position.innerHTML = '<option value="top">Atas</option><option value="bottom">Bawah</option>';
      position.value = sponsor.position;
      position.addEventListener("change", async () => {
        const result = await db.from("event_sponsors").update({ position: position.value }).eq("id", sponsor.id);
        if (result.error) {
          alert("Posisi sponsor gagal diubah: " + result.error.message);
          position.value = sponsor.position;
          return;
        }
        sponsor.position = position.value;
      });
      const order = document.createElement("input");
      order.type = "number";
      order.min = "0";
      order.step = "1";
      order.value = String(sponsor.sort_order || 0);
      order.title = "Urutan tampilan";
      order.addEventListener("change", async () => {
        const next = Math.max(0, Number(order.value) || 0);
        const result = await db.from("event_sponsors").update({ sort_order: next }).eq("id", sponsor.id);
        if (result.error) {
          alert("Urutan sponsor gagal diubah: " + result.error.message);
          order.value = String(sponsor.sort_order || 0);
        } else sponsor.sort_order = next;
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn btn-ghost btn-small";
      remove.textContent = "Hapus";
      remove.addEventListener("click", async () => {
        if (!confirm("Hapus logo sponsor " + sponsor.sponsor_name + " dari event ini?")) return;
        remove.disabled = true;
        const storage = await db.storage.from("event-assets").remove([sponsor.logo_path]);
        if (storage.error) {
          alert("File sponsor tidak berhasil dihapus dari Storage: " + storage.error.message);
          remove.disabled = false;
          return;
        }
        const deleted = await db.from("event_sponsors").delete().eq("id", sponsor.id);
        if (deleted.error) {
          alert("Data sponsor gagal dihapus: " + deleted.error.message);
          remove.disabled = false;
          return;
        }
        await db.from("event_assets").delete().eq("bucket_name", "event-assets").eq("object_path", sponsor.logo_path);
        existingSponsors = existingSponsors.filter((x) => x.id !== sponsor.id);
        renderCurrent();
      });
      row.append(img, name, position, order, remove);
      currentBox.append(row);
    });
  }

  async function loadBranding(eventId) {
    if (!eventId || !window.db) return;
    currentEventId = eventId;
    try {
      const [eventResult, sponsorsResult] = await Promise.all([
        db.from("events").select("organizer_logo_url,organizer_logo_path").eq("id", eventId).maybeSingle(),
        db.from("event_sponsors").select("id,sponsor_name,logo_url,logo_path,position,sort_order").eq("event_id", eventId).order("position").order("sort_order")
      ]);
      if (eventResult.error) throw eventResult.error;
      if (sponsorsResult.error) throw sponsorsResult.error;
      existingSponsors = sponsorsResult.data || [];
      renderCurrent();
      if (eventResult.data?.organizer_logo_url) {
        organizerPreview.innerHTML = "";
        const img = document.createElement("img");
        img.src = eventResult.data.organizer_logo_url;
        img.alt = "Logo Rajawali event";
        img.className = "reo-organizer-preview-img";
        organizerPreview.append(img);
      } else {
        organizerPreview.textContent = "Belum ada logo khusus. Logo utama website akan digunakan.";
      }
    } catch (error) {
      currentBox.textContent = "Logo event belum dapat dimuat: " + error.message + ". Pastikan migrasi branding telah dijalankan.";
    }
  }

  sponsorInput.addEventListener("change", () => {
    const files = Array.from(sponsorInput.files || []);
    if (!files.length) return;

    // Bangun daftar identitas file yang sudah dipilih agar tidak terduplikasi.
    const existingKeys = new Set(
      pendingSponsors.map((item) =>
        [item.file.name, item.file.size, item.file.lastModified].join("|")
      )
    );

    let added = 0;
    let rejected = 0;

    for (const file of files) {
      if (!file.type || !file.type.startsWith("image/")) {
        alert("File " + file.name + " bukan gambar dan tidak ditambahkan.");
        rejected++;
        continue;
      }

      if (file.size > 8 * 1024 * 1024) {
        alert("Logo " + file.name + " melebihi batas 8 MB dan tidak ditambahkan.");
        rejected++;
        continue;
      }

      const key = [file.name, file.size, file.lastModified].join("|");
      if (existingKeys.has(key)) continue;

      pendingSponsors.push({
        file,
        name: safeName(file.name),
        position: "bottom",
      });

      existingKeys.add(key);
      added++;
    }

    // Reset input tanpa menghapus file dalam pendingSponsors.
    // Admin dapat membuka pemilih file lagi untuk menambah batch berikutnya.
    sponsorInput.value = "";
    renderPending();

    if (added > 0) {
      note(
        added + " logo sponsor ditambahkan. " +
        pendingSponsors.length + " logo siap disimpan."
      );
    } else if (rejected > 0) {
      note("Tidak ada logo valid yang ditambahkan.", true);
    } else {
      note("Logo tersebut sudah ada dalam daftar pilihan.");
    }
  });

  organizerInput.addEventListener("change", () => {
    const file = organizerInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Logo harus berupa file gambar.");
      organizerInput.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    organizerPreview.innerHTML = "";
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Pratinjau logo Rajawali event";
    img.className = "reo-organizer-preview-img";
    organizerPreview.append(img);
  });

  form.addEventListener("submit", () => {
    if (observer) observer.disconnect();
    saveSnapshot = {
      eventId: document.getElementById("edit-event-id").value.trim(),
      slug: document.getElementById("event-slug").value.trim(),
      organizerFile: organizerInput.files?.[0] || null,
      sponsors: pendingSponsors.map((x) => ({ ...x })),
    };
    observer = new MutationObserver(() => {
      const value = saveMessage.textContent || "";
      if (value.includes("Event dan formulir berhasil disimpan.")) {
        observer.disconnect();
        saveBranding(saveSnapshot).catch((error) => {
          console.error("Simpan branding event:", error);
          note("Event tersimpan, tetapi penyimpanan logo gagal: " + error.message + ". Silakan buka Edit Event dan coba unggah kembali.", true);
        });
      } else if (value.startsWith("Gagal menyimpan:")) {
        observer.disconnect();
      }
    });
    observer.observe(saveMessage, { childList: true, characterData: true, subtree: true });
  });

  async function uploadImage(eventId, file, folder) {
    if (!file || !file.type.startsWith("image/")) throw new Error("File logo harus berupa gambar.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Ukuran setiap logo maksimal 8 MB.");
    const extension = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = eventId + "/branding/" + folder + "/" + Date.now() + "-" + crypto.randomUUID() + "-" + safe;
    const upload = await db.storage.from("event-assets").upload(path, file, { upsert: false, contentType: file.type || ("image/" + extension) });
    if (upload.error) throw new Error("Upload " + file.name + " gagal: " + upload.error.message);
    const publicData = db.storage.from("event-assets").getPublicUrl(path);
    const asset = await db.from("event_assets").insert({ event_id: eventId, bucket_name: "event-assets", object_path: path });
    if (asset.error) {
      await db.storage.from("event-assets").remove([path]);
      throw new Error("Pencatatan file " + file.name + " gagal: " + asset.error.message);
    }
    return { path, url: publicData.data.publicUrl };
  }

  async function saveBranding(snapshot) {
    if (processing || !snapshot) return;
    if (!snapshot.organizerFile && !snapshot.sponsors.length) return;
    processing = true;
    note("Event tersimpan. Sedang mengunggah logo Rajawali dan sponsor...");
    try {
      let eventId = snapshot.eventId;
      let event = null;
      if (eventId) {
        const result = await db.from("events").select("id,organizer_logo_path").eq("id", eventId).maybeSingle();
        if (result.error) throw result.error;
        event = result.data;
      } else {
        const result = await db.from("events").select("id,organizer_logo_path").eq("slug", snapshot.slug).maybeSingle();
        if (result.error) throw result.error;
        event = result.data;
        eventId = event?.id || "";
      }
      if (!eventId || !event) throw new Error("Event tersimpan tetapi ID event tidak ditemukan untuk menyimpan logo.");

      if (snapshot.organizerFile) {
        const uploaded = await uploadImage(eventId, snapshot.organizerFile, "organizer");
        const updated = await db.from("events").update({ organizer_logo_url: uploaded.url, organizer_logo_path: uploaded.path }).eq("id", eventId);
        if (updated.error) throw updated.error;
      }

      if (snapshot.sponsors.length) {
        const existing = await db.from("event_sponsors").select("id,position,sort_order").eq("event_id", eventId);
        if (existing.error) throw existing.error;
        const orders = { top: 0, bottom: 0 };
        (existing.data || []).forEach((x) => orders[x.position] = Math.max(orders[x.position], Number(x.sort_order || 0) + 1));
        for (const sponsor of snapshot.sponsors) {
          const uploaded = await uploadImage(eventId, sponsor.file, "sponsors");
          const saved = await db.from("event_sponsors").insert({
            event_id: eventId,
            sponsor_name: sponsor.name || safeName(sponsor.file.name),
            logo_url: uploaded.url,
            logo_path: uploaded.path,
            position: sponsor.position,
            sort_order: orders[sponsor.position]++,
          });
          if (saved.error) throw saved.error;
        }
      }

      pendingSponsors = [];
      existingSponsors = [];
      organizerInput.value = "";
      sponsorInput.value = "";
      renderPending();
      await loadBranding(eventId);
      note("Event dan seluruh logo branding berhasil disimpan.");
    } finally {
      processing = false;
    }
  }

  eventList?.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit]");
    if (!editButton) return;
    resetBranding();
    setTimeout(() => {
      const id = document.getElementById("edit-event-id")?.value;
      if (id) loadBranding(id);
    }, 120);
  });

  document.getElementById("new-event-btn")?.addEventListener("click", resetBranding);
  document.getElementById("cancel-edit-btn")?.addEventListener("click", resetBranding);
  resetBranding();
});
