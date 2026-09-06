'use client';

import { useRouter } from 'next/navigation';
import { Archive, Eye, Pencil } from 'lucide-react';
import { PinnableRowActions } from '@/components/portal/PinnableRowActions';
import { MUSTERI_ROW_ACTIONS, defaultPinnedActionIds } from '@/components/portal/portal-row-action-prefs';

type Props = {
  customerId: string;
  pinnedIds?: string[];
  canArchive?: boolean;
  onEdit: () => void;
  onArchive?: () => void;
};

/** Hasar/Acil satır ikonları ile aynı kabuk; kapsam yalnız müşteri kartı. */
export function CustomerRowActions({
  customerId,
  pinnedIds,
  canArchive = false,
  onEdit,
  onArchive,
}: Props) {
  const router = useRouter();
  const pins = pinnedIds ?? defaultPinnedActionIds(MUSTERI_ROW_ACTIONS);

  return (
    <PinnableRowActions
      rowId={customerId}
      menuEvent="musteri-menu-open"
      testId="musteri-row-actions"
      menuTestId="musteri-menu"
      moreTestId="musteri-more"
      pinnedIds={pins}
      items={[
        {
          id: 'view',
          label: 'Görüntüle',
          icon: <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />,
          onClick: () => router.push(`/panel/musteriler/${customerId}`),
        },
        {
          id: 'edit',
          label: 'Düzenle',
          icon: <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />,
          onClick: onEdit,
        },
        {
          id: 'archive',
          label: 'Arşivle',
          icon: <Archive className="h-3.5 w-3.5" strokeWidth={1.75} />,
          onClick: () => onArchive?.(),
          hidden: !canArchive || !onArchive,
          danger: true,
        },
      ]}
    />
  );
}
