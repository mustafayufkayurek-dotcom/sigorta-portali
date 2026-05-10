'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }
function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}

const CATEGORY_LABELS: Record<string, string> = {
  OFFICE_RENT: 'Ofis Kirası',
  PAYROLL: 'Personel Maaşları',
  SOFTWARE: 'Yazılım Lisansları',
  INSURANCE_PREMIUM: 'Sigorta Primleri',
  ACCOUNTING_LEGAL: 'Muhasebe / Hukuk',
};

const ALLOCATION_METHODS = [
  { value: 'equal', label: 'Eşit Dağıtım' },
  { value: 'proportional_revenue', label: 'Gelir Orantılı' },
  { value: 'hybrid', label: 'Hibrit (%50+%50)' },
];

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

export default function SabitGiderlerPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ expenseCategoryId: '', amount: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [allocMethod, setAllocMethod] = useState('hybrid');
  const [totals, setTotals] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [entriesRes, catsRes, totalRes] = await Promise.all([
        axios.get(`${API}/finance/overhead/entries`, { headers: authHeader(), params: { year, month } }),
        axios.get(`${API}/expense-categories`, { headers: authHeader() }),
        axios.get(`${API}/finance/overhead/entries/totals`, { headers: authHeader(), params: { year, month } }),
      ]);
      setEntries(entriesRes.data.data ?? entriesRes.data ?? []);
      const allCats = catsRes.data.data ?? catsRes.data ?? [];
      setCategories(allCats.filter((c: any) => ['OFFICE_RENT', 'PAYROLL', 'SOFTWARE', 'INSURANCE_PREMIUM', 'ACCOUNTING_LEGAL'].includes(c.code)));
      setTotals(totalRes.data ?? 0);
    } catch { setError('Veriler yüklenemedi'); }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.expenseCategoryId || !form.amount) return;
    setSaving(true);
    try {
      await axios.post(
        `${API}/finance/overhead/entries`,
        { year, month, expenseCategoryId: form.expenseCategoryId, amount: parseFloat(form.amount), description: form.description || undefined },
        { headers: authHeader() },
      );
      setShowForm(false);
      setForm({ expenseCategoryId: '', amount: '', description: '' });
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Kayıt başarısız');
    } finally { setSaving(false); }
  };

  const handleAllocate = async () => {
    if (!window.confirm(`${year}/${month} sabit giderleri ${ALLOCATION_METHODS.find(m => m.value === allocMethod)?.label} yöntemiyle dağıtılsın mı?`)) return;
    setAllocating(true);
    try {
      const r = await axios.post(`${API}/finance/overhead/allocate`, { year, month, allocationMethod: allocMethod }, { headers: authHeader() });
      alert(`✓ ${r.data.allocated} dosyaya dağıtıldı. Toplam: ${fmtCurrency(r.data.totalOverhead)}`);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Dağıtım başarısız');
    } finally { setAllocating(false); }
  };

  const months = [
    { v: 1, l: 'Ocak' }, { v: 2, l: 'Şubat' }, { v: 3, l: 'Mart' },
    { v: 4, l: 'Nisan' }, { v: 5, l: 'Mayıs' }, { v: 6, l: 'Haziran' },
    { v: 7, l: 'Temmuz' }, { v: 8, l: 'Ağustos' }, { v: 9, l: 'Eylül' },
    { v: 10, l: 'Ekim' }, { v: 11, l: 'Kasım' }, { v: 12, l: 'Aralık' },
  ];

  const isAllocated = entries.some((e: any) => e.isAllocated);

  return (
    <div className="space-y-6">
      {/* Başlık & dönem seçimi */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Sabit Gider Yönetimi</h2>
        <div className="flex gap-2">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="text-sm border border-slate-300 rounded-lg px-3 py-1.5">
            {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="text-sm border border-slate-300 rounded-lg px-3 py-1.5">
            {months.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Toplam Sabit Gider</p>
          <p className="text-2xl font-bold text-slate-900">{fmtCurrency(totals)}</p>
          <p className="text-xs text-slate-400 mt-1">{year}/{String(month).padStart(2, '0')}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Kategori Sayısı</p>
          <p className="text-2xl font-bold text-slate-900">{entries.length}</p>
        </div>
        <div className={`rounded-xl border p-4 ${isAllocated ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <p className="text-xs text-slate-500 mb-1">Dağıtım Durumu</p>
          <p className={`text-sm font-bold ${isAllocated ? 'text-green-700' : 'text-yellow-700'}`}>
            {isAllocated ? 'Dağıtıldı' : 'Dağıtılmadı'}
          </p>
        </div>
      </div>

      {/* Gider listesi */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">
            {year}/{String(month).padStart(2, '0')} Sabit Giderler
          </p>
          <button onClick={() => setShowForm(!showForm)} disabled={isAllocated} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
            + Gider Ekle
          </button>
        </div>

        {showForm && (
          <div className="p-4 bg-slate-50 border-b border-slate-100 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Kategori</label>
                <select value={form.expenseCategoryId} onChange={e => setForm({...form, expenseCategoryId: e.target.value})} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2">
                  <option value="">Seçiniz...</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>{CATEGORY_LABELS[c.code] ?? c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Tutar (TL)</label>
                <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Açıklama</label>
                <input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" placeholder="Opsiyonel" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="text-xs text-slate-500 px-3 py-1.5 border border-slate-300 rounded-lg">İptal</button>
              <button onClick={handleSave} disabled={saving} className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg disabled:opacity-50">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-6 text-center text-sm text-slate-400">Yükleniyor...</div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">Henüz kayıt bulunamadı.</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {entries.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {CATEGORY_LABELS[e.expenseCategory?.code] ?? e.expenseCategory?.name ?? e.expenseCategoryId}
                  </p>
                  {e.description && <p className="text-xs text-slate-400">{e.description}</p>}
                </div>
                <div className="flex items-center gap-3">
                  {e.isAllocated && (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Dağıtıldı</span>
                  )}
                  <p className="text-sm font-bold text-slate-800">{fmtCurrency(e.amount)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dağıtım bölümü */}
      {!isAllocated && entries.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Dosyalara Dağıt</p>
          <div className="flex items-center gap-3">
            <select value={allocMethod} onChange={e => setAllocMethod(e.target.value)} className="text-sm border border-slate-300 rounded-lg px-3 py-2 flex-1">
              {ALLOCATION_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <button
              onClick={handleAllocate}
              disabled={allocating}
              className="text-sm bg-orange-600 text-white px-5 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap"
            >
              {allocating ? 'Dağıtılıyor...' : `${fmtCurrency(totals)} Dağıt`}
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            <span className="font-medium">Eşit:</span> Her aktif dosyaya eşit pay &nbsp;|&nbsp;
            <span className="font-medium">Gelir Orantılı:</span> Dosya bedeline göre &nbsp;|&nbsp;
            <span className="font-medium">Hibrit:</span> %50 eşit + %50 orantılı
          </div>
        </div>
      )}

      {/* Logo ERP Sync */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">Logo Wing ERP Sync</p>
            <p className="text-xs text-slate-400 mt-0.5">Logo Wing muhasebe hesaplarından sabit giderleri otomatik çek</p>
          </div>
          <button
            onClick={async () => {
              try {
                const r = await axios.post(`${API}/integrations/logo/overhead-sync`, { year, month }, { headers: authHeader() });
                alert(`✓ ${r.data.synced} kategori senkronize edildi`);
                load();
              } catch (e: any) {
                alert(e?.response?.data?.message ?? 'Senkronizasyon başarısız');
              }
            }}
            className="text-xs border border-slate-300 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50"
          >
            Logo&apos;dan Çek
          </button>
        </div>
      </div>
    </div>
  );
}
