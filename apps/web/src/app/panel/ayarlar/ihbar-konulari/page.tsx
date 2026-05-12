'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import {
  EditButton,
  DeleteButton,
  SettingsTable,
  SettingsTableHead,
  SettingsTableTh,
  SettingsTableBody,
  SettingsTableRow,
  SettingsTableTd,
  SettingsTableActions,
  inputCls,
} from '@/components/settings/SettingsUI';
import { DeleteConfirmDialog } from '@/components/settings/SettingsModal';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://app.meridyen-tr.com/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

type Tab = 'hasar' | 'acil';

export default function IhbarKonulariPage() {
  const [activeTab, setActiveTab] = useState<Tab>('hasar');
  const [hasarTypes, setHasarTypes] = useState<string[]>([]);
  const [acilTypes, setAcilTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newValue, setNewValue] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/system-settings/ihbar-konulari`, { headers: authHeader() });
      const data = res.data.data ?? {};
      setHasarTypes(data.hasar ?? []);
      setAcilTypes(data.acil ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const currentTypes = activeTab === 'hasar' ? hasarTypes : acilTypes;

  const save = async (updated: string[], tab: Tab = activeTab) => {
    setSaving(true);
    setError('');
    setSuccess('');
    const payload = {
      hasar: tab === 'hasar' ? updated : hasarTypes,
      acil: tab === 'acil' ? updated : acilTypes,
    };
    try {
      await axios.put(`${API}/system-settings/ihbar-konulari`, payload, { headers: authHeader() });
      if (tab === 'hasar') setHasarTypes(updated);
      else setAcilTypes(updated);
      setSuccess('Kaydedildi');
      setTimeout(() => setSuccess(''), 2000);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    const val = newValue.trim();
    if (!val) { setError('Boş değer eklenemez'); return; }
    if (currentTypes.includes(val)) { setError('Bu konu zaten mevcut'); return; }
    setNewValue('');
    setError('');
    await save([...currentTypes, val]);
  };

  const handleDelete = async (idx: number) => {
    await save(currentTypes.filter((_, i) => i !== idx));
    setDeleteIdx(null);
  };

  const handleEditStart = (idx: number) => {
    setEditingIdx(idx);
    setEditValue(currentTypes[idx]);
    setError('');
  };

  const handleEditSave = async (idx: number) => {
    const val = editValue.trim();
    if (!val) { setError('Boş değer girilemez'); return; }
    if (currentTypes.some((t, i) => i !== idx && t === val)) { setError('Bu konu zaten mevcut'); return; }
    const updated = currentTypes.map((t, i) => (i === idx ? val : t));
    setEditingIdx(null);
    setEditValue('');
    await save(updated);
  };

  const handleMoveUp = async (idx: number) => {
    if (idx === 0) return;
    const updated = [...currentTypes];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    await save(updated);
  };

  const handleMoveDown = async (idx: number) => {
    if (idx === currentTypes.length - 1) return;
    const updated = [...currentTypes];
    [updated[idx + 1], updated[idx]] = [updated[idx], updated[idx + 1]];
    await save(updated);
  };

  const tabLabel = activeTab === 'hasar' ? 'Hasar' : 'Acil Yardım';
  const tabPlaceholder = activeTab === 'hasar'
    ? 'Örn: Konut Yangın, Dahili Su, Hırsızlık...'
    : 'Örn: Su Baskını, Gaz Kaçağı, Kilit/Çilingir...';

  return (
    <SettingsPageLayout
      title="İhbar Konuları"
      description="Hasar ve acil yardım dosyalarında kullanılacak ihbar konularını yönetin"
    >

      {/* Sekme */}
      <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-xl w-fit">
        {(['hasar', 'acil'] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => { setActiveTab(tab); setEditingIdx(null); setNewValue(''); setError(''); }}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'hasar' ? 'Hasar İhbar Konuları' : 'Acil İhbar Konuları'}
            <span className={`ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${
              activeTab === tab ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'
            }`}>
              {tab === 'hasar' ? hasarTypes.length : acilTypes.length}
            </span>
          </button>
        ))}
      </div>

      {/* Yeni Ekle */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Yeni {tabLabel} İhbar Konusu Ekle
        </p>
        <div className="flex gap-2">
          <input
            className={inputCls}
            placeholder={tabPlaceholder}
            value={newValue}
            onChange={(e) => { setNewValue(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || !newValue.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            + Ekle
          </button>
        </div>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-2">{error}</p>}
        {success && <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 mt-2">{success}</p>}
      </div>

      {/* Liste */}
      <SettingsTable loading={loading} empty={currentTypes.length === 0} emptyText={`Henüz ${tabLabel.toLowerCase()} ihbar konusu tanımlanmamış.`}>
        <SettingsTableHead>
          <SettingsTableTh className="w-10 text-center">Sıra</SettingsTableTh>
          <SettingsTableTh>İhbar Konusu</SettingsTableTh>
          <SettingsTableTh className="w-28 text-center">Sırala</SettingsTableTh>
          <SettingsTableTh className="w-28" />
        </SettingsTableHead>
        <SettingsTableBody>
          {currentTypes.map((type, idx) => (
            <SettingsTableRow key={idx}>
              <SettingsTableTd className="text-center text-xs text-slate-400 font-mono">{idx + 1}</SettingsTableTd>
              <SettingsTableTd>
                {editingIdx === idx ? (
                  <div className="flex gap-2 items-center">
                    <input
                      className="flex-1 border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                      value={editValue}
                      autoFocus
                      onChange={(e) => { setEditValue(e.target.value); setError(''); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleEditSave(idx); }
                        if (e.key === 'Escape') { setEditingIdx(null); setEditValue(''); }
                      }}
                    />
                    <button type="button" onClick={() => handleEditSave(idx)} disabled={saving}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      Kaydet
                    </button>
                    <button type="button" onClick={() => { setEditingIdx(null); setEditValue(''); }}
                      className="text-xs border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg hover:bg-slate-50">
                      İptal
                    </button>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${activeTab === 'hasar' ? 'bg-blue-400' : 'bg-red-400'}`} />
                    <span className="font-medium text-slate-800">{type}</span>
                  </span>
                )}
              </SettingsTableTd>
              <SettingsTableTd className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <button type="button" onClick={() => handleMoveUp(idx)} disabled={idx === 0 || saving}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors p-1 rounded hover:bg-slate-100" title="Yukarı Taşı">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button type="button" onClick={() => handleMoveDown(idx)} disabled={idx === currentTypes.length - 1 || saving}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors p-1 rounded hover:bg-slate-100" title="Aşağı Taşı">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </SettingsTableTd>
              <SettingsTableActions>
                {editingIdx !== idx && (
                  <>
                    <EditButton onClick={() => handleEditStart(idx)} />
                    <DeleteButton onClick={() => setDeleteIdx(idx)} />
                  </>
                )}
              </SettingsTableActions>
            </SettingsTableRow>
          ))}
        </SettingsTableBody>
      </SettingsTable>

      <DeleteConfirmDialog
        isOpen={deleteIdx !== null}
        onClose={() => setDeleteIdx(null)}
        onConfirm={() => deleteIdx !== null && handleDelete(deleteIdx)}
        deleting={saving}
        itemName={deleteIdx !== null ? currentTypes[deleteIdx] : undefined}
      />
    </SettingsPageLayout>
  );
}
