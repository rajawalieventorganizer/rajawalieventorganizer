document.addEventListener("DOMContentLoaded", () => {
  const { $, esc, money } = window.Rajawali, form=$("#status-form"), result=$("#status-result");
  form.addEventListener("submit", async e => {
    e.preventDefault(); if(!window.db){result.innerHTML='<p class="form-message">Supabase belum dikonfigurasi.</p>';return;}
    const token=$("#token").value.trim().toUpperCase();if(!token)return;
    result.innerHTML='<p>Memeriksa token...</p>';
    const {data,error}=await db.functions.invoke("check-status",{body:{token}});
    if(error||!data||data.error){result.innerHTML='<p class="form-message">Token tidak ditemukan atau layanan belum siap. Periksa kembali token.</p>';return;}
    const people=data.participants||[];
    result.innerHTML=`<div class="status-result"><b>${esc(data.event_title)}</b><p>Token:</p><div class="token-text">${esc(data.token)}</div><p>Status pendaftaran: <b>${esc(data.registration_status)}</b></p><p>Status pembayaran: <b>${esc(data.payment_status)}</b></p><p>Tagihan: <b>${money(data.payment_amount)}</b></p><p>Jumlah peserta: <b>${people.length}</b></p><p>${data.can_print_card?"Pendaftaran telah disetujui dan pembayaran telah terverifikasi. Kartu individu sudah dapat diunduh.":"Kartu peserta belum dapat diterbitkan. Tunggu verifikasi pembayaran dan/atau persetujuan panitia."}</p>${data.can_print_card?'<button id="download-cards" class="btn btn-primary full">Unduh Kartu Peserta PDF</button>':""}</div>`;
    if(data.can_print_card) $("#download-cards").addEventListener("click",()=>downloadCards(data));
  });
  async function imageData(url){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext("2d").drawImage(img,0,0);resolve(c.toDataURL("image/jpeg",.9));};img.onerror=reject;img.src=url;});}
  async function downloadCards(data){
    const btn=$("#download-cards");btn.disabled=true;btn.textContent="Menyiapkan kartu...";
    try{
      const {jsPDF}=window.jspdf;const pdf=new jsPDF({orientation:"portrait",unit:"mm",format:[105,148]});
      let logo=null;try{logo=await imageData("logo-rajawali.jpg");}catch(_){}
      for(let i=0;i<data.participants.length;i++){
        if(i>0)pdf.addPage([105,148],"portrait");
        const p=data.participants[i];
        pdf.setFillColor(10,28,65);pdf.rect(0,0,105,42,"F");
        pdf.setFillColor(224,30,37);pdf.rect(0,39,105,3,"F");
        if(logo)pdf.addImage(logo,"JPEG",7,6,28,19);
        pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(12);pdf.text("RAJAWALI EVENT ORGANIZER",40,15);
        pdf.setFont("helvetica","normal");pdf.setFontSize(7);pdf.text("SPORT AND MUSIC EVENT",40,21);
        pdf.setFontSize(8);pdf.text("KARTU PESERTA",40,31);
        pdf.setTextColor(11,30,70);pdf.setFont("helvetica","bold");pdf.setFontSize(9);pdf.text(String(data.event_title||"EVENT").toUpperCase().slice(0,42),7,52);
        pdf.setFontSize(7);pdf.setTextColor(112,124,145);pdf.text("NAMA PESERTA",7,66);
        pdf.setFontSize(15);pdf.setTextColor(11,30,70);pdf.text(String(p.full_name||"").slice(0,34),7,74);
        pdf.setFontSize(8);pdf.setTextColor(80,92,112);pdf.text("PERAN",7,85);
        pdf.setFont("helvetica","bold");pdf.setTextColor(190,30,38);pdf.setFontSize(11);pdf.text(String(p.participant_role||"Peserta").toUpperCase(),7,92);
        pdf.setFont("helvetica","normal");pdf.setFontSize(8);pdf.setTextColor(80,92,112);pdf.text("TIM / KLUB",7,103);
        pdf.setTextColor(11,30,70);pdf.setFontSize(9);pdf.text(String(p.team_name||"Individu").slice(0,36),7,110);
        pdf.setFontSize(7);pdf.setTextColor(112,124,145);pdf.text("NOMOR PESERTA",7,124);
        pdf.setFont("helvetica","bold");pdf.setFontSize(10);pdf.setTextColor(11,30,70);pdf.text(String(p.participant_no),7,131);
        const qr=await QRCode.toDataURL(String(p.participant_no),{width:240,margin:1});
        pdf.addImage(qr,"PNG",70,75,27,27);
        pdf.setDrawColor(220,226,236);pdf.line(7,137,98,137);
        pdf.setFont("helvetica","normal");pdf.setFontSize(6);pdf.setTextColor(125,135,151);pdf.text(`TOKEN PENDAFTARAN: ${data.token}`,7,143);
      }
      pdf.save(`kartu-rajawali-${data.token}.pdf`);
    }catch(err){console.error(err);alert("Kartu PDF gagal dibuat. Pastikan koneksi internet tersedia untuk memuat pustaka QR/PDF.");}
    btn.disabled=false;btn.textContent="Unduh Kartu Peserta PDF";
  }
});