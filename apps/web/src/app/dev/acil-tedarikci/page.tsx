'use client';

import { useState } from 'react';
import { notFound } from 'next/navigation';
import { ToastProvider, useToast } from '@/contexts/ToastContext';
import { RecommendedVendorsTabs } from '@/components/vendor-discovery/RecommendedVendorsTabs';
import type { VendorRecommendation } from '@/utils/emergencyApi';

const FILE_CITY = 'İstanbul';
const FILE_DISTRICT = 'Kadıköy';

const PREVIEW_VENDORS: VendorRecommendation[] = [
  {
    id: 'v1',
    name: 'Kadıköy Acil Servis',
    phone: '0216 555 01 01',
    city: 'İstanbul',
    district: 'Kadıköy',
    avgResponseTime: null,
    avgServiceScore: 4.6,
    avgCost: 1850,
    completedFileCount: 12,
    compositeScore: 92,
    serviceBranches: ['Konut'],
    lastWorkedAt: new Date(Date.now() - 28 * 86_400_000).toISOString(),
  },
  {
    id: 'v2',
    name: 'Üsküdar Destek',
    phone: '0216 555 02 02',
    city: 'İstanbul',
    district: 'Üsküdar',
    avgResponseTime: null,
    avgServiceScore: 4.1,
    avgCost: 2100,
    completedFileCount: 8,
    compositeScore: 84,
    serviceBranches: ['Araç'],
    lastWorkedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
  },
  {
    id: 'v3',
    name: 'Çingir Acil',
    phone: '0216 555 03 03',
    city: 'İstanbul',
    district: 'Ataşehir',
    serviceBranches: ['Konut', 'Araç'],
    avgResponseTime: null,
    avgServiceScore: null,
    avgCost: null,
    completedFileCount: 0,
    compositeScore: 70,
    rank: 3,
  },
  {
    id: 'v4',
    name: 'Cahit Aysu',
    phone: '0276 555 04 04',
    city: 'Uşak',
    district: 'Merkez',
    avgResponseTime: null,
    avgServiceScore: null,
    avgCost: null,
    completedFileCount: 0,
    compositeScore: 55,
    rank: 4,
    serviceBranches: ['Tesisat'],
  },
  {
    id: 'v5',
    name: 'Ekrem Topçu',
    phone: '0464 555 05 05',
    city: 'Rize',
    district: 'Merkez',
    avgResponseTime: null,
    avgServiceScore: null,
    avgCost: null,
    completedFileCount: 0,
    compositeScore: 50,
    rank: 5,
    serviceBranches: ['Elektrik Arızası'],
  },
  {
    id: 'v6',
    name: 'Eyüp Çorlu',
    phone: '0346 555 06 06',
    city: 'Sivas',
    district: 'Merkez',
    avgResponseTime: null,
    avgServiceScore: null,
    avgCost: null,
    completedFileCount: 0,
    compositeScore: 48,
    rank: 6,
    serviceBranches: ['Kapı/Kilit Arızası'],
  },
];

function PreviewInner() {
  const { showToast } = useToast();
  const [assigned, setAssigned] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-xl space-y-4">
        <div>
          <p className="text-xs font-medium text-content-tertiary mb-1">Geliştirme / Acil Tedarikçi</p>
          <h1 className="text-2xl font-bold text-content-primary">Öneri Önizleme</h1>
          <p className="mt-1 text-sm text-content-secondary">
            Dosya bölgesi: <strong>{FILE_DISTRICT} · {FILE_CITY}</strong>
          </p>
          <p className="mt-1 text-xs text-content-tertiary">
            Önceki kart: Firma Adı satırları, bölge rozeti, Dosyaya Ata
          </p>
        </div>
        <RecommendedVendorsTabs
          loading={false}
          vendors={PREVIEW_VENDORS}
          assignedVendorId={assigned}
          onAssign={(id) => {
            setAssigned(id);
            showToast('success', 'Önizleme — Dosyaya Atandı');
          }}
          city={FILE_CITY}
          district={FILE_DISTRICT}
          serviceType="Su Kaçağı"
          category="acil"
          helpText="Üstte Memnuniyet Ve Fiyat Avantajı Yüksek İlk 3 Önerilir. Diğer Kayıtlılar Aynı Listede Kapalı/Açılır. Bölgede Yoksa Alternatif Önerilere Bakın."
        />
      </div>
    </main>
  );
}

export default function AcilTedarikciPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <ToastProvider>
      <PreviewInner />
    </ToastProvider>
  );
}
