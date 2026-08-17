'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  Eye,
  FileText,
  Mail,
  MessageCircle,
  MoreVertical,
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
  onDeleteRequest?: () => void;
  onEmailRequest?: () => void;
  /** Ortak Not Yaz (tercihe bağlı e-posta) — verilirse dosya detayına gitmez */
  onAddNote?: () => void;
};

const iconBtnClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-transparent hover:border-slate-200 disabled:opacity-40';

export function OperationRowActions({
  kind,
  id,
  fileNo,
  reportId,
  defaultEmailTo,
  onDeleteRequest,
  onEmailRequest,
  onAddNote,
}: OperationRowActionsProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPos = () => {
    const btn = moreBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 180;
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8,
    );
    setMenuPos({ top: rect.bottom + 4, left });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updateMenuPos();
    const onScrollOrResize = () => updateMenuPos();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const detailHref =
    kind === 'hasar' ? `/panel/hasar-dosyalari/${id}?grup=operasyon` : `/panel/acil-yardim/${id}`;
  /** Hasar: ?edit=1 ile dosya bilgileri düzenleme (Görüntüle’den ayrı) */
  const editHref =
    kind === 'hasar' ? `/panel/hasar-dosyalari/${id}?edit=1` : detailHref;
  const noteHref =
    kind === 'hasar'
      ? `/panel/hasar-dosyalari/${id}?grup=operasyon&gorunum=eski&alt=iletisim`
      : `/panel/acil-yardim/${id}`;
  const historyHref =
    kind === 'hasar'
      ? `/panel/hasar-dosyalari/${id}?grup=operasyon&gorunum=eski&alt=gecmis`
      : `/panel/acil-yardim/${id}`;

  const stop = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const waHref = `https://api.whatsapp.com/send?text=${encodeURIComponent(`Meridyen — Dosya: ${fileNo}`)}`;

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
        opts?.danger ? 'text-status-danger hover:bg-red-50' : 'text-slate-700'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );

  const menu =
    open && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[120] min-w-[180px] rounded-xl border border-slate-200 bg-white py-1 text-xs shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left }}
            data-testid="ops-actions-menu"
            role="menu"
          >
            {/* Hasar: Düzenle = ?edit=1 (Görüntüle’den ayrı). Acil: tek Görüntüle — menüde Düzenle yok. */}
            {kind === 'hasar' &&
              menuItem('Düzenle', () => {
                setOpen(false);
                router.push(editHref);
              })}
            {menuItem('Not Yaz', () => {
              setOpen(false);
              if (onAddNote) {
                onAddNote();
                return;
              }
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
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={ref} className="relative flex items-center gap-0.5" onClick={stop} data-testid="ops-row-actions">
      {/* Görünür: Görüntüle · PDF · Mail · WhatsApp — diğerleri ⋮ menüde */}
      <button type="button" title="Görüntüle" aria-label="Görüntüle" className={iconBtnClass} onClick={() => router.push(detailHref)}>
        <Eye className="h-3.5 w-3.5" aria-hidden />
      </button>
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

      <button
        ref={moreBtnRef}
        type="button"
        aria-label="Diğer"
        aria-expanded={open}
        className={iconBtnClass}
        onClick={() => setOpen((v) => !v)}
        data-testid="ops-actions-menu-btn"
      >
        <MoreVertical className="h-3.5 w-3.5" aria-hidden />
      </button>
      {menu}
    </div>
  );
}
