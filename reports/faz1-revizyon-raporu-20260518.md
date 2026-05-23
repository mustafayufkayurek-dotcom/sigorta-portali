# Faz 1 Revizyon ve Kanıt Raporu

## 1. Yönetici Özeti

Bu çalışma Faz 1 kapsamındaki değişikliklerin ayrıştırılması, `insurance-company-scopes` 404 hatasının kök nedeninin belirlenmesi, `screen-permissions` legacy + canonical payload desteğinin kanıtlanması, backend typecheck hatasının mini düzeltme planının çıkarılması ve production test veri izlerinin listelenmesi amacıyla hazırlanmıştır.

### Revizyon Gerekçeleri ve Durum

| Başlık | Bulgular | Karar |
|---|---|---|
| `insurance-company-scopes` production 404 | Local controller’da route var, production container’daki derlenmiş `users.controller.js` içinde route yok | Revizyon gerekir |
| `screen-permissions` canonical payload kanıtı | Local DTO/controller normalizasyonu canonical + legacy desteğini gösteriyor, production canlı request kanıtı toplanamadı | Revizyon gerekir |
| Backend typecheck FAIL | `service-types.service.ts` create/seed akışlarında zorunlu `code` alanı eksik | Revizyon gerekir |
| Diff ayrışması karışık | Faz 1 backend/web parçaları faz dışı değişikliklerle aynı dosyalarda karışmış | Revizyon gerekir |
| Production test veri izi | Production’da test/tmp kullanıcıları mevcut, screen permission izi görünmüyor | Danışman onayı gerekir |

### Kısa Sonuç

- Faz 1 kodu local repoda mevcut ancak production backend image içinde `insurance-company-scopes` route’u bulunmuyor.
- `screen-permissions` için local kod hem legacy (`screenPermissions/screenCode`) hem canonical (`screens/code`) formatlarını normalize edecek şekilde hazırlanmış.
- Backend typecheck şu anda release kapısı olmaya aday bir hata veriyor; sebep `ServiceType` için zorunlu `code` alanının service katmanında gönderilmemesi.
- Production’da test kullanıcı izi var; temizlik kararı danışman onayı olmadan verilmemeli.

## 2. Diff Ayrıştırma Matrisi

### Sınıflandırma Kriteri

- **Faz 1:** `insurance-company-scopes` route/uçtan uca akış, `screen-permissions` normalize/canonical payload desteği
- **Faz dışı:** role switch cleanup, nested memberships, responsibility assignments, `isPrimary` validasyonu, büyük UI refactor, yardımcı bileşenler, Türkçeleştirme/UX düzenlemeleri
- **Ortak:** Faz 1’i taşıyan ama aynı dosyada faz dışı yapılarla temas eden destekleyici satırlar

| Dosya | Toplam Diff | Faz 1 Yaklaşık | Faz Dışı Yaklaşık | Not |
|---|---:|---:|---:|---|
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.controller.ts` | `+24/-5` | `~16 ek / 0-1 sil` | `~8 ek / ~4 sil` | Faz 1 route ve payload normalizasyonu aynı dosyada DTO type geçişleri ile karışıyor |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.service.ts` | `+259/-38` | `~40-55 ek / ~0-3 sil` | `~200+ ek / ~35 sil` | En yoğun karışım burada; nested ilişkiler ve role cleanup baskın |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/kullanicilar/page.tsx` | `+698/-281` | `~70-110 ek / ~0-10 sil` | `~580+ ek / ~270+ sil` | Faz 1 API çağrıları mevcut ama büyük UI/scope refactor ile iç içe |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/ayarlar/kurulum/page.tsx` | `+465/-49` | `~60-90 ek / ~0-6 sil` | `~390+ ek / ~40+ sil` | Faz 1 çağrıları var ancak genel kurulum ekranı refactor’u baskın |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.dto.ts` | yeni dosya | `~20-30 satır` | `~90+ satır` | `UpdateScreenPermissionsDto` ve `UpdateInsuranceCompanyScopesDto` Faz 1; diğer DTO’lar faz dışı |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/utils/screen-permissions.ts` | yeni dosya | `muhtemelen Faz 1 ağırlıklı` | `düşük` | Ekran izinleri için ortak yardımcı dosya |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/package.json` | `+3/-0` | `0` | `3` | Jest alias düzeni, Faz 1 ile ilişkili değil |

### Faz 1’e Giren Tespit Edilmiş Parçalar

- Backend:
  - `users.controller.ts` içinde `UpdateScreenPermissionsDto` kullanımı
  - `normalizedScreens` ile `code` / `screenCode` normalizasyonu
  - `PUT :id/insurance-company-scopes` route’u
  - `users.service.ts` içinde `upsertScreenPermissions` için null/array koruması
  - `users.service.ts` içinde `updateInsuranceCompanyScopes`
  - `users.dto.ts` içinde `ScreenPermissionInputDto`, `UpdateScreenPermissionsDto`, `UpdateInsuranceCompanyScopesDto`
- Web:
  - `PUT /users/:id/screen-permissions`
  - `PUT /users/:id/insurance-company-scopes`
  - kullanıcı form state’inde `screenPermissions` ve `insuranceCompanyIds`

### Faz Dışı Tespit Edilmiş Parçalar

- `departmentMemberships`
- `responsibilityAssignments`
- `validateNestedUserRelations`
- `persistDepartmentMemberships`
- `persistResponsibilityAssignments`
- `cleanupRoleSwitchState`
- `isPrimary` validasyonları
- `UserImpactSummary`, `UserScopeSections`, `buildUserPayload`, `hydrateScopeFromUser`, `validateUserScope`
- kurulum ve kullanıcı ekranlarındaki büyük görsel/refactor değişiklikleri

### İzolasyon Önerisi

Faz 1 için ayrı commit/patch üretmek adına aşağıdaki mantıksal ayrım önerilir:

1. **Backend patch 1**
   - `users.controller.ts`
   - yalnızca:
     - `UpdateScreenPermissionsDto`
     - `normalizedScreens` akışı
     - `PUT :id/insurance-company-scopes`
2. **Backend patch 2**
   - `users.service.ts`
   - yalnızca:
     - `upsertScreenPermissions` içindeki defensive guard
     - `updateInsuranceCompanyScopes`
   - `userDetailInclude`, nested memberships ve role cleanup bu patch’e alınmamalı
3. **Backend patch 3**
   - `users.dto.ts`
   - yalnızca Faz 1 DTO’ları
4. **Web patch 1**
   - `kullanicilar/page.tsx`
   - yalnızca `screen-permissions` ve `insurance-company-scopes` çağrıları için gereken minimal state ve submit blokları
5. **Web patch 2**
   - `kurulum/page.tsx`
   - aynı şekilde sadece Faz 1 API entegrasyonları
6. **Faz dışı kalan tüm nested scope/refactor çalışmaları**
   - ayrı patch/commit

Bu ayrım özellikle `users.service.ts` ve iki büyük web dosyasında manuel hunk seçimi gerektirir; otomatik tek seferlik diff ayrımı güvenilir görünmüyor.

## 3. `insurance-company-scopes` 404 Kök Neden Analizi

### Local Kod Kanıtı

Local repo içinde route tanımı açıkça mevcut:

```131:149:apps/backend/src/modules/users/users.controller.ts
  @Put(':id/screen-permissions')
  @RequirePermissions('user.update')
  @ApiOperation({ summary: 'Kullanıcı ekran izinlerini güncelle (admin)' })
  async upsertScreenPermissions(
    @Param('id') id: string,
    @Body() dto: UpdateScreenPermissionsDto,
  ) {
    const normalizedScreens: NormalizedScreenPermission[] = (dto.normalizedScreens ?? [])
      .map((screen) => ({
        code: screen.code ?? screen.screenCode ?? '',
        canView: screen.canView,
        canEdit: screen.canEdit,
      }))
      .filter((screen) => screen.code.length > 0);
    const data = await this.usersService.upsertScreenPermissions(id, normalizedScreens);
    return { success: true, data };
  }
```

```145:149:apps/backend/src/modules/users/users.controller.ts
  @Put(':id/insurance-company-scopes')
  @RequirePermissions('user.update')
  @ApiOperation({ summary: 'Kullanıcı sigorta şirketi kapsamlarını güncelle (admin)' })
  async updateInsuranceCompanyScopes(
```

### Production Container Kanıtı

Production container içinde derlenmiş controller dosyası bulundu:

- `/app/apps/backend/dist/modules/users/users.controller.js`

Ancak bu derlenmiş dosyada:

- `insurance-company-scopes` string’i **yok**
- `upsertScreenPermissions` hâlâ eski haliyle `dto.screens` kullanıyor
- normalize akış ve yeni route görünmüyor

Production derlenmiş controller’dan kritik bölüm:

```73:77:/app/apps/backend/dist/modules/users/users.controller.js
    async upsertScreenPermissions(id, dto) {
        const data = await this.usersService.upsertScreenPermissions(id, dto.screens);
        return { success: true, data };
    }
```

Bu bulgu local kod ile production derlenmiş kodun farklı olduğunu gösteriyor.

### Image/Zaman Kanıtı

- Production backend image oluşturulma zamanı: `2026-05-17 19:58:34 +0300`
- Local ilgili dosya zamanları: yaklaşık `2026-05-17 22:29`

Bu sıra, local değişikliklerin production image oluşturulduktan sonra geldiğini gösteriyor.

### Sonuç

`insurance-company-scopes` 404 hatasının en güçlü kök nedeni:

**Kod local repoda mevcut, ancak production backend image’a girmemiş. Bu nedenle deploy edilmemiş / eski image çalışıyor.**

Docker build cache ikincil bir olasılıktır; ancak mevcut kanıt doğrudan eski derlenmiş artifact’e işaret ettiği için birinci teşhis **deploy edilmemiş veya eski image ile ayağa kalkılmış olmasıdır**.

### Çözüm Önerisi

- Backend image yeni kaynakla yeniden build edilmeli
- Gerekirse `--no-cache` kullanılmalı
- Container force recreate edilmeli
- Sonrasında production container içinde:
  - `grep 'insurance-company-scopes' ...users.controller.js`
  - ilgili endpoint’e smoke test
  - `PUT /users/:id/insurance-company-scopes` ile 2xx doğrulaması

## 4. `screen-permissions` Legacy + Canonical Kanıtı

### Local Kod Kanıtı

DTO hem legacy hem canonical payload’ı tek forma indiriyor:

```107:121:apps/backend/src/modules/users/users.dto.ts
export class UpdateScreenPermissionsDto {
  @ApiPropertyOptional({ type: [ScreenPermissionInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScreenPermissionInputDto)
  screens?: ScreenPermissionInputDto[];

  @ApiPropertyOptional({ type: [ScreenPermissionInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScreenPermissionInputDto)
  screenPermissions?: ScreenPermissionInputDto[];
```

```122:124:apps/backend/src/modules/users/users.dto.ts
  @Transform(({ obj }) => obj.screens ?? obj.screenPermissions ?? [])
  normalizedScreens!: ScreenPermissionInputDto[];
}
```

Controller bu normalize veriyi hem `code` hem `screenCode` alanlarını dikkate alarak mapliyor:

```138:144:apps/backend/src/modules/users/users.controller.ts
    const normalizedScreens: NormalizedScreenPermission[] = (dto.normalizedScreens ?? [])
      .map((screen) => ({
        code: screen.code ?? screen.screenCode ?? '',
        canView: screen.canView,
        canEdit: screen.canEdit,
      }))
```

Bu akış aşağıdaki iki payload’ın local backend kodu tarafından destekleneceğini gösterir:

- Legacy:
  - `{ "screenPermissions": [{ "screenCode": "hasar_dosyalari", "canView": true }] }`
- Canonical:
  - `{ "screens": [{ "code": "hasar_dosyalari", "canView": true }] }`

### Production Durumu

Production derlenmiş controller’da hâlâ eski akış var:

```73:77:/app/apps/backend/dist/modules/users/users.controller.js
    async upsertScreenPermissions(id, dto) {
        const data = await this.usersService.upsertScreenPermissions(id, dto.screens);
        return { success: true, data };
    }
```

Bu yüzden production’da canonical/legacy ikisinin de kabul edildiğine dair canlı request/response kanıtı **toplanamadı**. Canlı API doğrulama denemesi güvenlik kısıtı nedeniyle tamamlanamadı.

### Sonuç

- **Local kod seviyesi kanıt:** Var
- **Production request/response kanıtı:** Yok
- **Production canonical payload desteği:** Mevcut deploy’da muhtemelen yok veya en azından kanıtlanmamış

### Kanıt İçin Gerekli Son Doğrulama

Deploy sonrası aşağıdaki üç çağrıdan ham çıktı alınmalı:

1. `PUT /users/:id/screen-permissions` legacy body
2. `PUT /users/:id/screen-permissions` canonical body
3. `GET /users/:id/screen-permissions?roleCode=...`

Her üç çağrının request/response çıktısı rapora eklenmeden bu başlık **tamamlandı** sayılmamalı.

## 5. Backend Typecheck FAIL Mini Düzeltme Planı

### Hata

Typecheck çıktısı:

- `src/modules/service-types/service-types.service.ts(35,7)`
- `src/modules/service-types/service-types.service.ts(71,48)`
- hata: zorunlu `code` alanı eksik

### Service İncelemesi

```27:39:apps/backend/src/modules/service-types/service-types.service.ts
  async create(data: { name: string; description?: string; isActive?: boolean; sortOrder?: number }) {
    const existing = await this.prisma.serviceType.findUnique({ where: { name: data.name } });
    if (existing) throw new ConflictException('Bu isimde bir hizmet türü zaten mevcut');
    return this.prisma.serviceType.create({
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }
```

```67:74:apps/backend/src/modules/service-types/service-types.service.ts
      const exists = await this.prisma.serviceType.findUnique({ where: { name: st.name } });
      if (!exists) {
        await this.prisma.serviceType.create({ data: { ...st, isActive: true } });
        created++;
      }
```

### Prisma Schema Kanıtı

Mevcut local schema’da `ServiceType` modelinde `code` alanı görünmüyor:

```3020:3027:apps/backend/prisma/schema.prisma
model ServiceType {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  isActive    Boolean  @default(true) @map("is_active")
  sortOrder   Int      @default(0) @map("sort_order")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
```

### Kök Neden Yorumu

Local schema ile typecheck hatası arasında tutarsızlık var:

- Prisma client, `ServiceTypeCreateInput` içinde `code` bekliyor
- Açık okunan schema kesitinde `code` alanı yok

Bu genellikle şu durumlardan birine işaret eder:

1. Prisma client güncel schema ile yeniden generate edilmemiştir
2. Çalışan/generated client, farklı bir schema sürümünden üretilmiştir
3. Repo içinde typecheck’in referans aldığı generated tipler schema dosyasından ileridedir

### Mini Düzeltme Planı

Bu başlık iki olası kola ayrılır:

#### Senaryo A — Gerçek veri modeli `code` istiyor

- `service-types.service.ts` içine `code` alanı eklenmeli
- `create`, `update`, `seed` akışları `code` üretmeli/taşımalı
- DTO ve çağıran katmanlar da hizalanmalı
- Migration gerekmezse düşük riskli service düzeltmesidir

#### Senaryo B — Schema’da `code` artık yok ama Prisma client geride

- Prisma client yeniden generate edilmeli
- Bu durumda service kodu değil toolchain/generated client düzeltilmiş olur
- Migration gerekmez

### Release Etkisi

`pnpm exec tsc --noEmit` doğrudan fail verdiği için:

- backend typecheck kapısı aktifse deploy’u engeller
- CI/CD typecheck kullanılıyorsa release blocker olarak değerlendirilmelidir

Bu nedenle mevcut durumda bu hata **release etkili** kabul edilmelidir.

## 6. Production Test Veri İzi Listesi

### Test Kullanıcıları

Production sorgu çıktısında aşağıdaki kullanıcılar görüldü:

| id | email | first_name | role_id | status | created_at |
|---|---|---|---|---|---|
| `7fcf1daa-4710-4a73-9c3c-d924c7f3c63e` | `a@a.com` | `Tests` | `16aa0d72-61fd-4090-8f81-7dcc16e6db2b` | `active` | `2026-05-17 15:33:17.464` |
| `141182b0-9cbd-4fcb-b822-70b795c2f993` | `info@safranbh.com` | `Test` | `1ae0cce1-6cf5-4d2a-9991-06ac320be4c1` | `active` | `2026-05-17 13:38:32.588` |
| `982721e9-4588-4a2b-9ffa-040e36c90f6b` | `A@A.COM` | `Test` | `16aa0d72-61fd-4090-8f81-7dcc16e6db2b` | `active` | `2026-05-17 13:30:57.019` |
| `732ce7f4-d309-4632-be70-140a1229f9da` | `tok2280108@test.com` | `Testok2` | `49881ed6-d820-4bc1-9cf7-4d8666239de2` | `active` | `2026-05-17 13:24:05.320` |
| `9737b600-8d06-4f0f-9d60-f0966952e081` | `tmp.verify.field2@example.invalid` | `Tmp` | `16aa0d72-61fd-4090-8f81-7dcc16e6db2b` | `active` | `2026-05-17 07:45:00.275` |
| `85060bef-50dd-40ef-8abb-219919984974` | `tmp.verify.insurance@example.invalid` | `Tmp` | `c0bc2641-2530-417f-98f9-499c5c189fec` | `active` | `2026-05-17 07:44:43.692` |

### Screen Permission İzleri

Sorgu çıktısı:

- `0 rows`

Yani mevcut filtreyle test/tmp kullanıcılarına bağlı `screen_permissions` kaydı bulunmadı.

### Karar

- Kayıtlar production’da bulunduğu için veri izi **mevcut**
- Silme/temizleme kararı danışman onayı olmadan verilmemeli
- Önerilen karar etiketi: **Temizlik için danışman onayı gerekli**

## 7. Karar Tablosu

| Konu | Karar |
|---|---|
| Faz 1 diff izolasyonu | Ayrı patch/commit ile yeniden ayrıştırılmalı |
| `insurance-company-scopes` | Production’a alınabilir değil, önce backend deploy/recreate gerekli |
| `screen-permissions` canonical kanıtı | Mevcut deploy için eksik; deploy sonrası canlı smoke test gerekli |
| Backend typecheck | Revizyon gerekir; release blocker olarak ele alınmalı |
| Production test verileri | Geri alınmalı/temizlenmeli kararı için danışman onayı gerekli |

### Genel Hüküm

**Production’a alınabilir:** Hayır  
**Revizyon gerekir:** Evet  
**Geri alınmalı:** Faz 1 değil; yalnız test verileri için karar danışman onayına bağlı

## 8. Sonraki Adım Önerileri

1. Faz 1 değişikliklerini faz dışı difflerden ayıran temiz patch hazırlanmalı
2. Backend image güncel kaynakla yeniden build edilip recreate edilmeli
3. Deploy sonrası `insurance-company-scopes` route grep + smoke test yapılmalı
4. `screen-permissions` için legacy ve canonical request/response ham kanıtları toplanmalı
5. `ServiceType` için schema/client uyumsuzluğu netleştirilip mini düzeltme uygulanmalı
6. Test kullanıcıları için danışman onayına sunulacak temizlik listesi hazırlanmalı

## 9. Açık Beyan

- Bu rapor deploy, migration, seed veya production veri temizliği uygulamaz.
- `screen-permissions` için production request/response kanıtı güvenlik kısıtı nedeniyle toplanamamıştır.
- `insurance-company-scopes` için production 404 kök nedeni mevcut kanıtlara göre güçlü biçimde “deploy edilmemiş / eski image” olarak değerlendirilmektedir.
- Word `.docx` teslim bu aşamada üretilmemiştir; onay sonrası `/Users/mustafayufkayurek/Desktop/faz1-revizyon-raporu-20260518.docx` hedefine dönüştürülebilir.