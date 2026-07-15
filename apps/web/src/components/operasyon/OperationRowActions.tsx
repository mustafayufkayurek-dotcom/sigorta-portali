'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { useToast } from '@/contexts/ToastContext';

export type OperationRowActionsProps = {
  kind: 'hasar' | 'acil';
  id: string;
  fileNo: string;
  /** En son onarım raporu — PDF / e-posta için */
  reportId?: string | null;
  /** Varsayılan e-posta alıcısı (sigorta şirketi vb.) */
  defaultEmailTo?: string | null;
  approval72hExceeded?: boolean;
  onDeleteRequest?: () => void;
  onEmailRequest?: () => void;
};

export function OperationRowActions({
  kind,
  id,
  fileNo,
  reportId,
  defaultEmailTo,
  approval72hExceeded,
  onDeleteRequest,
  onEmailRequest,
}: OperationRowActionsProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const detailHref =
    kind === 'hasar' ? `/panel/hasar-dosyalari/${id}` : `/panel/acil-yardim/${id}`;
  const editHref =
    kind === 'hasar' ? `/panel/hasar-dosyalari/${id}?edit=1` : `/panel/acil-yardim/${id}?edit=1`;
  const noteHref =
    kind === 'hasar'
      ? `/panel/hasar-dosyalari/${id}?grup=operasyon&alt=iletisim`
      : `/panel/acil-yardim/${id}`;
  const historyHref =
    kind === 'hasar'
      ? `/panel/hasar-dosyalari/${id}?grup=operasyon&alt=gecmis`
      : `/panel/acil-yardim/${id}`;

  const stop = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const waHref = `https://wa.me/?text=${encodeURIComponent(`Meridyen — Dosya: ${fileNo}`)}`;

  const handlePdf = async () => {
    setOpen(false);
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
      const blob = new Blob([res.data], { type: 'application/pdf' });
      if (blob.size < 32) {
        showToast('error', 'PDF oluşmadı veya boş döndü.');
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
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.message ?? e.message
        : e instanceof Error
          ? e.message
          : 'PDF oluşturulamadı';
      showToast('error', Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setPdfBusy(false);
    }
  };

  const menuItem = (
    label: string,
    onClick: () => void,
    opts?: { danger?: boolean; disabled?: boolean },
  ) => (
    <button
      type="button"
      disabled={opts?.disabled}
      className={`w-full text-left px-3 py-2 hover:bg-slate-50 disabled:opacity-40 ${
        opts?.danger ? 'text-red-700 hover:bg-red-50' : 'text-slate-700'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );

  return (
    <div ref={ref} className="relative flex items-center gap-0.5" onClick={stop} data-testid="ops-row-actions">
      {approval72hExceeded && (
        <button
          type="button"
          title="Onay Talep Et"
          className="px-1.5 py-1 rounded-md text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
          onClick={() => router.push(`${detailHref}?aksiyon=onay-talep`)}
        >
          Onay Talep Et
        </button>
      )}
      <button
        type="button"
        title="İşlem Menüsü"
        aria-label="İşlem Menüsü"
        aria-expanded={open}
        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 border border-transparent hover:border-slate-200"
        onClick={() => setOpen((v) => !v)}
        data-testid="ops-actions-menu-btn"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-30 min-w-[168px] rounded-xl border border-slate-200 bg-white shadow-lg py-1 text-xs"
          data-testid="ops-actions-menu"
        >
          {menuItem('Görüntüle', () => {
            setOpen(false);
            router.push(detailHref);
          })}
          {menuItem('Düzenle', () => {
            setOpen(false);
            router.push(editHref);
          })}
          {menuItem(pdfBusy ? 'PDF Oluşturuluyor…' : 'PDF Oluştur', () => void handlePdf(), {
            disabled: pdfBusy,
          })}
          {menuItem('E-posta Gönder', () => {
            setOpen(false);
            if (onEmailRequest) onEmailRequest();
            else if (!reportId) {
              showToast('error', 'Bu dosyada onarım raporu yok — PDF’siz e-posta engellendi.');
            } else {
              showToast('info', `Alıcı: ${defaultEmailTo || 'manuel girilecek'}`);
            }
          })}
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-left px-3 py-2 hover:bg-green-50 text-slate-700"
            onClick={() => setOpen(false)}
          >
            WhatsApp
          </a>
          {menuItem('Not', () => {
            setOpen(false);
            router.push(noteHref);
          })}
          {menuItem('Geçmiş', () => {
            setOpen(false);
            router.push(historyHref);
          })}
          <div className="my-1 border-t border-slate-100" />
          {menuItem(
            'Sil / İptal…',
            () => {
              setOpen(false);
              onDeleteRequest?.();
            },
            { danger: true },
          )}
        </div>
      )}
    </div>
  );
}
