document.addEventListener("DOMContentLoaded", async () => {
  const { $, apiReady, esc, date, money } = window.Rajawali;
  const list = $("#event-list"), search = $("#event-search");
  if (!window.db) { list.innerHTML = '<div class="empty-state">Website siap digunakan. Admin perlu mengisi konfigurasi Supabase terlebih dahulu agar daftar event tampil.</div>'; return; }
  let events = [];
  async function load() {
    list.innerHTML = '<div class="empty-state">Memuat daftar event...</div>';
    const { data, error } = await db.from("events").select("id,title,slug,category,summary,description,venue,start_date,end_date,fee_mode,fee_amount,cover_url,status").eq("status","published").order("start_date",{ascending:true});
    if (error) { list.innerHTML = '<div class="empty-state">Daftar event belum dapat dimuat. Periksa tabel dan kebijakan Supabase.</div>'; console.error(error); return; }
    events = data || []; render();
  }
  function render() {
    const q = (search?.value || "").toLowerCase().trim();
    const filtered = events.filter(e => [e.title,e.category,e.venue,e.summary].join(" ").toLowerCase().includes(q));
    if (!filtered.length) { list.innerHTML = '<div class="empty-state">Belum ada event yang tersedia untuk pencarian ini.</div>'; return; }
    list.innerHTML = filtered.map(e => `<article class="event-card"><div class="event-cover">${e.cover_url ? `<img src="${esc(e.cover_url)}" alt="${esc(e.title)}">` : `<img class="cover-mark" src="logo-rajawali.jpg" alt="">`}</div><div class="event-card-body"><span class="tag">${esc(e.category || "Event")}</span><h3>${esc(e.title)}</h3><div class="event-meta"><span>▦ ${date(e.start_date)}</span><span>⌖ ${esc(e.venue || "Lokasi menyusul")}</span></div><p>${esc(e.summary || e.description || "Informasi lengkap tersedia pada halaman event.")}</p><b class="card-link">${e.fee_mode === "free" ? "GRATIS" : money(e.fee_amount)} · Lihat detail →</b><a class="card-link" href="event.html?slug=${encodeURIComponent(e.slug)}" aria-label="Lihat ${esc(e.title)}">Buka halaman event ↗</a></div></article>`).join("");
  }
  search?.addEventListener("input", render);
  await load();
});