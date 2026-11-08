
/* KONFIGURASI SUPABASE RAJAWALI */
window.SUPABASE_URL = "https://ajochnxdmgkmkygjsrua.supabase.co";

window.SUPABASE_ANON_KEY = "sb_publishable_WKQL74vHXpjFVkzTi6K9Tw_60ERGZ_D";

window.SUPABASE_READY = !!(
  window.supabase &&
  window.SUPABASE_URL.startsWith("https://") &&
  window.SUPABASE_ANON_KEY
);

window.db = window.SUPABASE_READY
  ? window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    )
  : null;
