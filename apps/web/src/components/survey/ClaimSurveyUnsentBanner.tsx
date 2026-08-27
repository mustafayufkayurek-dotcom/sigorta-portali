'use client';

/**
 * Kapalı hasar dosyasında anket WhatsApp linki henüz üretilmediyse dosya sorumlusuna amber uyarı.
 * Anket zorunlu değildir; kapanışı engellemez.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InspectionReminderBanner } from '@/components/field-survey/InspectionReminderBanner';
import { getSurveyByClaimFile } from '@/utils/surveyApi';
import { surveyLinkSent } from '@/utils/survey-form';

type Props = {
  claimFileId: string;
  assignedOfficeUserId?: string | null;
  fileClosed: boolean;
};

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

export function ClaimSurveyUnsentBanner({
  claimFileId,
  assignedOfficeUserId,
  fileClosed,
}: Props) {
  const userId = useMemo(() => readUserId(), []);
  const isOwner = Boolean(userId && assignedOfficeUserId && userId === assignedOfficeUserId);

  const query = useQuery({
    queryKey: ['claim-survey-unsent', claimFileId],
    enabled: fileClosed && isOwner,
    retry: 1,
    throwOnError: false,
    queryFn: () => getSurveyByClaimFile(claimFileId),
  });

  if (!fileClosed || !isOwner || query.isLoading || query.isError) return null;
  if (surveyLinkSent(query.data)) return null;

  return (
    <div className="mb-4">
      <InspectionReminderBanner
        message="Bu Dosya Kapandı; Müşteri Memnuniyet Anketi WhatsApp İle Gönderilmedi. Anket Zorunlu Değildir."
        href={`/panel/hasar-dosyalari/${encodeURIComponent(claimFileId)}?grup=finans`}
        ctaLabel="Anket Linkine Git"
        testId="dosya-anket-hatirlatma"
      />
    </div>
  );
}
