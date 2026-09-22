# Deploy Geçmişi — Canlı Durum Özeti

**Tek kaynak (image):** `deploy/manifests/KNOWN_GOOD_IMAGES.json`  
**Açık işler:** `CANLIYA_ALINMAMIS_ENVANTER.md`  
**Son güncelleme:** 22 Eylül 2026

> Her deploy sonrası: bu dosyaya **yeni satır** + manifest `label` / `description` güncelle. Sohbet değil, bu dosya “son ne alındı?” cevabıdır.

---

## Canlı durum (22 Eylül 2026 — web v614 / backend v614)

| Servis | Sürüm | Durum |
|--------|-------|--------|
| **Web** | `sigorta-web:dalga2-agreement-hr-01-v614-amd64` | canlı |
| **Backend** | `app-backend:dalga2-agreement-hr-01-v614-amd64` | canlı |
| **Rollback** | Web **v613** / Backend **v612** | manifest `rollbackImages` |
| **Etiket** | `v614-dosya-acilma` | |

---

## Son deploy kronolojisi

### v614 — Full (22 Eylül 2026) — Dosya açılması

- Rapor indirme, puantaj yazdırma, dekont ve eksper belgesi açılır; pencere kesilirse sayfada durur
- Disk daralınca güvenli temizlik kendiliğinden başlar; fotoğraflar silinmez
- Güvenlik: kaynak kapısı, oturum kapısı, DB+uploads yedek gzip, canlı uploads silinmedi. Alımda iki servis birden durmaz; JWT ve Redis silinmez
- Geri alma web **v613** / backend **v612**

### v613 — Yalnız web (21 Eylül 2026) — Dosya önizlemesi

- Hasar Müşteri Görünümü ve Tam Görünüm raporu açar; pencere kesilirse sayfada durur
- Evrak, sözleşme, ölçüm ve fiş aynı kapıdan açılır
- Aynı kırılma her canlı alımda kesilir
- Güvenlik: kaynak kapısı, oturum kapısı, DB+uploads yedek gzip, canlı uploads silinmedi. Alımda backend durmaz; JWT ve Redis silinmez
- Geri alma web **v612** / backend **v608**

### v612 — Full (21 Eylül 2026) — Yazışma teyit cümlesi

- Giden yazışmada: Bu Yazışma Tarafınıza Ulaştığında Lütfen Teyid Ediniz.
- Güvenlik: kaynak kapısı, oturum kapısı, DB+uploads yedek gzip, canlı uploads silinmedi. Alımda backend ve web birden stop edilmez; JWT ve Redis silinmez
- Geri alma web **v611** / backend **v608**

### v611 — Yalnız web (21 Eylül 2026) — Şirket sitesi cep görünümü

- Telefonda giriş yan yana kesilmez; alta alta tam görünür
- Harita sayfasında başlık ve Destek Hattı üst üste binmez; özet kartlar iki sıra
- Güvenlik: kaynak kapısı, oturum kapısı, DB+uploads yedek gzip, canlı uploads silinmedi. Alımda backend durmaz; JWT ve Redis silinmez
- Geri alma web **v610** / backend **v608**

### v610 — Yalnız web (21 Eylül 2026) — Yenileniyoruz kutusu ve 15 gün sayaç

- Yenileniyoruz alanı büyüdü
- Sayaç 21 Eylül’den 15 gün geri sayar; süre 6 Ekim gece dolacak
- Güvenlik: kaynak kapısı, oturum kapısı, DB+uploads yedek gzip, canlı uploads silinmedi. Alımda backend durmaz; JWT ve Redis silinmez
- Geri alma web **v609** / backend **v608**

### v609 — Yalnız web (21 Eylül 2026) — Şirket sitesinde tek giriş

- Şirket sitesinde e-posta/şifre kutusu yok; Giriş Yap yazılıma gider
- Yazılım girişinde şifre ve (gerekirse) mail kodu bir kez yazılır
- Güvenlik: kaynak kapısı, oturum kapısı, DB+uploads yedek gzip, canlı uploads silinmedi. Alımda backend durmaz; JWT ve Redis silinmez
- Geri alma web **v608** / backend **v608**

### v608 — Full (21 Eylül 2026) — Giriş kodu kutuya dolar

- Windows’ta kopyalanan kod kutuya yazılır; Mac önerisi durur
- Şifre Ekranına Dön çalışır; Kodu Yeniden Gönder yeni kod yollar
- Mail selamı Sn. Mustafa Yufkayürek biçiminde
- Güvenlik: kaynak kapısı, oturum kapısı, DB+uploads yedek gzip, canlı uploads silinmedi. Alımda backend ve web birden stop edilmez; JWT ve Redis silinmez
- Geri alma web **v607** / backend **v605**

### v607 — Yalnız web (20 Eylül 2026) — Giriş kodu kutusu

- Yönetici/finans girişinde kırmızı sistem kapalı yazısı kalkar; 6 haneli kod kutusu açılır
- Güvenlik: kaynak kapısı, oturum kapısı. Alımda backend durmaz; JWT ve Redis silinmez
- Geri alma web **v606** / backend **v605**

### v606 — Yalnız web (20 Eylül 2026) — Acil finans sayfası

- Acil finans sayfası boş kayıtta kırılmaz; hakediş listesi durur
- Güvenlik: kaynak kapısı, oturum kapısı, DB+uploads yedek gzip, canlı uploads silinmedi. Alımda backend durmaz; JWT ve Redis silinmez
- Geri alma web **v605** / backend **v605**

### v605 — Full (20 Eylül 2026) — Giriş kodu, sabah bakışı, yedek ve ödeme ikinci göz

- Yönetici/finans yeni girişte e-posta kodu; Pasif/Arşiv yalnız o kişiyi keser
- Yönetim panelinde Bekleyen İş ve 5 Dosya çekmecesi; dönem tuşu ve ciro kartları durur
- Canlıda 30 dakika dokunulmazsa giriş; Beni Hatırla açık ekranı bırakmaz; kısa kesinti oturumu silmez
- Disk 8/5 GB haber; uploads ve yedek silinmez. Yedek ikinci yer doğrulanmadan gitti sayılmaz
- Fiş okunur, kutu dolar; Kaydet personeldedir. Ödendi finans personelindedir
- Güvenlik: kaynak kapısı, oturum kapısı, giriş kodu hız sınırı, disk bakımı (eski v603 imaj), DB+uploads yedek gzip, canlı uploads silinmedi. Alımda backend ve web birden stop edilmez; JWT ve Redis silinmez
- Geri alma web **v604** / backend **v604**

### v604 — Full (18 Eylül 2026) — Personel hatırlatma ve puantaj nabzı

- Gün sonu onaylamayana mail + yönetici çanı (hafta içi 18:05, Cumartesi 13:05)
- Ay sonu mali müşavire toplu puantaj (son gün 17:10; kaçtıysa 1’i 09:20)
- Panel açıkken mesai giriş/bitiş puantaja düşer
- Çandaki puantaj/izin yazısı Personel sayfasını açar
- Güvenlik: kaynak kapısı, disk bakımı (eski v600 imaj), DB+uploads yedek gzip, canlı uploads silinmedi. Alımda backend ve web birden stop edilmez; JWT ve Redis silinmez
- Geri alma web **v603** / backend **v603**

### v599 — Full (16 Eylül 2026) — Şirket sitesi Yenileniyoruz

- meridyen-tr.com / app aynı yazılım; Yenileniyoruz sayacı ve kartlar (harita yok)
- Kullanıcı Girişi durur; şirket adresinden giriş yazılıma düşer; panel şirket adresinde açılmaz
- Çerez şeridinde Çerezleri Yönet
- Güvenlik: kaynak kapısı, oturum kapısı, DB+uploads yedek gzip, yabancı siteden yazma kesilir, şirket sitesi origin’i yazılıma bağlı. Canlı uploads silinmedi. Alımda backend ve web birden stop edilmez; JWT ve Redis silinmez
- meridyen-tr.com genel isim kaydı henüz yok; sayfa yazılımdadır (`/yenileniyoruz`)
- Geri alma web **v598** / backend **v598**

### v598 — Full (15 Eylül 2026) — Acil kapanış; yanıt; Kime; kart; ihbar adresi; resim yükleme

- Acil kapanış raporu tespit kabuğunda; başlık/SLA/saat kapanışı işaret eder; SLA yalnız süre; hizmet sonrası resim; Çilingir dahil mail eki PDF
- Hasar yanıt ekinde 5 fotoğraf kesmesi kalktı; gönderime küçülür; taslak açılmaz
- Yanıt Kime çoklu adres; kartta kullanıcı olmayan alan adı adresinde personele hatırlatma
- Sigorta / broker / asistans / eksper kullanıcıları müşteri kartından; kişi seçilince ad soyad görev e-posta telefon dolar
- Müşteri / Tedarikçi / Personel Ekle üst bantta yazılan ad; eksper uyarısı ad yazılınca kalkar
- Eksper–sigorta kare kutu kalktı; ilişki Hasar dosyasından müşteri kartı ve CRM’de
- Yeni ihbar mailinde adres sonda İlçe-İL (Çukurova-ADANA)
- Acil kapanış Galeriden/Kameradan kaydı durur; çevirme yüklemeyi düşürmez
- Güvenlik: kaynak kapısı, oturum kapısı, DB+uploads yedek gzip, geri alma web v597 / backend v597. Canlı uploads silinmedi. Yeni migration yok. Alımda backend ve web birden stop edilmez; JWT ve Redis silinmez
- Geri alma web **v597** / backend **v597**

### v597 — Full (15 Eylül 2026) — Acil rapor fotoğraf; lightbox; yanıt eki; özet dönem

- Acil tespit raporu: resimler ayrı sayfa, imza en altta (Tespiti Yapan / Raporlayan, Dijital Onaylı); yan duran fotoğraf düzelir
- Resim büyütünce yakınlaştır, uzaklaştır, sola/sağa çevir (Acil tespit ve Hasar rapor resmi)
- Gelen kutu / dosya yanıtına ek
- Dosya özeti Bugün / Bu Hafta / Bu Ay İstanbul takvimi; Hasar kartı ilgili listeyi açar
- Acil raporda manuel onay / revizyon / silme tarihçesi
- Güvenlik: kaynak kapısı, oturum kapısı, DB+uploads yedek gzip, geri alma web v596 / backend v596. Canlı uploads silinmedi. Yeni migration yok. Alımda backend ve web birden stop edilmez; JWT ve Redis silinmez
- Geri alma web **v596** / backend **v596**

### v596 — Full (14 Eylül 2026) — Acil rapor; çoklu resmi fatura; kapanış çekmecesi; tedarikçi T.C.

- Tedarikçi şahısta T.C. kaydı durur; turuncu evrak uyarısı kaydı kesmez. Şirkette vergi numarası durur
- Acil (Çilingir hariç) Hasar benzeri tespit raporu; İhbar kutusundan PDF; asistans onayı gelen kutudan dosyaya düşer
- Rapor kalemini dosya sorumlusu yazar; örnek duvar işleri. Kaydet taslak. Raporu İncele yazı bitince açılır
- Aynı resmi fatura numarası birden fazla Acil dosyaya yazılır. Pencere: Resmi Fatura Numarası Giriniz
- Kapanış çekmecesi yenilemede kaybolmaz. Kaydet dosyayı kapatmaz
- Güvenlik: kaynak kapısı, oturum kapısı, DB+uploads yedek gzip, geri alma görüntüleri durur (web v595 / backend v595). Canlı uploads silinmedi. Migration: emergency_report_line
- Geri alma web **v595** / backend **v595**

### v595 — Full (14 Eylül 2026) — Satış fatura talepleri; Kullanıcılar Ekle; hoş geldin kopyası

- Satış Fatura Talepleri Hasar ve Acil ayrı listelenir. Acil’de çoklu seçim, hesap ve aynı resmi faturaya toplu yazım
- Faturalar yalnız kesilen belgedir. Kullanıcılar Ekle durur; ekspertiz firması popup; ofis personeli seçilince form dolar
- Yeni hoş geldin Kullanıcılar e-postasına gider; Platform Mail Kopyası ve okundu yöneticiye aynı gönderimde düşer. Ekli kullanıcılar yenilenmez
- Güvenlik: kaynak kapısı, oturum kapısı, DB+uploads yedek gzip, geri alma görüntüleri durur (web v594 / backend v594). Canlı uploads silinmedi. Yeni migration yok
- Geri alma web **v594** / backend **v594**

### v594 — Full (13 Eylül 2026) — Finans kartı liste ile uyumlu

- Finans Merkezi kartı tıklanınca karttaki işin listesi açılır (tahsilat kuyruğu, dönemin tahsilatı, masraf, net sonuç, bekleyen fatura talebi)
- Bekleyen tahsilat kuyruk tutarını basar; dönem bakiyesi kuyruk yerine yazılmaz
- Güvenlik: kaynak kapısı, oturum kapısı, DB+uploads yedek gzip, geri alma görüntüleri durur (web v593 / backend v593). Canlı uploads silinmedi
- Geri alma web **v593** / backend **v593**

### v593 — Full (13 Eylül 2026) — Kenar; Platform Mail Kopyası; Türkçe okundu

- Sol menü kapalıyken sayfa kenarı dolar; kart ortadan kesilmez
- Platform Mail Kopyası maili atana gider (finans / müdür / yönetici / dosya sorumlusu). Asıl yazı ile aynı gönderim; gitmezse kopya da gitmez
- Okundu bilgisi gelir; İngilizce «was read on» Türkçe Okundu olur. Gönderim tarih-saat, kalın Karşı Taraf / kopya satırı
- Güvenlik: kaynak kapısı, oturum kapısı, DB+uploads yedek gzip, geri alma görüntüleri durur (web v592 / backend v590). Canlı uploads silinmedi
- Geri alma web **v592** / backend **v590**

### v592 — Web (13 Eylül 2026) — i kalktı; hamburger menü

- Başlık yanındaki i ve çift açıklama kalktı
- Yönetim Paneli tek satır; Bugün / Bu Hafta sağda
- Sol menü yalnız hamburger; «Menüyü Daralt» yok
- Güvenlik: kaynak kapısı, oturum kapısı, DB+uploads yedek gzip, offsite B2 (v591 kaçığı kapatıldı), baseline, geri alma görüntüleri durur
- Backend **v590** durur. Geri alma web **v591** / backend **v586**

### v591 — Web (13 Eylül 2026) — Boş başlık açıklaması kalktı

- Başlık yanındaki i yalnız konu kuralı varsa durur
- «Hasar dosyası listesi» gibi başlığı tekrarlayan metin kalktı
- Backend **v590** durur. Geri alma web **v590** / backend **v586**

### v590 — Full (13 Eylül 2026) — İK ve panel düzeltmeleri

- İK personel kadrosu açık (Personel Ekle, zimmet aynı kayıtta, puantaj kapısı)
- Sol menü üstünde aç/kapa tuşu. Anketler tek tık. Liste 10’dan başlar
- Açıklamalar başlıktaki i ikonunda. Tahsilat boş hali düzgün
- Geri alma web **v589** / backend **v586**

### v589 — Web (13 Eylül 2026) — Menü tıklayınca açılır

- Sol menü tıklayınca açılır / kapanır. Üzerine gelince açılmaz
- Açıkken yazılar listenin üstünü kapatmaz; sayfa yana kayar. Kapalıyken simgeler durur
- Backend **v586** durur. İK yok. Geri alma web **v588** / backend **v586**

### v588 — Web (12 Eylül 2026) — Menü üzerine gelince açılır

- Sol menü kapalıyken simge durur. Üzerine gelince yazı açılır; sayfanın üstüne koyu çekmece binmez
- Liste sıkışmaz. Backend **v586** durur. İK yok
- Geri alma web **v587** / backend **v586**

### v587 — Web (12 Eylül 2026) — Kapalı menü simgeleri

- Kapalı sol menüde simgeler durur. Açıkken yine listenin üzerine biner; tablo sıkışmaz
- Backend **v586** durur. İK yok
- Geri alma web **v586** / backend **v586**

### v586 — Full (12 Eylül 2026) — Liste Sıra; menü; finans kartları

- Hasar / Operasyon / Acil listesinde Sıra kalkar; son sütun İşlemler
- Sol menü dar rayda durur; açılınca tabloyu sıkıştırmaz
- Finans üst kartları kuyruk kaydını okur (bekleyen fatura / tahsilat / dönem)
- Migrasyon yok. İK yok. Geri alma web **v585** / backend **v585**

### v585 — Full (12 Eylül 2026) — Yazışma geçmişi; görünür kopya; CRM izi

- Gelen kutu / dosya yanıtında yazışma geçmişi durur; logo yığını kırpılır
- Dosya mailinde dosya sorumlusuna görünür kopya. CRM tanıtımda gönderene görünür kopya; Hasar kutusundan gider
- Durum: Gönderildi / Ulaşmadı / Yanıt geldi. CRM’de sahte Okundu yok
- Kilit: `yazisma-mail-izi-kilidi.mdc` + `smoke-outbound-mail.sh` / `smoke-acil-netlesen.sh`. Migrasyon yok. İK yok
- Geri alma web **v584** / backend **v584**

### v584 — Full (12 Eylül 2026) — İhbar adresi; Acil gelen kutu isim

- İhbar mailinde adres sokak · ilçe · il; «Atabey - Türkiye - Isparta» kuyruğu kesilir (Yeni İhbar + Tespit planlandı)
- Acil mailden açılan dosyada sigortalı kişi adı Kimde olmaz; dosya sorumlusu işlemi yapan ofis kullanıcısıdır; Test Kullanıcı otomatik yazılmaz
- Bitmiş iş kilitleri `--skip-rsync` ile atlanmaz. Migrasyon yok. İK yok
- Geri alma web **v583** / backend **v583**. Eski açık `AY-202609-` satırı kendiliğinden düzelmez

### v583 — Full (10 Eylül 2026) — Firma portal; Acil hizmet alım sözleşmesi

- Müşteri kartından firma kullanıcıları (hoş geldin + geçici şifre; yetkili kişiler giriş almaz)
- Görev kişiye yazılır; Kullanıcılar iç davet; yetki yalnız dosya sorumlusunda
- Girişte sistem kapalı ayrı; tedarikçi kimliği; Acil hizmet alım sözleşmesi Hasar onarımından ayrı
- Firma kullanıcısı sağ üst: müşteri kısa adı + ad soyad
- Geri alma web **v582** / backend **v581**. İK yok

### v582 — Web (8 Eylül 2026) — Liste kartı dolsun

- Liste tablosu kartın ortasında kesilmez; kartı doldurur. Sütun toplamından daralmaz
- Kullanıcılar Hasar süzgeci kabuğunda. Kilit: `smoke-liste-gorunum.sh` + `liste-sutun-genislik-kilidi.mdc`
- Backend **v581** durur. İK yok
- Geri alma web **v581** / backend **v581**

### v581 — Full (8 Eylül 2026) — Onaya gönderim; kullanıcı listesi

- Onaya Gönder taslak açmaz; kırmızı Azure Mail.ReadWrite uyarısı kalkar
- Kullanıcılar: ad ve telefon aynı satırda; görev tek satır. Sürüm etiketi **v581**
- Geri alma web **v580** / backend **v578**. İK yok

### v580 — Web (8 Eylül 2026) — Telefon yazımı; finans liste

- Türkiye telefonu **532 133 4144** (+90 ve baştaki 0 yok)
- Finans listeleri ekrana yüzdeyle yayılmaz
- Backend **v578** durur. İK yok
- Geri alma web **v579** / backend **v578**

### v579 — Web (8 Eylül 2026) — Menü; kesintide oturum

- Dosya üstü üç nokta menüsü kartta kesilmez
- Kısa sunucu kesintisinde oturum silinmez. Backend **v578** durur. İK yok
- Geri alma web **v578** / backend **v578**

### v578 — Full (7 Eylül 2026) — Acil dijital onay; mail kutusu kilidi

- İhbar: Adres Ve Hizmet Talep Onayı. Kapanış: Servis Onay Formu (ücret yok). Hasar muvafakat durur
- Hoş geldin Kullanıcılar; Hasar işi Hasar kutusundan, Acil kapanış İhbar kutusundan
- Migrasyon yok. İK yok. Geri alma web **v577** / backend **v575**

### v577 — Web (7 Eylül 2026) — Acil tespit / sunum yazısı

- Tespit bulgusu ve sunum özeti yazılıp başka adıma geçince silinmez
- Backend **v575** durur. Rollback web **v576**. İK yok

### v576 — Web (7 Eylül 2026) — KVKK onaylı kamu metni

- KVKK / gizlilik / çerez sayfalarında taslak uyarısı yok
- Backend **v575** durur. Rollback web **v575**. İK yok

### v575 — Full (7 Eylül 2026) — Acil sigortalı adı; açık dosya kartı


- Tablo genişliği piksel; sütunlar ekrana göre şişmez
- İşlem seçici ve listede harita yok kilitlendi (`smoke-liste-gorunum.sh`)
- Backend **v571** durur. Rollback web **v572**. İK yok

### v572 — Web (6 Eylül 2026) — Liste işlem; listeden harita kalktı

- Kolonda görünen işlemler seçilir. Portal, dosya sorumlusu, finans, admin listeleri
- Dosya Özeti / Hasar / Acil listesinde harita yok. Harita menüsü durur
- Backend **v571** durur. Rollback web **v571**. İK yok

### v571 — Full (6 Eylül 2026) — Sigorta Canlı İzle yalnız harita

- Şehir listesi yok. Sigorta/asistans Canlı İzle doğrudan harita
- Bölge seç durur. v570 sağlık / kapanan yedek / kutu harita durur
- Rollback web+backend **v570**. İK yok

### v570 — Full (6 Eylül 2026) — Harita sağlık; sigorta kapanan; portal kutu

- Sağlık uyarısı pinleri kesmez. Kopuklukta Bozulmuş görünür
- Sigortada açık dosya yoksa kapanan görünür. Dosya sorumlusu yalnız kendi işi
- Açık pin nabız. Sigorta/asistans Canlı İzle ve Operasyon Ağı aynı kutu harita
- Rollback web+backend **v569**. İK yok

### v569 — Full (6 Eylül 2026) — Harita il, kapanan dosya, bölge

- GPS yoksa pin il adıyla durur. Tercihle kapanan Hasar/Acil görünür
- Bölge seç. Müşteri kartı ve dosya sorumlusu listesinde aynı harita
- Rollback web+backend **v568**. İK yok

### v568 — Full (5 Eylül 2026) — Harita iş adresi; Hasar/Acil ayrı

- Açık dosya pin’i iş adresinde. Tedarikçi telefonu yok. Yeşil kutu sahada
- Personel dairesi sizin telefon. Haritada bir kez şerit. Hasar kabuğu aynı
- Rollback web+backend **v567**. İK yok

### v567 — Full (5 Eylül 2026) — Acil kesilen fatura; kartlar tam özet

- Acil Faturalandı Kesilen Faturalar’a düşer; Hasar ciro/kârı karışmaz
- Finans kesilen kartları ve Asistans Faturalar kesilen özetten
- Tablo: Acil fatura Hasar dosyasına bağlanmaz
- Rollback web+backend **v566**. İK yok

### v566 — Full (5 Eylül 2026) — Fatura talebi iş kalemi; Acil sözleşme yok

- Yapılan iş kalemi dosya konusu. İptal açıklaması zorunlu. Göz ile incelenir
- Acil Yardımda her dosyada sözleşme / dijital servis formu yok
- Rollback web **v565** / backend **v563**. İK yok

### v565 — Web (5 Eylül 2026) — Vergi No Eksik / TC No Eksik

- Eksik baş harfi büyük. Backend v563 durur. İK yok
- Rollback web **v564** / backend **v563**

### v564 — Web (5 Eylül 2026) — Tedarikçi Vergi No / TC No eksik

- İsim altında **Vergi No Eksik** veya **TC No Eksik**; dar sütunda kesilmez
- Liste kabuğu sade. Backend v563 durur. İK yok
- Rollback web **v563** / backend **v563**

### v563 — Full (5 Eylül 2026) — Tedarikçi eksik kimlik işareti

- Listede TC veya vergi no yoksa kayıt işaretlenir
- v562 sözleşme/kimlik kilidi durur. İK yok
- Rollback web+backend **v562**

### v558 — Full (3 Eylül 2026) — Finans faturalar

- Müşteri sütunu; eksper/sigorta sütunu yok
- İşlemler: Yazdır, Bildir (dosya sorumlusu panel zili), Düzenle, İptal; düzenleme nedeni zorunlu
- Fatura Talepleri sekmesi bekleyende yanar; finans girişinde öncelikli görev
- Finans tablolarında sayfa boyu ve sütun kaydırma
- Rollback web+backend **v557**. İK yok. Tedarikçi türü kutusu bu pakette yok

### v557 — Full (2 Eylül 2026) — Evrak kırmızısı, hakediş karışması

- Kapalı dosyada Evrak Yükleme yeşil: yükleme veya dosya kapanışı. Fiziki muvafakat sayılır
- Hasar Gider hakedişi yalnız bu dosya; başka dosyanın ödemesi basılmaz
- Acil tespit bulgusu v556’daki gibi durur. Eski boş dosya kendiliğinden dolmaz
- Rollback web+backend **v556**. İK yok. Tedarikçi türü kutusu bu pakette yok

### v556 — Full (2 Eylül 2026) — Tahsilat, ofis kapanış, tespit, sağ panel

- Hasar tahsilat: boş fatura kaydı FK kırmaz
- Ofis süreç bitmeden kapatmaz; iptal nedeni zorunlu. Saha kapatmaz
- Acil tespit bulgusu kapatmadan önce yazılır; boş güncelleme silmez
- Sağ panel soldaki sayfaya tıklayınca kapanmaz; X/çıkışta kayıt hatırlatması
- Rollback web+backend **v555**. İK yok. Tedarikçi türü kutusu bu pakette yok

### v555 — Full (2 Eylül 2026) — Kapanış, anket, onay talep, rapor onaylandı

- Dosya kapanış maili Hasar + Acil; sigorta / asistans / eksper / broker. Meridyen personele bu görsel gitmez
- Anket raporu otomatik gitmez; personel sorar, yönetici onayı şart. Sigorta + asistans + eksper + broker
- Onay talep: `{Sigorta}-{Dosya No}-Onay Talep`. Rapor onaylandı: `{Rapor Onaylandı}-{Sigorta}-{Dosya No}`
- Kabuk logo 120px, lacivert başlık. v554 hoş geldin durur
- Rollback web+backend **v554**. İK yok. Sağ panel kaydır ayrı

### v554 — Full (2 Eylül 2026) — Hoş geldin maili gerçek ekrana göre

- Metin personel / sigorta / eksper / broker / asistans ekranına göre
- Üst bantta rol yazılmaz; firma adı ismin üstünde
- Giriş **https://app.meridyen-tr.com/giris**. Logo **120px**
- v553 hakediş durur. Rollback web+backend **v553**. İK yok.

### v553 — Full (1 Eylül 2026) — Acil hakediş Ödenecekler; Ödendi finansındır

- İş bitince tedarikçiye ödenecek tutar görünür
- Ödenmeyen hakediş finans **Ödenecekler** kuyruğunda durur
- Finansa gittikten sonra **Ödendi** işlemini finans personeli yapar; dosya sorumlusu finans tarafında işlem yapamaz
- İşlemi yapan adıyla kaydolur. Vade yok
- v552 saha/hakediş/kısa ad durur. Rollback web+backend **v552**. İK yok.

### v552 — Full (1 Eylül 2026) — Saha sonlandırır; iş grubu hakedişi; kısa ad

- Saha **Tespiti Sonlandır**; ofis dosyası kapanmaz, dosya sorumlusuna açık düşer
- Aynı tedarikçinin her iş grubu ayrı finansa gider; bütçe Düzenle satışa dokunmaz
- Kısmi kayıt Kısa Ad’ı silmez; boş kısa ad karttaki isimden doldurulur (8 kayıt)
- v551 durum kilidi durur. Rollback web+backend **v551**. İK yok.

### v551 — Full (1 Eylül 2026) — Dosya durumu son işlem

- Red «Dosya Kapatıldı» olmaz; **Reddedildi** kalır
- Revizyon **Revizyon Talep Edildi**; «Rapor Yazım Aşamasında» yazılmaz
- Onaya giden revize rapor **Onay Bekliyor**
- Gerçek kapanış **Dosya Kapatıldı**
- v550 hakediş/saha/avans durur
- Rollback web+backend **v550**. İK yok.

### v550 — Full (1 Eylül 2026) — Hakediş örnek yok; saha kapatmaz; avans yarı onay

- Hakediş listesinde örnek tedarikçi satırı yok
- Saha tespiti ofis dosyasını kapatmaz
- Avans tavanı yok; iş bedelinin yarısını geçerse ekran uyarısı + onay; finans **Avans uyarısı**
- Sözleşme uyarısı: «Sözleşme durumunu belirleyiniz.»
- v549 üç dosya sözleşme muafiyeti durur
- Rollback web+backend **v549**. İK yok.

### v549 — Full (1 Eylül 2026) — Üç dosyada sözleşme muafiyeti

- Adalet Vakfı, Serap Richard, İlknur Yılmaz: tedarikçi sözleşmesi yüklenmez
- Diğer dosyada sözleşme sorusu durur
- Rollback web+backend **v548**. İK yok.

### v548 — Full (1 Eylül 2026) — Hasar tahsilat tarafı ve gelir

- Satış faturası kime Dosya Onaylandı adımında sorulur; Finansa talep et ile kilitlenir
- Yeni Gelir: Faturalı / Faturasız; faturasızda KDV yok
- Avans açıklaması kutu içinde; iş grubu adı yazılmaz
- Rollback web **v547** / backend **v546**. İK yok.

### v547 — Web-only (31 Ağustos 2026) — Hasar avans tedarikçi seçimi

- Avans Talebi: tedarikçiler bütçe / ödenen avans / kalan ile listelenir; Avans Ver ile seçilir
- Açıklamaya «İş Grubu Yok» yazılmaz
- Rollback web **v546** / backend **v546**. İK yok.

### v546 — Full (31 Ağustos 2026) — Hasar tedarikçi hakedişi

- Gider & Bütçe: Hakediş Ver, ödeme tablosu (tedarikçi, iş grubu, dosya, tarihler)
- Tahsilatlar dosya sorumlusuna açık; tedarikçi kartından dosyaya dönüş
- Rollback web+backend **v545**. İK yok.

### v545 — Full (27 Ağustos 2026) — Sigorta muvafakat izleme

- Sigorta portalı kendi dosyasında muvafakat görüntüle / yazdır
- Rollback web+backend **v544**. İK yok.

### v544 — Full (27 Ağustos 2026) — Evrak MinIO / sekmeler / DOC / işlem ikonları

- Fiziki evrak oturumla bayt; müşteri sekmeleri; DOC kodu; Ayarlar kalem/sil
- Rollback web+backend **v543**. İK yok.

### v346 — Web-only (13 Temmuz 2026) — Dashboard Dosya Sorumlusu Merkezi Faz 4 (D0)

- Başlık **Dosya Sorumlusu Merkezi** + Dosya Sorumlusu rozeti
- CTA: + Yeni Hasar (mavi); + Yeni Acil yalnızca kapsama göre
- Operasyon Özeti kompakt band + Günün Akışı (finans kartı yok) + Onay Gecikmeleri
- Alt 3’lü: Kritik Uyarılar / Bekleyen Aksiyonlar / Son Aktiviteler
- >1440px Ofis Kullanım Kılavuzu paneli (finans linki yok)
- Admin v345 şablonu dokunulmadı; backend v342 korunur

### v345 — Web-only (13 Temmuz 2026) — Dashboard Admin KPI Faz 3

- Başlık **Operasyon Yönetim Merkezi** + Admin rozeti
- CTA: + Yeni Hasar (mavi), + Yeni Acil (kırmızı), Pazartesi Toplantısı (mavi outline)
- Finans Özeti 5 KPI (tam ₺ format); Operasyon Özeti 6 kompakt metrik
- Haftalık Performans + Günün Akışı; >1440px Kullanım Kılavuzu paneli (300px)
- Shell v344 dokunulmadı (sidebar 240/72, Hızlı İşlem, Operasyon Aktif)
- Backend değişmedi (v342)

### v344 — Web-only (13 Temmuz 2026) — Dashboard shell Faz 2

- Sidebar **240px / 72px** (ANA SAYFA TASARIM TALİMATI kilidi; 286/92 geri alındı)
- Aktif menü `#EEF4FF` / `#2563EB` + sol 4px çizgi
- Topbar: Global Arama (⌘K), **+ Hızlı İşlem**, bildirim, Kullanım Kılavuzu, **Operasyon Aktif**
- Alt footer: Menüyü Daralt + kılavuz; navigasyon maddeleri korunur
- Backend değişmedi (v342)

### v343 — Web-only (önceki)

- Finans Özeti tam ₺ tutar; tab ikon; randevu/süreç düzenlemeleri

### v282 — Web-only (11 Temmuz 2026 gece) — logo konusu kapatıldı

- Sidebar logo **kompakt tek satır** (v253): dar menüde alt chevron ve çift beyaz kutu kaldırıldı
- Commit: `167b345`

### v281 — Web-only (11 Temmuz 2026 gece)

- **Koyu mod kapalı** — test aşaması `PANEL_FORCE_LIGHT_MODE`
- Logo ölçeği **v274/ade5d73** seviyesine döndü (5rem şişirme geri alındı)
- Commit: `6d6d0a0`

### v280 — Web-only (11 Temmuz 2026 gece)

- Logo şeridi **koyu temada da beyaz** — dar menü yanıltıcı koyu şerit kaldırıldı
- Geniş menü logo **5.25rem** belirgin; dar küre h-11
- Commit: `b98076c`

### v279 — Web-only (11 Temmuz 2026 gece)

- Sidebar logo **ölçeklendirme** — ade5d73 cilası: dar menü beyaz kart + büyük küre; geniş menü 4.5rem logo
- v278 ölçek regresyonu geri alındı
- Backend **v276 sabit**; migration yok
- Commit: `f52f9cd`

### v278 — Web-only (11 Temmuz 2026 gece)

- **S2 dar menü logo:** `meridyen-globe-square.png` geri — v277 SVG ihlali geri alındı (`ONAYLI_UI_CHECKLIST`)
- Backend **v276 sabit**; migration yok
- Smoke: login FAIL (yerel credential — bilinen); routing PASS; web healthy
- Commit: `4ef1981`

### v277 — Web-only (11 Temmuz 2026 gece)

- **Sidebar logo:** dar menü `MeridyenGlobeAnimated` SVG; geniş menü `meridyen-logo-original.png`
- **Koyu tema:** geniş logo için beyaz zemin (JPEG şeffaf değil)
- Backend **v276 sabit**; migration yok
- Pre-deploy: disk/routing PASS; nginx → web PASS
- Smoke: login FAIL (yerel credential — bilinen, v274 ile aynı); diğer rotalar PASS; web container healthy v277
- Commit: `e0bd4fc`

### v276 — Full (11 Temmuz 2026 akşam)

- **İhbar konusu:** canonical only; gelen kutusu `claimSubjectId` bağlama
- **Logo:** sidebar beyaz kutu kaldırıldı
- **E-posta 404:** panel URL + `/claim-files/*` redirect
- **Onarım raporu:** yatay revizyon geçmişi (Dosya Bilgileri içinde)
- **Sürüm etiketi:** `panel-build-info.ts` → v276
- Migration yok
- Commit: `1fafa1b`
- Disk: eski image temizliği sonrası deploy (korunan: v275, v274 web, v272 backend)

### v275 — Full (11 Temmuz 2026 akşam)

- Operasyon dosya tıklama **500** düzeltmesi (`claim?.latestRepairReport`)
- **İhbar konusu** eşlemesi (`resolveClaimIhbarKonusu`); API claimSubject dahil
- Mail terminoloji normalizasyonu (Cam Kırılması, Dahili Su vb.)
- Sidebar nav aktif/hover kontrastı; sütun sıra ↑↓ ve genişlik iyileştirmesi
- Migration yok
- Commit: `9d26122`

### v274 — Web-only (11 Temmuz 2026 akşam)

- Koyu tema **tablo zebra kontrastı** — dosyalar okunur
- **Sidebar logo** kalıcı CSS: `rounded-xl`, ölçek, dar menü küre çipi
- Backend **v272 sabit**; migration yok
- Smoke: login FAIL (yerel credential — bilinen); routing PASS; web healthy
- Commit: `ade5d73`

### v273 — Web-only (11 Temmuz 2026 akşam)

- Onarım raporu dosya sorumlusu **23 madde UX** geri bildirimi
- Rapora Git doğrudan rapor sayfası; Dosya Bilgileri eksper/ihbar; tablo satır UX; Tespit sütunu; tedarikçi modal/hafıza; alt bant; revizyon geçmişi taşıma
- Backend **v272 sabit**; migration yok
- Smoke: login FAIL (yerel credential — bilinen); routing PASS; web healthy
- Commit: `6c9bfbc`

### v251 — Web-only (11 Temmuz 2026)

- Sidebar kabuğu cilası: **Menüyü Daralt** + **rol kılavuzu** alt bölümde sabit
- Logo: küre + MERİDYEN / ASİSTANCE (beyaz kutu kaldırıldı)
- Yuvarlak köşeler (12px), içerik kaydırması menüyü kesmez
- Backend **v249 sabit**

### v250 — Web-only (11 Temmuz 2026)

- **P1 şablon:** Lacivert sidebar (tam logo / küre, Menüyü Daralt, rehber kartı)
- **Admin Yönetim Merkezi:** Admin rozeti, kırmızı Yeni Acil, Pazartesi Toplantısı
- Operasyon 6 kompakt kart + yüzde, Ekip Yoğunluğu grafiği
- Günün Akışı şeridi + büyük Gider Dağıtımı kartı
- Alt sıra: Kritik Uyarılar | Finans Darboğazları | Personel Yük (progress bar)
- Backend **v249 sabit** — migration yok
- Mustafa onayı: 11 Temmuz 2026

### v246 — Full (önceki oturum)

- 403 / erişim düzeltmeleri (dosya sorumlusu)
- Hasar dosyası görünürlük + otomatik ofis ataması
- Bireysel tedarikçi `firstName` hatası
- İş grubu ekleme yetkisi
- Gelen kutusu v245 özellikleri

### v247 — Full

- Global arama (mailler, acil dosyalar, sigortalı adı)
- Operasyon tablosu **Sigortalı Adı Soyadı** sütunu
- Bitişik dosya no eşleştirme (`50663701` ↔ `5066 3701`)

### v248 — Full (10 Temmuz 2026)

- **Dashboard iskeleti** — Finans Özeti + Operasyon Özeti + Haftalık Performans bölümleri *(onaylı mockup şablonu birebir değil — bkz. envanter P1)*
- Yan menü yenilemesi (daralt/genişlet, Finans Merkezi)
- Hasar detay paneli: sigortalı adı, hasar adresi, ihbar içeriği
- Yeni dosyada `insuredName` kaydı düzeltmesi
- HASAR Graph delta otomatik kurtarma (sync state not found → delta sıfırla + yeniden tara)
- Operational access grants + 2 migration
- Oturum güvenliği, IDOR scope, sidebar UX (v232–v234 commit’leri)

### v249 — Backend-only (10 Temmuz 2026, v248 sonrası)

- Inbound ingest build fix (`ef87cdb` — kullanılmayan job parametresi)
- Web **v248 sabit** kaldı

### Operasyonel (deploy değil, canlıda uygulandı)

- HASAR gelen kutusu delta manuel sıfırlama + senkron → `50663701` Aynur Yar ve `50663630` Ayla Belgin mailleri çekildi

---

## Canlıda VAR (tekrar deploy gerekmez)

**Platform:** Ayarlar anayasası, kullanıcı davet, KVKK modal, Tanımlar hub, sol menü + kılavuz

**Operasyon / hasar:** Gelen kutusu çekirdek, dosya açma modal, global arama, operasyon sigortalı sütunu, bitişik dosya no, hasar detay paneli, 403 düzeltmeleri

**Finans:** Finans Merkezi sayfası, v250 **Yönetim Merkezi** şablonu (admin), PayTR kod yolu (`/odeme/[token]`)

**Diğer:** Harita pinleri, tedarikçi dış kaynak arama, personel özlük, eksper/sigorta/broker portalları, MinIO, müşteri modülü UX

---

## Canlıda YOK / henüz yapılmadı

### Deploy bekleyen kod

| # | Konu | Durum |
|---|------|--------|
| — | Repoda olup canlıda olmayan kod | **Boş** — son gap v250’de kapandı |

### Ürün — şablon sonrası açık işler

| # | Konu | Mockup / not |
|---|------|----------------|
| P2 | **Dosya sorumlusu** dashboard şablonu birebir UI | Ayrı mockup / doğrulama gerekir |
| P1 | Admin şablon — Mustafa canlı screenshot PASS | `canli-kabul/ekran-goruntuleri/p1-v250/` |

### Ops işi (kod deploy değil)

| # | Konu | Dosya |
|---|------|-------|
| D2 | Eski hasar dosyalarına ofis ataması backfill | `scripts/backfill-orphan-claim-office-assignments.sql` |

### Veri düzeltmesi (deploy değil)

- `2026 YB 13237` — sigortalı adı boş; panelden veya SQL ile manuel güncelleme (eski kayıt)

### Kabul / test eksik (A paketi)

A1 screenshot, A2 BACKLOG 13 madde, A3 gelen kutusu T1–T7, A4 giriş logo, A5 davet maili, A6 harita — ayrıntı: `CANLIYA_ALINMAMIS_ENVANTER.md`

### Gelecek faz (B paketi)

PayTR canlı mod, CRM derinliği, gelen kutusu F2–F3, saha keşif, e-imza — ayrıntı: envanter B maddeleri

---

## Özet cümle

Son büyük **kod** paketi **v250 (web-only) + v249 (backend)** canlıda: P1 sidebar + admin dashboard şablonu dahil. **Deploy bekleyen yeni kod yok.** Sırada: canlı screenshot PASS (P1), dosya sorumlusu şablonu (P2), ops backfill (D2).

---

## Deploy sonrası güncelleme şablonu

```markdown
### vNNN — Web-only | Backend-only | Full (TARİH)
- Madde 1
- Madde 2
Rollback: ...
```
