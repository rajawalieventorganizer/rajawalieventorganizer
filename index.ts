import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(n:number){const bytes=crypto.getRandomValues(new Uint8Array(n));return [...bytes].map(b=>alphabet[b%alphabet.length]).join("");}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 const out=(v:any,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{...cors,"Content-Type":"application/json"}});
 try{
  const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db=createClient(url,key);
  const body=await req.json();const {event_id,registration_type,team_name,whatsapp,participants,custom_data}=body;
  if(!event_id||!whatsapp||!Array.isArray(participants)||participants.length<1||participants.length>50)return out({error:"Data pendaftaran belum lengkap atau jumlah anggota tidak valid."},400);
  if(!["individual","team"].includes(registration_type))return out({error:"Jenis pendaftaran tidak valid."},400);
  if(registration_type==="individual"&&participants.length!==1)return out({error:"Pendaftaran individu hanya untuk satu orang."},400);
  if(registration_type==="team"&&!String(team_name||"").trim())return out({error:"Nama tim wajib diisi."},400);
  for(const p of participants)if(!String(p.name||"").trim()||String(p.name).length>100)return out({error:"Nama peserta wajib diisi (maksimal 100 karakter)."},400);
  const {data:event,error:eventError}=await db.from("events").select("*").eq("id",event_id).eq("status","published").single();
  if(eventError||!event)return out({error:"Event tidak ditemukan atau pendaftaran belum dibuka."},404);
  const today=new Date().toISOString().slice(0,10);
  if(event.registration_deadline&&event.registration_deadline<today)return out({error:"Pendaftaran telah ditutup."},400);
  if(event.registration_type!=="both"&&event.registration_type!==registration_type)return out({error:"Jenis pendaftaran tidak tersedia untuk event ini."},400);
  const unitFee=event.fee_mode==="free"?0:Number(event.fee_amount||0);
  const fee=unitFee*(event.fee_basis==="participant"?participants.length:1);
  let suffix="000",token="",created=null;
  for(let attempt=0;attempt<8;attempt++){
    suffix=fee>0?String(100+crypto.getRandomValues(new Uint32Array(1))[0]%900):"000";
    token=`SMO-${randomCode(4)}-${suffix}`;
    const amount=fee>0?fee+Number(suffix):0;
    const {data,error}=await db.from("registrations").insert({
      event_id,token,registrant_name:String(participants[0].name).trim(),whatsapp:String(whatsapp).trim(),
      registration_type,team_name:String(team_name||"").trim(),custom_data:custom_data||{},
      payment_amount:amount,payment_suffix:suffix,payment_status:fee>0?"pending":"not_required",
      registration_status:event.approval_required?"pending":"approved"
    }).select("id,token,payment_amount").single();
    if(!error){created=data;break;}
    if(error.code!=="23505")throw error;
  }
  if(!created)throw new Error("Tidak berhasil membuat token unik. Silakan kirim ulang.");
  const rows=participants.map((p,i)=>({registration_id:created.id,event_id,participant_no:`${created.token}-${String(i+1).padStart(2,"0")}`,full_name:String(p.name).trim(),participant_role:String(p.role||"Peserta"),team_name:String(team_name||"").trim()}));
  const {error:peopleError}=await db.from("participants").insert(rows);
  if(peopleError){await db.from("registrations").delete().eq("id",created.id);throw peopleError;}
  return out({success:true,token:created.token,payment_amount:created.payment_amount,payment_status:fee>0?"pending":"not_required",participants:rows.length});
 }catch(e){return out({error:e.message||"Pendaftaran gagal diproses."},500);}
});