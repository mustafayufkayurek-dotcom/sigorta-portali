'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Eye, FileText, History, Mail, MessageCircle, Pencil, Trash2 } from 'lucide-react';
import { API, authHeader } from '@/utils/api';
import { useToast } from '@/contexts/ToastContext';
import { PinnableRowActions } from '@/components/portal/PinnableRowActions';
import { defaultPinnedActionIds, OPS_ROW_ACTIONS } from '@/components/portal/portal-row-action-prefs';

export type OperationRowActionsProps = {
  kind: 'hasar' | 'acil';
  id: string;
  fileNo: string;
  pinnedIds?: string[];
  reportId?: string | null;
  defaultEmailTo?: string | null;
  onDeleteRequest?: () => void;
  onEmailRequest?: () => void;
  onAddNote?: () => void;
};

export function OperationRowActions({
  kind,
  id,
  fileNo,
  pinnedIds,
  reportId,
  defaultEmailTo,
  onDeleteRequest,
  onEmailRequest,
  onAddNote,
}: OperationRowActionsProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pdfBusy, setPdfBusy] = useState(false);
  const pins = pinnedIds ?? defaultPinnedActionIds(OPS_ROW_ACTIONS);

  const detailHref =
    kind === 'hasar' ? `/panel/hasar-dosyalari/${id}?grup=operasyon` : `/panel/acil-yardim/${id}`;
  const editHref = kind === 'hasar' ? `/panel/hasar-dosyalari/${id}?edit=1` : detailHref;
  const noteHref =
    kind === 'hasar'
      ? `/panel/hasar-dosyalari/${id}?grup=operasyon&gorunum=eski&alt=iletisim`
      : `/panel/acil-yardim/${id}`;
  const historyHref =
    kind === 'hasar'
      ? `/panel/hasar-dosyalari/${id}?grup=operasyon&gorunum=eski&alt=gecmis`
      : `/panel/acil-yardim/${id}`;
  const waHref = `https://api.whatsapp.com/send?text=${encodeURIComponent(`Meridyen — Dosya: ${fileNo}`)}`;

  const handlePdf = async () => {
    if (kind !== 'hasar') {
      showToast('warning', 'Acil dosya için onarım raporu PDF’i yok.');
      return;
    }
    if (!reportId) {
      showToast('error', 'Bu dosyada onarım raporu yok — PDF oluşturulamaz.');
      router.push(`/panel/hasar-dosyalari/${id}/onarim-raporu`);
      return;
    }
    setPdfBusy(true);
    try {
      const res = await axios.get(`${API}/repair-reports/${reportId}/pdf?view=external`, {
        headers: authHeader(),
        responseType: 'blob',
      });
      const contentType = String(res.headers?.['content-type'] ?? '');
      if (contentType.includes('application/json') || contentType.includes('text/')) {
        const text = await (res.data as Blob).text();
        let msg = 'PDF oluşturulamadı';
        try {
          const parsed = JSON.parse(text) as { message?: string | string[] };
          msg = Array.isArray(parsed.message) ? parsed.message.join(', ') : (parsed.message ?? msg);
        } catch {
          msg = text.slice(0, 180) || msg;
        }
        showToast('error', msg);
        return;
      }
      const blob = new Blob([res.data], { type: 'application/pdf' });
      if (blob.size < 32) {
        showToast('error', 'PDF oluşmadı veya boş döndü.');
        return;
      }
      const head = await blob.slice(0, 5).text();
      if (!head.startsWith('%PDF')) {
        showToast('error', 'Sunucu PDF yerine hata döndü.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `onarim-raporu-${fileNo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('success', 'PDF oluşturuldu ve indirildi.');
    } catch (e: unknown) {
      let msg = 'PDF oluşturulamadı';
      if (axios.isAxiosError(e)) {
        const data = e.response?.data;
        if (data instanceof Blob) {
          try {
            const parsed = JSON.parse(await data.text()) as { message?: string | string[] };
            msg = Array.isArray(parsed.message) ? parsed.message.join(', ') : (parsed.message ?? e.message);
          } catch {
            msg = e.message;
          }
        } else {
          msg = (data as { message?: string | string[] })?.message
            ? Array.isArray((data as { message: string | string[] }).message)
              ? ((data as { message: string[] }).message).join(', ')
              : String((data as { message: string }).message)
            : e.message;
        }
      } else if (e instanceof Error) {
        msg = e.message;
      }
      showToast('error', msg);
    } finally {
      setPdfBusy(false);
    }
  };

  const openEmail = () => {
    if (onEmailRequest) {
      onEmailRequest();
      return;
    }
    if (!reportId) {
      showToast('error', 'Bu dosyada onarım raporu yok — PDF’siz e-posta engellendi.');
      return;
    }
    showToast('info', `Alıcı: ${defaultEmailTo || 'manuel girilecek'}`);
  };

  return (
    <PinnableRowActions
      rowId={id}
      menuEvent="ops-row-menu-open"
      testId="ops-row-actions"
      menuTestId="ops-actions-menu"
      moreTestId="ops-actions-menu-btn"
      pinnedIds={pins}
      items={[
        {
          id: 'view',
          label: 'Görüntüle',
          onClick: () => router.push(detailHref),
          icon: <Eye className="h-3.5 w-3.5" aria-hidden />,
        },
        {
          id: 'pdf',
          label: 'PDF Oluştur',
          onClick: () => void handlePdf(),
          disabled: pdfBusy,
          hidden: kind !== 'hasar',
          icon: <FileText className="h-3.5 w-3.5" aria-hidden />,
        },
        {
          id: 'mail',
          label: 'E-posta Gönder',
          onClick: openEmail,
          icon: <Mail className="h-3.5 w-3.5" aria-hidden />,
        },
        {
          id: 'whatsapp',
          label: 'WhatsApp',
          onClick: () => window.open(waHref, '_blank', 'noopener,noreferrer'),
          icon: <MessageCircle className="h-3.5 w-3.5" aria-hidden />,
        },
        {
          id: 'note',
          label: 'Not Yaz',
          onClick: () => {
            if (onAddNote) {
              onAddNote();
              return;
            }
            router.push(noteHref);
          },
          icon: <Mail className="h-3.5 w-3.5" aria-hidden />,
        },
        {
          id: 'edit',
          label: 'Düzenle',
          onClick: () => router.push(editHref),
          hidden: kind !== 'hasar',
          icon: <Pencil className="h-3.5 w-3.5" aria-hidden />,
        },
        {
          id: 'history',
          label: 'Geçmiş',
          onClick: () => router.push(historyHref),
          icon: <History className="h-3.5 w-3.5" aria-hidden />,
        },
        {
          id: 'archive',
          label: 'Arşive Taşı',
          onClick: () => onDeleteRequest?.(),
          danger: true,
          icon: <Trash2 className="h-3.5 w-3.5" aria-hidden />,
        },
      ]}
    />
  );
}
