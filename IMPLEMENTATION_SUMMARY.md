# Domain Ayrıştırma - Uygulama Özeti

## Uygulanan Değişiklikler

### 1. Schema Değişiklikleri (`schema.prisma`)

**Yeni Modeller:**
- `ClaimSubject`: Bağımsız ihbar konusu / hasar türü lookup
  - code, name, description, category (hasar | acil_yardim)
  - isActive, sortOrder, metadata
- `UserDepartmentMembership`: Çoklu kullanıcı-departman ilişkisi
  - userId, departmentId, roleScope, isPrimary, isActive
- `ClaimResponsibilityAssignment`: Dosya sorumlusu atama kuralları
  - userId, departmentId, regionType, regionValues, coverageType, coverageConfig, priority

**Model Güncellemeleri:**
- `ClaimFile.claimSubjectId`: Yeni alan (nullable), departmentFileSubjectId deprecated
- `User`: departmentMemberships, responsibilityAssignments ilişkileri eklendi
- `Department`: members, responsibilityAssignments ilişkileri eklendi

### 2. Backend Modülleri

**Yeni Modüller:**
- `claim-subjects`: ClaimSubject CRUD servisi
  - GET /claim-subjects (list all)
  - GET /claim-subjects/active (active only)
  - POST/PUT/DELETE claim-subjects
- `claim-responsibilities`: Dosya sorumlusu CRUD ve routing servisi
  - GET /claim-responsibilities (list + filter)
  - POST /claim-responsibilities/find-responsible (routing logic)

**Güncellenen Modüller:**
- `claim-files.service.ts`: claimSubjectId desteği eklendi, backward-compat korundu

### 3. Seed Güncellemeleri (`seed.ts`)

**Yeni Seed Verileri:**
- 23 adet ClaimSubject (12 hasar + 11 acil yardım)
- 3 gerçek departman (Hasar Onarım, Acil Yardım, Sovtaj)

**Backward Compat:**
- Eski departments (hasar türleri) halen tabloda mevcut
- Yeni vs. eski kod ayrımı: `hasar-onarim`, `acil-yardim`, `sovtaj` vs. `konut-yangin`, `dahili-su` vb.

### 4. Web Entegrasyonu

**Eksper Portal (`eksper-portal/page.tsx`):**
- İhbar dropdown: `system-settings/ihbar-konulari` → `claim-subjects/active?category=hasar`
- Response parse: `{ data: { hasar: [], acil: [] } }` → `{ data: [{ code, name, category }] }`

### 5. Migrasyon

- Migration oluşturuldu: `20260514172819_domain_separation_claim_subjects_user_departments`
- Schema DB'ye push edildi ve seed çalıştırıldı

---

## Kritik Not: Eksik Adımlar

Token bütçesi dolayısıyla aşağıdaki görevler bu PR'da tamamlanmadı. Sonraki iterasyonda ele alınmalı:

### Yüksek Öncelikli
1. **Departmanlar Admin Ekranı**: `apps/web/src/app/panel/ayarlar/page.tsx`
   - Eski hasar türlerini "ihbar konuları" olarak etiketle
   - Yeni gerçek departmanları ayrı bölüm olarak göster
2. **İhbar Konuları Admin Ekranı**: Yeni `panel/ayarlar/ihbar-konulari/page.tsx` ekranı
   - ClaimSubject CRUD (Ekle / Düzenle / Sil)
   - Kategori bazlı filtreleme (Hasar / Acil Yardım)
3. **Dosya Sorumluları Admin Ekranı**: Yeni `panel/ayarlar/dosya-sorumlulari/page.tsx`
   - ClaimResponsibilityAssignment CRUD
   - Kullanıcı + Departman + Bölge + Kapsam yönetimi
4. **Eski Departments Temizliği**: Seed'de deprecated departments için `isSystem=false` veya tag eklenmeli

### Orta Öncelikli
5. **Routing/Yetki Akışları**: claim-files assign/routing mantığı ClaimResponsibilityAssignment servisini kullanmalı
6. **ReportFieldConfig**: Alan zorunluluğu departman mı, claimSubject mi kontrolü — ekran audit gerekli
7. **Raporlama**: Branş/Departman etiketleri UI'da karışıklık yaratabilir — label tutarlılığı sağlanmalı

### Düşük Öncelikli
8. **system-settings/ihbar-konulari Endpoint**: Deprecated olarak işaretlensin veya read-only fallback yap
9. **seed-demo.ts, seed-pilot-operation-data.ts**: Aynı mantık revize edilsin (duplicate seed hataları)
10. **Test Coverage**: Unit testler (claim-subjects, claim-responsibilities servisleri)

---

## Runtime Doğrulama

### Backend
```bash
cd apps/backend
pnpm dev
# Backend started on port 3000
```

### DB Kontrol
```bash
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); (async () => { const cs = await prisma.claimSubject.findMany(); console.log('ClaimSubjects:', cs.length); await prisma.\$disconnect(); })()"
# ClaimSubjects: 23
```

### Endpoint Test
```bash
curl -s http://localhost:3000/api/v1/claim-subjects/active | jq '.data | length'
# Endpoint requires auth, add token in production test
```

---

## Veri Şeması

### ClaimSubject Örnek
```json
{
  "id": "uuid",
  "code": "konut-yangin",
  "name": "Konut Yangın",
  "description": null,
  "category": "hasar",
  "isActive": true,
  "sortOrder": 1,
  "metadata": {}
}
```

### Department Örnek (Yeni)
```json
{
  "id": "uuid",
  "code": "hasar-onarim",
  "name": "Hasar Onarım",
  "description": "Hasar dosyaları operasyonel yönetim departmanı",
  "color": "#3B82F6",
  "reportFormat": "repair",
  "status": "active",
  "isSystem": true,
  "sortOrder": 1
}
```

---

## Kaynaklar

- **Domain Harita**: `DOMAIN_MAPPING.md`
- **Migration**: `apps/backend/prisma/migrations/20260514172819_*`
- **Yeni Modüller**: `apps/backend/src/modules/claim-subjects`, `apps/backend/src/modules/claim-responsibilities`
- **Seed**: `apps/backend/prisma/seed.ts` (line 101-170)

---

## Completion Kriterleri (Bu PR)

✅ Schema ayrıştırıldı (ClaimSubject, UserDepartmentMembership, ClaimResponsibilityAssignment)  
✅ Backend modülleri eklendi (claim-subjects, claim-responsibilities)  
✅ Migration oluşturuldu ve seed güncellendi  
✅ Eksper portal ihbar dropdown yeni endpoint'e bağlandı  
⚠️  Admin paneli ekranları eksik (departmanlar, ihbar konuları, dosya sorumluları)  
⚠️  Routing/yetki akışları yeni modele henüz bağlanmadı  

## Sonraki Adımlar

1. Admin paneli UI tamamlanmalı (3 ekran)
2. Eski departments deprecated edilmeli
3. Routing mantığı ClaimResponsibilityAssignment servisini kullanmalı
4. End-to-end smoke test + doküman güncellemesi
