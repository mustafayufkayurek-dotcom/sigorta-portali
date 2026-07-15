'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { useToast } from '@/contexts/ToastContext';

export type OperationSendEmailTarget = {
  claimId: string;
  fileNo: string;
  reportId: string | null;
  defaultTo?: string;
};

type EmailTemplateOpt = {
  id: string;
  name: string;
  subject?: string;
  isActive?: boolean;
};

type Props = {
  target: OperationSendEmailTarget | null;
  onClose: () => void;
};

/**
 * Operasyon → E-posta Gönder: PDF üret → ekle → gönder.
 * PDF yok / oluşmazsa FAIL (toast). SMTP yoksa PARTIAL (pdfAttached kanıtı).
 */
export function OperationSendEmailModal({ target, onClose }: Props) {
  const { showToast } = useToast();
  const [to, setTo] = useState('');
  const [viewType, setViewType] = useState<'external' | 'internal'>('external');
  const [subject, setSubject] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [templates, setTemplates] = useState<EmailTemplateOpt[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!target) return;
    setTo(target.defaultTo ?? '');
    setSubject(`Hasar Onarım Raporu — ${target.fileNo}`);
    setViewType('external');
    setTemplateId('');
  }, [target]);

  useEffect(() => {
    if (!target) return;
    axios
      .get(`${API}/system-settings/email-templates`, { headers: authHeader() })
      .then((res) => {
        const raw = res.data?.data ?? res.data?.values ?? res.data ?? [];
        const list = (Array.isArray(raw) ? raw : [])
          .filter((t: EmailTemplateOpt) => t && t.id && t.name && t.isActive !== false)
          .map((t: EmailTemplateOpt) => ({
            id: String(t.id),
            name: String(t.name),
            subject: t.subject ? String(t.subject) : undefined,
            isActive: t.isActive,
          }));
        setTemplates(list);
      })
      .catch(() => setTemplates([]));
  }, [target]);

  if (!target) return null;

  const noteHref = `/panel/hasar-dosyalari/${target.claimId}?grup=operasyon&alt=iletisim`;
  const pdfAttachLabel = target.reportId
    ? `Onarım Raporu PDF — ${target.fileNo}`
    : 'PDF eki yok (rapor bulunamadı)';

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    if (tpl.subject?.trim()) {
      setSubject(tpl.subject.replace(/\{dosyaNo\}/gi, target.fileNo).trim());
    }
  };

  const submit = async () => {
    if (!target.reportId) {
      showToast('error', 'Bu dosyada onarım raporu yok — PDF oluşamaz, e-posta gönderilemez.');
      return;
    }
    const recipient = to.trim();
    if (!recipient || !recipient.includes('@')) {
      showToast('error', 'Geçerli bir alıcı e-posta adresi girin.');
      return;
    }
    setBusy(true);
    try {
      const res = await axios.post(
        `${API}/repair-reports/${target.reportId}/send-email`,
        { to: recipient, subject: subject.trim() || undefined, viewType },
        { headers: authHeader() },
      );
      const data = res.data?.data ?? res.data;
      const pdfAttached = Boolean(data?.pdfAttached);
      const mode = data?.mode as string | undefined;
      const message = data?.message ?? '';

      if (!pdfAttached) {
        showToast('error', 'PDF eki oluşmadan gönderim engellendi.');
        return;
      }

      if (data?.success) {
        showToast('success', `E-posta PDF eki ile gönderildi → ${recipient}`);
        onClose();
        return;
      }

      if (mode === 'staging-no-smtp') {
        showToast(
          'warning',
          `PARTIAL: PDF eki hazır (${data?.pdfBytes ?? '?'} B) · SMTP yok · Alıcı: ${recipient}`,
        );
        onClose();
        return;
      }

      showToast('error', message || 'E-posta gönderilemedi');
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.message ?? e.message
        : e instanceof Error
          ? e.message
          : 'E-posta gönderilemedi';
      showToast('error', Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="ops-email-title">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl" data-testid="ops-email-modal">
        <h3 id="ops-email-title" className="text-base font-semibold text-slate-900">
          E-posta Gönder
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Dosya <span className="font-mono font-semibold text-slate-700">{target.fileNo}</span>
          {' · '}PDF oluşturulup eke eklenir (PDF’siz gönderim yok).
        </p>

        {!target.reportId && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Bu dosyada onarım raporu bulunamadı. Önce rapor oluşturun.
          </div>
        )}

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Alıcı</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="ornek@sigorta.com"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              disabled={busy}
              data-testid="ops-email-to"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">PDF Eki</label>
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                target.reportId
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
              data-testid="ops-email-pdf-attach"
            >
              {pdfAttachLabel}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Şablon</label>
            <select
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
              disabled={busy}
              data-testid="ops-email-template"
            >
              <option value="">Şablon Seç (İsteğe Bağlı)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Konu</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              disabled={busy}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">PDF Görünümü</label>
            <select
              value={viewType}
              onChange={(e) => setViewType(e.target.value as 'external' | 'internal')}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
              disabled={busy}
            >
              <option value="external">Dış (Sigorta)</option>
              <option value="internal">İç (Meridyen)</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-xs font-medium text-slate-600">Not</span>
            <Link
              href={noteHref}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
              onClick={onClose}
              data-testid="ops-email-note-link"
            >
              Dosya Notuna Git
            </Link>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !target.reportId}
            className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            data-testid="ops-email-submit"
          >
            {busy ? 'PDF + Gönderiliyor…' : 'PDF Oluştur ve Gönder'}
          </button>
        </div>
      </div>
    </div>
  );
}
