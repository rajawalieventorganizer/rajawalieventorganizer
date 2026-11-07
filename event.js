document.addEventListener("DOMContentLoaded", async () => {
  const { $, esc, date, money } = window.Rajawali;
  const slug = new URLSearchParams(location.search).get("slug");
  const top = $("#event-top"), desc = $("#event-description"), area = $("#registration-area");
  if (!window.db) { top.innerHTML = '<div class="empty-state">Supabase belum dikonfigurasi.</div>'; return; }
  if (!slug) { top.innerHTML = '<div class="empty-state">Alamat event tidak lengkap. Kembali ke halaman agenda.</div>'; return; }
  const { data:event, error } = await db.from("events").select("*").eq("slug",slug).eq("status","published").maybeSingle();
  if (error || !event) { top.innerHTML = '<div class="empty-state">Event tidak ditemukan atau belum dipublikasikan.</div>'; return; }
  document.title = `${event.title} | Rajawali`;
  top.innerHTML = `<span class="eyebrow">${esc(event.category || "EVENT RAJAWALI")}</span><h1 class="event-title">${esc(event.title)}</h1><p class="event-subtitle">${esc(event.summary || "Informasi resmi kegiatan Rajawali Event Organizer.")}</p><div class="event-hero-meta"><span>▦ ${date(event.start_date)}</span><span>⌖ ${esc(event.venue || "Lokasi menyusul")}</span><span>◈ ${event.fee_mode === "free" ? "Gratis" : money(event.fee_amount)}</span></div>`;
  desc.innerHTML = `<h2>Tentang Event</h2><p>${esc(event.description || event.summary || "Deskripsi event belum tersedia.")}</p><div class="event-facts"><p><b>Tanggal mulai:</b> ${date(event.start_date)}</p><p><b>Tanggal selesai:</b> ${date(event.end_date)}</p><p><b>Batas pendaftaran:</b> ${date(event.registration_deadline)}</p><p><b>Lokasi:</b> ${esc(event.venue || "Belum ditentukan")}</p></div>`;
  const { data:fields } = await db.from("event_fields").select("*").eq("event_id",event.id).order("sort_order");
  const fieldsHtml = (fields || []).map(f => {
    const id = `custom-${f.id}`, required = f.is_required ? "required" : "";
    if (f.field_type === "select") return `<label>${esc(f.label)}${required? " *":""}<select name="${esc(f.field_key)}" ${required}><option value="">Pilih...</option>${(f.options||[]).map(o=>`<option>${esc(o)}</option>`).join("")}</select></label>`;
    if (f.field_type === "textarea") return `<label>${esc(f.label)}${required? " *":""}<textarea name="${esc(f.field_key)}" rows="3" ${required}></textarea></label>`;
    return `<label>${esc(f.label)}${required? " *":""}<input name="${esc(f.field_key)}" type="${["text","number","date","tel","email"].includes(f.field_type)?f.field_type:"text"}" ${required}></label>`;
  }).join("");
  const closed = event.registration_deadline && event.registration_deadline < new Date().toISOString().slice(0,10);
  area.innerHTML = closed ? '<div class="notice">Pendaftaran untuk event ini telah ditutup.</div>' : `
    <form id="register-form"><label>Jenis Pendaftaran<select id="reg-type" name="registration_type">${event.registration_type!=="team"?'<option value="individual">Individu</option>':""}${event.registration_type!=="individual"?'<option value="team">Tim / Grup</option>':""}</select></label>
    <div id="team-name-wrap" class="hidden"><label>Nama Tim / Klub<input name="team_name" id="team-name"></label></div>
    <div id="people-list"><div class="person-row"><h4>Data Peserta 1</h4><label>Nama Lengkap *<input name="person_name" required maxlength="100"></label><label>Peran<select name="person_role"><option>Atlet</option><option>Ketua Tim</option><option>Pelatih</option><option>Manajer Tim</option><option>Peserta</option></select></label></div></div>
    <button type="button" id="add-person" class="btn btn-secondary btn-small hidden">+ Tambah Anggota</button>
    ${fieldsHtml}<label>Nomor WhatsApp Pendaftar *<input name="whatsapp" type="tel" required placeholder="08xxxxxxxxxx"></label>
    ${event.fee_mode === "manual_transfer" && Number(event.fee_amount||0)>0 ? `<div class="notice"><b>Pembayaran transfer manual</b><br>Bank: ${esc(event.bank_name||"Informasi bank belum tersedia")}<br>Nomor rekening: ${esc(event.bank_account_number||"Belum diatur")}<br>Atas nama: ${esc(event.bank_account_holder||"Belum diatur")}<br><small>Nominal transfer akan ditampilkan setelah pendaftaran dan mencakup tiga digit unik pada token.</small></div>` : ""}
    <button type="submit" class="btn btn-primary full">Kirim Pendaftaran</button><p class="field-hint">Pastikan data benar. Token pendaftaran akan ditampilkan setelah berhasil.</p></form><div id="registration-result"></div>`;
  const form = $("#register-form"), type = $("#reg-type"), people = $("#people-list"), add = $("#add-person"), team = $("#team-name-wrap");
  if (!form) return;
  function refreshType() { const isTeam = type.value === "team"; team.classList.toggle("hidden",!isTeam); add.classList.toggle("hidden",!isTeam); }
  type.addEventListener("change",refreshType); refreshType();
  add.addEventListener("click",()=>{ const n=people.querySelectorAll(".person-row").length+1; if(n>50)return alert("Maksimal 50 anggota per formulir."); const row=document.createElement("div");row.className="person-row";row.innerHTML=`<h4>Data Peserta ${n} <button type="button" class="remove-person">Hapus</button></h4><label>Nama Lengkap *<input name="person_name" required maxlength="100"></label><label>Peran<select name="person_role"><option>Atlet</option><option>Ketua Tim</option><option>Pelatih</option><option>Manajer Tim</option><option>Peserta</option></select></label>`;row.querySelector(".remove-person").addEventListener("click",()=>row.remove());people.append(row); });
  form.addEventListener("submit", async ev => {
    ev.preventDefault(); const button=form.querySelector('[type=submit]'); button.disabled=true;button.textContent="Mengirim...";
    const fd=new FormData(form), names=fd.getAll("person_name"), roles=fd.getAll("person_role"), custom={};
    (fields||[]).forEach(f=>{const v=fd.get(f.field_key);if(v!==null&&v!=="")custom[f.field_key]=v;});
    const payload={event_id:event.id,registration_type:type.value,team_name:fd.get("team_name")||"",whatsapp:fd.get("whatsapp"),participants:names.map((name,i)=>({name,role:roles[i]||"Peserta"})),custom_data:custom};
    try {
      const {data,error}=await db.functions.invoke("register-event",{body:payload});
      if(error) throw error;
      $("#registration-result").innerHTML=`<div class="status-result"><b>Pendaftaran diterima.</b><p>Simpan token ini untuk cek status.</p><div class="token-text">${esc(data.token)}</div><p>Biaya: <b>${money(data.payment_amount)}</b></p><p>${data.payment_amount>0?"Lakukan transfer ke rekening yang dicantumkan panitia, lalu tunggu verifikasi admin.": "Pendaftaran gratis berhasil dicatat."}</p><a class="btn btn-secondary btn-small" href="cek-status.html">Cek Status Pendaftaran</a></div>`;
      form.reset();people.innerHTML='<div class="person-row"><h4>Data Peserta 1</h4><label>Nama Lengkap *<input name="person_name" required maxlength="100"></label><label>Peran<select name="person_role"><option>Atlet</option><option>Ketua Tim</option><option>Pelatih</option><option>Manajer Tim</option><option>Peserta</option></select></label></div>';refreshType();
    } catch(err) { console.error(err); $("#registration-result").innerHTML=`<p class="form-message">Pendaftaran gagal: ${esc(err.message||"Periksa koneksi dan konfigurasi Supabase.")}</p>`; }
    button.disabled=false;button.textContent="Kirim Pendaftaran";
  });
});