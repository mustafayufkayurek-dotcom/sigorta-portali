'use client';

import { FieldOperationsMap } from '@/components/operasyon/FieldOperationsMap';
import { usePanelAccess } from '@/hooks/usePanelAccess';

export default function HaritaPage() {
  const { isAdmin } = usePanelAccess();
  return <FieldOperationsMap showNotice showPersonnelRoute ownerOnly={!isAdmin} />;
}
