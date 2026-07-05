'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/contexts/ToastContext';

const DISCLAIMER_ITEMS = [
  'Bu çıktı resmi puantaj defteri yerine geçmez.',
  'Ad-soyad dijital onay kaydı tutulur; 5070 kapsamında nitelikli e-imza değildir.',
  'Mesai saatleri panel nabız referansıdır; resmi mesai kartı değildir.',
  'Bordro hesaplama veya SGK bildirim kaynağı değildir.',
  'Mali müşavir incelemesi için bilgilendirme amaçlıdır.',
];

type PeriodLock = {
  employeeConfirmedAt?: string | null;
  managerConfirmedAt?: string | null;
  lockedAt?: string | null;
  isLocked?: boolean;
};

type AttendanceSummary = {
  confirmedDays: number;
  pastWorkDays: number;
  pendingConfirmationDays: number;
};

interface AttendanceAccountantPanelProps {
  year: number;
  month: number;
  summary?: AttendanceSummary;
  periodLock?: PeriodLock;
  defaultExpanded?: boolean;
}

export function AttendanceAccountantPanel({
  year,
  month,
  summary,
  periodLock,
  defaultExpanded = false,
}: AttendanceAccountantPanelProps) {
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [exportLoading, setExportLoading] = useState<'xlsx' | 'print' | null>(null);
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

  const exportUrl = (format: 'xlsx' | 'print') =>
    `${API}/hr/attendance/export?year=${year}&month=${month}&format=${format}`;

  const handleDownloadXlsx = async () => {
    setExportLoading('xlsx');
    try {
      const res = await fetch(exportUrl('xlsx'), { headers: authHeader() });
      if (!res.ok) throw new Error('Excel indirilemedi');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `puantaj-${year}-${String(month).padStart(2, '0')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('success', 'Excel İndirildi');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Excel İndirilemedi');
    } finally {
      setExportLoading(null);
    }
  };

  const handlePrint = async () => {
    setExportLoading('print');
    try {
      const res = await fetch(exportUrl('print'), { headers: authHeader() });
      if (!res.ok) throw new Error('Yazdırma sayfası açılamadı');
      const html = await res.text();
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showToast('warning', 'Açılır Pencere Engellendi — Tarayıcı İzinlerini Kontrol Edin');
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Yazdırma Başarısız');
    } finally {
      setExportLoading(null);
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
        'hr/attendance/send-accountant',
        { to, year, month, message: emailMessage.trim() || undefined },
      );
      if (result.success) {
        showToast('success', result.message || 'E-posta Gönderildi');
        setEmailOpen(false);
        setEmailMessage('');
      } else {
        showToast('error', result.message || 'E-posta Gönderilemedi');
      }
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'E-posta Gönderilemedi');
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50/80 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-800">Mali Müşavir Çıktısı</span>
        <span className="text-xs text-slate-500">{expanded ? 'Gizle' : 'Göster'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100">
          <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-xs text-slate-700">
            <p className="font-medium text-slate-800 mb-2">Önemli Uyarılar</p>
            <ul className="list-disc pl-4 space-y-1">
              {DISCLAIMER_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          {summary && (
            <div className="flex flex-wrap gap-3 text-xs text-slate-600">
              <span>Onaylı Gün: {summary.confirmedDays}</span>
              <span>Bekleyen: {summary.pendingConfirmationDays}</span>
              {periodLock?.employeeConfirmedAt && (
                <span className="text-emerald-700">Personel Aylık Onay Verildi</span>
              )}
              {periodLock?.isLocked && (
                <span className="text-red-600">Ay Kilitli</span>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={exportLoading !== null}
              onClick={handleDownloadXlsx}
              className="rounded-lg bg-emerald-600 text-white text-xs font-medium px-3 py-2 hover:bg-emerald-700 disabled:opacity-50"
            >
              {exportLoading === 'xlsx' ? 'İndiriliyor...' : 'Excel İndir'}
            </button>
            <button
              type="button"
              disabled={exportLoading !== null}
              onClick={handlePrint}
              className="rounded-lg border border-slate-300 text-xs font-medium px-3 py-2 hover:bg-slate-50 disabled:opacity-50"
            >
              {exportLoading === 'print' ? 'Açılıyor...' : 'Yazdır'}
            </button>
            <button
              type="button"
              onClick={() => setEmailOpen(true)}
              className="rounded-lg bg-[#1a4080] text-white text-xs font-medium px-3 py-2 hover:bg-[#153366]"
            >
              Mali Müşavire Gönder
            </button>
          </div>
        </div>
      )}

      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Mali Müşavire Gönder</h3>
              <button
                type="button"
                onClick={() => setEmailOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                aria-label="Kapat"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {year} yılı {month}. ay puantaj özeti e-posta ekinde Excel olarak gönderilir.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Alıcı E-posta</label>
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
              <label className="block text-xs font-medium text-slate-500 mb-1">Mesaj (Opsiyonel)</label>
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
                className="rounded-lg bg-[#1a4080] text-white px-4 py-2 text-xs font-medium hover:bg-[#153366] disabled:opacity-50"
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
