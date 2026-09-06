'use client';

import { useRouter } from 'next/navigation';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { PinnableRowActions } from '@/components/portal/PinnableRowActions';
import { TEDARIKCI_ROW_ACTIONS, defaultPinnedActionIds } from '@/components/portal/portal-row-action-prefs';

type Props = {
  vendorId: string;
  pinnedIds?: string[];
  onEdit: () => void;
  onDelete: () => void;
  highlightEdit?: boolean;
};

/** Müşteri/Hasar satır ikonları ile aynı kabuk; kapsam yalnız tedarikçi kartı. */
export function VendorRowActions({ vendorId, pinnedIds, onEdit, onDelete, highlightEdit }: Props) {
  const router = useRouter();
  const pins = pinnedIds ?? defaultPinnedActionIds(TEDARIKCI_ROW_ACTIONS);

  return (
    <PinnableRowActions
      rowId={vendorId}
      menuEvent="tedarikci-menu-open"
      testId="tedarikci-row-actions"
      menuTestId="tedarikci-menu"
      moreTestId="tedarikci-more"
      pinnedIds={pins}
      items={[
        {
          id: 'view',
          label: 'Görüntüle',
          icon: <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />,
          onClick: () => router.push(`/panel/tedarikciler/${vendorId}`),
        },
        {
          id: 'edit',
          label: highlightEdit ? 'Kimliği tamamla' : 'Düzenle',
          icon: <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />,
          onClick: onEdit,
        },
        {
          id: 'delete',
          label: 'Sil…',
          icon: <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />,
          onClick: onDelete,
          danger: true,
        },
      ]}
    />
  );
}
