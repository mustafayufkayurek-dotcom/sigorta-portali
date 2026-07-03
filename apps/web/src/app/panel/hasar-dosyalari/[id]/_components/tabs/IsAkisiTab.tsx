'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import ProcessTimeline from '@/components/timeline/ProcessTimeline';
import { API, authHeader } from '../claim-detail-utils';
import { SectionCard } from '../claim-detail-ui';
import { SubTabNav } from './sub-tab-nav';

const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  SUPPLIER_ASSIGNED: 'Tedarikçi Atandı',
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

export function IsAkisiTab({ claimId }: { claimId: string }) {
  const [subTab, setSubTab] = useState<'surec' | 'randevu' | 'gecmis'>('surec');
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [apptLoading, setApptLoading] = useState(false);
  const [apptDate, setApptDate] = useState('');
  const [apptNote, setApptNote] = useState('');
  const [apptSaving, setApptSaving] = useState(false);
  const [apptError, setApptError] = useState('');
  const [apptSuccess, setApptSuccess] = useState('');

  const loadLog = useCallback(() => {
    setLogLoading(true);
    axios.get(`${API}/claim-files/${claimId}/activity-log`, { headers: authHeader() })
      .then((r) => setActivityLog(r.data.data ?? []))
      .catch(console.error)
      .finally(() => setLogLoading(false));
  }, [claimId]);

  const loadAppointments = useCallback(() => {
    setApptLoading(true);
    axios.get(`${API}/claim-files/${claimId}/appointments`, { headers: authHeader() })
      .then((r) => setAppointments(r.data.data ?? []))
      .catch(console.error)
      .finally(() => setApptLoading(false));
  }, [claimId]);

  useEffect(() => {
    if (subTab === 'randevu') loadAppointments();
    if (subTab === 'gecmis') loadLog();
  }, [subTab, loadAppointments, loadLog]);

  const handleCreateAppointment = async () => {
    if (!apptDate) { setApptError('Randevu tarihi/saati seçiniz.'); return; }
    setApptSaving(true); setApptError(''); setApptSuccess('');
    try {
      await axios.post(`${API}/claim-files/${claimId}/appointments`, { scheduledDate: apptDate, notes: apptNote }, { headers: authHeader() });
      setApptSuccess('Randevu oluşturuldu.');
      setApptDate(''); setApptNote('');
      loadAppointments(); loadLog();
    } catch (e: any) {
      setApptError(e?.response?.data?.message ?? 'Randevu oluşturulamadı.');
    } finally { setApptSaving(false); }
  };

  const apptStatusLabel: Record<string, string> = { planned: 'Planlandı', completed: 'Tamamlandı', cancelled: 'İptal' };
  const apptStatusColor: Record<string, string> = { planned: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-600' };

  const IS_AKISI_SUB_TABS = [
    { id: 'surec' as const, label: 'Süreç' },
    { id: 'randevu' as const, label: 'Randevular' },
    { id: 'gecmis' as const, label: 'Hareket Geçmişi' },
  ];

  return (
    <div className="space-y-4">
      <SubTabNav tabs={IS_AKISI_SUB_TABS} active={subTab} onChange={setSubTab} />

      {/* Süreç Timeline */}
      {subTab === 'surec' && (
        <ProcessTimeline claimFileId={claimId} />
      )}

      {/* Randevular */}
      {subTab === 'randevu' && (
        <div className="space-y-4">
          <SectionCard title="Randevu Oluştur">
            {apptError && <div className="mb-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{apptError}</div>}
            {apptSuccess && <div className="mb-3 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">{apptSuccess}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tarih / Saat <span className="text-red-500">*</span></label>
                <input type="datetime-local" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={apptDate} onChange={(e) => setApptDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Not</label>
                <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={apptNote} onChange={(e) => setApptNote(e.target.value)} placeholder="Randevu notları..." />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={handleCreateAppointment} disabled={apptSaving || !apptDate}
                className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
                {apptSaving && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                {apptSaving ? 'Oluşturuluyor...' : 'Randevu Oluştur'}
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Randevular">
            {apptLoading ? (
              <p className="text-sm text-slate-400 py-4 text-center">Yükleniyor...</p>
            ) : appointments.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">Henüz randevu oluşturulmamış.</div>
            ) : (
              <div className="space-y-3">
                {appointments.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800">
                          {new Date(a.scheduledDate).toLocaleString('tr-TR')}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${apptStatusColor[a.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {apptStatusLabel[a.status] ?? a.status}
                        </span>
                      </div>
                      {a.notes && <p className="text-xs text-slate-500 mt-1">{a.notes}</p>}
                      <p className="text-xs text-slate-400 mt-1">
                        {a.createdBy?.firstName} {a.createdBy?.lastName} · {new Date(a.createdAt).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* Hareket Geçmişi */}
      {subTab === 'gecmis' && (
        <SectionCard title="Hareket Geçmişi">
          {logLoading ? (
            <p className="text-sm text-slate-400 py-8 text-center">Yükleniyor...</p>
          ) : activityLog.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">Henüz hareket kaydı yok.</p>
              <p className="text-xs text-slate-400 mt-1">Tedarikçi atama, randevu ve tespit işlemleri burada görünecek.</p>
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
        </SectionCard>
      )}
    </div>
  );
}
