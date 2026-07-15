'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { FinansPanelCard } from '@/components/finance/FinansPanelUI';
import { API, authAxios } from '../claim-detail-utils';
import { GorevlerTab } from './GorevlerTab';
import { IletisimTab } from './IletisimTab';
import { RandevularTab } from './RandevularTab';

type OperasyonSubTab = 'gorevler' | 'iletisim' | 'randevular' | 'gecmis';

const OPERASYON_SUB_TABS: { id: OperasyonSubTab; label: string }[] = [
  { id: 'gorevler', label: 'Görevler & Hatırlatmalar' },
  { id: 'iletisim', label: 'İletişim & Günlük' },
  { id: 'randevular', label: 'Randevular' },
  { id: 'gecmis', label: 'Hareket Geçmişi' },
];

const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  SUPPLIER_ASSIGNED: 'Tedarikçi Atandı',
  SUPPLIER_REMOVED: 'Tedarikçi Kaldırıldı',
  APPOINTMENT_SCHEDULED: 'Randevu Planlandı',
  APPOINTMENT_UPDATED: 'Randevu Güncellendi',
  INSPECTION_DONE: 'Tespit Yapıldı',
  COST_REPORT_SUBMITTED: 'Maliyet Raporu Gönderildi',
  ATTACHMENT_ADDED: 'Ek Yüklendi',
  STATUS_CHANGED: 'Durum Değişti',
  NOTE_ADDED: 'Not Eklendi',
};

const ACTIVITY_ACTION_COLORS: Record<string, string> = {
  SUPPLIER_ASSIGNED: 'bg-purple-100 text-purple-700 border-purple-200',
  APPOINTMENT_SCHEDULED: 'bg-blue-100 text-blue-700 border-blue-200',
  APPOINTMENT_UPDATED: 'bg-blue-50 text-blue-600 border-blue-100',
  INSPECTION_DONE: 'bg-amber-100 text-amber-700 border-amber-200',
  COST_REPORT_SUBMITTED: 'bg-green-100 text-green-700 border-green-200',
  ATTACHMENT_ADDED: 'bg-slate-100 text-slate-600 border-slate-200',
  STATUS_CHANGED: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  NOTE_ADDED: 'bg-slate-100 text-slate-600 border-slate-200',
};

function HareketGecmisiPanel({ claimId }: { claimId: string }) {
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLog = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authAxios<{ data: any[] }>({
        method: 'GET',
        url: `${API}/claim-files/${claimId}/activity-log`,
      });
      setActivityLog(r.data.data ?? []);
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 401) return;
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  return (
    <FinansPanelCard
      title="Hareket Geçmişi"
      subtitle="Otomatik işlem kaydı"
    >
      {loading ? (
        <p className="text-sm text-slate-400 py-8 text-center">Yükleniyor…</p>
      ) : activityLog.length === 0 ? (
        <div className="py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-sm text-slate-500">Henüz Hareket Kaydı Yok</p>
          <p className="text-xs text-slate-400 mt-1">İşlemler burada kronolojik olarak görünecek.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
          <div className="space-y-4 pl-10">
            {activityLog.map((log) => {
              const actionColor = ACTIVITY_ACTION_COLORS[log.action] ?? 'bg-slate-100 text-slate-600 border-slate-200';
              const actionLabel = ACTIVITY_ACTION_LABELS[log.action] ?? log.action;
              return (
                <div key={log.id} className="relative">
                  <div className="absolute -left-10 top-2.5 w-4 h-4 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  </div>
                  <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${actionColor}`}>
                        {actionLabel}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(log.createdAt).toLocaleString('tr-TR')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{log.description}</p>
                    {log.actor && (
                      <p className="text-xs text-slate-400 mt-1">
                        {log.actor.firstName} {log.actor.lastName} · {log.actorRole}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </FinansPanelCard>
  );
}

export function TakipTab({
  claimId,
  claim,
  initialSubTab,
}: {
  claimId: string;
  claim: any;
  /** Operasyon listesinden ?alt=gecmis | iletisim */
  initialSubTab?: OperasyonSubTab;
}) {
  const [subTab, setSubTab] = useState<OperasyonSubTab>(initialSubTab ?? 'gorevler');

  useEffect(() => {
    if (initialSubTab) setSubTab(initialSubTab);
  }, [initialSubTab]);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="sticky top-[52px] z-10 border-b border-slate-100 bg-white/95 px-4 py-1.5 backdrop-blur-sm">
          <div className="flex gap-1 overflow-x-auto">
            {OPERASYON_SUB_TABS.map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={`shrink-0 border-b-2 -mb-px whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
                  subTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {subTab === 'gorevler' && <GorevlerTab claimId={claimId} claim={claim} />}
      {subTab === 'iletisim' && <IletisimTab claimId={claimId} />}
      {subTab === 'randevular' && <RandevularTab claimId={claimId} claim={claim} />}
      {subTab === 'gecmis' && <HareketGecmisiPanel claimId={claimId} />}
    </div>
  );
}
