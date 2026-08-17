'use client';

/**
 * Mesaj Şablonları — lokal kontrol (oturumsuz)
 * Panel yolu: /panel/ayarlar/sms-bildirimler (oturum gerekir)
 * Production’da kapalı. Commit / push / deploy bu aşamada yok.
 */

import { notFound } from 'next/navigation';
import { MessageTemplatesPage } from '@/components/settings/MessageTemplatesPage';

export default function MesajSablonlariLocalPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <MessageTemplatesPage localPreview />
      </div>
    </div>
  );
}
