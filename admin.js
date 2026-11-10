
  function previewFor(f) {
    if (f.field_type === "radio" || f.field_type === "checkbox") {
      const opts = (f.options || []).filter(x => x.trim());

      return opts.slice(0, 4).map(o =>
        `<div class="gf-preview-choice">
          <span class="gf-preview-box ${f.field_type === "checkbox" ? "square" : ""}"></span>
          ${esc(o)}
        </div>`
      ).join("") || '<div class="gf-preview-choice">Opsi jawaban akan tampil di sini</div>';
    }

    if (f.field_type === "select") {
      return '<div class="gf-preview-choice">Pilih jawaban <span style="margin-left:auto">⌄</span></div>';
    }

    if (f.field_type === "textarea") {
      return '<div class="gf-preview-line" style="height:42px;border:1px solid #d6dce1;border-radius:5px;width:100%"></div>';
    }

    if (f.field_type === "photo_upload") {
      return `
        <div class="gf-preview-choice">
          <span>▧</span>
          Pilih atau unggah foto
        </div>
        <div class="gf-hint">Format JPG, JPEG, PNG, WebP</div>
      `;
    }

    if (f.field_type === "document_upload") {
      return `
        <div class="gf-preview-choice">
          <span>📄</span>
          Pilih atau unggah dokumen
        </div>
        <div class="gf-hint">Format PDF, DOC, DOCX, dan lainnya</div>
      `;
    }

    return '<div class="gf-preview-line"></div>';
  }
