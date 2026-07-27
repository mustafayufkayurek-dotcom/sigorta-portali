# Meridyen Design System

Bu katman mevcut Meridyen ekranlarını yeniden tasarlamak için değil, ortak görsel dili güvenli biçimde korumak için kullanılır.

## Renk Paleti

| Token | Kullanım |
|---|---|
| `brand-50` – `brand-900` | Birincil aksiyonlar, linkler, odak halleri |
| `surface` / `surface-muted` / `surface-subtle` | Kart ve arka plan yüzeyleri |
| `border` / `border-strong` | Bileşen ayırıcıları ve güçlü sınırlar |
| `content-primary` / `secondary` / `tertiary` | Metin hiyerarşisi |
| `status-success` / `warning` / `danger` / `info` | Durum göstergeleri |

`rounded-card` kartlarda, `rounded-button` butonlarda kullanılır.

## Bileşenler

### StatCard

```tsx
import { FolderOpen } from 'lucide-react';
import { StatCard } from '@/components/ui';

<StatCard
  title="Açık Dosyalar"
  value={24}
  icon={FolderOpen}
  iconColor="blue"
  trend={{ value: 12, isPositive: true }}
  href="/panel/hasar-dosyalari"
/>
```

### PageHeader

```tsx
import { PageHeader } from '@/components/ui';

<PageHeader
  breadcrumbs={[{ label: 'Operasyon', href: '/panel' }, { label: 'Dosyalar' }]}
  title="Dosyalar"
  subtitle="Operasyon dosyalarını yönetin."
  lastUpdated="25.07.2026 10:30"
  actions={<button className="btn-primary">Yeni Dosya</button>}
/>
```

### SectionCard

```tsx
import { SectionCard } from '@/components/ui';

<SectionCard title="Son İşlemler" action={<a href="/panel">Tümünü Gör</a>}>
  <ActivityList />
</SectionCard>
```

### EmptyState

```tsx
import { FolderOpen } from 'lucide-react';
import { EmptyState } from '@/components/ui';

<EmptyState
  icon={FolderOpen}
  title="Dosya Bulunamadı"
  description="Bu filtreye uygun dosya yok."
/>
```

## Do's

- Token sınıflarını tercih edin: `bg-surface`, `text-content-secondary`, `border-border`.
- Ortak bileşenleri yeni ekranlarda tekrar kullanın.
- Durum bilgilerini kısa, tutarlı badge’lerle gösterin.
- `className` ile yalnız gerektiği kadar yerel uyarlama yapın.

## Don'ts

- Mevcut shell, sidebar, header veya kullanıcı akışını ortak bileşen gerekçesiyle değiştirmeyin.
- Sayfa içinde yeni renk sistemi veya rastgele hex değerleri üretmeyin.
- Aynı amaç için yeni bir kart/header bileşeni yazmayın.
- Kullanıcıya görünen metinlerde `uppercase` kullanmayın.
- Birincil aksiyon için `indigo-600`, `blue-600` veya rastgele hex kullanmayın — her zaman `brand-600` (hover: `brand-700`, koyu hover: `brand-800`).
- Durum renkleri için `emerald-500`, `amber-500`, `red-500` kullanmayın — `status-success` / `status-warning` / `status-danger`.

### Örnek — birincil aksiyon rengi

```tsx
// ❌ BAD
<button className="bg-indigo-600 hover:bg-indigo-700 text-white">Kaydet</button>

// ✅ GOOD
<button className="bg-brand-600 hover:bg-brand-700 text-white">Kaydet</button>
```

Not: Bazı modüllerde renk iş kuralı anlamı taşır (Müşteriler yeşili, kurumsal/bireysel rozet ayrımı gibi). Bunlar kasıtlıdır, değiştirilmez — yalnız *rastgele/kazara* farklı renkler token'a bağlanır.
