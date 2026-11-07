/* KONFIGURASI SUPABASE
   Isi URL dan anon/public key dari Project Settings > API.
   Jangan pernah menaruh service_role key di file website ini. */
window.SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
window.SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_PUBLIC_KEY";
window.SUPABASE_READY = !!(window.supabase && window.SUPABASE_URL.startsWith("https://") &&
  !window.SUPABASE_URL.includes("YOUR-PROJECT") && window.SUPABASE_ANON_KEY &&
  !window.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE"));
window.db = window.SUPABASE_READY ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null;
