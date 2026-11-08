import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function todayJakarta() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;
}

function publishableKey() {
  // Prefer the current Supabase publishable-key dictionary.
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    try {
      const keys = JSON.parse(raw);
      if (keys?.default) return keys.default as string;
    } catch {
      throw new Error("SUPABASE_PUBLISHABLE_KEYS tidak dapat dibaca.");
    }
  }
  return Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
}

Deno.serve(async (req) => {
  const respond = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return respond({ error: "Metode tidak diizinkan." }, 405);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const key = publishableKey();
    const authorization = req.headers.get("Authorization");

    if (!url || !key) {
      return respond({ error: "Konfigurasi Supabase URL atau publishable key tidak tersedia pada Edge Function." }, 500);
    }
    if (!authorization) {
      return respond({ error: "Sesi login Admin tidak ditemukan. Silakan login kembali." }, 401);
    }

    // Gunakan sesi Admin sendiri. RLS Supabase menjadi lapisan otorisasi
    // untuk tabel events, event_assets, dan bucket event-assets.
    // Tidak memerlukan service_role key di dalam fungsi ini.
    const db = createClient(url, key, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: authError } = await db.auth.getUser();
    const user = userData?.user;
    if (authError || !user) {
      return respond({ error: "Sesi login tidak valid. Silakan login kembali." }, 401);
    }

    const { data: isAdmin, error: adminError } = await db.rpc("is_organizer_admin");
    if (adminError) {
      return respond({ error: `Pemeriksaan hak Admin gagal: ${adminError.message}` }, 500);
    }
    if (!isAdmin) {
      return respond({ error: "Akun ini tidak terdaftar sebagai Admin Rajawali." }, 403);
    }

    let body: { event_id?: unknown };
    try {
      body = await req.json();
    } catch {
      return respond({ error: "Isi permintaan tidak valid." }, 400);
    }
    const eventId = body?.event_id;
    if (typeof eventId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)) {
      return respond({ error: "ID event tidak valid." }, 400);
    }

    const { data: event, error: eventError } = await db
      .from("events")
      .select("id,title,start_date,end_date")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) {
      return respond({ error: `Gagal membaca event: ${eventError.message}` }, 500);
    }
    if (!event) {
      return respond({ error: "Event tidak ditemukan pada tabel events. Tidak ada data yang dihapus." }, 404);
    }

    const finalDate = event.end_date || event.start_date;
    if (!finalDate || finalDate >= todayJakarta()) {
      return respond({ error: "Event belum lewat. Penghapusan ditolak." }, 403);
    }

    const { data: assets, error: assetsError } = await db
      .from("event_assets")
      .select("bucket_name,object_path")
      .eq("event_id", eventId);

    if (assetsError) {
      return respond({ error: `Gagal membaca daftar file event: ${assetsError.message}` }, 500);
    }

    const grouped = new Map<string, string[]>();
    for (const asset of assets || []) {
      if (!grouped.has(asset.bucket_name)) grouped.set(asset.bucket_name, []);
      grouped.get(asset.bucket_name)!.push(asset.object_path);
    }

    // Hapus file yang tercatat sebelum menghapus record event.
    for (const [bucket, paths] of grouped) {
      const { error } = await db.storage.from(bucket).remove(paths);
      if (error) {
        return respond({ error: `Gagal menghapus file dari Storage (${bucket}): ${error.message}. Data event belum dihapus.` }, 500);
      }
    }

    const { data: deleted, error: deleteError } = await db
      .from("events")
      .delete()
      .eq("id", eventId)
      .select("id");

    if (deleteError) {
      return respond({ error: `Gagal menghapus event: ${deleteError.message}` }, 500);
    }
    if (!deleted || deleted.length === 0) {
      return respond({ error: "Tidak ada baris event yang terhapus. Periksa izin RLS Admin." }, 403);
    }

    return respond({
      success: true,
      event_id: eventId,
      message: `Event “${event.title}” dan data terkait berhasil dihapus.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan pada server.";
    console.error("delete-event error:", message);
    return respond({ error: message }, 500);
  }
});
