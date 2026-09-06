'use client';

import { Check, Copy, Download, Eye, FileText, FolderOpen, History, Mail } from 'lucide-react';
import { PinnableRowActions } from './PinnableRowActions';

export type InsuranceOnaylarActionsProps = {
  rowId: string;
  pinnedIds: string[];
  canRespond: boolean;
  onPreviewReport: () => void;
  onApprove: () => void;
  onAddNote: () => void;
  onFileSummary: () => void;
  onDocuments: () => void;
  onDownloadReport: () => void;
  onHistory: () => void;
  onCopyFileNo: () => void;
};

export function InsuranceOnaylarActions({
  rowId,
  pinnedIds,
  canRespond,
  onPreviewReport,
  onApprove,
  onAddNote,
  onFileSummary,
  onDocuments,
  onDownloadReport,
  onHistory,
  onCopyFileNo,
}: InsuranceOnaylarActionsProps) {
  return (
    <PinnableRowActions
      rowId={rowId}
      menuEvent="sigorta-onaylar-menu-open"
      testId="sigorta-onaylar-actions"
      menuTestId="sigorta-onaylar-menu"
      moreTestId="sigorta-onaylar-more"
      pinnedIds={pinnedIds}
      items={[
        {
          id: 'preview',
          label: 'Rapor Önizleme',
          onClick: onPreviewReport,
          icon: <Eye className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'approve',
          label: 'Onayla',
          onClick: onApprove,
          hidden: !canRespond,
          testId: 'sigorta-onaylar-approve',
          icon: <Check className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'note',
          label: 'Dosya Notu Oluştur Ve Gönder',
          onClick: onAddNote,
          testId: 'sigorta-onaylar-note',
          icon: <Mail className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'documents',
          label: 'Evraklar',
          onClick: onDocuments,
          icon: <FileText className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'summary',
          label: 'Dosya Özeti',
          onClick: onFileSummary,
          icon: <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'download',
          label: 'Raporu İndir',
          onClick: onDownloadReport,
          icon: <Download className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
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
