document.addEventListener("DOMContentLoaded", () => {
  const { $, apiReady, slugify, esc, date, money } = window.Rajawali;
  const login=$("#login-section"), dashboard=$("#dashboard-section"), msg=$("#login-message"), eventList=$("#admin-event-list");
  let currentEvents=[], fieldRows=[];
  const show=(el,on)=>el.classList.toggle("hidden",!on);
  const statusTag=s=>`<span class="status-pill ${s}">${s}</span>`;
  function switchTab(id){document.querySelectorAll(".admin-panel").forEach(p=>show(p,p.id===id));document.querySelectorAll(".tab-btn").forEach(b=>b.classList.toggle("active",b.dataset.tab===id));}
  document.querySelectorAll(".tab-btn").forEach(b=>b.addEventListener("click",()=>{switchTab(b.dataset.tab);if(b.dataset.tab==="registrants-panel")loadRegistrants();}));
  $("#new-event-btn").addEventListener("click",()=>{resetEditor();switchTab("editor-panel");});
  $("#cancel-edit-btn").addEventListener("click",()=>{resetEditor();switchTab("events-panel");});
  $("#event-title").addEventListener("input",()=>{if(!$("#edit-event-id").value)$("#event-slug").value=slugify($("#event-title").value);});
  $("#add-field-btn").addEventListener("click",()=>addField());
  $("#logout-btn").addEventListener("click",async()=>{await db.auth.signOut();location.reload();});
  $("#login-form").addEventListener("submit",async e=>{e.preventDefault();if(!apiReady())return;msg.textContent="Memeriksa akun...";const {error}=await db.auth.signInWithPassword({email:$("#admin-email").value,password:$("#admin-password").value});if(error){msg.textContent=error.message;return;}await initialize();});
  async function initialize(){
    const {data:{user}}=await db.auth.getUser();if(!user){show(login,true);show(dashboard,false);return;}
    const {data:admin,error}=await db.from("organizer_admins").select("user_id").eq("user_id",user.id).maybeSingle();
    if(error||!admin){await db.auth.signOut();msg.textContent="Akun ini belum terdaftar sebagai admin Rajawali.";show(login,true);return;}
    show(login,false);show(dashboard,true);show($("#logout-btn"),true);await loadEvents();await loadSettings();
  }
  function todayJakarta(){
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    return `${parts.find(x=>x.type==="year")?.value}-${parts.find(x=>x.type==="month")?.value}-${parts.find(x=>x.type==="day")?.value}`;
  }
  function eventHasPassed(item){
    const finalDate=item?.end_date||item?.start_date;
    return !!finalDate && finalDate < todayJakarta();
  }
  async function getFunctionErrorMessage(error){
    let message=error?.message||"Fungsi penghapusan gagal.";
    try{
      const response=error?.context?.clone ? error.context.clone() : error?.context;
      if(response?.json){
        const body=await response.json();
        message=body?.error||body?.message||message;
      }
    }catch(_){ }
    return message;
  }
  async function loadEvents(){
    eventList.innerHTML='<div class="empty-state">Memuat event...</div>';
    const [{data,error},{count:regCount}]=await Promise.all([
      db.from("events").select("*").order("created_at",{ascending:false}),
      db.from("registrations").select("*",{count:"exact",head:true})
    ]);
    if(error){eventList.innerHTML=`<div class="empty-state">Gagal memuat: ${esc(error.message)}</div>`;return;}
    currentEvents=data||[];
    $("#stat-total").textContent=currentEvents.length;$("#stat-live").textContent=currentEvents.filter(x=>x.status==="published").length;$("#stat-draft").textContent=currentEvents.filter(x=>x.status==="draft").length;$("#stat-reg").textContent=regCount||0;
    if(!currentEvents.length){eventList.innerHTML='<div class="empty-state">Belum ada event. Tekan “Buat Event” untuk memulai.</div>';return;}
    eventList.innerHTML=currentEvents.map(e=>`<article class="admin-event-item"><div><h3>${esc(e.title)}</h3><p>${date(e.start_date)} · ${esc(e.venue||"Lokasi belum ditentukan")} · ${statusTag(e.status)}</p></div><div class="admin-actions"><button data-edit="${e.id}">Edit</button><a href="event.html?slug=${encodeURIComponent(e.slug)}" target="_blank">Lihat</a><button data-publish="${e.id}">${e.status==="published"?"Jadikan Draft":"Publikasikan"}</button>${eventHasPassed(e)?`<button class="danger" data-delete="${e.id}">Hapus</button>`:`<small>Hapus tersedia setelah event lewat</small>`}</div></article>`).join("");
  }
  eventList.addEventListener("click",async e=>{
    const edit=e.target.dataset.edit,pub=e.target.dataset.publish,del=e.target.dataset.delete;
    if(edit){const item=currentEvents.find(x=>x.id===edit);if(item)await editEvent(item);}
    if(pub){const item=currentEvents.find(x=>x.id===pub);if(!item)return;const next=item.status==="published"?"draft":"published";const {error}=await db.from("events").update({status:next}).eq("id",pub);if(error)alert(error.message);await loadEvents();}
    if(del){
      const item=currentEvents.find(x=>x.id===del);if(!item)return;
      if(!eventHasPassed(item)){alert("Event hanya dapat dihapus setelah tanggal event lewat.");return;}
      const yes=confirm(`Hapus event “${item.title}”? Seluruh pendaftaran, peserta, formulir, menu, dan file event yang tercatat akan ikut dihapus. Tindakan ini tidak dapat dibatalkan.`);if(!yes)return;
      const btn=e.target;btn.disabled=true;btn.textContent="Menghapus...";
      try{
        const {data,error}=await db.functions.invoke("delete-event",{body:{event_id:del}});
        if(error)throw new Error(await getFunctionErrorMessage(error));
        if(data?.error)throw new Error(data.error);
        if(!data?.success)throw new Error("Server belum mengonfirmasi penghapusan.");
        alert("Event dan seluruh data terkait berhasil dihapus.");
        await loadEvents();
      }catch(err){
        alert(`Penghapusan gagal: ${err?.message||"Terjadi kesalahan."}\n\nData event tidak dianggap terhapus.`);
        btn.disabled=false;btn.textContent="Hapus";
      }
    }
  });
  function addField(f={}){const id=crypto.randomUUID();fieldRows.push({id,...f});renderFields();}
  function renderFields(){const box=$("#field-builder");box.innerHTML=fieldRows.map((f,i)=>`<div class="field-row" data-row="${f.id}"><input class="f-label" value="${esc(f.label||"")}" placeholder="Nama kolom, mis. Asal Klub"><select class="f-type"><option value="text">Teks</option><option value="number">Angka</option><option value="date">Tanggal</option><option value="tel">Telepon</option><option value="email">Email</option><option value="select">Pilihan</option><option value="textarea">Paragraf</option></select><input class="f-options" value="${esc((f.options||[]).join(", "))}" placeholder="Opsi, pisahkan koma"><label><input type="checkbox" class="f-required" ${f.is_required?"checked":""}> Wajib</label><button type="button" class="remove-field" data-remove="${f.id}">×</button></div>`).join("");box.querySelectorAll(".field-row").forEach((row,i)=>{row.querySelector(".f-type").value=fieldRows[i].field_type||"text";});box.querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>{fieldRows=fieldRows.filter(f=>f.id!==b.dataset.remove);renderFields();}));}
  function readFields(){return [...$("#field-builder").querySelectorAll(".field-row")].map((row,i)=>{const label=row.querySelector(".f-label").value.trim();return {label,field_key:slugify(label).replace(/-/g,"_"),field_type:row.querySelector(".f-type").value,options:row.querySelector(".f-options").value.split(",").map(x=>x.trim()).filter(Boolean),is_required:row.querySelector(".f-required").checked,sort_order:i};}).filter(f=>f.label);}
  function resetEditor(){ $("#event-form").reset();$("#edit-event-id").value="";$("#editor-title").textContent="Buat Event Baru";fieldRows=[];renderFields();$("#event-fee").value=0;$("#fee-basis").value="registration"; }
  async function editEvent(e){resetEditor();$("#editor-title").textContent="Edit Event";$("#edit-event-id").value=e.id;$("#event-title").value=e.title;$("#event-slug").value=e.slug;$("#event-category").value=e.category||"Lainnya";$("#event-status").value=e.status;$("#event-start").value=e.start_date||"";$("#event-end").value=e.end_date||"";$("#event-deadline").value=e.registration_deadline||"";$("#event-venue").value=e.venue||"";$("#registration-type").value=e.registration_type;$("#fee-mode").value=e.fee_mode;$("#event-fee").value=e.fee_amount||0;$("#fee-basis").value=e.fee_basis||"registration";$("#bank-name").value=e.bank_name||"";$("#bank-number").value=e.bank_account_number||"";$("#bank-holder").value=e.bank_account_holder||"";$("#approval-required").checked=e.approval_required;$("#event-description-input").value=e.description||"";
    const {data}=await db.from("event_fields").select("*").eq("event_id",e.id).order("sort_order");fieldRows=(data||[]).map(f=>({...f}));renderFields();switchTab("editor-panel");}
  $("#event-form").addEventListener("submit",async e=>{
    e.preventDefault();const button=e.submitter;button.disabled=true;$("#save-message").textContent="Menyimpan...";
    const id=$("#edit-event-id").value,feeMode=$("#fee-mode").value,fee=feeMode==="free"?0:Number($("#event-fee").value||0);
    const slug=slugify($("#event-slug").value||$("#event-title").value);
    const payload={title:$("#event-title").value.trim(),slug,category:$("#event-category").value,status:$("#event-status").value,start_date:$("#event-start").value,end_date:$("#event-end").value||null,registration_deadline:$("#event-deadline").value||null,venue:$("#event-venue").value,registration_type:$("#registration-type").value,fee_mode:feeMode,fee_amount:fee,fee_basis:$("#fee-basis").value,bank_name:$("#bank-name").value,bank_account_number:$("#bank-number").value,bank_account_holder:$("#bank-holder").value,approval_required:$("#approval-required").checked,description:$("#event-description-input").value};
    try{
      let saved;
      if(id){const {data,error}=await db.from("events").update(payload).eq("id",id).select("id").single();if(error)throw error;saved=data;}
      else{const {data,error}=await db.from("events").insert(payload).select("id").single();if(error)throw error;saved=data;}
      const image=$("#event-cover").files[0];
      if(image){const path=`${saved.id}/${Date.now()}-${image.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;const {error:upErr}=await db.storage.from("event-assets").upload(path,image,{upsert:false});if(upErr)throw upErr;const {data:urlData}=db.storage.from("event-assets").getPublicUrl(path);const {error:assetErr}=await db.from("event_assets").insert({event_id:saved.id,bucket_name:"event-assets",object_path:path});if(assetErr)throw assetErr;const {error:updateErr}=await db.from("events").update({cover_url:urlData.publicUrl}).eq("id",saved.id);if(updateErr)throw updateErr;}
      const fields=readFields();const {error:delErr}=await db.from("event_fields").delete().eq("event_id",saved.id);if(delErr)throw delErr;
      if(fields.length){const {error:fieldErr}=await db.from("event_fields").insert(fields.map(f=>({...f,event_id:saved.id})));if(fieldErr)throw fieldErr;}
      $("#save-message").textContent="Event berhasil disimpan.";resetEditor();switchTab("events-panel");await loadEvents();
    }catch(err){console.error(err);$("#save-message").textContent=`Gagal: ${err.message||"Periksa data."}`;}
    button.disabled=false;
  });
  async function loadRegistrants(){const box=$("#registrant-list");box.textContent="Memuat data...";const {data,error}=await db.from("registrations").select("id,event_id,token,registrant_name,registration_type,team_name,payment_amount,payment_status,registration_status,created_at,events(title)").order("created_at",{ascending:false}).limit(300);if(error){box.textContent=error.message;return;}window._registrations=data||[];renderRegistrants();}
  function renderRegistrants(){const q=($("#registrant-search").value||"").toLowerCase(),rows=(window._registrations||[]).filter(r=>[r.token,r.registrant_name,r.team_name].join(" ").toLowerCase().includes(q));if(!rows.length){$("#registrant-list").innerHTML='<div class="empty-state">Belum ada pendaftar.</div>';return;}$("#registrant-list").innerHTML=`<table class="data-table"><thead><tr><th>Event / Nama</th><th>Token</th><th>Biaya</th><th>Pembayaran</th><th>Pendaftaran</th><th>Aksi</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.events?.title||"Event")}</b><br>${esc(r.registrant_name||r.team_name||"Peserta")}</td><td>${esc(r.token)}</td><td>${money(r.payment_amount)}</td><td>${statusTag(r.payment_status)}</td><td>${statusTag(r.registration_status)}</td><td>${r.payment_status==="pending"?`<button data-verify="${r.id}" class="btn btn-small btn-primary">Verifikasi Bayar</button>`:""} ${r.registration_status==="pending" && (r.payment_status==="verified" || r.payment_status==="not_required")?`<button data-approve="${r.id}" class="btn btn-small btn-primary">Setujui</button>`:""} ${(r.registration_status!=="rejected" && r.registration_status!=="approved")?`<button data-reject="${r.id}" class="btn btn-small btn-ghost">Tolak</button>`:""}</td></tr>`).join("")}</tbody></table>`;}
  $("#registrant-search").addEventListener("input",renderRegistrants);
  $("#registrant-list").addEventListener("click",async e=>{
    const verify=e.target.dataset.verify,approve=e.target.dataset.approve,reject=e.target.dataset.reject,id=verify||approve||reject;if(!id)return;
    const row=(window._registrations||[]).find(r=>r.id===id);if(!row)return;
    let update={};
    if(verify){if(!confirm("Konfirmasi pembayaran peserta ini sudah diterima di rekening?"))return;update={payment_status:"verified",payment_verified_at:new Date().toISOString(),payment_verified_by:(await db.auth.getUser()).data.user.id};}
    if(approve){if(row.payment_status!=="verified"&&row.payment_status!=="not_required"){alert("Verifikasi pembayaran terlebih dahulu.");return;}if(!confirm("Setujui pendaftaran peserta ini?"))return;update={registration_status:"approved"};}
    if(reject){if(!confirm("Tolak pendaftaran ini? Status akan ditandai ditolak."))return;update={registration_status:"rejected",...(row.payment_status==="pending"?{payment_status:"rejected"}:{})};}
    const {error}=await db.from("registrations").update(update).eq("id",id);if(error)alert(error.message);await loadRegistrants();
  });
  async function loadSettings(){const {data}=await db.from("site_settings").select("*").eq("id",1).maybeSingle();if(!data)return;$("#setting-email").value=data.contact_email||"";$("#setting-phone").value=data.contact_phone||"";$("#setting-address").value=data.contact_address||"";$("#setting-social").value=data.social_url||"";}
  $("#settings-form").addEventListener("submit",async e=>{e.preventDefault();const {error}=await db.from("site_settings").upsert({id:1,contact_email:$("#setting-email").value,contact_phone:$("#setting-phone").value,contact_address:$("#setting-address").value,social_url:$("#setting-social").value});$("#settings-message").textContent=error?error.message:"Identitas berhasil disimpan.";});
  if(!window.db){show(login,true);msg.textContent="Isi URL dan anon key Supabase pada assets/js/supabase-config.js terlebih dahulu.";return;}
  initialize();
});