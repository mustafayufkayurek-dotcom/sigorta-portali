import { Suspense } from 'react';
import { GirisKoduKopyalaClient } from './GirisKoduKopyalaClient';

export default function GirisKoduKopyalaPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-slate-500">Yükleniyor…</p>}>
      <GirisKoduKopyalaClient />
    </Suspense>
  );
}
