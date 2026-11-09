(() => {
  const $ = (s, r=document) => r.querySelector(s);
  document.querySelectorAll("[data-year]").forEach(el => el.textContent = new Date().getFullYear());
  const toggle = $(".menu-toggle"), nav = $(".main-nav");
  if (toggle && nav) toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open"); toggle.setAttribute("aria-expanded", String(open));
  });

  // Menu event otomatis dari event yang berstatus Published.
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
    if (!window.db) { alert("Supabase belum dikonfigurasi. Periksa supabase-config.js."); return false; }
    return true;
  };
  const slugify = value => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const money = value => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(value||0));
  const date = value => value ? new Date(value+"T00:00:00").toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"}) : "Belum ditentukan";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  window.Rajawali = { $, apiReady, slugify, money, date, esc };

  // Pengaturan publik: isi konten website dari site_settings Supabase.
  async function applyPublicSettings() {
    if (!window.db) return;
    const {data, error} = await window.db.from("site_settings").select("*").eq("id",1).maybeSingle();
    if (error || !data) return;
    const setText = (selector, value) => {
      if (!value) return;
      document.querySelectorAll(selector).forEach(el => el.textContent = value);
    };
    const setImage = (selector, value) => {
      if (!value) return;
      document.querySelectorAll(selector).forEach(el => { el.src = value; });
    };
    setText(".brand b", data.organization_name);
    setText(".footer-brand b", data.organization_name);
    setText(".brand small", data.tagline);
    setText(".footer-brand small", data.tagline);
    setText(".hero-copy .eyebrow", data.tagline ? `${data.organization_name || "RAJAWALI EVENT ORGANIZER"} · ${data.tagline}` : "");
    setText(".hero-copy h1", data.hero_title);
    setText(".hero-copy > p", data.hero_description);
    setText(".contact-side h3", data.tagline);
    setImage(".brand img,.footer-brand img,.hero-logo-card img,.contact-side img", data.logo_url);
    const email = document.getElementById("contact-email");
    const phone = document.getElementById("contact-phone");
    const address = document.getElementById("contact-address");
    if (email && data.contact_email) email.textContent = data.contact_email;
    if (phone && (data.contact_whatsapp || data.contact_phone)) phone.textContent = data.contact_whatsapp || data.contact_phone;
    if (address && data.contact_address) address.textContent = data.contact_address;

    const footer = document.querySelector(".site-footer .footer-inner > small");
    if (footer && data.footer_text) footer.textContent = `© ${new Date().getFullYear()} ${data.footer_text}`;
    const contactCard = document.querySelector(".contact-card");
    if (contactCard) {
      let links = document.getElementById("organization-links");
      if (!links) {
        links = document.createElement("div");
        links.id = "organization-links";
        links.className = "contact-line";
        contactCard.appendChild(links);
      }
      const items = [];
      if (data.maps_url) items.push(`<a target="_blank" rel="noopener" href="${esc(data.maps_url)}">Buka lokasi di Google Maps</a>`);
      if (data.instagram_url) items.push(`<a target="_blank" rel="noopener" href="${esc(data.instagram_url)}">Instagram</a>`);
      if (data.facebook_url) items.push(`<a target="_blank" rel="noopener" href="${esc(data.facebook_url)}">Facebook</a>`);
      if (data.youtube_url) items.push(`<a target="_blank" rel="noopener" href="${esc(data.youtube_url)}">YouTube</a>`);
      if (data.tiktok_url) items.push(`<a target="_blank" rel="noopener" href="${esc(data.tiktok_url)}">TikTok</a>`);
      links.innerHTML = items.join(" · ");
    }
  }
  document.addEventListener("DOMContentLoaded", applyPublicSettings);
  if (document.readyState !== "loading") applyPublicSettings();

  // Muat modul tambahan pengaturan admin tanpa mengubah modul event yang sudah ada.
  if (document.body.classList.contains("admin-body")) {
    const script = document.createElement("script");
    script.src = "admin-settings-extra.js";
    script.defer = true;
    document.head.appendChild(script);
  }
})();