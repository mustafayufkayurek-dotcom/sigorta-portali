'use client';

/**
 * Dosya Sorumlusu Merkezi — tespit henüz yapılmadı uyarısı.
 * Yöntem: Saha ile aynı amber dashboard bandı (çan / mesaj kanalı yok).
 * Yalnız office_staff layout’tan mount edilir.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { InspectionReminderBanner } from '@/components/field-survey/InspectionReminderBanner';
import { inspectionReminder } from '@/utils/field-staff-claim-view';
import { CLAIM_LIST_OPEN_HREF } from '../../utils/claim-nav-href';

type OfficeClaimRow = {
  id: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  inspectionDone?: boolean | null;
  inspectionDoneAt?: string | null;
  statusChangedAt?: string | null;
  currentStatus?: { code?: string | null; name?: string | null } | null;
};

function readOfficeUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user') ?? localStorage.getItem('currentUser');
    if (!raw) return null;
    const u = JSON.parse(raw) as { id?: string; role?: { code?: string }; roleCode?: string };
    const code = String(u?.role?.code ?? u?.roleCode ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    if (code !== 'office_staff') return null;
    return typeof u?.id === 'string' ? u.id : null;
  } catch {
    return null;
  }
}

export function OfficeInspectionReminder() {
  const officeUserId = useMemo(() => readOfficeUserId(), []);

  const claimsQuery = useQuery({
    queryKey: ['office-inspection-reminder', officeUserId],
    enabled: Boolean(officeUserId),
    retry: 1,
    throwOnError: false,
    queryFn: async () => {
      const res = await apiClient.getWithMeta<OfficeClaimRow[], { total?: number }>('/claim-files', {
        limit: 80,
        statusCode: 'open',
        assignedOfficeUserId: officeUserId!,
      });
      return res.data ?? [];
    },
  });

  const reminder = useMemo(
    () => inspectionReminder(claimsQuery.data ?? [], 'office'),
    [claimsQuery.data],
  );

  if (!officeUserId || claimsQuery.isLoading || claimsQuery.isError) return null;
  if (reminder.pendingCount === 0) return null;

  return (
    <div className="mb-4">
      <InspectionReminderBanner
        message={reminder.message}
        href={CLAIM_LIST_OPEN_HREF}
        ctaLabel="Dosyalarıma Git"
        testId="ofis-tespit-hatirlatma"
      />
    </div>
  );
}
