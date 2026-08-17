# Sigorta Hasar Yönetim Sistemi

Türkiye'de oto dışı branşlarda sigorta hasar onarım hizmeti veren firmalar için kapsamlı web + mobil + backend yönetim platformu.

## 🏗️ Mimari

### Tech Stack
- **Backend**: NestJS + TypeScript + Prisma + PostgreSQL
- **Web**: Next.js 14 + TypeScript + Tailwind CSS
- **Mobile**: React Native (Expo Router)
- **Cache/Queue**: Redis
- **Storage**: S3 Compatible (MinIO)
- **Monorepo**: pnpm workspace + Turbo

### Proje Yapısı
```
sigorta-hasar-sistemi/
├── apps/
│   ├── backend/          # NestJS API
│   ├── web/              # Next.js yönetim paneli
│   └── mobile/           # Expo React Native
├── packages/
│   └── shared/           # Ortak tipler, enumlar, şemalar
├── docker-compose.yml
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 🚀 Hızlı Başlangıç

### Gereksinimler
- Node.js >= 18.x
- pnpm >= 8.x
- Docker & Docker Compose

### 1. Kurulum

```bash
# Bağımlılıkları yükle
pnpm install

# Ortam değişkenlerini ayarla
cp .env.example .env
# .env dosyasını ihtiyacınıza göre düzenleyin
```

### 2. Servisleri Başlat

```bash
# PostgreSQL, Redis, MinIO
docker-compose up -d

# Servislerin sağlıklı olduğunu kontrol edin
docker-compose ps
```

### 3. Veritabanı Migration ve Seed

```bash
cd apps/backend

# Prisma client oluştur
pnpm prisma:generate

# Migration çalıştır
pnpm prisma:migrate

# Seed verileri yükle (roller, izinler, durumlar, admin kullanıcı)
pnpm prisma:seed
```

**Varsayılan Admin Kullanıcı:**
- E-posta: `admin@example.com`
- Şifre: `admin123`

### 4. Uygulamaları Çalıştır

```bash
# Tüm uygulamaları aynı anda (Turbo ile)
pnpm dev

# Veya ayrı ayrı:
# Backend (port 3000)
cd apps/backend && pnpm dev

# Web (port 3001)
cd apps/web && pnpm dev

# Mobile (Expo)
cd apps/mobile && pnpm dev
```

---

## 📚 API Dokümantasyonu

Backend çalıştırıldığında Swagger dokümantasyonu:
```
http://localhost:3000/api/docs
```

---

## 🔐 Kullanıcı Rolleri ve Yetkiler

### Roller
- **admin**: Tam yetkili sistem yöneticisi
- **manager**: Şube müdürü
- **office_staff**: Ofis operasyon personeli
- **field_staff**: Saha operasyon personeli
- **adjuster**: Bağımsız eksper
- **finance**: Finans personeli

### İzin Modülleri
- Kullanıcı yönetimi
- Rol ve yetki yönetimi
- Sigorta şirketi yönetimi
- Hasar dosyası yönetimi
- Müşteri yönetimi
- Görev yönetimi
- Doküman yönetimi
- Not yönetimi
- Dashboard

---

## 📊 Hasar Dosyası Durum Akışı

```
new → pre_review → adjuster_assigned → site_visit_planned → 
site_visit_done → budget_preparing → budget_submitted → 
budget_revision_requested (opsiyonel döngü) → budget_approved → 
repair_planning → repair_in_progress → repair_completed → 
invoice_pending → invoice_submitted → payment_pending → 
partially_collected (opsiyonel) → closed

Her aşamadan cancelled durumuna geçilebilir.
```

---

## 🎯 Faz 1 Kapsamı (Mevcut)

### Backend
✅ Auth modülü (JWT + refresh token)
✅ Kullanıcı ve RBAC yönetimi
✅ Sigorta şirketi CRUD
✅ Hasar dosyası CRUD + durum makinesi
✅ Müşteri ve adres yönetimi
✅ Görev yönetimi (CRUD + complete)
✅ Not yönetimi
✅ Doküman yönetimi + dosya yükleme (stub presigned URL)
✅ Bildirimler (read/unread)
✅ Dashboard KPI'ları

### Web
✅ Login sayfası
✅ Dashboard (temel metrikler)
✅ Hasar dosya listesi
✅ Temel navigasyon ve layout

### Mobile
✅ Login ekranı
✅ Atanmış dosyalar listesi
✅ Profil ekranı

---

## 🧪 Test ve Kalite

```bash
# Lint
pnpm lint

# Type check
pnpm typecheck

# Test (unit + integration)
pnpm test

# Tüm kalite kontrolleri
pnpm lint && pnpm typecheck && pnpm test
```

---

## 🔧 Prisma Komutları

```bash
cd apps/backend

# Prisma Studio (veritabanı GUI)
pnpm prisma:studio

# Migration oluştur
pnpm prisma:migrate

# Seed verilerini yeniden yükle
pnpm prisma:seed

# Prisma client yenile
pnpm prisma:generate
```

---

## 🐳 Docker Servisleri

```bash
# Başlat
docker-compose up -d

# Durdur
docker-compose down

# Logları görüntüle
docker-compose logs -f

# Servisleri sıfırla (veritabanı dahil)
docker-compose down -v
```

**Servis Portları:**
- PostgreSQL: `5432`
- Redis: `6379`
- MinIO: `9000` (API), `9001` (Console)

**MinIO Erişim:**
- Console: http://localhost:9001
- Kullanıcı: `minioadmin`
- Şifre: `minioadmin`

---

## 📝 Ortam Değişkenleri

`.env.example` dosyasını `.env` olarak kopyalayıp düzenleyin:

### Backend
- `DATABASE_URL`: PostgreSQL bağlantı URL'i
- `REDIS_URL`: Redis bağlantı URL'i
- `JWT_SECRET`: JWT imzalama anahtarı (production'da güçlü bir değer)
- `JWT_ACCESS_EXPIRES_IN`: Access token süresi (örn. `15m`)
- `JWT_REFRESH_EXPIRES_IN`: Refresh token süresi (örn. `7d`)

### Storage
- `S3_ENDPOINT`: S3 uyumlu storage endpoint
- `S3_ACCESS_KEY`: Access key
- `S3_SECRET_KEY`: Secret key
- `S3_BUCKET`: Bucket adı

### Frontend
- `NEXT_PUBLIC_API_URL`: Backend API URL'i (web için)
- `MOBILE_API_URL`: Backend API URL'i (mobile için)

---

## 🚧 Gelecek Fazlar

### Faz 2 (Planlanan)
- Detaylı raporlama ve dashboard genişletmeleri
- WebSocket ile gerçek zamanlı bildirimler
- E-posta ve SMS entegrasyonu
- Gelişmiş arama ve filtreleme
- Toplu işlemler (bulk operations)
- Ekspertiz raporu şablonları
- İmza ve onay akışları

### Faz 3 (Planlanan)
- Muhasebe ve finans modülü entegrasyonu
- Sigorta şirketi API entegrasyonları
- Tedarikçi ve tamirhane yönetimi
- Süreç otomasyonu (workflow engine)
- Analitik ve BI raporları

---

## 🤝 Katkıda Bulunma

1. Feature branch oluşturun
2. Değişiklikleri yapın ve commit edin
3. Branch'i push edin
4. Pull Request açın

---

## 📄 Lisans

Bu proje özel bir firmaya özel geliştirilmiştir.

---

## 📞 Destek

Sorularınız için proje yöneticinize başvurun.
