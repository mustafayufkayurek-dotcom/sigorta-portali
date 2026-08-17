/** Resmi Mutabakat / Muvafakat Onay Formu — docs/features/Mutabakat-Muvafakat-Anket-Formu.xlsx */
export const MUVAFAKATNAME_TEMPLATE = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Mutabakat / Muvafakat — {{dosya_no}}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #111827; margin: 0; padding: 0; background: #fff; line-height: 1.45; }
    .page { padding: 28px 32px; max-width: 820px; margin: 0 auto; }
    .doc-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 2px solid #1a4080; padding-bottom: 14px; margin-bottom: 18px; }
    .doc-header-logo img { height: 52px; width: auto; display: block; }
    .doc-header-meta { text-align: right; font-size: 10px; color: #64748b; line-height: 1.5; }
    .doc-header-meta strong { display: block; font-size: 12px; color: #1a4080; margin-bottom: 2px; }
    h1 { text-align: center; font-size: 15px; font-weight: 700; letter-spacing: 0.02em; margin: 0 0 18px; color: #1a4080; }
    .meta-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 14px; font-size: 11px; }
    .field { border-bottom: 1px solid #374151; padding-bottom: 2px; min-height: 18px; }
    .field-label { color: #4b5563; font-size: 10px; margin-bottom: 2px; }
    .field-value { font-weight: 600; color: #111827; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
    .section-title { font-size: 11px; font-weight: 700; color: #1a4080; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px; }
    .section-sub { font-size: 9px; color: #64748b; font-weight: 400; }
    .party-block { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; background: #f8fafc; }
    .party-row { margin-bottom: 8px; }
    .party-row:last-child { margin-bottom: 0; }
    .legal { margin: 18px 0; text-align: justify; font-size: 10.5px; color: #1f2937; }
    .legal p { margin: 0 0 10px; }
    .legal-title { font-weight: 700; text-align: center; margin: 16px 0 10px; font-size: 11px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
    .sig-col h4 { font-size: 10px; font-weight: 700; margin: 0 0 8px; color: #374151; }
    .sig-line { border-top: 1px solid #9ca3af; margin-top: 48px; padding-top: 4px; font-size: 10px; color: #6b7280; }
    .amount-box { margin: 14px 0; font-size: 11px; }
    .contact { margin-top: 16px; font-size: 10px; color: #374151; line-height: 1.6; }
    .footnote { margin-top: 14px; font-size: 10px; font-weight: 600; text-align: center; color: #475569; }
    .footer { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 9px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
<div class="page">
  <div class="doc-header">
    <div class="doc-header-logo">
      <img src="{{logo_url}}" alt="Meridyen Assistance" />
    </div>
    <div class="doc-header-meta">
      <strong>{{sirket_ad}}</strong>
      {{sirket_adres}}
    </div>
  </div>

  <h1>Mutabakat / Muvafakat Onay Formu</h1>

  <div class="meta-row">
    <div>
      <div class="field-label">Tanzim Tarihi</div>
      <div class="field field-value">{{tarih}}</div>
    </div>
    <div>
      <div class="field-label">Dosya Numarası</div>
      <div class="field field-value">{{dosya_no}}</div>
    </div>
    <div>
      <div class="field-label">Sigorta Şirketi</div>
      <div class="field field-value">{{sigorta_sirketi}}</div>
    </div>
    <div>
      <div class="field-label">Hasar Nedeni</div>
      <div class="field field-value">{{hasar_nedeni}}</div>
    </div>
  </div>

  <div class="two-col">
    <div class="party-block">
      <div class="section-title">Sigortalı Bilgiler</div>
      <div class="party-row"><span class="field-label">Ad Soyad</span><div class="field field-value">{{sigortali_ad}}</div></div>
      <div class="party-row"><span class="field-label">T.C. Kimlik No</span><div class="field field-value">{{sigortali_tc}}</div></div>
      <div class="party-row"><span class="field-label">Tazminat Bedeli</span><div class="field field-value">{{sigortali_tazminat_bedeli}}</div></div>
      <div class="party-row"><span class="field-label">Adres</span><div class="field field-value">{{sigortali_adres}}</div></div>
    </div>
    <div class="party-block">
      <div class="section-title">Mali Mesuliyet Mağdur Bilgiler <span class="section-sub">(Mağduriyet Var İse Doldurunuz)</span></div>
      <div class="party-row"><span class="field-label">Ad Soyad</span><div class="field field-value">{{magdur_ad}}</div></div>
      <div class="party-row"><span class="field-label">T.C. Kimlik No</span><div class="field field-value">{{magdur_tc}}</div></div>
      <div class="party-row"><span class="field-label">Mağdurun Konumu</span><div class="field field-value">{{magdur_konum}}</div></div>
      <div class="party-row"><span class="field-label">Adres</span><div class="field field-value">{{magdur_adres}}</div></div>
    </div>
  </div>

  <div class="legal-title">İbraname ve Onarım Tutanağı</div>
  <div class="legal">
    <p>
      Mutabakat ve onayımız dahilinde; hasarımın <strong>{{servis_veren}}</strong> onarım firması tarafından giderilmesi
      kararlaştırılmış olup, onarım işlemleri sonunda <strong>{{onarim_bitis_tarihi}}</strong> tarihli hasar sebebi ile
      sigorta şirketinden (3. şahıs mali mesuliyet zararı olması halinde hasara sebep olan sigortalıdan) başkaca hiçbir
      hak ve alacağımızın kalmayacağını, tazminat alacağımızı devir ve temlik ettiğimizi, temlik sonucu hasar
      tazminatının sigorta şirketi tarafından onarımı yapan <strong>{{servis_veren}}</strong> firmasına ödenmesine
      muvafakat ettiğimizi kabul ve beyan ederiz.
    </p>
    <p>
      Tazminat tutarının sigorta şirketi tarafından tarafıma/tarafımıza ödemesi durumunda, söz konusu ödemeden itibaren
      en geç 3 (üç) gün içinde hasar tutarını <strong>{{servis_veren}}</strong> firmasına defaten ödeyeceğimi/ödeyeceğimizi;
      tazminat kapsamı dışında kalan onarım bedellerinin tarafımdan/tarafımızdan ödeneceğini kabul ve taahhüt ederim/ederiz.
    </p>
  </div>

  <div class="signatures">
    <div class="sig-col">
      <h4>Mağdur (3. Şahıs Mali Mesuliyet)</h4>
      <div class="sig-line">Ad Soyad · İmza</div>
    </div>
    <div class="sig-col">
      <h4>Sigortalı</h4>
      <div class="sig-line">Ad Soyad · İmza</div>
    </div>
  </div>

  <div class="amount-box">
    <strong>Tazminat Bedeli:</strong> {{tazminat_bedeli_toplam}} TL + KDV
  </div>

  <div class="contact">
    <div><strong>Servis Veren:</strong> {{servis_veren}}</div>
    <div><strong>Adres:</strong> {{servis_veren_adres}}</div>
    <div><strong>Müşteri Hizmetleri:</strong> {{musteri_hizmetleri}}</div>
    <div><strong>Gsm ve Whatsapp Hattı:</strong> {{whatsapp_hatti}}</div>
  </div>

  <div class="footnote">İşbu Belge; Onarımın Bitmesine Müteakip Geçerli Olacaktır.</div>

  <div class="footer">
    Bu belge {{servis_veren}} / Meridyen Assistance sistemi tarafından dosya {{dosya_no}} için oluşturulmuştur.
  </div>
</div>
</body>
</html>`;
