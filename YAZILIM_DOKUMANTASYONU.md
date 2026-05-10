# Sigorta Hasar Yönetim Sistemi — Yazılım Dokümantasyonu

> **Proje Adı:** Meridyen Assistance — Sigorta Hasar Onarım Yönetim Sistemi  
> **Domain:** app.meridyen-tr.com  
> **Hazırlanma Tarihi:** Mayıs 2026  
> **Tech Stack:** Next.js 14 · NestJS 10 · PostgreSQL 16 · Redis 7 · MinIO · Docker Compose · pnpm Monorepo (Turborepo)

---

## İçindekiler

1. [Genel Mimari](#1-genel-mimari)
2. [Backend — NestJS](#2-backend--nestjs)
3. [Veritabanı — PostgreSQL + Prisma](#3-veritabanı--postgresql--prisma)
4. [Frontend — Next.js](#4-frontend--nextjs)
5. [Altyapı ve Deployment](#5-altyapı-ve-deployment)
6. [Güvenlik](#6-güvenlik)
7. [Önemli Tasarım Kararları](#7-önemli-tasarım-kararları)

---

## 1. Genel Mimari

### 1.1 Sistem Genel Bakış

Sigorta hasar onarım yönetim sistemi, sigorta şirketlerine hizmet veren eksper ve tamir firmalarının tüm iş süreçlerini (hasar dosyası açma, eksper atama, bütçe onayı, onarım takibi, faturalama, tahsilat) dijitalleştiren tam kapsamlı bir SaaS platformdur.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         İnternet / Kullanıcılar                       │
└──────────────────────┬─────────────────────────────┬─────────────────┘
                       │ HTTPS (443)                  │ HTTPS (443)
               ┌───────▼───────────────────────────────▼──────────┐
               │              Nginx Reverse Proxy                   │
               │   rate-limit · SSL/TLS 1.2+1.3 · gzip · headers  │
               └───────┬───────────────────────────────┬──────────┘
                       │ /api/*                        │ /*
               ┌───────▼───────┐               ┌──────▼──────────┐
               │  NestJS API   │               │   Next.js Web   │
               │  Port :3000   │               │   Port :3001    │
               │  (PM2)        │               │  (standalone)   │
               └───────┬───────┘               └─────────────────┘
                       │
          ┌────────────┼────────────┬──────────────┐
          │            │            │              │
   ┌──────▼──────┐ ┌───▼───┐ ┌─────▼──────┐ ┌────▼────┐
   │ PostgreSQL  │ │ Redis │ │   MinIO    │ │  SMTP   │
   │   :5432     │ │ :6379 │ │  :9000     │ │ E-posta │
   └─────────────┘ └───────┘ └────────────┘ └─────────┘
```

### 1.2 Monorepo Yapısı

Proje, **Turborepo + pnpm workspaces** kullanarak tek repo'da yönetilen çoklu uygulama mimarisi (monorepo) üzerine kuruludur.

```
sigorta-hasar-sistemi/
├── apps/
│   ├── backend/                  # NestJS REST API
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # 2900+ satır, 80+ model
│   │   │   ├── seed.ts
│   │   │   └── migrations/       # 50+ migration
│   │   └── src/
│   │       ├── app.module.ts     # Ana modül (70+ modül kayıt)
│   │       ├── main.ts           # Bootstrap (Swagger, Helmet, CORS)
│   │       ├── common/
│   │       │   ├── decorators/   # @CurrentUser, @RequirePermissions, @Public
│   │       │   ├── guards/       # JwtAuthGuard, PermissionsGuard, AgreementGuard, CustomerAccessGuard
│   │       │   ├── interceptors/ # CostMaskingInterceptor, PhoneMaskingInterceptor
│   │       │   ├── helpers/      # field-staff.helper.ts
│   │       │   └── logger/       # winston.logger.ts
│   │       └── modules/          # 70+ domain modülü
│   ├── web/                      # Next.js 14 App Router
│   │   └── src/
│   │       ├── app/              # Sayfa route'ları (95+ page.tsx)
│   │       ├── components/       # Yeniden kullanılabilir bileşenler
│   │       ├── contexts/         # ToastContext, vs.
│   │       └── utils/            # api.ts, emergencyApi.ts, fileDocumentApi.ts...
│   └── mobile/                   # Expo React Native (alan personeli mobil)
│       └── app/
│           ├── (tabs)/
│           ├── adjuster-assignment/
│           ├── adjuster-report/
│           └── repair-report/
├── packages/
│   └── shared/                   # Frontend + Backend ortak tipler
│       └── src/
│           ├── enums.ts          # Tüm enum tanımları
│           ├── types.ts          # TypeScript interface'leri
│           ├── schemas.ts        # Zod doğrulama şemaları
│           └── index.ts
├── nginx/
│   └── nginx.conf                # Production Nginx konfigürasyonu
├── docker-compose.yml            # Geliştirme ortamı
├── docker-compose.prod.yml       # Production ortamı
├── Dockerfile.backend            # 4-aşamalı backend image
├── Dockerfile.web                # 4-aşamalı Next.js image
├── turbo.json                    # Turborepo pipeline tanımları
├── pnpm-workspace.yaml           # pnpm workspace konfigürasyonu
└── tsconfig.base.json            # Paylaşılan TypeScript konfigürasyonu
```

### 1.3 Turborepo Pipeline

```json
// turbo.json (özet)
{
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "typecheck": {},
    "test": {},
    "clean": { "cache": false }
  }
}
```

`turbo run dev` komutu ile tüm uygulamalar (backend, web, shared) paralel başlatılır.

---

## 2. Backend — NestJS

### 2.1 Bootstrap ve Global Konfigürasyon

`apps/backend/src/main.ts` dosyasında uygulama aşağıdaki global yapılandırmalar ile başlatılır:

```typescript
// apps/backend/src/main.ts
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Statik dosya servisi (development: local uploads)
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });

  // Güvenlik başlıkları (helmet)
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // CORS: Sadece WEB_URL'den gelen istekler (credentials dahil)
  app.enableCors({
    origin: process.env.WEB_URL || 'http://localhost:3001',
    credentials: true,
  });

  // Global ValidationPipe: whitelist=true, transform=true
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // API prefix: /api/v1
  app.setGlobalPrefix('api/v1');

  // Swagger: /api/docs
  const config = new DocumentBuilder()
    .setTitle('Sigorta Hasar Yönetim Sistemi API')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.BACKEND_PORT || 3000);
}
```

### 2.2 Modül Listesi

`AppModule` içinde kayıtlı tüm modüller ve sorumlulukları:

| Modül | Sorumluluk |
|-------|-----------|
| **AuthModule** | Giriş, kayıt, token yönetimi (JWT), şifre sıfırlama, reCAPTCHA |
| **UsersModule** | Kullanıcı CRUD, servis bölgeleri, ekran izinleri, push token |
| **RbacModule** | Rol ve izin yönetimi (Role-Based Access Control) |
| **InsuranceCompaniesModule** | Sigorta şirketi yönetimi |
| **ClaimFilesModule** | Hasar dosyası yaşam döngüsü (açma, atama, durum geçişleri, kapatma) |
| **CustomersModule** | Müşteri CRM (bireysel/kurumsal), çakışma kontrolü, Excel export |
| **AddressesModule** | Adres yönetimi |
| **TasksModule** | Görev yönetimi (site ziyareti, belge toplama, vs.) |
| **NotesModule** | Not yönetimi (genel, arama logu, ziyaret raporu, dahili) |
| **DocumentsModule** | Belge kayıt ve yönetimi |
| **UploadsModule** | Dosya yükleme (presigned URL, multipart) |
| **NotificationsModule** | Bildirim yönetimi (in-app, e-posta, SMS, push) |
| **DashboardModule** | Operasyon KPI, kullanıcı performansı, bütçe verimliliği, raporlar |
| **AdjustersModule** | Eksper yönetimi, atama, rapor, randevu, check-in/check-out |
| **BudgetModule** | Bütçe versiyonlama, kalemler, onay akışı |
| **VendorsModule** | Tedarikçi yönetimi, hizmet bölgesi, iş grupları, risk skoru |
| **WorkGroupsModule** | İş grubu tanımları (tadilat, elektrik, boya, vs.) |
| **RepairReportsModule** | Onarım raporu, kalemler, onay geçmişi, dışarı onay |
| **DepartmentsModule** | Departman ve dosya konusu yönetimi |
| **SpeechModule** | Ses → metin dönüşümü (not kayıt) |
| **LocationsModule** | İl/ilçe veri seti (Türkiye lokasyon verileri) |
| **DocumentTypesModule** | Belge tipi tanımları |
| **VendorDocumentsModule** | Tedarikçiye ait belgeler (vergi levhası, sertifika, vs.) |
| **ExternalApprovalsModule** | Dış onay süreçleri (e-posta, WhatsApp üzerinden) |
| **InvoicesModule** | Fatura yönetimi |
| **PaymentsModule** | Ödeme kayıtları |
| **BankAccountsModule** | Banka hesabı yönetimi |
| **LogoIntegrationModule** | Logo Wing ERP entegrasyonu |
| **ExpenseCategoriesModule** | Masraf kategorileri tanımları |
| **UserLocationsModule** | Saha personeli konum takibi |
| **CustomerAccessLogModule** | Müşteri erişim günlüğü ve otomatik süre sonu |
| **SlaModule** | SLA kuralları ve son tarih takibi |
| **SystemSettingsModule** | Sistem geneli ayarlar (anahtar-değer) |
| **EntityDocumentsModule** | Genel varlık belgesi (tedarikçi, müşteri, vs.) |
| **ChatArchiveModule** | WhatsApp sohbet arşivi parse etme ve depolama |
| **ClaimLocationsModule** | Hasar lokasyonları (koordinat tabanlı) |
| **WorkSubGroupsModule** | İş alt grup tanımları |
| **TaxVerificationModule** | Vergi no doğrulama |
| **WidgetsModule** | Dashboard widget verileri (hava durumu, kur, vs.) |
| **StorageModule** | Dosya depolama soyutlama katmanı (local / MinIO S3) |
| **TaskAssignmentsModule** | Otomatik görev atama motoru (kurallar, onay akışı) |
| **RevisionRequestsModule** | Rapor revizyon talep yönetimi |
| **ServiceBranchesModule** | Hizmet branşları tanımları |
| **AnalyticsModule** | Gelişmiş analitik (branş dağılımı, trend, kapanma hızı, karlılık) |
| **HealthModule** | `GET /api/v1/health` sağlık kontrolü (public) |
| **AgreementsModule** | KVKK sözleşme yönetimi ve kullanıcı onayı |
| **VendorStatementsModule** | Tedarikçi hesap ekstresi, itiraz yönetimi, token tabanlı onay |
| **MarketPricesModule** | Piyasa fiyat kataloğu ve anomali tespiti |
| **VendorRiskModule** | Tedarikçi risk puanı ve konsantrasyon analizi |
| **FinanceModule** | P&L yönetimi (ekstra iş, gelir, sabit gider, portföy analizi) |
| **ReportTemplatesModule** | Onarım raporu şablonları |
| **EmergencyModule** | Acil yardım vakası yönetimi ve finansı |
| **VendorContractsModule** | Tedarikçi sözleşme şablonları ve imzalı sözleşmeler |
| **FileDocumentsModule** | Dosya bazlı evrak sistemi (kapanış koşulları, WhatsApp gönderim) |
| **InvoiceRequestsModule** | Fatura talep yönetimi |
| **SurveysModule** | Müşteri memnuniyet anketi yönetimi |
| **ExpensesModule** | Masraf takibi (onay akışlı) |
| **RegionsModule** | Bölgesel fiyat ayarı (fiyat zammı) yönetimi |
| **SearchModule** | Global arama (dosya, müşteri, tedarikçi, eksper) |
| **ServiceTypesModule** | Hizmet tipi tanımları |

### 2.3 Global Guard Zinciri

`AppModule`'de `APP_GUARD` token'ı ile üç guard sırayla kayıtlıdır; her istek bu sırayı geçmek zorundadır:

```
İstek → JwtAuthGuard → PermissionsGuard → AgreementGuard → Controller
```

```typescript
// apps/backend/src/app.module.ts
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: PermissionsGuard },
  { provide: APP_GUARD, useClass: AgreementGuard },
],
```

### 2.4 API Endpoint Listesi

Aşağıda tüm modüllerin expose ettiği endpoint'ler yer almaktadır. Tüm endpoint'ler `/api/v1` prefix'i ile başlar.

#### Auth

| Method | Path | Açıklama | Yetki |
|--------|------|----------|-------|
| POST | `/auth/login` | Kullanıcı girişi (reCAPTCHA opsiyonel) | Public + ThrottlerGuard |
| POST | `/auth/register` | Yeni kullanıcı kaydı | Public + ThrottlerGuard |
| POST | `/auth/refresh` | Access token yenileme | Public |
| POST | `/auth/forgot-password` | Şifre sıfırlama talebi | Public + ThrottlerGuard |
| POST | `/auth/reset-password` | Yeni şifre belirleme | Public |
| POST | `/auth/logout` | Çıkış yap (refresh token iptal) | JWT |
| GET | `/auth/me` | Mevcut kullanıcı bilgisi + izinler | JWT |

#### Hasar Dosyaları

| Method | Path | Açıklama | İzin |
|--------|------|----------|------|
| GET | `/claim-files` | Dosya listesi (filtreleme, sayfalama) | `claim_file.view` |
| GET | `/claim-files/statuses` | Durum listesi | `claim_file.view` |
| GET | `/claim-files/check-file-no` | Dosya no çakışma kontrolü | `claim_file.view` |
| GET | `/claim-files/:id` | Dosya detayı | `claim_file.view` |
| POST | `/claim-files` | Yeni dosya oluştur | `claim_file.create` |
| PATCH | `/claim-files/:id` | Dosya güncelle | `claim_file.update` |
| DELETE | `/claim-files/:id` | Dosya sil | `claim_file.delete` |
| POST | `/claim-files/:id/assign` | Kullanıcı/şube ata | `claim_file.assign` |
| POST | `/claim-files/:id/change-status` | Durum değiştir | `claim_file.status_change` |
| GET | `/claim-files/:id/timeline` | Durum zaman çizelgesi | `claim_file.view` |
| GET | `/claim-files/:id/suggest-responsible` | Sorumlu önerisi (yük dengeleme) | `claim_file.view` |
| POST | `/claim-files/:id/assign-supplier` | Tedarikçi ata | `claim_file.assign` |
| POST | `/claim-files/:id/appointments` | Randevu oluştur | `claim_file.update` |
| GET | `/claim-files/:id/appointments` | Randevuları getir | `claim_file.view` |
| GET | `/claim-files/:id/activity-log` | Hareket geçmişi | `claim_file.view` |
| POST | `/claim-files/:id/inspection` | Tespit notu ekle | `claim_file.update` |
| POST | `/claim-files/:id/cost-report` | Maliyet raporu gönder | `claim_file.update` |
| GET | `/claim-files/:id/vendors/nearby` | Yakındaki tedarikçiler | `claim_file.view` |
| GET | `/claim-files/:id/invoices` | Dosya faturaları | `invoice.view` |
| GET | `/claim-files/:id/financial-summary` | Finansal özet | `invoice.view` |
| POST | `/claim-files/:id/extra-works` | Ekstra iş ekle | JWT |
| GET | `/claim-files/:id/extra-works` | Ekstra işleri listele | JWT |
| PATCH | `/claim-files/:id/extra-works/:wid` | Ekstra iş güncelle | JWT |
| DELETE | `/claim-files/:id/extra-works/:wid` | Ekstra iş sil | JWT |
| GET | `/claim-files/:id/extra-works/:wid/pl` | Mini P&L özeti | JWT |
| POST | `/claim-files/:id/revenues` | Gelir ekle | JWT |
| GET | `/claim-files/:id/revenues` | Gelirleri listele | JWT |
| PATCH | `/claim-files/:id/revenues/:rid/collect` | Tahsilat güncelle | JWT |
| DELETE | `/claim-files/:id/revenues/:rid` | Gelir sil | JWT |

#### Müşteriler

| Method | Path | Açıklama | İzin |
|--------|------|----------|------|
| GET | `/customers` | Müşteri listesi | `customer.view` |
| GET | `/customers/check-duplicate` | Çakışma kontrolü (TC/telefon/e-posta) | `customer.view` |
| GET | `/customers/overdue-count` | Takip tarihi geçmiş müşteri sayısı | `customer.view` |
| GET | `/customers/overdue-widget` | Dashboard widget için son 3 gecikmeli müşteri | `customer.view` |
| GET | `/customers/my-customers` | Saha personeline atanmış müşteriler | `customer.view` |
| GET | `/customers/:id` | Müşteri detayı | `customer.view` |
| POST | `/customers/:id/initiate-call` | Click-to-call | `customer.view` |
| POST | `/customers` | Yeni müşteri | `customer.create` |
| PATCH | `/customers/:id` | Güncelle | `customer.update` |
| DELETE | `/customers/:id` | Sil | `customer.delete` |
| PATCH | `/customers/bulk-status` | Toplu durum değiştir | `customer.update` |
| PATCH | `/customers/bulk-tags` | Toplu etiket ata | `customer.update` |
| POST | `/customers/export` | Excel export | `customer.view` |

#### Kullanıcılar

| Method | Path | Açıklama | İzin |
|--------|------|----------|------|
| GET | `/users` | Kullanıcı listesi | `user.view` |
| GET | `/users/:id` | Kullanıcı detayı | `user.view` |
| POST | `/users` | Yeni kullanıcı | `user.create` |
| PATCH | `/users/:id` | Güncelle | `user.update` |
| PUT | `/users/:id` | Güncelle (PUT) | `user.update` |
| DELETE | `/users/:id` | Sil | `user.delete` |
| POST | `/users/me/expo-push-token` | Expo push token kaydet | JWT |
| GET | `/users/:id/service-areas` | Hizmet bölgeleri | `user.view` |
| PATCH | `/users/:id/service-areas` | Hizmet bölgelerini güncelle | `user.update` |
| GET | `/users/me/permissions` | Ekran izinlerimi getir | JWT |
| GET | `/users/:id/screen-permissions` | Kullanıcı ekran izin matrisi | `user.view` |
| PUT | `/users/:id/screen-permissions` | Ekran izinlerini güncelle | `user.update` |

#### Tedarikçiler

| Method | Path | Açıklama | İzin |
|--------|------|----------|------|
| GET | `/vendors` | Tedarikçi listesi | `vendor.view` |
| GET | `/vendors/contract-expiring` | Sözleşmesi bitiyor | `vendor.view` |
| GET | `/vendors/check-duplicate` | Çakışma kontrolü | `vendor.view` |
| GET | `/vendors/suggest` | Akıllı tedarikçi önerisi | `vendor.view` |
| GET | `/vendors/:id` | Detay | `vendor.view` |
| GET | `/vendors/:id/stats` | İstatistikler | `vendor.view` |
| POST | `/vendors` | Yeni tedarikçi | `vendor.create` |
| PATCH | `/vendors/:id` | Güncelle | `vendor.update` |
| PATCH | `/vendors/:id/service-areas` | Hizmet bölgelerini güncelle | `vendor.update` |
| PATCH | `/vendors/:id/work-groups` | İş gruplarını güncelle | `vendor.update` |
| DELETE | `/vendors/:id` | Sil | `vendor.delete` |
| PATCH | `/vendors/bulk-status` | Toplu durum değiştir | `vendor.update` |
| POST | `/vendors/export` | Excel export | `vendor.view` |

#### Eksperler

| Method | Path | Açıklama | İzin |
|--------|------|----------|------|
| GET | `/adjusters` | Eksper listesi | `adjuster.view` |
| GET | `/adjusters/performance` | Tüm eksper performans metrikleri | `adjuster.view` |
| GET | `/adjusters/calendar` | Randevu takvimi | `adjuster.view` |
| GET | `/adjusters/suggest` | Bölge/branş bazlı öneri | `adjuster.view` |
| GET | `/adjusters/:id` | Eksper detayı | `adjuster.view` |
| GET | `/adjusters/:id/performance` | Performans metrikleri | `adjuster.view` |
| POST | `/adjusters` | Yeni eksper | `adjuster.create` |
| PATCH | `/adjusters/:id` | Güncelle | `adjuster.update` |
| DELETE | `/adjusters/:id` | Sil | `adjuster.delete` |
| POST | `/adjusters/assignments` | Eksper ataması oluştur | `adjuster.assign` |
| PATCH | `/adjusters/assignments/:id/respond` | Atamayı kabul/reddet | `adjuster.assign` |
| GET | `/adjusters/assignments/claim/:claimFileId` | Dosya atamaları | `adjuster.view` |
| POST | `/adjusters/assignments/:id/report` | Eksper raporu oluştur | `adjuster.report.create` |
| PATCH | `/adjusters/reports/:id/review` | Raporu onayla/reddet | `adjuster.report.review` |
| POST | `/adjusters/appointments` | Randevu oluştur | `adjuster.view` |
| PATCH | `/adjusters/appointments/:id/status` | Randevu durumu güncelle | `adjuster.view` |
| GET | `/adjusters/appointments/claim/:claimFileId` | Dosya randevuları | `adjuster.view` |
| GET | `/adjusters/appointments` | Randevu listesi | `adjuster.view` |
| POST | `/adjusters/appointments/:id/send-notification` | SMS/WhatsApp bildirim | `adjuster.view` |
| POST | `/adjusters/appointments/:id/check-in` | Varış kaydı (koordinat) | JWT |
| POST | `/adjusters/appointments/:id/check-out` | Çıkış kaydı | JWT |

#### Dashboard ve Raporlar

| Method | Path | Açıklama | İzin |
|--------|------|----------|------|
| GET | `/dashboard/operations` | Operasyon KPI verileri | `dashboard.view` |
| GET | `/dashboard/user-performance` | Sorumlu bazlı performans | `dashboard.view` |
| GET | `/dashboard/budget-efficiency` | Bütçe verimliliği | `dashboard.view` |
| GET | `/dashboard/adjuster-performance` | Eksper performans dashboard | `dashboard.view` |
| GET | `/dashboard/finance` | Finans dashboard | `dashboard.view` |
| GET | `/dashboard/my-performance` | Kişisel performans ve risk | `dashboard.view` |
| GET | `/reports/profitability` | Kârlılık raporu | `report.view` |
| GET | `/reports/collections` | Tahsilat raporu | `report.view` |
| GET | `/reports/file-performance` | Dosya performans raporu | `report.view` |
| GET | `/reports/staff-performance` | Personel performans raporu | `report.view` |
| GET | `/reports/financial-extended` | Genişletilmiş finansal rapor | `report.view` |
| GET | `/reports/adjuster-extended` | Genişletilmiş eksper raporu | `report.view` |
| GET | `/reports/:reportType/export` | Excel/PDF export | `report.view` |

#### Analitik

| Method | Path | Açıklama | İzin |
|--------|------|----------|------|
| GET | `/analytics/branch-distribution` | Branş bazlı dağılım | `dashboard.view` |
| GET | `/analytics/branch-trend` | Aylık branş trendi | `dashboard.view` |
| GET | `/analytics/customer-performance` | Müşteri bazlı performans | `report.view` |
| GET | `/analytics/branch-alerts` | Branş uyarıları | `dashboard.view` |
| GET | `/analytics/staff-performance` | Personel performans (son 30 gün) | `dashboard.view` |
| GET | `/analytics/closure-speed` | Dosya kapama hızı ve SLA uyumu | `dashboard.view` |
| GET | `/analytics/profitability` | Karlılık metrikleri | `dashboard.view` |

#### Finans

| Method | Path | Açıklama | İzin |
|--------|------|----------|------|
| GET | `/invoices` | Fatura listesi | `invoice.view` |
| GET | `/invoices/:id` | Fatura detayı | `invoice.view` |
| POST | `/invoices` | Yeni fatura | `invoice.create` |
| PATCH | `/invoices/:id` | Güncelle | `invoice.update` |
| PATCH | `/invoices/:id/status` | Durum güncelle | `invoice.update` |
| DELETE | `/invoices/:id` | Sil | `invoice.delete` |
| GET | `/finance/overhead/entries` | Sabit gider kayıtları | JWT |
| POST | `/finance/overhead/entries` | Sabit gider ekle | JWT |
| GET | `/finance/overhead/entries/totals` | Aylık toplam sabit gider | JWT |
| POST | `/finance/overhead/allocate` | Sabit giderleri dosyalara dağıt | JWT |
| GET | `/finance/analytics/portfolio-pl` | Portföy P&L özeti | JWT |
| GET | `/finance/analytics/profitability-ranking` | En karlı dosyalar sıralaması | JWT |
| POST | `/finance/analytics/recalculate/:claimFileId` | Dosya P&L yeniden hesapla | JWT |

#### Görevler

| Method | Path | Açıklama | İzin |
|--------|------|----------|------|
| GET | `/tasks` | Görev listesi | `task.view` |
| GET | `/tasks/:id` | Görev detayı | `task.view` |
| POST | `/tasks` | Yeni görev | `task.create` |
| PATCH | `/tasks/:id` | Güncelle | `task.update` |
| DELETE | `/tasks/:id` | Sil | `task.delete` |
| POST | `/tasks/:id/complete` | Tamamla | `task.complete` |

#### Bildirimler

| Method | Path | Açıklama | İzin |
|--------|------|----------|------|
| GET | `/notifications` | Bildirim listesi | JWT |
| GET | `/notifications/unread-count` | Okunmamış sayısı | JWT |
| GET | `/notifications/birthdays-today` | Bugün doğum günü olanlar | JWT |
| PATCH | `/notifications/:id/read` | Okundu işaretle | JWT |
| PATCH | `/notifications/read-all` | Tümünü okundu işaretle | JWT |

#### Diğer Önemli Endpoint'ler

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/health` | Sağlık kontrolü (Public) |
| GET | `/locations/provinces` | İller listesi |
| GET | `/locations/districts` | İlçeler listesi |
| POST | `/uploads/presigned-url` | Dosya yükleme URL'i |
| POST | `/uploads/complete` | Yükleme tamamlama kaydı |
| GET | `/search` | Global arama |
| GET | `/widgets/weather` | Hava durumu widget |
| GET | `/widgets/exchange-rates` | Döviz kuru widget |

### 2.5 Interceptor'lar (Veri Maskeleme)

#### CostMaskingInterceptor

Saha personeli (`field_staff` rolü) için maliyet alanlarını yanıtlardan otomatik olarak kaldırır:

```typescript
// apps/backend/src/common/interceptors/cost-masking.interceptor.ts
const CLAIM_FILE_COST_FIELDS = [
  'initialReserveAmount', 'estimatedCostAmount', 'approvedBudgetAmount',
  'actualCostAmount', 'invoicedAmount', 'collectedAmount',
  'profitMargin', 'totalCost', 'price', 'priceAmount',
];

const REPAIR_ITEM_COST_FIELDS = ['unitPrice', 'totalAmount', 'laborCost', 'materialCost'];
```

#### PhoneMaskingInterceptor

Saha personeli için telefon numaralarını maskeler (ilk 4 + son 4 hane gösterilir):

```typescript
// apps/backend/src/common/helpers/field-staff.helper.ts
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(0, 4) + '***' + digits.slice(-4);
  // Örnek: "0555***4567"
}
```

Maskeleme, yanıt nesnesi içinde `phone`, `contactPhone`, `siteContactPhone` gibi alanları recursive olarak tarar.

---

## 3. Veritabanı — PostgreSQL + Prisma

### 3.1 Prisma Konfigürasyonu

```prisma
// apps/backend/prisma/schema.prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x", "linux-musl"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

`binaryTargets` ayarı, hem yerel geliştirme (native) hem Docker Alpine (linux-musl) ortamında çalışmayı sağlar.

### 3.2 Temel Tablolar / Modeller

#### Kimlik Doğrulama ve Yetkilendirme

| Tablo | Açıklama | Önemli Alanlar |
|-------|----------|----------------|
| `insurance_companies` | Sigorta şirketi bilgileri | `code`, `name`, `taxNumber`, `status` |
| `branches` | Şube/ofis bilgileri | `name`, `city`, `region`, `managerUserId` |
| `roles` | Kullanıcı rolleri | `code` (UNIQUE), `name` |
| `permissions` | Sistem izinleri | `code` (UNIQUE), `module`, `action` |
| `role_permissions` | Rol-izin eşleşmesi (N:N) | `roleId`, `permissionId` |
| `users` | Sistem kullanıcıları | `email`, `passwordHash`, `roleId`, `branchId`, `status`, `isMobileUser`, `isWebUser` |
| `user_insurance_company_scopes` | Kullanıcı bazlı sigorta şirketi kısıtı | `userId`, `insuranceCompanyId` |
| `refresh_tokens` | JWT refresh token | `token`, `expiresAt`, `revokedAt` |
| `password_reset_tokens` | Şifre sıfırlama token | `token`, `expiresAt`, `usedAt` |

#### Hasar Dosyası (Core)

| Tablo | Açıklama | Önemli Alanlar |
|-------|----------|----------------|
| `claim_files` | Hasar dosyası ana tablosu | `fileNo` (UNIQUE), `insuranceCompanyId`, `policyNo`, `claimNo`, `productBranch`, `lossType`, `incidentDate`, `currentStatusId`, `priority`, `assignedFieldUserId`, `assignedOfficeUserId`, `assignedSupplierId`, `slaDueAt`, `closedAt` |
| `claim_statuses` | Hasar dosyası durum tanımları | `code`, `name`, `order`, `color` |
| `claim_status_history` | Durum değişim geçmişi | `claimFileId`, `fromStatusId`, `toStatusId`, `changedByUserId`, `note` |
| `customers` | Müşteri bilgileri | `customerType` (individual/corporate), `firstName`, `lastName`, `phone`, `email`, `tcNo` |
| `customer_contacts` | Müşteriye ait ek iletişim | `customerId`, `name`, `phone`, `role` |
| `addresses` | Adres bilgileri | `street`, `city`, `district`, `postalCode`, `latitude`, `longitude` |
| `claim_risk_locations` | Hasar risk konumları | `claimFileId`, `propertyType`, `address`, `coordinates` |

#### Görev ve Not Yönetimi

| Tablo | Açıklama |
|-------|----------|
| `tasks` | Görevler (site ziyareti, belge toplama, bütçe hazırlama, vs.) |
| `task_checklists` | Görev kontrol listesi kalemleri |
| `notes` | Notlar (genel, arama logu, ziyaret raporu, dahili) |
| `file_assets` | Yüklenen dosya metadata'sı (MinIO veya local) |
| `claim_documents` | Hasar belgesi (fatura, rapor, fotoğraf, vs.) |
| `audit_logs` | Değişiklik denetim logu |
| `notifications` | Bildirim kayıtları |

#### Eksper Yönetimi

| Tablo | Açıklama |
|-------|----------|
| `adjusters` | Eksper profili (uzmanlık, bölge, lisans) |
| `adjuster_assignments` | Eksper atama kaydı (durum: PENDING/ACCEPTED/REJECTED/COMPLETED) |
| `adjuster_reports` | Eksper raporları |
| `appointments` | Randevular (eksper ziyareti, müşteri toplantısı, inceleme) |

#### Tedarikçi Yönetimi

| Tablo | Açıklama |
|-------|----------|
| `vendors` | Tedarikçi firması bilgileri |
| `vendor_service_areas` | Tedarikçinin hizmet verdiği il/ilçeler |
| `user_service_areas` | Saha personelinin sorumlu olduğu il/ilçeler |
| `vendor_work_groups` | Tedarikçi-iş grubu eşleşmesi |
| `work_groups` | İş grupları (tadilat, elektrik, boya, vs.) |
| `work_sub_groups` | İş alt grupları |

#### Bütçe ve Onarım

| Tablo | Açıklama |
|-------|----------|
| `budget_versions` | Bütçe sürümleri (DRAFT/SUBMITTED/REVISION/APPROVED/REJECTED) |
| `budget_items` | Bütçe kalemleri (işçilik, malzeme, alt yüklenici, vs.) |
| `cost_entries` | Maliyet girişleri |
| `repair_reports` | Onarım raporları |
| `repair_report_items` | Onarım raporu kalemleri (iş grubu, miktar, birim fiyat) |
| `report_images` | Rapor görselleri |
| `report_approval_history` | Onay/ret geçmişi |
| `external_approvals` | Dış paydaş onay süreci (e-posta/WhatsApp token) |

#### Finans (Faz 3 P&L)

| Tablo | Açıklama |
|-------|----------|
| `bank_accounts` | Banka hesapları |
| `invoices` | Faturalar |
| `payments` | Ödeme kayıtları |
| `claim_financial_summaries` | Dosya bazlı finansal özet (otomatik güncellenen) |
| `extra_work_items` | Ekstra iş kalemleri |
| `claim_file_revenues` | Dosya gelirleri |
| `monthly_overhead_entries` | Aylık sabit gider kayıtları |
| `overhead_allocations` | Sabit giderlerin dosyalara dağılımı |

#### Tedarikçi Hakediş ve Risk

| Tablo | Açıklama |
|-------|----------|
| `vendor_payment_statements` | Tedarikçi hesap ekstresi |
| `vendor_statement_items` | Ekstre kalemleri |
| `vendor_statement_receipts` | Makbuz/dekont yüklemeleri |
| `vendor_statement_disputes` | İtiraz kayıtları |
| `vendor_statement_tokens` | Tokenlar (link üzerinden onay) |
| `vendor_risk_scores` | Tedarikçi güncel risk puanı |
| `vendor_risk_score_histories` | Risk puanı geçmişi |
| `market_price_catalog` | Piyasa fiyat kataloğu |
| `repair_item_anomaly_flags` | Anormal fiyat tespiti işaretleri |

#### Müşteri Takip ve Erişim

| Tablo | Açıklama |
|-------|----------|
| `customer_access_logs` | Saha personelinin müşteri görüntüleme logu |
| `user_locations` | Saha personeli GPS konum geçmişi |
| `chat_archives` | WhatsApp sohbet arşivi |

#### KVKK ve Sözleşme

| Tablo | Açıklama |
|-------|----------|
| `agreements` | KVKK ve kullanım sözleşmeleri |
| `agreement_acceptances` | Kullanıcı onayları |
| `vendor_contract_templates` | Tedarikçi sözleşme şablonları |
| `vendor_contracts` | İmzalanmış tedarikçi sözleşmeleri |

#### Logo ERP Entegrasyonu

| Tablo | Açıklama |
|-------|----------|
| `integration_configs` | ERP bağlantı ayarları |
| `integration_logs` | ERP entegrasyon logları |
| `integration_entity_maps` | Yerel varlık ↔ ERP cari eşleşmesi |

#### Diğer

| Tablo | Açıklama |
|-------|----------|
| `sla_rules` | SLA süre kuralları (branş/öncelik bazlı) |
| `system_settings` | Anahtar-değer sistem ayarları |
| `departments` | Departmanlar |
| `department_file_subjects` | Departman bazlı dosya konuları |
| `report_field_configs` | Rapor alan konfigürasyonları (zorunluluk ayarları) |
| `document_types` | Belge tipi tanımları |
| `screen_permissions` | Kullanıcı bazlı ekran izinleri (override) |
| `emergency_cases` | Acil yardım vakaları |
| `emergency_cost_entries` | Acil yardım maliyet kalemleri |
| `emergency_invoice_drafts` | Acil yardım fatura taslakları |
| `file_documents` | Dosya evrak sistemi (kapanış koşulları) |
| `invoice_requests` | Fatura talepleri |
| `survey_campaigns` | Anket kampanyaları |
| `survey_responses` | Anket yanıtları |
| `expenses` | Masraf takibi |
| `expense_categories` | Masraf kategorileri |
| `regions` | Coğrafi bölge tanımları |
| `regional_price_adjustments` | Bölgesel fiyat zammı kuralları |
| `price_list_versions` | Fiyat listesi sürümleri |
| `task_assignments` | Otomatik görev atama |
| `assignment_rules` | Atama kuralları |
| `report_revision_requests` | Rapor revizyon talepleri |
| `revision_messages` | Revizyon süreci mesajlaşma |
| `service_branches` | Hizmet branşları |
| `service_types` | Hizmet tipleri |
| `file_activity_logs` | Dosya hareket logu (ofis-saha iş akışı) |
| `file_appointments` | Dosya bazlı saha randevuları |

### 3.3 Temel İlişkiler

```
InsuranceCompany 1──* ClaimFile
ClaimFile *──1 ClaimStatus (currentStatus)
ClaimFile 1──* ClaimStatusHistory
ClaimFile *──1 Customer
ClaimFile *──* Vendor (assignedSupplier)
ClaimFile 1──* AdjusterAssignment *──1 Adjuster
ClaimFile 1──* BudgetVersion 1──* BudgetItem
ClaimFile 1──* RepairReport 1──* RepairReportItem
ClaimFile 1──* Invoice 1──* Payment
ClaimFile 1──1 ClaimFinancialSummary
ClaimFile 1──* VendorStatementItem
Role *──* Permission (via RolePermission)
User *──1 Role
User *──1 Branch
User 1──1 Adjuster (opsiyonel)
Vendor *──* WorkGroup (via VendorWorkGroup)
Vendor *──* Province/District (via VendorServiceArea)
```

### 3.4 Önemli Enum Tanımları

```typescript
// packages/shared/src/enums.ts

// Hasar Dosyası Durumları (17 adım)
enum ClaimStatus {
  NEW = 'new',
  PRE_REVIEW = 'pre_review',
  ADJUSTER_ASSIGNED = 'adjuster_assigned',
  SITE_VISIT_PLANNED = 'site_visit_planned',
  SITE_VISIT_DONE = 'site_visit_done',
  BUDGET_PREPARING = 'budget_preparing',
  BUDGET_SUBMITTED = 'budget_submitted',
  BUDGET_REVISION_REQUESTED = 'budget_revision_requested',
  BUDGET_APPROVED = 'budget_approved',
  REPAIR_PLANNING = 'repair_planning',
  REPAIR_IN_PROGRESS = 'repair_in_progress',
  REPAIR_COMPLETED = 'repair_completed',
  INVOICE_PENDING = 'invoice_pending',
  INVOICE_SUBMITTED = 'invoice_submitted',
  PAYMENT_PENDING = 'payment_pending',
  PARTIALLY_COLLECTED = 'partially_collected',
  CLOSED = 'closed',
}

// Onarım Raporu Durumları
enum RepairReportStatus {
  DRAFT, SUBMITTED, PENDING_APPROVAL, APPROVED, REJECTED,
  SENT_FOR_EXTERNAL_APPROVAL, EXTERNALLY_APPROVED, EXTERNALLY_REJECTED,
}

// Kullanıcı Rolleri
enum UserRole {
  ADMIN = 'admin', MANAGER = 'manager',
  OFFICE_STAFF = 'office_staff', FIELD_STAFF = 'field_staff',
  ADJUSTER = 'adjuster', FINANCE = 'finance',
}
```

### 3.5 Migration Stratejisi

- Prisma Migrate kullanılır: `prisma migrate dev` geliştirme, `prisma migrate deploy` production.
- 50+ migration ile incremental schema evrimi izlenir.
- `prisma db seed` ile başlangıç verileri (roller, izinler, Türkiye il/ilçe verileri) oluşturulur.
- Production deployment'ta `prisma generate` + `prisma migrate deploy` Dockerfile içinde çalıştırılır.

---

## 4. Frontend — Next.js

### 4.1 Teknoloji

- **Next.js 14 App Router** (Sunucu ve İstemci bileşenleri)
- **TypeScript** (strict mode)
- **Tailwind CSS** (utility-first CSS)
- **Recharts** (AreaChart, BarChart, PieChart, RadarChart)
- **Axios** (HTTP istekleri)
- **React Context** (Toast bildirimleri)
- **`pnpm`** paket yöneticisi

### 4.2 Sayfa Yapısı (Route Listesi)

#### Genel Sayfalar (Kimlik doğrulama gerektirmeyen)

| Route | Açıklama |
|-------|----------|
| `/` | Yönlendirme (token varsa → `/panel`, yoksa → `/giris`) |
| `/giris` | Giriş sayfası (marketing panel + login form + reCAPTCHA) |
| `/giris/sifre-sifirla` | Şifre sıfırlama sayfası |
| `/onay/[token]` | Dış onay token sayfası (onarım raporu onayı) |
| `/evrak/[token]` | Belge görüntüleme (token ile — müşteri/dış erişim) |
| `/ekstre/[token]` | Tedarikçi ekstre görüntüleme |
| `/sozlesme/[token]` | KVKK sözleşme görüntüleme ve imzalama |
| `/anket/[token]` | Müşteri memnuniyet anketi |

#### Panel Sayfaları (`/panel/...`)

| Route | Açıklama | Roller |
|-------|----------|--------|
| `/panel` | Ana dashboard (KPI, grafikler, hava durumu, kur) | Tümü |
| `/panel/hasar-dosyalari` | Hasar dosyaları listesi | admin, office_staff, field_staff, FINANS, MANAGER |
| `/panel/hasar-dosyalari/yeni` | Yeni dosya oluştur | admin, office_staff |
| `/panel/hasar-dosyalari/[id]` | Dosya detay (sekme: genel, görevler, notlar, belgeler, finans...) | admin, office_staff, field_staff, FINANS |
| `/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]` | Onarım raporu detayı | admin, office_staff |
| `/panel/musteriler` | Müşteri listesi | admin, office_staff, FINANS, MANAGER |
| `/panel/musteriler/[id]` | Müşteri detayı | admin, office_staff, FINANS |
| `/panel/tedarikciler` | Tedarikçi listesi | admin, office_staff, FINANS, MANAGER |
| `/panel/tedarikciler/[id]` | Tedarikçi detayı | admin, office_staff, FINANS |
| `/panel/eksperler` | Eksper listesi | admin, office_staff, FINANS, MANAGER |
| `/panel/eksperler/[id]` | Eksper detayı | admin, office_staff |
| `/panel/kullanicilar` | Kullanıcı yönetimi | admin |
| `/panel/kullanicilar/[id]` | Kullanıcı detayı | admin |
| `/panel/personel-yonetimi` | Personel yönetimi | admin, office_staff, MANAGER |
| `/panel/revizyon-talepleri` | Revizyon talebi listesi | admin, office_staff, FINANS, MANAGER |
| `/panel/revizyon-talepleri/[id]` | Revizyon talebi detayı | admin, office_staff |
| `/panel/acil-yardim` | Acil yardım vaka listesi | admin, office_staff, MANAGER |
| `/panel/acil-yardim/yeni` | Yeni acil yardım vakası | admin, office_staff |
| `/panel/acil-yardim/[id]` | Vaka detayı | admin, office_staff |
| `/panel/acil-yardim/finans` | Acil yardım finansı | admin, office_staff |
| `/panel/acil-yardim/finans/faturalar` | Acil yardım faturaları | admin, office_staff |
| `/panel/finans` | Finans ana sayfa | admin, FINANS, MANAGER |
| `/panel/finans/faturalar` | Fatura yönetimi | admin, FINANS |
| `/panel/finans/tahsilatlar` | Tahsilat yönetimi | admin, FINANS |
| `/panel/finans/fatura-talepleri` | Fatura talepleri | admin, FINANS |
| `/panel/finans/dosya-pl` | Dosya P&L analizi | admin, FINANS |
| `/panel/finans/portfolyo-pl` | Portföy P&L | admin, FINANS |
| `/panel/finans/sabit-giderler` | Sabit gider yönetimi | admin, FINANS |
| `/panel/finans/karlilik` | Karlılık analizi | admin, FINANS |
| `/panel/finans/banka-hesaplari` | Banka hesapları | admin, FINANS |
| `/panel/finans/masraflar` | Masraf takibi | admin, FINANS |
| `/panel/raporlar/brans-analizi` | Branş dağılım analizi | admin, FINANS, MANAGER |
| `/panel/raporlar/dosya-performansi` | Dosya performans raporu | admin, FINANS, MANAGER |
| `/panel/raporlar/personel-performansi` | Personel performans raporu | admin, FINANS, MANAGER |
| `/panel/raporlar/finansal` | Finansal rapor | admin, FINANS |
| `/panel/raporlar/eksper` | Eksper performans raporu | admin, FINANS, MANAGER |
| `/panel/raporlar/sla` | SLA uyum raporu | admin, MANAGER |
| `/panel/harita` | Harita görünümü (saha personel takibi) | admin, office_staff, MANAGER |
| `/panel/operasyon` | Operasyon dashboard | admin, office_staff, FINANS, MANAGER |
| `/panel/carilerim` | Saha personeli: kendi müşterileri | field_staff, admin, FINANS, office_staff |
| `/panel/eksper-portal` | Eksper portal ana sayfa | admin, office_staff |
| `/panel/eksper-portal/dosyalar` | Eksper portal dosyaları | admin, office_staff |
| `/panel/eksper-portal/onaylar` | Eksper onayları | admin, office_staff |
| `/panel/eksper-portal/randevular` | Eksper randevuları | admin, office_staff |
| `/panel/sigorta-portal` | Sigorta portal | admin, office_staff |
| `/panel/sigorta-portal/dosyalar` | Sigorta portal dosyaları | admin, office_staff |
| `/panel/sigorta-portal/onaylar` | Sigorta onayları | admin, office_staff |
| `/panel/sigorta-portal/faturalar` | Sigorta faturaları | admin, office_staff |
| `/panel/ayarlar/sigorta-sirketleri` | Sigorta şirketi yönetimi | admin |
| `/panel/ayarlar/roller` | Rol yönetimi | admin |
| `/panel/ayarlar/departmanlar` | Departman yönetimi | admin |
| `/panel/ayarlar/is-gruplari` | İş grubu tanımları | admin |
| `/panel/ayarlar/fiyat-listesi` | Fiyat listesi yönetimi | admin |
| `/panel/ayarlar/fiyat-yonetimi` | Fiyat yönetimi | admin |
| `/panel/ayarlar/bolgesel-zamlar` | Bölgesel fiyat zammı | admin |
| `/panel/ayarlar/sozlesmeler` | KVKK sözleşme yönetimi | admin |
| `/panel/ayarlar/entegrasyonlar` | Logo ERP entegrasyon ayarları | admin |
| `/panel/ayarlar/mail-kurulum` | E-posta SMTP ayarları | admin |
| `/panel/ayarlar/kurulum` | Sistem genel ayarlar | admin |
| `/panel/guvenlik/erisim-loglari` | Güvenlik erişim logları | admin |
| `/panel/profil` | Kullanıcı profili | Tümü |

### 4.3 Rol Bazlı Erişim Kontrolü (Frontend)

Panel layout'u (`apps/web/src/app/panel/layout.tsx`) üç katmanlı erişim kontrolü uygular:

**Katman 1 — `ROUTE_ACCESS` Dizi Tabanlı Kontrol:**

```typescript
// apps/web/src/app/panel/layout.tsx
const ROUTE_ACCESS: RouteAccess[] = [
  { path: '/panel/hasar-dosyalari', roles: ['admin','ADMIN','office_staff','OFFICE_STAFF','field_staff','FIELD_STAFF','FINANS','MANAGER'] },
  { path: '/panel/finans',          roles: ['admin','ADMIN','accountant','ACCOUNTANT','FINANS','MANAGER'] },
  { path: '/panel/ayarlar',         roles: ['admin','ADMIN'] },
  // ...
];

function hasRouteAccess(pathname: string, roleCode: string): boolean {
  // En uzun eşleşen kuralı bul (daha spesifik alt path'ler öncelikli)
  const matching = ROUTE_ACCESS
    .filter((r) => pathname === r.path || pathname.startsWith(r.path + '/'))
    .sort((a, b) => b.path.length - a.path.length);
  if (matching.length === 0) return true;
  const rule = matching[0];
  if (rule.roles.length === 0) return true;
  return rule.roles.includes(roleCode);
}
```

**Katman 2 — `NAV_ITEM_ACCESS` ile Navigasyon Menüsü Filtreleme:**

Navigasyon menüsündeki öğeler, kullanıcı rolüne göre `canSeeNavItem()` fonksiyonu ile filtrelenerek gösterilir.

**Katman 3 — `SCREEN_TO_PATH` ile Veritabanı İzin Sistemi:**

Yöneticiler, kullanıcıya özel ekran izinleri tanımlayabilir. Bu izinler `screen_permissions` tablosunda tutulur ve frontend'de `allowedScreens` dizisi olarak yüklenir. Veritabanı izinleri rol tabanlı izinlerin önündedir.

```typescript
// Ekran kodu → path eşlemesi
const SCREEN_TO_PATH: Record<string, string> = {
  hasar_dosyalari:   '/panel/hasar-dosyalari',
  acil_yardim:       '/panel/acil-yardim',
  finans:            '/panel/finans',
  // ...
};
```

### 4.4 API Çağrı Yapısı

```typescript
// apps/web/src/utils/api.ts
const _base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
export const API = _base.endsWith('/api/v1') ? _base : `${_base}/api/v1`;

export function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
}

export function authHeader() {
  return { Authorization: `Bearer ${getToken()}` };
}
```

Token `localStorage`'de tutulur. Her API isteğine `Authorization: Bearer <token>` başlığı eklenir.

**Özelleştirilmiş API dosyaları:**

| Dosya | Kapsam |
|-------|--------|
| `utils/api.ts` | Temel API URL ve auth header |
| `utils/emergencyApi.ts` | Acil yardım vakası ve finans CRUD |
| `utils/fileDocumentApi.ts` | Dosya evrak sistemi (kapanış koşulları, WhatsApp gönderimi) |
| `utils/surveyApi.ts` | Anket kampanyası yönetimi |
| `utils/invoiceRequestApi.ts` | Fatura talep yönetimi |

### 4.5 Oturum Yönetimi

- `SessionTimeoutBar` bileşeni, süre dolmadan önce kullanıcıya uyarı gösterir.
- Access token 15 dakika, refresh token 7 gün geçerlidir.
- Token yenileme işlemi frontend'de otomatik olarak yapılır (refresh endpoint üzerinden).

### 4.6 State Yönetimi

Global state için React Context kullanılır:
- **ToastContext** — Toast bildirim gösterimi
- Diğer state'ler bileşen bazında `useState`/`useReducer` ile yönetilir.
- Sunucu taraflı state (SSR cache) yoktur; tüm veri istemci tarafında `useEffect` + `fetch/axios` ile alınır.

---

## 5. Altyapı ve Deployment

### 5.1 Geliştirme Ortamı (docker-compose.yml)

```yaml
# docker-compose.yml — Sadece altyapı servisleri (backend + web lokal çalışır)
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: sigorta_hasar
    volumes: [postgres_data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: [redis_data:/data]

  minio:
    image: minio/minio:latest
    ports: ["9000:9000", "9001:9001"]
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
```

### 5.2 Production Ortamı (docker-compose.prod.yml)

7 servisten oluşur ve `sigorta-net` bridge network üzerinde birbirleriyle iletişim kurar:

| Servis | Image | Port | Açıklama |
|--------|-------|------|----------|
| `nginx` | nginx:1.25-alpine | 80, 443 | Reverse proxy, SSL sonlandırma |
| `certbot` | certbot/certbot | — | Let's Encrypt SSL otomatik yenileme |
| `backend` | Dockerfile.backend | 3000 (iç) | NestJS API + PM2 |
| `web` | Dockerfile.web | 3001 (iç) | Next.js standalone |
| `postgres` | postgres:16-alpine | 5432 (iç) | PostgreSQL veritabanı |
| `redis` | redis:7-alpine | 6379 (iç) | Redis cache/queue |
| `minio` | minio/minio:latest | 9001 (sadece localhost) | MinIO object storage |

**Güvenlik notları:**
- PostgreSQL ve Redis portları dışarıya kapalıdır (`expose` kullanılır, `ports` değil).
- MinIO admin konsolu (9001) sadece `127.0.0.1` üzerinden erişilebilir (SSH tüneli gerektirir).
- Redis `requirepass` ve `maxmemory` konfigürasyonları ile production'da güvenli çalışır.
- Redis `allkeys-lru` politikası ile 256 MB bellek sınırı uygulanır.

### 5.3 Docker Image Yapısı

#### Backend (Dockerfile.backend) — 4 Aşama

```dockerfile
# Stage 1: deps — pnpm install (dev + prod)
# Stage 2: shared-build — @sigorta/shared paketi derleme
# Stage 3: backend-build — prisma generate + NestJS build
# Stage 4: production — Node.js Alpine + PM2 + dumb-init

FROM node:20-alpine AS production
# dumb-init: PID 1 sorunlarını çözer (graceful shutdown)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["pm2-runtime", "ecosystem.config.js"]
EXPOSE 3000
```

PM2 kullanılması, process yönetimi, otomatik yeniden başlatma ve log yönetimi sağlar.

#### Frontend (Dockerfile.web) — 4 Aşama

```dockerfile
# Stage 1: deps — pnpm install
# Stage 2: shared-build — @sigorta/shared paketi derleme
# Stage 3: web-build — Next.js standalone build
# Stage 4: production — Node.js Alpine + standalone server

ARG NEXT_PUBLIC_API_URL=https://app.meridyen-tr.com/api/v1
ENV PORT=3001
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "apps/web/server.js"]
EXPOSE 3001
```

Next.js `standalone` output kullanılarak minimum image boyutu elde edilir.

### 5.4 Nginx Konfigürasyonu

```nginx
# nginx/nginx.conf

# Rate limiting zone'ları
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;

server {
    listen 443 ssl http2;
    server_name app.meridyen-tr.com;

    # SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:...;
    ssl_session_cache shared:SSL:10m;
    ssl_stapling on;

    # Güvenlik başlıkları
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self)";

    # API — rate limit: 30 req/min, burst 10
    location /api {
        limit_req zone=api_limit burst=10 nodelay;
        proxy_pass http://backend:3000;
    }

    # Login — sıkı rate limit: 5 req/min, burst 3
    location /api/v1/auth/login {
        limit_req zone=auth_limit burst=3 nodelay;
        proxy_pass http://backend:3000;
    }

    # WebSocket (Socket.IO)
    location /socket.io {
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;
    }

    # Statik dosyalar — 1 yıl cache
    location /_next/static/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Frontend
    location / {
        proxy_pass http://web:3001;
    }
}
```

### 5.5 Environment Değişkenleri

**Kritik production değişkenleri** (`.env.production.example` referansı):

| Değişken | Örnek Değer | Açıklama |
|----------|-------------|----------|
| `DOMAIN` | `app.meridyen-tr.com` | Alan adı |
| `DATABASE_URL` | `postgresql://user:pass@postgres:5432/db` | PostgreSQL bağlantısı |
| `REDIS_PASSWORD` | güçlü şifre | Redis auth şifresi |
| `REDIS_URL` | `redis://:pass@redis:6379` | Redis bağlantısı |
| `JWT_SECRET` | `openssl rand -hex 32` çıktısı | JWT imzalama anahtarı |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token süresi |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token süresi |
| `STORAGE_PROVIDER` | `s3` | Depolama: `local` veya `s3` |
| `MINIO_ROOT_USER` | güvenli kullanıcı adı | MinIO erişim anahtarı |
| `MINIO_ROOT_PASSWORD` | güçlü şifre | MinIO gizli anahtar |
| `S3_BUCKET` | `hasar-documents` | MinIO bucket adı |
| `WEB_URL` | `https://app.meridyen-tr.com` | CORS allowed origin |
| `NEXT_PUBLIC_API_URL` | `https://app.meridyen-tr.com/api/v1` | Frontend API URL |
| `SMTP_HOST` | `mail.domain.com` | E-posta SMTP sunucusu |
| `LOGO_INTEGRATION_ENABLED` | `false` | Logo ERP entegrasyon flag |

### 5.6 VPS Deployment Adımları

```bash
# 1. Repo'yu çek
git clone <repo-url> /opt/sigorta
cd /opt/sigorta

# 2. Production env dosyasını oluştur
cp .env.production.example .env.production
# .env.production dosyasını düzenle (şifreler, domain, vs.)

# 3. SSL sertifikası (ilk kurulum — certbot standalone)
docker run --rm -p 80:80 certbot/certbot certonly \
  --standalone --email admin@domain.com \
  --agree-tos --no-eff-email -d app.meridyen-tr.com

# 4. Production image'larını build et
docker compose -f docker-compose.prod.yml --env-file .env.production build

# 5. Servisleri başlat
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# 6. Database migration
docker exec sigorta-backend sh -c "cd /app/apps/backend && node_modules/.bin/prisma migrate deploy"

# 7. Database seed (ilk kurulum)
docker exec sigorta-backend sh -c "cd /app/apps/backend && node_modules/.bin/prisma db seed"

# 8. Güncellemeler için
git pull && docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

---

## 6. Güvenlik

### 6.1 Authentication Akışı

```
1. Kullanıcı POST /api/v1/auth/login (email + password + reCAPTCHA)
   ├── ThrottlerGuard: rate limit kontrolü
   ├── reCAPTCHA doğrulama (Google API)
   ├── bcrypt.compare() ile şifre doğrulama
   ├── Kullanıcı durumu kontrolü (status === 'active')
   └── Başarılı ise:
       ├── accessToken  ← JWT (15 dk, payload: {sub, email})
       ├── refreshToken ← JWT (7 gün, DB'ye kaydedilir)
       └── userData     ← id, rol, şube, izinler, sigorta şirketi kapsamı

2. Her istek Header: "Authorization: Bearer <accessToken>"
   └── JwtAuthGuard:
       ├── Token parse + doğrulama (JWT_SECRET)
       ├── DB'den kullanıcı + tüm izinler yükleniyor
       └── request.user = { id, roleCode, permissions, insuranceCompanyScopes }

3. Token yenileme: POST /api/v1/auth/refresh { refreshToken }
   ├── DB'de token var mı? + revokedAt null mu?
   ├── Süresi dolmuş mu?
   ├── Eski token iptal edilir (revokedAt = now)
   └── Yeni token çifti döndürülür (Token Rotation)

4. Çıkış: POST /api/v1/auth/logout { refreshToken }
   └── DB'de token revokedAt = now (refresh token etkisizleştirilir)
```

### 6.2 Yetkilendirme (RBAC)

#### PermissionsGuard

```typescript
// apps/backend/src/common/guards/permissions.guard.ts

// Varsayılan rol izinleri (DB boş ise fallback)
const ROLE_DEFAULT_PERMISSIONS = {
  ADMIN: ['*'],           // Tüm izinler
  OFFICE_STAFF: ['customer.view', 'file.view', 'file.create', ...],
  FIELD_STAFF: ['customer.view', 'file.view', 'file.update', ...],
  FINANS: ['finance.view', 'finance.create', 'invoice.view', ...],
};

// İzin kontrolü
canActivate(context) {
  if (roleCode === 'ADMIN') return true;  // Admin bypass
  const permissions = user.permissions?.length > 0
    ? user.permissions                    // DB'den yüklenen izinler
    : ROLE_DEFAULT_PERMISSIONS[roleCode]; // Fallback
  return requiredPermissions.some(p => permissions.includes(p));
}
```

İzinler `@RequirePermissions('claim_file.view')` decorator'ü ile endpoint'lere uygulanır.

#### AgreementGuard

KVKK sözleşmelerini onaylamamış kullanıcılar API'ye erişemez:

```typescript
// Onaylanmamış sözleşme varsa:
throw new ForbiddenException({
  code: 'AGREEMENTS_PENDING',
  message: 'Önce aktif sözleşmeleri onaylamanız gerekiyor.',
  pendingAgreements: [{ id, title, type, version }],
});
```

Frontend, `AgreementConsentModal` bileşeni ile bu durumu yakalar ve modal gösterir.

#### CustomerAccessGuard

Saha personelinin sadece atanmış olduğu dosyalardaki müşterilere erişmesini sağlar; erişim 48 saat ile sınırlıdır:

```typescript
// apps/backend/src/common/guards/customer-access.guard.ts
// field_staff rolü için:
// 1. Müşteri ile ilişkili dosyaları bul
// 2. Bu dosyalarda assignedFieldUserId === user.id kontrolü
// 3. 48 saat süresi kontrolü
// 4. Erişim logu (CustomerAccessLogModule)
```

### 6.3 Veri Koruma

| Mekanizma | Uygulama |
|-----------|----------|
| **Şifre hash** | `bcrypt.hash(password, 10)` — salt=10 |
| **JWT imzalama** | `JWT_SECRET` (en az 32 bayt önerilir, `openssl rand -hex 32`) |
| **Token Rotation** | Refresh token tek kullanımlıktır; yenilemede eski iptal edilir |
| **Telefon maskeleme** | `field_staff` rolü için API yanıtlarında `0555***4567` formatı |
| **Maliyet maskeleme** | `field_staff` için finansal alanlar yanıttan kaldırılır |
| **CORS** | Sadece `WEB_URL` origin'inden gelen istekler kabul edilir |
| **Helmet** | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` başlıkları |
| **Rate Limiting** | Nginx: API 30 req/min, Login 5 req/min; NestJS ThrottlerModule: 10 req/60s |
| **Validation** | Global `ValidationPipe(whitelist: true)` — tanımsız alanlar reddedilir |
| **KVKK** | `AgreementGuard` — sözleşme onayı zorunludur |

### 6.4 Loglama

```typescript
// apps/backend/src/common/logger/winston.logger.ts
// Format: JSON + timestamp
// error.log  → max 10MB, 5 dosya rotasyonu
// combined.log → max 20MB, 10 dosya rotasyonu
// Console: development'ta renkli
```

Müşteri erişim logları `customer_access_logs` tablosunda tutulur (`CustomerAccessLogModule`). Saha personelinin GPS konumu `user_locations` tablosuna kaydedilir.

---

## 7. Önemli Tasarım Kararları

### 7.1 Neden Monorepo?

**Seçilen:** pnpm Workspaces + Turborepo  
**Reddedilen:** Ayrı repository'ler

**Gerekçe:**
- `packages/shared` paketi, TypeScript tipler (`AuthUser`, `ClaimStatus`), Zod şemaları ve enum'ları hem backend hem frontend arasında tek yerden paylaşılır. Ayrı repo'larda bu senkronizasyon manuel ve hata prone olurdu.
- Turborepo `build` pipeline'ı bağımlılık sırasını otomatik yönetir: `shared` → `backend` → `web`.
- `turbo run dev` ile tek komutla tüm stack ayağa kalkar.
- Tek CI/CD pipeline ile tüm uygulamalar test edilir.

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 7.2 Neden Prisma ORM?

**Seçilen:** Prisma 5  
**Reddedilen:** TypeORM, Sequelize, Ham SQL

**Gerekçe:**
- **Type-safety:** `schema.prisma` dosyasından otomatik üretilen TypeScript tipleri, runtime hatalarını compile-time'a taşır.
- **Migration yönetimi:** `prisma migrate dev` / `prisma migrate deploy` ile sürüm kontrolüne uyumlu schema evrimi.
- **Prisma Client:** İlişkisel sorguları (`include`, `select`) tip güvenli olarak yönetir; N+1 sorgu problemlerini önler.
- **Docker uyumluluğu:** `binaryTargets` ile Native (Mac) ve Alpine Linux için aynı binary üretilebilir.

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x", "linux-musl"]
}
```

### 7.3 Neden Next.js App Router?

**Seçilen:** Next.js 14 App Router  
**Reddedilen:** Pages Router, Pure SPA (React + Vite), Nuxt

**Gerekçe:**
- **Server Components:** Dashboard KPI verileri gibi statik içerikler sunucu tarafında render edilerek ilk yükleme hızı artırılır.
- **Nested Layouts:** `/panel/layout.tsx` ile auth kontrolü, navbar ve sidebar tüm panel sayfaları için tek yerden yönetilir; tekrar eden kod önlenir.
- **Route Groups:** Public sayfalar (`/giris`, `/evrak/[token]`) ve panel sayfaları (`/panel/*`) ayrı layout hiyerarşisine sahiptir.
- **Standalone Output:** `output: 'standalone'` ile Docker image boyutu minimize edilir; sadece gerekli dosyalar kopyalanır.

### 7.4 Neden Redis?

**Seçilen:** Redis 7 (Bull/BullMQ queue backend)  
**Reddedilen:** In-memory queue, RabbitMQ

**Gerekçe:**
- **Bull Queue:** `CustomerAccessLogModule` kullanıcı erişim loglarını asenkron olarak işler; müşteri görüntüleme latency'sini artırmaz.
- **Access expiry scheduler:** `CustomerAccessLogModule.access-expiry.scheduler.ts` ile süresi dolmuş erişimleri periyodik temizler.
- **Gelecek kullanım:** Token cache (Logo ERP `LOGO_TOKEN_CACHE_TTL_MINUTES`), session yönetimi.
- **Alpine image:** Redis 7 Alpine ile minimum bellek kullanımı (maxmemory: 256MB).

```typescript
// apps/backend/src/app.module.ts
BullModule.forRootAsync({
  useFactory: (configService: ConfigService) => {
    const url = new URL(configService.get('REDIS_URL'));
    return { redis: { host: url.hostname, port: parseInt(url.port) } };
  },
}),
```

### 7.5 Neden MinIO?

**Seçilen:** MinIO (S3-compatible)  
**Reddedilen:** AWS S3 (doğrudan), lokal dosya sistemi (production'da)

**Gerekçe:**
- **S3 API uyumluluğu:** `@aws-sdk/client-s3` kütüphanesi, kod değişikliği olmadan hem MinIO (on-premise) hem gerçek AWS S3'e bağlanabilir. `STORAGE_PROVIDER=s3` değişkeni ile geçiş yapılır.
- **On-premise kontrol:** Müşteri verileri (hasar fotoğrafları, belgeler, faturalar) şirket VPS'inde kalır; KVKK açısından avantajlıdır.
- **Presigned URL:** Belgelere doğrudan MinIO'dan kısa süreli (15 dakika) erişim URL'i üretilir; backend trafik yükü azalır.
- **Güvenli erişim:** MinIO admin konsolu (9001) dışarıya kapalıdır, sadece SSH tüneli ile erişilebilir.

```typescript
// apps/backend/src/modules/storage/storage.service.ts
// Soyutlama katmanı: STORAGE_PROVIDER=local → yerel disk
//                    STORAGE_PROVIDER=s3 → MinIO (prod) veya AWS S3
async getSignedUrl(key: string, expiresIn = 900): Promise<string> {
  if (this.provider === 's3') {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3Client, command, { expiresIn });
  }
  return `/uploads/${key}`; // Development
}
```

### 7.6 Neden NestJS?

**Seçilen:** NestJS 10  
**Reddedilen:** Express (bare), Fastify, Hono

**Gerekçe:**
- **Module sistemi:** 70+ domain modülünü bağımsız, test edilebilir birimler halinde organize eder.
- **Dependency Injection:** Guard, Interceptor, Service bağımlılıkları IoC container tarafından yönetilir.
- **Decorator tabanlı:** `@Controller`, `@Get`, `@RequirePermissions` gibi decorator'lar ile declarative API tanımı.
- **TypeScript-first:** Prisma'nın ürettiği tipler ile tam entegrasyon.
- **Swagger entegrasyonu:** `@ApiTags`, `@ApiOperation` decorator'ları ile otomatik API dokümantasyonu (`/api/docs`).

---

## Ek: Geliştirme Ortamı Kurulumu

```bash
# Gereksinimler: Node 18+, pnpm 8+, Docker Desktop

# 1. Bağımlılıkları yükle
pnpm install

# 2. Altyapı servislerini başlat
docker compose up -d

# 3. Ortam değişkenlerini ayarla
cp .env.example .env

# 4. Database migration + seed
cd apps/backend
pnpm exec prisma migrate dev
pnpm exec prisma db seed

# 5. Tüm uygulamaları başlat (turbo)
cd ../..
pnpm dev
# → Backend: http://localhost:3000
# → Frontend: http://localhost:3001
# → API Docs: http://localhost:3000/api/docs
# → MinIO Console: http://localhost:9001 (minioadmin/minioadmin)
```

---

*Bu dokümantasyon, projenin Mayıs 2026 itibariyle güncel halini yansıtmaktadır.*
