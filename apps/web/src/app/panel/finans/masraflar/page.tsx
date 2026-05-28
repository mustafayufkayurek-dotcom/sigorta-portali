'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

// ── API helpers ───────────────────────────────────────────────────────────────
const _base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const API   = _base.endsWith('/api/v1') ? _base : _base + '/api/v1';
function getToken()   { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = (n: number | string | null | undefined) =>
  n == null ? '—' : Number(n).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

// ── Plan sabitleri (Backend ExpensePlan enum) ─────────────────────────────────
const PLAN_BUTCE  = 'BUTCELENEN';
const PLAN_EK     = 'EKSTRA_SATIS_MASRAFI';

const PLAN_META: Record<string, { label: string; short: string; badgeCls: string; cardCls: string; barCls: string }> = {
  [PLAN_BUTCE]: {
    label:    'Dosya Bütçesi',
    short:    'Bütçe',
    badgeCls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    cardCls:  'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    barCls:   'bg-blue-500',
  },
  [PLAN_EK]: {
    label:    'Ek İşler',
    short:    'Ek',
    badgeCls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    cardCls:  'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    barCls:   'bg-amber-400',
  },
};

const EXPENSE_GUIDE = [
  {
    title: 'Dosya Bütçesi',
    tag: 'Planlanan',
    body: 'Ekspertiz, servis, standart parça, saha operasyonu ve dosya açılışında öngörülen olağan maliyetler bu gruba yazılır.',
    example: 'Örnek: Standart onarım malzemesi veya dosya için beklenen hizmet bedeli.',
    cls: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200',
  },
  {
    title: 'Ek İşler',
    tag: 'Bütçe dışı',
    body: 'İlk bütçede yer almayan, sonradan doğan veya müşteriye/sigortaya ayrıca açıklanması gereken masraflar bu gruba yazılır.',
    example: 'Örnek: Ek keşif, ilave işçilik, sonradan çıkan parça veya özel saha gideri.',
    cls: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
  },
  {
    title: 'Kayıt Disiplini',
    tag: 'Zorunlu',
    body: 'Her masraf mutlaka dosya numarasına bağlanmalı, açıklama alanında işin nedeni anlaşılır yazılmalı ve gerçek işlem tarihi seçilmelidir.',
    example: 'Örnek açıklama: Yangın dosyası yerinde keşif ulaşım gideri.',
    cls: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200',
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface FileOption {
  id:          string;
  fileNo:      string;
  description: string;
}

interface Expense {
  id:           string;
  fileCaseId:   string;
  fileNo:       string;
  expensePlan:  string;
  description:  string;
  amount:       number;
  date:         string;
}

const EMPTY_FORM = { fileCaseId: '', expensePlan: PLAN_BUTCE, description: '', amount: '', date: new Date().toISOString().slice(0, 10) };

// ── Bileşen ───────────────────────────────────────────────────────────────────
export default function MasraflarPage() {
  const router = useRouter();

  // Veriler
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [files,    setFiles]    = useState<FileOption[]>([]);
  const [loading,  setLoading]  = useState(true);

  // Form
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState<string | null>(null);
  const [form,       setForm]       = useState({ ...EMPTY_FORM });
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState('');
  const [fileSearch, setFileSearch] = useState('');

  // Filtreler
  const [fPlan,     setFPlan]     = useState('');
  const [fFile,     setFFile]     = useState('');
  const [fDateFrom, setFDateFrom] = useState('');
  const [fDateTo,   setFDateTo]   = useState('');

  // ── Dosyaları yükle ────────────────────────────────────────────────────────
  const loadFiles = useCallback(async (search = '') => {
    try {
      const res = await axios.get(`${API}/file-cases`, {
        headers: authHeader(),
        params: { search, limit: 40 },
      });
      const rows = (res.data?.data ?? res.data ?? []) as Record<string, unknown>[];
      setFiles(rows.map((f) => ({
        id:          String(f['id']),
        fileNo:      String(f['fileNo'] ?? f['claimNo'] ?? ''),
        description: String(f['description'] ?? f['insuredName'] ?? ''),
      })));
    } catch {
      setFiles([]);
    }
  }, []);

  useEffect(() => { loadFiles(fileSearch); }, [fileSearch, loadFiles]);

  // ── Masrafları yükle ───────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (fPlan)     params['expensePlan'] = fPlan;
      if (fFile)     params['fileCaseId']  = fFile;
      if (fDateFrom) params['dateFrom']    = fDateFrom;
      if (fDateTo)   params['dateTo']      = fDateTo;

      const res = await axios.get(`${API}/expenses`, { headers: authHeader(), params });
      const rows = (res.data?.data ?? res.data ?? []) as Record<string, unknown>[];
      setExpenses(rows.map((e) => ({
        id:          String(e['id']),
        fileCaseId:  String(e['fileCaseId'] ?? (e['fileCase'] as Record<string, unknown>)?.['id'] ?? ''),
        fileNo:      String(e['fileNo'] ?? (e['fileCase'] as Record<string, unknown>)?.['fileNo'] ?? ''),
        expensePlan: String(e['expensePlan'] ?? ''),
        description: String(e['description'] ?? ''),
        amount:      Number(e['amount'] ?? 0),
        date:        String(e['date'] ?? ''),
      })));
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [fPlan, fFile, fDateFrom, fDateTo, router]);

  useEffect(() => { load(); }, [load]);

  // ── Kaydet ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setFormError('');
    if (!form.fileCaseId)  return setFormError('Hasar dosyası seçimi zorunludur.');
    if (!form.expensePlan) return setFormError('Kategori seçimi zorunludur.');
    if (!form.amount)      return setFormError('Tutar zorunludur.');
    if (!form.date)        return setFormError('Tarih zorunludur.');

    setSaving(true);
    try {
      const payload = {
        fileCaseId:  form.fileCaseId,
        expensePlan: form.expensePlan,
        description: form.description || undefined,
        amount:      parseFloat(form.amount),
        date:        form.date,
      };
      if (editId) {
        await axios.put(`${API}/expenses/${editId}`, payload, { headers: authHeader() });
      } else {
        await axios.post(`${API}/expenses`, payload, { headers: authHeader() });
      }
      setShowForm(false); setEditId(null); setForm({ ...EMPTY_FORM }); setFormError('');
      load();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
      const msg = axios.isAxiosError(err) ? (err.response?.data?.message ?? 'Kayıt başarısız') : 'Kayıt başarısız';
      setFormError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (e: Expense) => {
    setEditId(e.id);
    setForm({ fileCaseId: e.fileCaseId, expensePlan: e.expensePlan, description: e.description, amount: String(e.amount), date: e.date?.slice(0, 10) ?? '' });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu masrafı silmek istediğinize emin misiniz?')) return;
    try {
      await axios.delete(`${API}/expenses/${id}`, { headers: authHeader() });
      load();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) router.push('/giris');
    }
  };

  // ── Hesaplamalar ───────────────────────────────────────────────────────────
  const butceTotal = expenses.reduce((s, e) => e.expensePlan === PLAN_BUTCE ? s + e.amount : s, 0);
  const ekTotal    = expenses.reduce((s, e) => e.expensePlan === PLAN_EK    ? s + e.amount : s, 0);
  const grandTotal = butceTotal + ekTotal;
  const fileCount  = new Set(expenses.map((e) => e.fileCaseId).filter(Boolean)).size;
  const butcePct   = grandTotal > 0 ? Math.round((butceTotal / grandTotal) * 100) : 0;
  const ekPct      = 100 - butcePct;

  // Dosya bazlı analiz
  type FileRow = { fileNo: string; butce: number; ek: number };
  const byFile = Object.entries(
    expenses.reduce<Record<string, FileRow>>((acc, e) => {
      if (!acc[e.fileCaseId]) acc[e.fileCaseId] = { fileNo: e.fileNo, butce: 0, ek: 0 };
      if (e.expensePlan === PLAN_BUTCE) acc[e.fileCaseId].butce += e.amount;
      else                              acc[e.fileCaseId].ek    += e.amount;
      return acc;
    }, {}),
  ).sort((a, b) => (b[1].butce + b[1].ek) - (a[1].butce + a[1].ek));

  const pieMax = Math.max(butceTotal, ekTotal, 1);

  // CSS sınıfları
  const inputCls = 'w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors';
  const labelCls = 'block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 min-h-screen bg-white -m-6 p-6">

      {/* Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Masraf İzleme</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Hasar dosyalarına bağlı Dosya Bütçesi ve Ek İşler masraflarını takip edin
          </p>
        </div>
        <button
          onClick={() => { setEditId(null); setForm({ ...EMPTY_FORM }); setFormError(''); setShowForm((v) => !v); }}
          className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 shadow-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {showForm ? 'Formu Kapat' : 'Masraf Ekle'}
        </button>
      </div>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Toplam */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Toplam Masraf</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{fmt(grandTotal)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{expenses.length} kalem</p>
        </div>
        {/* Dosya Bütçesi */}
        <div className={`rounded-xl border p-4 ${PLAN_META[PLAN_BUTCE].cardCls}`}>
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Dosya Bütçesi</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{fmt(butceTotal)}</p>
          <p className="text-xs text-blue-400 dark:text-blue-500 mt-1">
            {expenses.filter((e) => e.expensePlan === PLAN_BUTCE).length} kalem · %{butcePct}
          </p>
        </div>
        {/* Ek İşler */}
        <div className={`rounded-xl border p-4 ${PLAN_META[PLAN_EK].cardCls}`}>
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">Ek İşler</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{fmt(ekTotal)}</p>
          <p className="text-xs text-amber-400 dark:text-amber-500 mt-1">
            {expenses.filter((e) => e.expensePlan === PLAN_EK).length} kalem · %{ekPct}
          </p>
        </div>
        {/* Dosya Sayısı */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">İlgili Dosya</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{fileCount}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {fileCount > 0 && grandTotal > 0 ? `Ort. ${fmt(grandTotal / fileCount)}/dosya` : '—'}
          </p>
        </div>
      </div>

      {/* Masraf kalemi rehberi */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Masraf Kalemi Rehberi</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Kayıt sırasında hangi kalemin hangi kategoriye yazılacağını hızlıca ayırt etmek için kullanılır.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            İpucu
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {EXPENSE_GUIDE.map((item) => (
            <div key={item.title} className={`rounded-xl border p-4 ${item.cls}`}>
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold">{item.title}</h4>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide dark:bg-slate-900/40">
                  {item.tag}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 opacity-90">{item.body}</p>
              <p className="mt-3 rounded-lg bg-white/80 px-3 py-2 text-[11px] leading-5 opacity-90 dark:bg-slate-900/40">
                {item.example}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Masraf Ekleme Formu */}
      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">
            {editId ? 'Masrafı Düzenle' : 'Yeni Masraf Ekle'}
          </h3>

          {formError && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2.5 text-xs text-red-700 dark:text-red-400">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Hasar Dosyası — arama + select */}
            <div className="md:col-span-2">
              <label className={labelCls}>
                Hasar Dosyası <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  placeholder="Dosya no ile ara..."
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                />
                <select
                  className={`${inputCls} min-w-[220px]`}
                  value={form.fileCaseId}
                  onChange={(e) => setForm({ ...form, fileCaseId: e.target.value })}
                >
                  <option value="">Dosya seçiniz...</option>
                  {files.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.fileNo}{f.description ? ` — ${f.description}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Kategori — 2 büyük radio kart */}
            <div className="md:col-span-2">
              <label className={labelCls}>
                Kategori <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: PLAN_BUTCE, label: 'Dosya Bütçesi', sub: 'Normal bütçe kapsamındaki masraflar', icon: '📁', activeCls: 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' },
                  { value: PLAN_EK,   label: 'Ek İşler',       sub: 'Bütçe dışı ek iş masrafları',        icon: '➕', activeCls: 'border-amber-400 bg-amber-50 dark:bg-amber-900/30' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, expensePlan: opt.value })}
                    className={`text-left rounded-xl border-2 px-4 py-3 transition-all ${
                      form.expensePlan === opt.value
                        ? opt.activeCls
                        : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <span className="text-xl">{opt.icon}</span>
                    <p className={`font-semibold text-sm mt-1 ${form.expensePlan === opt.value ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Açıklama */}
            <div className="md:col-span-2">
              <label className={labelCls}>Açıklama</label>
              <input
                className={inputCls}
                placeholder="Masraf açıklaması (örn: Çatı kaplama malzemesi)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {/* Tutar */}
            <div>
              <label className={labelCls}>Tutar (₺) <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm pointer-events-none">₺</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className={`${inputCls} pl-7`}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
            </div>

            {/* Tarih */}
            <div>
              <label className={labelCls}>Tarih <span className="text-red-500">*</span></label>
              <input
                type="date"
                className={inputCls}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditId(null); setForm({ ...EMPTY_FORM }); setFormError(''); }}
              className="text-sm text-slate-500 dark:text-slate-400 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="text-sm bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
            >
              {saving ? 'Kaydediliyor...' : editId ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}

      {/* Filtreler */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex flex-wrap gap-3 items-center">
        {/* Kategori */}
        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-1">
          {[{ v: '', l: 'Tümü' }, { v: PLAN_BUTCE, l: 'Dosya Bütçesi' }, { v: PLAN_EK, l: 'Ek İşler' }].map(({ v, l }) => (
            <button
              key={v}
              type="button"
              onClick={() => setFPlan(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                fPlan === v
                  ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Dosya */}
        <select
          value={fFile}
          onChange={(e) => setFFile(e.target.value)}
          className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
        >
          <option value="">Tüm Dosyalar</option>
          {files.map((f) => <option key={f.id} value={f.id}>{f.fileNo}</option>)}
        </select>

        {/* Tarih aralığı */}
        <div className="flex items-center gap-2">
          <input type="date" value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)}
            className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200" />
          <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
          <input type="date" value={fDateTo} onChange={(e) => setFDateTo(e.target.value)}
            className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200" />
          {(fDateFrom || fDateTo) && (
            <button type="button" onClick={() => { setFDateFrom(''); setFDateTo(''); }}
              className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300">Temizle</button>
          )}
        </div>
      </div>

      {/* Liste Tablosu */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Masraf Listesi</p>
          <span className="text-xs text-slate-400 dark:text-slate-500">{expenses.length} kayıt</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">Yükleniyor...</div>
        ) : expenses.length === 0 ? (
          <div className="py-14 text-center">
            <svg className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm text-slate-400 dark:text-slate-500">Henüz veri bulunmamaktadır.</p>
            <button type="button" onClick={() => setShowForm(true)}
              className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline">
              + İlk masrafı ekle
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-700/40 text-left">
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Dosya No</th>
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Kategori</th>
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Açıklama</th>
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide text-right">Tutar</th>
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tarih</th>
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {expenses.map((e) => {
                  const meta = PLAN_META[e.expensePlan] ?? PLAN_META[PLAN_BUTCE];
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                          {e.fileNo || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${meta.badgeCls}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 max-w-[220px] truncate">
                        {e.description || <span className="text-slate-300 dark:text-slate-600 italic">Açıklama yok</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {fmt(e.amount)}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {fmtDate(e.date)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => handleEdit(e)} title="Düzenle"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button type="button" onClick={() => handleDelete(e.id)} title="Sil"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-700/40">
                  <td colSpan={3} className="px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Toplam</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-900 dark:text-slate-100">{fmt(grandTotal)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Kategorik Analiz */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pasta grafik (CSS) */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Kategori Dağılımı</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-5">Dosya Bütçesi vs Ek İşler</p>

          {grandTotal === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">Veri yok</p>
          ) : (
            <div className="flex items-center gap-8">
              {/* CSS pie chart */}
              <div className="relative shrink-0 w-32 h-32">
                <svg viewBox="0 0 36 36" className="w-32 h-32 -rotate-90">
                  {/* Arka plan (Ek İşler) */}
                  <circle cx="18" cy="18" r="15.915" fill="transparent"
                    stroke="#f59e0b" strokeWidth="4" strokeDasharray="100" strokeDashoffset="0" />
                  {/* Dosya Bütçesi */}
                  <circle cx="18" cy="18" r="15.915" fill="transparent"
                    stroke="#3b82f6" strokeWidth="4"
                    strokeDasharray={`${butcePct} ${100 - butcePct}`}
                    strokeDashoffset="0"
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-slate-800 dark:text-slate-100">%{butcePct}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Bütçe</span>
                </div>
              </div>

              {/* Legend */}
              <div className="flex-1 space-y-4">
                {[
                  { plan: PLAN_BUTCE, value: butceTotal, pct: butcePct },
                  { plan: PLAN_EK,    value: ekTotal,    pct: ekPct },
                ].map(({ plan, value, pct }) => {
                  const m = PLAN_META[plan];
                  const barW = pieMax > 0 ? Math.round((value / pieMax) * 100) : 0;
                  return (
                    <div key={plan}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold ${plan === PLAN_BUTCE ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {m.label}
                        </span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{fmt(value)}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div className={`h-full rounded-full ${m.barCls} transition-all duration-700`} style={{ width: `${barW}%` }} />
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">%{pct} · {expenses.filter((e) => e.expensePlan === plan).length} kalem</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Dosya bazlı tablo */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Dosya Bazlı Analiz</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Her dosyanın bütçe ve ek iş toplamları</p>

          {byFile.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">Veri yok</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-100 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40">
                    <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-medium">Dosya No</th>
                    <th className="px-3 py-2 text-right text-blue-500 dark:text-blue-400 font-medium">Bütçe</th>
                    <th className="px-3 py-2 text-right text-amber-500 dark:text-amber-400 font-medium">Ek İşler</th>
                    <th className="px-3 py-2 text-right text-slate-500 dark:text-slate-400 font-medium">Toplam</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                  {byFile.map(([fileId, row]) => {
                    const total = row.butce + row.ek;
                    const bPct  = total > 0 ? Math.round((row.butce / total) * 100) : 0;
                    return (
                      <tr key={fileId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-3 py-2.5">
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{row.fileNo}</span>
                          {/* mini stacked bar */}
                          <div className="mt-1 h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 flex">
                            <div className="h-full bg-blue-500" style={{ width: `${bPct}%` }} />
                            <div className="h-full bg-amber-400" style={{ width: `${100 - bPct}%` }} />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-blue-700 dark:text-blue-300 font-semibold whitespace-nowrap">
                          {row.butce > 0 ? fmt(row.butce) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-amber-700 dark:text-amber-300 font-semibold whitespace-nowrap">
                          {row.ek > 0 ? fmt(row.ek) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {fmt(total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40">
                    <td className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-400">Genel Toplam</td>
                    <td className="px-3 py-2 text-right font-bold text-blue-700 dark:text-blue-300">{fmt(butceTotal)}</td>
                    <td className="px-3 py-2 text-right font-bold text-amber-700 dark:text-amber-300">{fmt(ekTotal)}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-slate-100">{fmt(grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
