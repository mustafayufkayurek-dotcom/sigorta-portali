'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { usePanelRoleCode } from '@/hooks/usePanelRole';
import {
  approveSurveyMonthlySend,
  getSurveyMonthlyDispatch,
  requestSurveyMonthlySend,
  type SurveyMonthlyDispatch,
} from '@/utils/surveyApi';

function isSurveyReportManager(roleCode: string): boolean {
  return roleCode === 'admin' || roleCode === 'manager';
}

export function MonthlySurveyReportAskCard() {
  const { showToast } = useToast();
  const roleCode = usePanelRoleCode();
  const manager = isSurveyReportManager(roleCode);
  const [row, setRow] = useState<SurveyMonthlyDispatch | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getSurveyMonthlyDispatch();
      setRow(data);
    } catch {
      setRow(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!row || row.status === 'empty' || row.status === 'sent') return null;

  const askSend = async () => {
    setBusy(true);
    try {
      setRow(await requestSurveyMonthlySend());
      showToast('success', 'Yönetici onayı istendi. Rapor henüz gitmedi.');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'İstek gönderilemedi.';
      showToast('error', message);
    } finally {
      setBusy(false);
    }
  };

  const approveSend = async () => {
    setBusy(true);
    try {
      setRow(await approveSurveyMonthlySend());
      showToast('success', 'Rapor yönetici onayı ile gönderildi.');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Gönderilemedi.';
      showToast('error', message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm"
      data-testid="anket-aylik-rapor-soru"
    >
      <p className="text-sm font-semibold text-slate-900">
        {row.period} müşteri memnuniyet raporu hazır.
      </p>
      {row.status === 'ready' ? (
        <p className="mt-1 text-sm text-slate-600">
          Sigorta, asistans, eksper ve broker firmalarına göndermek ister misiniz? Yönetici onayı olmadan gitmez.
        </p>
      ) : (
        <p className="mt-1 text-sm text-slate-600">Yönetici onayı bekleniyor. Rapor henüz gitmedi.</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {row.status === 'ready' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void askSend()}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Evet, yönetici onayı iste
          </button>
        )}
        {manager && (row.status === 'ready' || row.status === 'requested') && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void approveSend()}
            className="inline-flex items-center rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
          >
            Onayla ve gönder
          </button>
        )}
      </div>
    </div>
  );
}
