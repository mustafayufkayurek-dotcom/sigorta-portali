'use client';

import { ClipboardList, Copy, Eye, FileText, History, Mail } from 'lucide-react';
import { PinnableRowActions } from './PinnableRowActions';

export type InsuranceDosyalarActionsProps = {
  rowId: string;
  pinnedIds: string[];
  onFileSummary: () => void;
  onAddNote: () => void;
  onDocuments: () => void;
  onOperation: () => void;
  onHistory: () => void;
  onCopyFileNo: () => void;
};

export function InsuranceDosyalarActions({
  rowId,
  pinnedIds,
  onFileSummary,
  onAddNote,
  onDocuments,
  onOperation,
  onHistory,
  onCopyFileNo,
}: InsuranceDosyalarActionsProps) {
  return (
    <PinnableRowActions
      rowId={rowId}
      menuEvent="sigorta-dosyalar-menu-open"
      testId="sigorta-dosyalar-actions"
      menuTestId="sigorta-dosyalar-menu"
      moreTestId="sigorta-dosyalar-more"
      pinnedIds={pinnedIds}
      items={[
        {
          id: 'summary',
          label: 'Dosya Özeti',
          onClick: onFileSummary,
          testId: 'sigorta-dosyalar-summary',
          icon: <Eye className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'note',
          label: 'Dosya Notu Oluştur Ve Gönder',
          onClick: onAddNote,
          testId: 'sigorta-dosyalar-note',
          icon: <Mail className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'documents',
          label: 'Evraklar',
          onClick: onDocuments,
          icon: <FileText className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'operation',
          label: 'Operasyon Bilgileri',
          onClick: onOperation,
          icon: <ClipboardList className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'history',
          label: 'Geçmiş',
          onClick: onHistory,
          icon: <History className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'copyFileNo',
          label: 'Dosya No Kopyala',
          onClick: onCopyFileNo,
          icon: <Copy className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
      ]}
    />
  );
}
