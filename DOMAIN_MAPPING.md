# Domain Ayrıştırma Haritası

## Mevcut Kavram Karmaşası

### 1. `Department` (departments tablosu)
**Şu anki kullanım:** Hasar türü lookup gibi kullanılıyor (Konut Yangın, Dahili Su, vb.)  
**Hedef kullanım:** Gerçek organizasyon birimi (Hasar Onarım, Acil Yardım, Sovtaj)

**İlişkiler:**
- `ClaimFile.departmentId` → departman bazlı dosya yönlendirme
- `DepartmentFileSubject` → departmana gömülü hasar konusu alt tipleri
- `ReportFieldConfig.departmentId` → departman bazlı alan zorunlulukları

### 2. `DepartmentFileSubject` (department_file_subjects tablosu)
**Şu anki kullanım:** Departmana bağlı hasar türü alt kırılımları  
**Sorun:** Hasar türü departmandan bağımsız olmalı  
**Hedef:** Bu model deprecated edilecek, yeni `ClaimSubject` modeline geçilecek

**İlişkiler:**
- `ClaimFile.departmentFileSubjectId` → deprecated, yeni `claimSubjectId` kullanılacak

### 3. `Branch` (branches tablosu)
**Kullanım:** Fiziksel operasyon lokasyonu (İstanbul Anadolu, Ankara Merkez)  
**Hedef:** Bu model doğru, değişiklik yok

**İlişkiler:**
- `User.branchId` → kullanıcı-şube ilişkisi (tekil, deprecated)
- `ClaimFile.assignedBranchId` → dosya atandığı fiziksel şube

### 4. `ServiceBranch` (service_branches tablosu)
**Kullanım:** Hizmet branşı lookup (hasar / acil_yardim tipi ayrımı)  
**Hedef:** Bu model doğru, değişiklik yok

### 5. `system_settings.ihbar_konulari`
**Şu anki kullanım:** JSON ile hasar/acil ihbar konuları saklanıyor  
**Sorun:** Hardcoded yaklaşım, departments ile duplicate veri  
**Hedef:** Kaldırılacak, yeni `ClaimSubject` tablosu authoritative kaynak olacak

### 6. Semantic Mapping

| Alan Adı | Şu anki anlam | Hedef anlam | Değişiklik |
|----------|---------------|-------------|------------|
| `ClaimFile.departmentId` | Hasar türü benzeri | Operasyonel departman | Veri geçişi gerekli |
| `ClaimFile.departmentFileSubjectId` | Hasar konusu | Deprecated | Yeni `claimSubjectId` eklenecek |
| `ClaimFile.assignedBranchId` | Fiziksel şube | Fiziksel şube | Değişmez |
| `User.branchId` | Tekil şube ataması | Backward-compat | Yeni `UserDepartmentMembership` eklenecek |
| `Department.code/name` | Hasar türü | Org. birimi | Seed değişecek |
| `DepartmentFileSubject` | Alt hasar türü | Deprecated | → ClaimSubject |

---

## Hedef Modeller

### 1. `ClaimSubject` (yeni tablo)
**Amaç:** Bağımsız ihbar konusu / hasar türü lookup

**Alanlar:**
- id, code, name, description
- category: 'hasar' | 'acil_yardim' | 'both'
- isActive, sortOrder, metadata (JSON)

**Kaynak:**
- Mevcut `departments` seed verisi
- `DepartmentFileSubject` kayıtları
- `system_settings.ihbar_konulari` JSON

### 2. `UserDepartmentMembership` (yeni tablo)
**Amaç:** Çoklu kullanıcı-departman ilişkisi

**Alanlar:**
- userId, departmentId
- roleScope, isPrimary, isActive
- createdAt, updatedAt

**Kaynak:**
- Mevcut `users.branchId` → ilk membership kaydı

### 3. `ClaimResponsibilityAssignment` (yeni tablo)
**Amaç:** Dosya sorumlusu atama kuralları

**Alanlar:**
- userId, departmentId
- regionType: 'city' | 'district' | 'region' | 'countrywide'
- regionValues: string[] (JSON)
- coverageType: 'all' | 'specific_subjects'
- coverageConfig: JSON
- priority, isActive

**Özel:** Acil Yardım için `countrywide` fallback

### 4. `Department` (güncellenmiş)
**Yeni seed:**
```prisma
[
  { code: 'hasar-onarim', name: 'Hasar Onarım', description: 'Hasar dosyaları operasyon' },
  { code: 'acil-yardim', name: 'Acil Yardım', description: 'Acil yardım operasyon' },
  { code: 'sovtaj', name: 'Sovtaj', description: 'Sovtaj operasyon' },
]
```

---

## Endpoint/Alan Kullanım Matrisi

| Endpoint/Modül | Mevcut alan | Semantik | Hedef alan | Aksiyon |
|----------------|-------------|----------|------------|---------|
| `claim-files/create` | `departmentId` | Hasar türü benzeri | `departmentId` + `claimSubjectId` | DTO split |
| `claim-files/list` | `departmentId` filter | Hasar türü | `claimSubjectId` filter | DTO alias |
| `departments/list` | Tüm kayıtlar | Hasar türleri | Sadece org. departman | Seed split |
| `system-settings/ihbar_konulari` | JSON | Hasar konusu | → `claim-subjects/list` | Endpoint remap |
| `eksper-portal` form | `ihbar_konulari` JSON | Dropdown | → `claim-subjects/active` | Frontend remap |
| `users.branchId` | Tekil | Fiziksel şube | `UserDepartmentMembership` | Backward-compat |

---

## Veri Migrasyonu Strateji

### Faz 1: Tablo oluşturma
```sql
-- ClaimSubject tablosu
-- UserDepartmentMembership tablosu
-- ClaimResponsibilityAssignment tablosu
-- ClaimFile.claimSubjectId alanı (nullable)
```

### Faz 2: Veri taşıma
```sql
-- Eski departments → ClaimSubject
INSERT INTO claim_subjects (code, name, category, ...)
SELECT code, name, 'hasar', ... FROM departments WHERE code IN (...)

-- DepartmentFileSubject → ClaimSubject
INSERT INTO claim_subjects (code, name, category, ...)
SELECT code, name, 'hasar', ... FROM department_file_subjects

-- ClaimFile.departmentFileSubjectId → claimSubjectId
UPDATE claim_files SET claimSubjectId = (
  SELECT cs.id FROM claim_subjects cs
  WHERE cs.code = (SELECT code FROM department_file_subjects WHERE id = departmentFileSubjectId)
)

-- users.branchId → UserDepartmentMembership
INSERT INTO user_department_memberships (userId, departmentId, isPrimary)
SELECT id, (SELECT id FROM departments WHERE code = 'hasar-onarim'), true
FROM users WHERE branchId IS NOT NULL
```

### Faz 3: Gerçek departman seed'i
```sql
-- Eski kayıtları temizle
DELETE FROM departments WHERE code NOT IN ('hasar-onarim', 'acil-yardim', 'sovtaj')

-- Varsayılan departmanlar
INSERT INTO departments (code, name, description) VALUES
('hasar-onarim', 'Hasar Onarım', 'Operasyonel hasar dosya yönetimi'),
('acil-yardim', 'Acil Yardım', 'Acil yardım operasyon'),
('sovtaj', 'Sovtaj', 'Sovtaj operasyon')
```

### Faz 4: Backward-compat cleanup (opsiyonel)
- `users.branchId` nullable olarak kalsın
- `departmentFileSubjectId` deprecated olarak işaretlensin
- `system_settings.ihbar_konulari` read-only fallback

---

## Risk Noktaları

### 1. `ReportFieldConfig.departmentId`
**Sorun:** Alan zorunluluğu hasar türüne mi, departmana mı bağlı?  
**Analiz gerekli:** `panel/ayarlar/alan-zorunluluklari` ekranında ne yapıldığına bakılacak  
**Muhtemel çözüm:** İki eksenli model (departman x claimSubject) veya sadece claimSubject

### 2. Raporlama ekranlarında "Branş"
**Örnek:** `panel/raporlar/brans-analizi`  
**Karışıklık:** Backend endpoint'i `productBranch` mi, `department` mi, yoksa `serviceType` mi dönüyor?  
**Çözüm:** Endpoint response alias ve UI label audit

### 3. Seed dosyaları
**Risk:** Demo/pilot seed'lerde eski semantik tekrar sisteme girebilir  
**Önlem:** Tüm seed dosyaları (`seed.ts`, `seed-demo.ts`, `seed-pilot-operation-data.ts`) aynı PR'da revize edilecek

---

## Completion Checklist

- [ ] Domain haritası çıkarıldı ve paylaşıldı ✅
- [ ] Prisma schema ayrıştırıldı (ClaimSubject, UserDepartmentMembership, ClaimResponsibilityAssignment)
- [ ] Backend modülleri güncellendi (departments, claim-files, claim-subjects)
- [ ] Veri migrasyonu script'i hazırlandı
- [ ] Seed dosyaları güncellendi
- [ ] Web admin ekranları ayrıştırıldı (departmanlar, ihbar konuları)
- [ ] Eksper portal dropdown yeni endpoint'e bağlandı
- [ ] Routing ve yetki akışları yeni modele bağlandı
- [ ] Smoke testler geçti
- [ ] Doküman güncellendi
