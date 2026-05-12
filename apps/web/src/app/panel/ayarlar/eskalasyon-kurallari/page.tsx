'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '@/contexts/ToastContext';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://app.meridyen-tr.com/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

interface EscalationRules {
  warningDays: number;
  criticalDays: number;
  escalationDays: number;
}

const DEFAULT_RULES: EscalationRules = { warningDays: 3, criticalDays: 7, escalationDays: 14 };

export default function EskalasyonKurallarPage() {
  const { showToast } = useToast();
  const [rules, setRules] = useState<EscalationRules>(DEFAULT_RULES);
  const [draft, setDraft] = useState<EscalationRules>(DEFAULT_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/task-assignments/escalation-rules`, { headers: authHeader() });
      const data: EscalationRules = res.data.data ?? DEFAULT_RULES;
      setRules(data);
      setDraft(data);
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleChange = (field: keyof EscalationRules, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1) return;
    setDraft((prev) => ({ ...prev, [field]: num }));
    setDirty(true);
  };

  const handleSave = async () => {
    // Validate ordering
    if (draft.warningDays >= draft.criticalDays) {
      showToast('error', 'Kritik Gün Sayısı, Uyarı Gün Sayısından Büyük Olmalıdır.');
      return;
    }
    if (draft.criticalDays >= draft.escalationDays) {
      showToast('error', 'Eskalasyon Gün Sayısı, Kritik Gün Sayısından Büyük Olmalıdır.');
      return;
    }
    setSaving(true);
    try {
      await axios.put(`${API}/task-assignments/escalation-rules`, draft, { headers: authHeader() });
      setRules(draft);
      setDirty(false);
      showToast('success', 'Eskalasyon Kuralları Kaydedildi.');
    } catch {
      showToast('error', 'Kayıt Başarısız. Lütfen Tekrar Deneyin.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft(rules);
    setDirty(false);
  };

  const levelConfig = [
    {
      key: 'warningDays' as keyof EscalationRules,
      label: 'Uyarı',
      description: 'Bu kadar gün ilerleme kaydedilmezse sarı uyarı oluşturulur ve personele bildirim gönderilir.',
      badgeCls: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
      borderCls: 'border-yellow-300',
      bgCls: 'bg-yellow-50',
      icon: (
        <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      type: 'REMINDER',
    },
    {
      key: 'criticalDays' as keyof EscalationRules,
      label: 'Kritik',
      description: 'Bu kadar gün ilerleme kaydedilmezse kırmızı uyarı oluşturulur ve yöneticiye bildirim gönderilir.',
      badgeCls: 'bg-red-100 text-red-800 border border-red-300',
      borderCls: 'border-red-300',
      bgCls: 'bg-red-50',
      icon: (
        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      type: 'OVERDUE',
    },
    {
      key: 'escalationDays' as keyof EscalationRules,
      label: 'Eskalasyon',
      description: 'Bu kadar gün ilerleme kaydedilmezse eskalasyon alarmı tetiklenir ve üst yöneticiye bildirilir.',
      badgeCls: 'bg-slate-800 text-slate-100 border border-slate-600',
      borderCls: 'border-slate-600',
      bgCls: 'bg-slate-900',
      icon: (
        <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
      type: 'ESCALATION',
    },
  ];

  return (
    <SettingsPageLayout
      title="Eskalasyon Kuralları"
      description="Geciken dosyalar için otomatik uyarı ve eskalasyon eşiklerini yönetin. Cron job her gün saat 09:00'da çalışır."
    >


      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Kural kartları */}
          <div className="space-y-4 mb-8">
            {levelConfig.map((cfg) => (
              <div key={cfg.key} className={`rounded-xl border-2 p-5 ${cfg.bgCls} ${cfg.borderCls}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.bgCls} border ${cfg.borderCls}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-sm font-semibold ${cfg.key === 'escalationDays' ? 'text-slate-200' : 'text-slate-900'}`}>{cfg.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badgeCls}`}>{cfg.type}</span>
                    </div>
                    <p className={`text-xs ${cfg.key === 'escalationDays' ? 'text-slate-400' : 'text-slate-500'} mb-3`}>{cfg.description}</p>
                    <div className="flex items-center gap-3">
                      <label className={`text-xs font-medium ${cfg.key === 'escalationDays' ? 'text-slate-300' : 'text-slate-600'}`}>
                        Gün Eşiği:
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleChange(cfg.key, String(draft[cfg.key] - 1))}
                          disabled={draft[cfg.key] <= 1}
                          className="w-7 h-7 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={90}
                          value={draft[cfg.key]}
                          onChange={(e) => handleChange(cfg.key, e.target.value)}
                          className="w-16 text-center border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleChange(cfg.key, String(draft[cfg.key] + 1))}
                          className="w-7 h-7 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                        <span className={`text-xs ${cfg.key === 'escalationDays' ? 'text-slate-400' : 'text-slate-500'}`}>Gün</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Zaman çizelgesi önizleme */}
          <div className="bg-white rounded-xl border border-slate-100 p-5 mb-8 shadow-sm">
            <p className="text-sm font-semibold text-slate-700 mb-4">Zaman Çizelgesi Önizleme</p>
            <div className="relative">
              <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-slate-200" />
              <div className="relative flex items-start justify-between">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center z-10 shadow-sm">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold text-green-700 mt-2">Gün 0</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Atama</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-yellow-400 flex items-center justify-center z-10 shadow-sm">
                    <span className="text-white text-xs font-bold">{draft.warningDays}</span>
                  </div>
                  <p className="text-xs font-semibold text-yellow-700 mt-2">Gün {draft.warningDays}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Uyarı</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center z-10 shadow-sm">
                    <span className="text-white text-xs font-bold">{draft.criticalDays}</span>
                  </div>
                  <p className="text-xs font-semibold text-red-700 mt-2">Gün {draft.criticalDays}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Kritik</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center z-10 shadow-sm">
                    <span className="text-white text-xs font-bold">{draft.escalationDays}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 mt-2">Gün {draft.escalationDays}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Eskalasyon</p>
                </div>
              </div>
            </div>
          </div>

          {/* Validation uyarıları */}
          {draft.warningDays >= draft.criticalDays && (
            <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Kritik Gün Sayısı, Uyarı Gün Sayısından Büyük Olmalıdır.
            </div>
          )}
          {draft.criticalDays >= draft.escalationDays && (
            <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Eskalasyon Gün Sayısı, Kritik Gün Sayısından Büyük Olmalıdır.
            </div>
          )}

          {/* Kaydet / İptal */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty || draft.warningDays >= draft.criticalDays || draft.criticalDays >= draft.escalationDays}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-sm shadow-blue-200 transition-all"
            >
              {saving ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              Kaydet
            </button>
            {dirty && (
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-2 border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                İptal
              </button>
            )}
          </div>
        </>
      )}
    </SettingsPageLayout>
  );
}
