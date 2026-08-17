'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/contexts/ToastContext';
import { Users, Mail, FileSpreadsheet } from 'lucide-react';

const DISCLAIMER_ITEMS = [
  'Bu çıktı resmi puantaj defteri yerine geçmez.',
  'Tüm aktif personelin elektronik onaylı puantaj özeti ve onaylı izin formları tek dosyada birleştirilir.',
  'Ad-soyad yazarak verilen dijital onay, 5070 sayılı Kanun kapsamında nitelikli elektronik imza değildir; zaman damgalı "adi delil" niteliğindedir.',
  'Mali müşavir incelemesi için bilgilendirme amaçlıdır.',
];

interface Props {
  year: number;
  month: number;
}

export function AttendanceBulkAccountantPanel({ year, month }: Props) {
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    axios
      .get(`${API}/system-settings/company-info`, { headers: authHeader() })
      .then((r) => {
        const email = r.data?.data?.accountantEmail?.trim();
        if (email) setEmailTo(email);
      })
      .catch(() => {});
  }, []);

  const handleDownloadXlsx = async () => {
    setExportLoading(true);
    try {
      const res = await fetch(
        `${API}/hr/attendance/export-bulk?year=${year}&month=${month}`,
        { headers: authHeader() },
      );
      if (!res.ok) throw new Error('Toplu Excel indirilemedi');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `puantaj-toplu-${year}-${String(month).padStart(2, '0')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('success', 'Toplu Rapor İndirildi');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Toplu Rapor İndirilemedi');
    } finally {
      setExportLoading(false);
    }
  };

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const handleSendEmail = async () => {
    const to = emailTo.trim();
    if (!validateEmail(to)) {
      setEmailError('Geçerli bir e-posta adresi girin.');
      return;
    }
    setEmailError('');
    setEmailSending(true);
    try {
      const result = await apiClient.post<{ success: boolean; message: string }>(
        'hr/attendance/send-accountant-bulk',
        { to, year, month, message: emailMessage.trim() || undefined },
      );
      if (result.success) {
        showToast('success', result.message || 'Toplu Rapor Gönderildi');
        setEmailOpen(false);
        setEmailMessage('');
      } else {
        showToast('error', result.message || 'Toplu Rapor Gönderilemedi');
      }
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Toplu Rapor Gönderilemedi');
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-brand-50/60 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-content-primary">
          <Users className="h-4 w-4 text-brand-600" />
          Ay Sonu Toplu Rapor — Tüm Personel
        </span>
        <span className="text-xs text-content-tertiary">{expanded ? 'Gizle' : 'Göster'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-brand-100">
          <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-xs text-content-secondary">
            <p className="font-medium text-content-primary mb-2">Önemli Uyarılar</p>
            <ul className="list-disc pl-4 space-y-1">
              {DISCLAIMER_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-content-secondary">
            Rapor; her personel için onaylı puantaj günlerini ve dönem içindeki onaylı izin formlarını
            tek Excel dosyasında (Özet · Puantaj Detay · İzin Formları) birleştirir.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={exportLoading}
              onClick={handleDownloadXlsx}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold px-3 py-2 hover:bg-emerald-700 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {exportLoading ? 'İndiriliyor...' : 'Toplu Excel İndir'}
            </button>
            <button
              type="button"
              onClick={() => setEmailOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 text-white text-xs font-semibold px-3 py-2 hover:bg-brand-700"
            >
              <Mail className="h-3.5 w-3.5" />
              Mali Müşavire Toplu Gönder
            </button>
          </div>
        </div>
      )}

      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-content-primary">Mali Müşavire Toplu Gönder</h3>
              <button
                type="button"
                onClick={() => setEmailOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                aria-label="Kapat"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-content-tertiary">
              {year} yılı {month}. ay — tüm personelin puantaj + izin formu özeti e-posta ekinde Excel olarak gönderilir.
            </p>
            <div>
              <label className="block text-xs font-medium text-content-tertiary mb-1">Alıcı E-posta</label>
              <input
                type="email"
                className={`w-full border rounded-lg px-3 py-2 text-sm${emailError ? ' border-red-300' : ' border-slate-200'}`}
                value={emailTo}
                onChange={(e) => { setEmailTo(e.target.value); setEmailError(''); }}
                onBlur={() => {
                  if (emailTo.trim() && !validateEmail(emailTo)) {
                    setEmailError('Geçerli bir e-posta adresi girin.');
                  }
                }}
                placeholder="muhasebe@ornek.com"
              />
              {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-content-tertiary mb-1">Mesaj (Opsiyonel)</label>
              <textarea
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[72px]"
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Mali müşavire iletilecek kısa not..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEmailOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={emailSending}
                onClick={handleSendEmail}
                className="rounded-lg bg-brand-600 text-white px-4 py-2 text-xs font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {emailSending ? 'Gönderiliyor...' : 'Gönder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
