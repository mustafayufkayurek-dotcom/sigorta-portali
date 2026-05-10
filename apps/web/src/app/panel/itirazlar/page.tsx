'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }
function fmtDate(d: string | null | undefined) { return d ? new Date(d).toLocaleDateString('tr-TR') : '—'; }
function fmtDateTime(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
}

const DISPUTE_STATUS: Record<string, { label: string; color: string }> = {
  OPEN:            { label: 'Açık',           color: 'bg-red-100 text-red-700' },
  UNDER_REVIEW:    { label: 'İnceleniyor',    color: 'bg-orange-100 text-orange-700' },
  RESOLVED_ACCEPT: { label: 'Kabul Edildi',   color: 'bg-green-100 text-green-700' },
  RESOLVED_REJECT: { label: 'Reddedildi',     color: 'bg-slate-100 text-slate-600' },
  WITHDRAWN:       { label: 'Geri Çekildi',   color: 'bg-slate-100 text-slate-500' },
};

const DISPUTE_REASON_LABELS: Record<string, string> = {
  AMOUNT_MISMATCH: 'Tutar Yanlış',
  ITEM_NOT_DONE:   'İş Yapılmadı',
  WRONG_CLAIM:     'Yanlış Dosya',
  NOT_RECEIVED:    'Ödeme Alınmadı',
  OTHER:           'Diğer',
};

const ALERT_LABELS: Record<string, { label: string; color: string }> = {
  HIGH_DISPUTE_RATE:          { label: 'Yüksek İtiraz Oranı',   color: 'bg-red-100 text-red-700' },
  REPEATED_DISPUTE_SAME_ITEM: { label: 'Tekrarlı İtiraz',        color: 'bg-orange-100 text-orange-700' },
  BULK_DISPUTE:               { label: 'Toplu İtiraz',           color: 'bg-yellow-100 text-yellow-700' },
};

export default function ItirazlarPage() {
  const [tab, setTab] = useState<'disputes' | 'alerts'>('disputes');
  const [disputes, setDisputes] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [resolveModal, setResolveModal] = useState<any>(null);

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = filterStatus ? `?status=${filterStatus}` : '?status=OPEN';
      const res = await axios.get(`${API}/vendor-statements/disputes${params}`, { headers: authHeader() });
      setDisputes(res.data.data ?? []);
      setTotal(res.data.meta?.total ?? 0);
    } catch { setError('Veriler yüklenemedi'); }
    setLoading(false);
  }, [filterStatus]);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/vendor-statements/alerts?isAcknowledged=false`, { headers: authHeader() });
      setAlerts(res.data ?? []);
    } catch { setError('Veriler yüklenemedi'); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'disputes') loadDisputes();
    else loadAlerts();
  }, [tab, loadDisputes, loadAlerts]);

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await axios.patch(`${API}/vendor-statements/alerts/${alertId}/acknowledge`, {}, { headers: authHeader() });
      loadAlerts();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Hata');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Sayfa Başlık */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">İtiraz Yönetimi</h1>
        <p className="text-sm text-slate-400 mt-0.5">Tedarikçi ödeme ekstre itirazları ve anormallik alarmları</p>
      </div>

      {/* Tab Bar */}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex overflow-hidden">
        {[
          { id: 'disputes', label: 'İtirazlar', icon: '⚠' },
          { id: 'alerts', label: 'Alarmlar', icon: '🔔' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-all ${
              tab === t.id ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{t.icon}</span> {t.label}
            {t.id === 'alerts' && alerts.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-semibold">{alerts.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Disputes Tab */}
      {tab === 'disputes' && (
        <div className="space-y-4">
          {/* Filtre */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Durum:</span>
            {[
              { value: '',                label: 'Açık' },
              { value: 'UNDER_REVIEW',    label: 'İnceleniyor' },
              { value: 'RESOLVED_ACCEPT', label: 'Tümü' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFilterStatus(f.value)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  filterStatus === f.value ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-slate-400">{total} kayıt</span>
          </div>

          {loading ? (
            <div className="text-center py-10 text-slate-400">Yükleniyor...</div>
          ) : disputes.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-10 text-center">
              <p className="text-slate-400 text-sm">Henüz kayıt bulunamadı.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {disputes.map((dispute) => {
                const st = DISPUTE_STATUS[dispute.status] ?? DISPUTE_STATUS.OPEN;
                const isResolvable = ['OPEN', 'UNDER_REVIEW'].includes(dispute.status);
                return (
                  <div key={dispute.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              {DISPUTE_REASON_LABELS[dispute.reason] ?? dispute.reason}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-800 mt-2">
                            {dispute.statementItem?.lineDescription}
                          </p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-slate-500">
                              Tedarikçi: <span className="font-medium">{dispute.vendor?.name}</span>
                            </span>
                            {dispute.statementItem?.claimFile && (
                              <span className="text-xs text-slate-500">
                                Dosya: <span className="font-medium">{dispute.statementItem.claimFile.fileNo}</span>
                              </span>
                            )}
                            {dispute.statementItem?.statement && (
                              <span className="text-xs text-slate-500">
                                Ekstre: <span className="font-medium">{dispute.statementItem.statement.statementNo}</span>
                              </span>
                            )}
                          </div>
                          <div className="mt-2 p-2.5 bg-slate-50 rounded-lg">
                            <p className="text-xs text-slate-600 italic">&quot;{dispute.reasonNote}&quot;</p>
                          </div>
                          <p className="text-xs text-slate-400 mt-2">{fmtDateTime(dispute.createdAt)}</p>
                        </div>
                      </div>
                    </div>

                    {isResolvable && (
                      <div className="px-5 pb-4 flex gap-2 border-t border-slate-50 pt-3">
                        <button
                          onClick={() => setResolveModal({ id: dispute.id, vendor: dispute.vendor?.name, resolution: 'RESOLVED_ACCEPT' })}
                          className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          Kabul Et (Düzeltilecek)
                        </button>
                        <button
                          onClick={() => setResolveModal({ id: dispute.id, vendor: dispute.vendor?.name, resolution: 'RESOLVED_REJECT' })}
                          className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg transition-colors"
                        >
                          Reddet
                        </button>
                      </div>
                    )}

                    {dispute.resolvedBy && (
                      <div className="px-5 pb-3 pt-0">
                        <p className="text-xs text-slate-400">
                          {fmtDate(dispute.resolvedAt)} tarihinde {dispute.resolvedBy.firstName} {dispute.resolvedBy.lastName} tarafından çözümlendi
                        </p>
                        {dispute.resolvedNote && (
                          <p className="text-xs text-slate-500 mt-0.5 italic">{dispute.resolvedNote}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Alerts Tab */}
      {tab === 'alerts' && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-10 text-slate-400">Yükleniyor...</div>
          ) : alerts.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-10 text-center">
              <p className="text-slate-400 text-sm">Henüz kayıt bulunamadı.</p>
            </div>
          ) : (
            alerts.map((alert) => {
              const at = ALERT_LABELS[alert.alertType] ?? { label: alert.alertType, color: 'bg-slate-100 text-slate-600' };
              return (
                <div key={alert.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${at.color}`}>{at.label}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 mt-2">
                        {alert.vendor?.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Son {alert.windowDays} günde <span className="font-semibold text-red-600">{alert.disputeCount} itiraz</span> yapıldı.
                        {alert.statement && ` · Ekstre: ${alert.statement.statementNo}`}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{fmtDateTime(alert.createdAt)}</p>
                    </div>
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="flex-shrink-0 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs rounded-lg font-medium transition-colors"
                    >
                      Okundu
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModal && (
        <ResolveModal
          disputeId={resolveModal.id}
          vendorName={resolveModal.vendor}
          defaultResolution={resolveModal.resolution}
          onClose={() => setResolveModal(null)}
          onResolved={() => { setResolveModal(null); loadDisputes(); }}
        />
      )}
    </div>
  );
}

// ─── ResolveModal ─────────────────────────────────────────────────────────────
function ResolveModal({
  disputeId,
  vendorName,
  defaultResolution,
  onClose,
  onResolved,
}: {
  disputeId: string;
  vendorName: string;
  defaultResolution: string;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [resolution, setResolution] = useState(defaultResolution);
  const [resolvedNote, setResolvedNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (resolvedNote.trim().length < 5) { setError('Karar notu en az 5 karakter olmalıdır'); return; }
    setSaving(true);
    try {
      await axios.patch(
        `${API}/vendor-statements/disputes/${disputeId}/resolve`,
        { resolution, resolvedNote: resolvedNote.trim() },
        { headers: authHeader() },
      );
      onResolved();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'İşlem başarısız');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">İtiraz Çözümle</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            <span className="font-semibold">{vendorName}</span> adlı tedarikçinin itirazı için karar giriniz.
          </p>

          {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Karar</label>
            {[
              { value: 'RESOLVED_ACCEPT', label: 'Kabul Et — İtiraz haklı, düzeltme yapılacak' },
              { value: 'RESOLVED_REJECT', label: 'Reddet — İtiraz geçersiz, kalem onaylı kalır' },
            ].map((r) => (
              <label key={r.value} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer mb-2 transition-all ${
                resolution === r.value ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input type="radio" name="resolution" value={r.value} checked={resolution === r.value}
                  onChange={() => setResolution(r.value)} className="accent-indigo-600" />
                <span className="text-sm text-slate-700">{r.label}</span>
              </label>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Karar Notu <span className="text-red-400">*</span>
            </label>
            <textarea
              value={resolvedNote}
              onChange={(e) => setResolvedNote(e.target.value)}
              rows={3}
              placeholder="Kararınızın gerekçesini yazınız..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? 'Kaydediliyor...' : 'Çözümle'}
          </button>
        </div>
      </div>
    </div>
  );
}
