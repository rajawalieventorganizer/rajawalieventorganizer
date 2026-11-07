(() => {
  const $ = (s, r=document) => r.querySelector(s);
  document.querySelectorAll("[data-year]").forEach(el => el.textContent = new Date().getFullYear());
  const toggle = $(".menu-toggle"), nav = $(".main-nav");
  if (toggle && nav) toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open"); toggle.setAttribute("aria-expanded", String(open));
  });
  // Menu event dipenuhi otomatis dari event yang berstatus Published.
  if (nav && window.db) {
    const dropdown = document.createElement("details");
    dropdown.className = "nav-dropdown";
    dropdown.innerHTML = '<summary>Event</summary><div class="nav-dropdown-menu"><span>Memuat event...</span></div>';
    const contactLink = nav.querySelector('a[href="kontak.html"]');
    nav.insertBefore(dropdown, contactLink || null);
    window.db.from("events").select("title,slug").eq("status","published").order("start_date",{ascending:true})
      .then(({data,error}) => {
        const box = dropdown.querySelector(".nav-dropdown-menu");
        if (error || !data || !data.length) { box.innerHTML = '<span>Belum ada event</span>'; return; }
        box.innerHTML = data.map(e => `<a href="event.html?slug=${encodeURIComponent(e.slug)}">${String(e.title).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}</a>`).join("");
      });
  }
  const apiReady = () => {
    if (!window.db) { alert("Supabase belum dikonfigurasi. Isi assets/js/supabase-config.js terlebih dahulu."); return false; }
    return true;
  };
  const slugify = value => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const money = value => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(value||0));
  const date = value => value ? new Date(value+"T00:00:00").toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"}) : "Belum ditentukan";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  window.Rajawali = { $, apiReady, slugify, money, date, esc };
})();
