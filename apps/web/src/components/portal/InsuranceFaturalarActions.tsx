'use client';

import { Copy, Download, Eye, FileText, FolderOpen, History, Mail } from 'lucide-react';
import { PinnableRowActions } from './PinnableRowActions';

export type InsuranceFaturalarActionsProps = {
  rowId: string;
  pinnedIds: string[];
  hasClaimFile: boolean;
  onPreviewReport: () => void;
  onAddNote: () => void;
  onFileSummary: () => void;
  onDocuments: () => void;
  onDownloadInvoice: () => void;
  onHistory: () => void;
  onCopyFileNo: () => void;
  onCopyInvoiceNo: () => void;
};

export function InsuranceFaturalarActions({
  rowId,
  pinnedIds,
  hasClaimFile,
  onPreviewReport,
  onAddNote,
  onFileSummary,
  onDocuments,
  onDownloadInvoice,
  onHistory,
  onCopyFileNo,
  onCopyInvoiceNo,
}: InsuranceFaturalarActionsProps) {
  return (
    <PinnableRowActions
      rowId={rowId}
      menuEvent="sigorta-faturalar-menu-open"
      testId="sigorta-faturalar-actions"
      menuTestId="sigorta-faturalar-menu"
      moreTestId="sigorta-faturalar-more"
      pinnedIds={pinnedIds}
      items={[
        {
          id: 'preview',
          label: 'Rapor Önizleme',
          onClick: onPreviewReport,
          disabled: !hasClaimFile,
          icon: <Eye className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'note',
          label: 'Dosya Notu Oluştur Ve Gönder',
          onClick: onAddNote,
          disabled: !hasClaimFile,
          icon: <Mail className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'download',
          label: 'Faturayı İndir',
          onClick: onDownloadInvoice,
          icon: <Download className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'documents',
          label: 'Evraklar',
          onClick: onDocuments,
          disabled: !hasClaimFile,
          icon: <FileText className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'summary',
          label: 'Dosya Özeti',
          onClick: onFileSummary,
          disabled: !hasClaimFile,
          icon: <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'history',
          label: 'Geçmiş',
          onClick: onHistory,
          disabled: !hasClaimFile,
          icon: <History className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'copyFileNo',
          label: 'Dosya No Kopyala',
          onClick: onCopyFileNo,
          disabled: !hasClaimFile,
          icon: <Copy className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'copyInvoiceNo',
          label: 'Fatura No Kopyala',
          onClick: onCopyInvoiceNo,
          icon: <Copy className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
      ]}
    />
  );
}
