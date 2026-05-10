'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

export default function BankaHesaplariPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ bankName: '', branchName: '', iban: '', currency: 'TRY', isActive: true });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError('');
    axios.get(`${API}/bank-accounts`, { headers: authHeader() })
      .then((r) => setAccounts(r.data.data ?? []))
      .catch(() => setError('Veriler yüklenemedi'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.bankName || !form.iban) { alert('Banka Adı ve IBAN Zorunludur'); return; }
    setSaving(true);
    try {
      if (editId) {
        await axios.patch(`${API}/bank-accounts/${editId}`, form, { headers: authHeader() });
      } else {
        await axios.post(`${API}/bank-accounts`, form, { headers: authHeader() });
      }
      setShowForm(false);
      setEditId(null);
      setForm({ bankName: '', branchName: '', iban: '', currency: 'TRY', isActive: true });
      load();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Hata oluştu'); }
    finally { setSaving(false); }
  };

  const handleEdit = (acc: any) => {
    setEditId(acc.id);
    setForm({ bankName: acc.bankName, branchName: acc.branchName ?? '', iban: acc.iban, currency: acc.currency, isActive: acc.isActive });
    setShowForm(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Banka Hesapları</h2>
        <button type="button" onClick={() => { setShowForm(true); setEditId(null); setForm({ bankName: '', branchName: '', iban: '', currency: 'TRY', isActive: true }); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">+ Yeni Hesap</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h4 className="font-medium text-slate-800 text-sm">{editId ? 'Hesabı Düzenle' : 'Yeni Banka Hesabı'}</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Banka Adı *</label>
              <input type="text" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Garanti BBVA" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Şube Adı</label>
              <input type="text" value={form.branchName} onChange={(e) => setForm({ ...form, branchName: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Merkez Şube" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500 mb-1 block">IBAN *</label>
              <input type="text" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" placeholder="TR00 0000 0000 0000 0000 0000 00" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Para Birimi</label>
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
              <label htmlFor="isActive" className="text-sm text-slate-700">Aktif</label>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">İptal</button>
            <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-400">Yükleniyor...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
      ) : accounts.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">Henüz kayıt bulunamadı.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Banka</th>
                <th className="text-left px-4 py-3">Şube</th>
                <th className="text-left px-4 py-3">IBAN</th>
                <th className="text-left px-4 py-3">Para Birimi</th>
                <th className="text-left px-4 py-3">Durum</th>
                <th className="text-left px-4 py-3">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{acc.bankName}</td>
                  <td className="px-4 py-3 text-slate-600">{acc.branchName ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{acc.iban}</td>
                  <td className="px-4 py-3 text-slate-600">{acc.currency}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${acc.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{acc.isActive ? 'Aktif' : 'Pasif'}</span></td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => handleEdit(acc)} className="text-xs text-blue-600 hover:underline">Düzenle</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
