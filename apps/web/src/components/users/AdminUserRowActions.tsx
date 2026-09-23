'use client';

import { Archive, KeyRound, Pencil, Trash2, UserCheck } from 'lucide-react';
import { PinnableRowActions } from '@/components/portal/PinnableRowActions';
import { ADMIN_USER_ROW_ACTIONS, defaultPinnedActionIds } from '@/components/portal/portal-row-action-prefs';

export function AdminUserRowActions({
  userId,
  pinnedIds,
  protectedAdmin,
  isSelf,
  status,
  onEdit,
  onResetPwd,
  onActivate,
  onArchive,
  onDelete,
}: {
  userId: string;
  pinnedIds?: string[];
  protectedAdmin: boolean;
  isSelf: boolean;
  status: string;
  onEdit: () => void;
  onResetPwd: () => void;
  onActivate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const pins = pinnedIds ?? defaultPinnedActionIds(ADMIN_USER_ROW_ACTIONS);
  const inactive = status === 'inactive' || status === 'archived';
  const archived = status === 'archived';
  const active = status === 'active';

  return (
    <PinnableRowActions
      rowId={userId}
      menuEvent="admin-user-menu-open"
      testId="admin-user-row-actions"
      menuTestId="admin-user-menu"
      moreTestId="admin-user-more"
      pinnedIds={pins}
      items={[
        {
          id: 'edit',
          label: 'Düzenle',
          icon: <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />,
          onClick: onEdit,
        },
        {
          id: 'resetPwd',
          label: 'Geçici Şifre Üret',
          icon: <KeyRound className="h-3.5 w-3.5" strokeWidth={1.75} />,
          onClick: onResetPwd,
          hidden: protectedAdmin,
        },
        {
          id: 'activate',
          label: 'Yeniden Aktifleştir',
          icon: <UserCheck className="h-3.5 w-3.5" strokeWidth={1.75} />,
          onClick: onActivate,
          hidden: !inactive || protectedAdmin || isSelf,
        },
        {
          id: 'archive',
          label: 'Arşivle',
          icon: <Archive className="h-3.5 w-3.5" strokeWidth={1.75} />,
          onClick: onArchive,
          hidden: !active || protectedAdmin || isSelf,
          danger: true,
        },
        {
          id: 'delete',
          label: 'Kalıcı Sil',
          icon: <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />,
          onClick: onDelete,
          hidden: !archived || protectedAdmin || isSelf,
          danger: true,
        },
      ]}
    />
  );
}
