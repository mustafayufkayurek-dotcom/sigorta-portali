/** Sözleşme şablonları — Ayarlar > Kurulum > Genel Bilgiler alanlarından doldurulur */

export interface AgreementTemplateVars {
  sirket_adi: string;
  sirket_adres: string;
  sirket_telefon: string;
  sirket_email: string;
  sirket_vergi_no: string;
  sirket_ticaret_sicil: string;
  sirket_web: string;
  kvkk_email: string;
  uygulama_url: string;
  bordro_isveren_adi: string;
  bordro_isveren_adres: string;
  bordro_isveren_vergi_no: string;
  bordro_isveren_ticaret_sicil: string;
}

export const AGREEMENT_PLACEHOLDER_HINTS: { key: keyof AgreementTemplateVars; label: string }[] = [
  { key: 'sirket_adi', label: 'Şirket adı' },
  { key: 'sirket_adres', label: 'Adres' },
  { key: 'sirket_telefon', label: 'Telefon' },
  { key: 'sirket_email', label: 'E-posta' },
  { key: 'sirket_vergi_no', label: 'Vergi no' },
  { key: 'sirket_ticaret_sicil', label: 'Ticaret sicil no' },
  { key: 'sirket_web', label: 'Web sitesi' },
  { key: 'kvkk_email', label: 'KVKK iletişim e-postası' },
  { key: 'uygulama_url', label: 'Uygulama adresi' },
  { key: 'bordro_isveren_adi', label: 'Bordro işvereni adı' },
  { key: 'bordro_isveren_adres', label: 'Bordro işvereni adresi' },
  { key: 'bordro_isveren_vergi_no', label: 'Bordro işvereni vergi no' },
  { key: 'bordro_isveren_ticaret_sicil', label: 'Bordro işvereni ticaret sicil no' },
];

export function renderAgreementTemplate(template: string, vars: Partial<AgreementTemplateVars>): string {
  let out = template;

  // Koşullu blok: bordro işvereni tanımlı değilse ilgili bölümü kaldır
  const hasPayrollEmployer = Boolean(vars.bordro_isveren_adi?.trim());
  out = out.replace(/\{\{#bordro_isveren\}\}([\s\S]*?)\{\{\/bordro_isveren\}\}/g, (_m, inner) =>
    hasPayrollEmployer ? inner : '',
  );

  for (const { key } of AGREEMENT_PLACEHOLDER_HINTS) {
    const value = (vars[key] ?? '').trim();
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '—');
  }

  return out;
}

export const KVKK_DEFAULT_CONTENT = `<h2>KİŞİSEL VERİLERİN KORUNMASI KANUNU KAPSAMINDA AYDINLATMA METNİ</h2>

<p>Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu sıfatıyla hareket eden <strong>{{sirket_adi}}</strong> tarafından hazırlanmıştır.</p>

<h3>1. Veri Sorumlusunun Kimliği</h3>
<p><strong>Veri Sorumlusu:</strong> {{sirket_adi}}<br/>
<strong>Adres:</strong> {{sirket_adres}}<br/>
<strong>Telefon:</strong> {{sirket_telefon}}<br/>
<strong>E-posta:</strong> <a href="mailto:{{kvkk_email}}">{{kvkk_email}}</a><br/>
<strong>Web:</strong> <a href="{{sirket_web}}">{{sirket_web}}</a><br/>
<strong>Vergi No:</strong> {{sirket_vergi_no}}<br/>
<strong>Ticaret Sicil No:</strong> {{sirket_ticaret_sicil}}</p>

{{#bordro_isveren}}
<h3>1.1. Bordro İşvereni Bilgilendirmesi</h3>
<p>Belirsiz süreli iş sözleşmem <strong>{{bordro_isveren_adi}}</strong> nezdinde yürürlüktedir. Hasar dosyası ve operasyon süreçleri {{sirket_adi}} tarafından yönetilmekte olup, operasyonel talimatlar görev tanımım çerçevesinde {{sirket_adi}} tarafından verilebilir.</p>
<p><strong>Bordro işvereni:</strong> {{bordro_isveren_adi}} — Vergi No: {{bordro_isveren_vergi_no}} — Ticaret Sicil: {{bordro_isveren_ticaret_sicil}} — Adres: {{bordro_isveren_adres}}</p>
<p>İş hukukundan doğan hak ve yükümlülükler bakımından asıl işverenim {{bordro_isveren_adi}} olup; bu sistem kapsamında işlenen kişisel veriler bakımından {{sirket_adi}} ayrıca veri sorumlusu sıfatıyla hareket edebilir. İş hukuku kaynaklı başvurularımı {{bordro_isveren_adi}}'na; kişisel veri haklarıma ilişkin başvurularımı {{kvkk_email}} adresine yönelteceğimi bildiğimi beyan ederim.</p>
{{/bordro_isveren}}

<h3>2. İşlenen Kişisel Veriler</h3>
<p>{{uygulama_url}} sistemine giriş ve kullanım süreçlerinde aşağıdaki kişisel verileriniz işlenmektedir:</p>
<ul>
  <li>Ad, soyad, e-posta adresi, telefon numarası (kimlik ve iletişim bilgileri)</li>
  <li>Kullanıcı adı ve şifre bilgileri (güvenlik bilgileri)</li>
  <li>IP adresi, tarayıcı bilgisi, giriş tarihi/saati (log kayıtları)</li>
  <li>Görev kapsamında girilen hasar dosyası ve ilgili belgeler (mesleki bilgiler)</li>
</ul>

<h3>3. Kişisel Verilerin İşlenme Amaçları</h3>
<p>Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:</p>
<ul>
  <li>Sistemin kullanımı ve yönetimi</li>
  <li>Kullanıcı kimliğinin doğrulanması ve güvenliğin sağlanması</li>
  <li>Hasar dosyalarının takibi ve yönetimi</li>
  <li>Yasal yükümlülüklerin yerine getirilmesi</li>
  <li>Yetkili kişi, kurum ve kuruluşlara bilgi verilmesi</li>
</ul>

<h3>4. Kişisel Verilerin Aktarılması</h3>
<p>Kişisel verileriniz; yasal zorunluluklar dahilinde yetkili kamu kurumları ve yargı mercileriyle, iş süreçlerimizin yürütülmesi amacıyla hizmet aldığımız iş ortaklarımızla KVKK'nın 8. maddesi kapsamında paylaşılabilir.</p>

<h3>5. Kişisel Veri Toplamanın Yöntemi ve Hukuki Sebebi</h3>
<p>Kişisel verileriniz; sistem kayıt formu, oturum açma ekranı ve sistem kullanımı sırasında elektronik ortamda toplanmaktadır. Hukuki dayanak; KVKK'nın 5/2-c maddesi (sözleşmenin ifası), 5/2-ç maddesi (hukuki yükümlülük) ve 5/2-f maddesi (meşru menfaat) kapsamındadır.</p>

<h3>6. Kişisel Veri Sahibinin Hakları</h3>
<p>KVKK'nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:</p>
<ul>
  <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
  <li>Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme</li>
  <li>Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme</li>
  <li>Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme</li>
  <li>Kişisel verilerinizin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme</li>
  <li>KVKK'nın 7. maddesinde öngörülen şartlar çerçevesinde kişisel verilerinizin silinmesini veya yok edilmesini isteme</li>
  <li>İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme</li>
  <li>Kişisel verilerinizin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
</ul>

<p>Haklarınızı kullanmak için <a href="mailto:{{kvkk_email}}">{{kvkk_email}}</a> adresine başvurabilirsiniz.</p>

<p><strong>Bu metni okuduğunuzu ve içeriğini anladığınızı beyan etmenizi rica ederiz.</strong></p>`;

export const GIZLILIK_DEFAULT_CONTENT = `<h2>GİZLİLİK VE KİŞİSEL VERİ KORUMA TAAHHÜTNAME</h2>

<p>Bu taahhütname, <strong>{{sirket_adi}}</strong> bünyesindeki {{uygulama_url}} sistemine erişim sağlayan çalışan, tedarikçi ve yetkili kullanıcılar tarafından kabul edilmesi zorunlu bir belgedir.</p>

{{#bordro_isveren}}
<h3>0. İş Organizasyonu Bilgilendirmesi</h3>
<p>Belirsiz süreli iş sözleşmem <strong>{{bordro_isveren_adi}}</strong> nezdinde yürürlüktedir. Hasar dosyası ve operasyon süreçleri <strong>{{sirket_adi}}</strong> tarafından yönetilmekte olup, operasyonel talimatlar görev tanımım çerçevesinde {{sirket_adi}} tarafından verilebilir.</p>
<p>İş hukukundan doğan hak ve yükümlülükler bakımından asıl işverenim {{bordro_isveren_adi}} olup; bu bilgilendirmeyi okuduğumu ve anladığımı beyan ederim. İş hukuku kaynaklı başvurularımı {{bordro_isveren_adi}}'na; kişisel veri haklarıma ilişkin başvurularımı {{kvkk_email}} adresine yönelteceğimi kabul ederim.</p>
{{/bordro_isveren}}

<h3>1. Gizlilik Yükümlülüğü</h3>
<p>Sisteme erişim sağlayan kişi olarak aşağıdaki hususları kabul ve taahhüt ederim:</p>
<ul>
  <li>Sistem üzerinde erişeceğim tüm kişisel verileri, ticari bilgileri ve gizli bilgileri üçüncü kişilerle paylaşmayacağımı,</li>
  <li>Sistemde işlediğim bilgileri yalnızca görevim kapsamında kullanacağımı,</li>
  <li>Herhangi bir yetkisiz kişiye sistem erişim bilgilerimi (kullanıcı adı, şifre) vermeyeceğimi,</li>
  <li>Sistemde gördüğüm bilgileri kopyalamayacağımı, dışarı çıkarmayacağımı ve kötüye kullanmayacağımı.</li>
</ul>

<h3>2. Kişisel Veri Güvenliği</h3>
<p>Sistemde işlediğim kişisel verilerin güvenliğini sağlamak amacıyla:</p>
<ul>
  <li>Güçlü ve benzersiz şifre kullanacağımı,</li>
  <li>Şifremi düzenli aralıklarla değiştireceğimi,</li>
  <li>Sistemden çıkarken oturumu kapattığımdan emin olacağımı,</li>
  <li>Fark ettiğim güvenlik açıklarını derhal {{kvkk_email}} üzerinden yetkililere bildireceğimi</li>
</ul>
<p>kabul ve taahhüt ederim.</p>

<h3>3. Yetkisiz Erişim Yasağı</h3>
<p>Görevim kapsamı dışındaki verilere, dosyalara veya kayıtlara erişmeyeceğimi kabul ederim. Görev tanımım dışında sistem üzerinde işlem yapmayacağımı taahhüt ederim.</p>

<h3>4. Veri İhlali Bildirimi</h3>
<p>Bir veri ihlali veya güvenlik tehdidi fark ettiğimde, durumu derhal ve gecikmeksizin sistem yöneticisine bildireceğimi kabul ederim.</p>

<h3>5. Görev Sona Ermesinde Yükümlülükler</h3>
<p>Görevimin sona ermesi veya sistem erişimimin kaldırılması durumunda:</p>
<ul>
  <li>Sistemden edindiğim tüm bilgilerin gizliliğini korumaya devam edeceğimi,</li>
  <li>Elimdeki tüm sistem belgelerini ve kopyaları iade edeceğimi veya imha edeceğimi</li>
</ul>
<p>taahhüt ederim.</p>

<h3>6. Yasal Yaptırımlar</h3>
<p>Bu taahhütnameye aykırı davranışlarımın, 6698 sayılı KVKK, 5237 sayılı Türk Ceza Kanunu ve ilgili diğer mevzuat kapsamında yasal yaptırımlara yol açabileceğini bildiğimi kabul ederim.</p>

<p><strong>Yukarıdaki taahhütlerin tamamını okuduğumu, anladığımı ve kabul ettiğimi beyan ederim.</strong></p>`;

export const DEFAULT_AGREEMENT_TEMPLATES = {
  kvkk: KVKK_DEFAULT_CONTENT,
  gizlilik: GIZLILIK_DEFAULT_CONTENT,
} as const;
