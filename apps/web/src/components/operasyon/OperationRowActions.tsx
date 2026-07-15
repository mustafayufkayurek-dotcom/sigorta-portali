'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  Archive,
  Eye,
  FileText,
  History,
  Mail,
  MessageCircle,
  MoreVertical,
  Pencil,
  StickyNote,
} from 'lucide-react';
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

const iconBtnClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-transparent hover:border-slate-200 disabled:opacity-40';

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
      // PDF sihirli bayt kontrolü — JSON hata gövdesini indirme
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
            ? (Array.isArray((data as { message: string | string[] }).message)
              ? ((data as { message: string[] }).message).join(', ')
              : String((data as { message: string }).message))
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
    setOpen(false);
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

      <button type="button" title="Görüntüle" aria-label="Görüntüle" className={iconBtnClass} onClick={() => router.push(detailHref)}>
        <Eye className="h-3.5 w-3.5" aria-hidden />
      </button>
      {/* Hasar: Düzenle → ?edit=1 dosya bilgileri. Acil: Görüntüle ile aynı → tek ikon. */}
      {kind === 'hasar' && (
        <button type="button" title="Düzenle" aria-label="Düzenle" className={iconBtnClass} onClick={() => router.push(editHref)}>
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
      <button
        type="button"
        title="PDF Oluştur"
        aria-label="PDF Oluştur"
        className={iconBtnClass}
        disabled={pdfBusy}
        onClick={() => void handlePdf()}
      >
        <FileText className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button type="button" title="E-posta Gönder" aria-label="E-posta Gönder" className={iconBtnClass} onClick={openEmail}>
        <Mail className="h-3.5 w-3.5" aria-hidden />
      </button>
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        title="WhatsApp"
        aria-label="WhatsApp"
        className={iconBtnClass}
        onClick={() => setOpen(false)}
      >
        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
      </a>
      <button type="button" title="Not Ekle" aria-label="Not Ekle" className={iconBtnClass} onClick={() => router.push(noteHref)}>
        <StickyNote className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button type="button" title="Geçmiş" aria-label="Geçmiş" className={iconBtnClass} onClick={() => router.push(historyHref)}>
        <History className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button
        type="button"
        title="Arşive Taşı"
        aria-label="Arşive Taşı"
        className={`${iconBtnClass} text-red-600 hover:bg-red-50 hover:text-red-700`}
        onClick={() => onDeleteRequest?.()}
      >
        <Archive className="h-3.5 w-3.5" aria-hidden />
      </button>

      <button
        type="button"
        title="İşlem Menüsü"
        aria-label="İşlem Menüsü"
        aria-expanded={open}
        className={iconBtnClass}
        onClick={() => setOpen((v) => !v)}
        data-testid="ops-actions-menu-btn"
      >
        <MoreVertical className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-30 min-w-[176px] rounded-xl border border-slate-200 bg-white shadow-lg py-1 text-xs"
          data-testid="ops-actions-menu"
        >
          {menuItem('Görüntüle', () => {
            setOpen(false);
            router.push(detailHref);
          })}
          {kind === 'hasar' &&
            menuItem('Düzenle', () => {
              setOpen(false);
              router.push(editHref);
            })}
          {menuItem(pdfBusy ? 'PDF Oluşturuluyor…' : 'PDF Oluştur', () => void handlePdf(), {
            disabled: pdfBusy,
          })}
          {menuItem('E-posta Gönder', openEmail)}
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-left px-3 py-2 hover:bg-green-50 text-slate-700"
            onClick={() => setOpen(false)}
          >
            WhatsApp
          </a>
          {menuItem('Not Ekle', () => {
            setOpen(false);
            router.push(noteHref);
          })}
          {menuItem('Geçmiş', () => {
            setOpen(false);
            router.push(historyHref);
          })}
          <div className="my-1 border-t border-slate-100" />
          {menuItem(
            'Arşive Taşı',
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
