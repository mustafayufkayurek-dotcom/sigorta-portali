'use client';

/**
 * Dosya Sorumlusu Merkezi — kapanmış dosyada anket WhatsApp linki gönderilmedi uyarısı.
 * Tespit bandı ile aynı amber yöntem; çan / mesaj kanalı yok.
 * Anket zorunlu değildir; kapanışı engellemez.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InspectionReminderBanner } from '@/components/field-survey/InspectionReminderBanner';
import { listClosureUnsentSurveys } from '@/utils/surveyApi';
import { CLAIM_LIST_CLOSED_HREF, claimDetailHref } from '../../utils/claim-nav-href';

function readUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user') ?? localStorage.getItem('currentUser');
    if (!raw) return null;
    const u = JSON.parse(raw) as { id?: string };
    return typeof u?.id === 'string' ? u.id : null;
  } catch {
    return null;
  }
}

export function OfficeSurveyReminder() {
  const userId = useMemo(() => readUserId(), []);

  const query = useQuery({
    queryKey: ['office-survey-closure-unsent', userId],
    enabled: Boolean(userId),
    retry: 1,
    throwOnError: false,
    queryFn: listClosureUnsentSurveys,
  });

  const files = query.data ?? [];
  if (!userId || query.isLoading || query.isError) return null;
  if (files.length === 0) return null;

  const firstHref = claimDetailHref(files[0]?.id);
  const href = files.length === 1 && firstHref ? firstHref : CLAIM_LIST_CLOSED_HREF;
  const message =
    files.length === 1
      ? `${files[0].fileNo} Dosyası Kapandı; Müşteri Memnuniyet Anketi WhatsApp İle Gönderilmedi`
      : `${files.length} Kapalı Dosyada Müşteri Memnuniyet Anketi WhatsApp İle Gönderilmedi`;

  return (
    <div className="mb-4">
      <InspectionReminderBanner
        message={message}
        href={href}
        ctaLabel={files.length === 1 ? 'Dosyaya Git' : 'Kapalı Dosyalara Git'}
        testId="ofis-anket-hatirlatma"
      />
    </div>
  );
}
