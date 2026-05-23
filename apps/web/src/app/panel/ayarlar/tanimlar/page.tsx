'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { API, authHeader } from '@/utils/api';
import { DAMAGE_TYPE_OPTIONS } from '@/components/damage-reports/RepairItemsModal';
import { toTitleCaseTR, sanitizeCode, generateCodeFromName, generateSequentialCode } from '@/utils/text-helpers';
import { useToast } from '@/contexts/ToastContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type UsageArea = 'musteri' | 'eksper' | 'tedarikci' | 'dosya';

interface Department {
  id: string;
  code: string;
  name: string;
  color: string;
  reportFormat: string;
  status: string;
}

interface CustomerType {
  id: string;
  name: string;
  description?: string;
  color: string;
  status: 'active' | 'inactive';
}

interface RelationshipType {
  label: string;
  active: boolean;
  usageAreas?: UsageArea[];
}

interface ServiceType {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}

interface DocumentType {
  id: string;
  code: string;
  name: string;
  description?: string;
  isRequired: boolean;
  sortOrder: number;
  status: string;
}

interface WorkSubGroup {
  id: string;
  workGroupId: string;
  code: string;
  name: string;
  description?: string;
  unitType: string;
  unitPrice?: number | null;
  sortOrder: number;
  status: string;
}

interface WorkGroup {
  id: string;
  code: string;
  name: string;
  description?: string;
  unit?: string;
  sortOrder: number;
  status: string;
  subGroups?: WorkSubGroup[];
  workSubGroups?: WorkSubGroup[];
  _count?: { workSubGroups: number };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors';
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1';
const codeHelperText = 'Sadece büyük İngilizce harf, rakam ve alt çizgi (_) kullanın';
const CODE_REGEX = /^[A-Z0-9_]*$/;
const WORK_GROUP_UNIT_OPTIONS = ['m²', 'adet', 'metre', 'saat', 'kg', 'ton'];

const USAGE_AREAS: { value: UsageArea; label: string; cls: string }[] = [
  { value: 'musteri',   label: 'Müşteri',   cls: 'bg-blue-50 text-blue-700 border-blue-100' },
  { value: 'eksper',    label: 'Eksper',    cls: 'bg-purple-50 text-purple-700 border-purple-100' },
  { value: 'tedarikci', label: 'Tedarikçi', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  { value: 'dosya',     label: 'Dosya',     cls: 'bg-green-50 text-green-700 border-green-100' },
];

const DEFAULT_COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#EC4899','#06B6D4','#6366F1','#14B8A6','#F97316'];

const DEFAULT_CUSTOMER_TYPES = [
  { name: 'Sigorta Şirketi',   color: '#3B82F6', description: 'Sigorta şirketleri' },
  { name: 'Asistans Firma',    color: '#8B5CF6', description: 'Asistans firmaları' },
  { name: 'Sigortalı',         color: '#10B981', description: 'Sigortalı müşteriler' },
  { name: 'Eksper',            color: '#F59E0B', description: 'Eksperler' },
];

// ── Tab metadata ──────────────────────────────────────────────────────────────

const TAB_HINTS: Record<string, { title: string; desc: string; tip: string }> = {
  departmanlar: {
    title: 'Departmanlar',
    desc: 'Farklı hasar türleri veya operasyon birimleri için departmanlar tanımlayın.',
    tip: 'Her departmanın benzersiz bir kodu olmalıdır (örn: HASAR_KASKO). Renk seçimi raporlarda görsel ayrımı kolaylaştırır.',
  },
  'musteri-tipleri': {
    title: 'Müşteri Tipleri',
    desc: 'Müşteri kayıt formunda kullanıcıya sunulacak müşteri kategorilerini belirleyin.',
    tip: 'Sigorta Şirketi, Asistans Firma, Sigortalı gibi tipler dosya atamalarında ve filtrelemede kolaylık sağlar.',
  },
  'iliski-turleri': {
    title: 'İlişki Türleri',
    desc: 'Müşteriler ve iş ortakları arasındaki ilişki kategorilerini tanımlayın.',
    tip: 'Kullanım alanı seçerek ilişki türünün hangi kayıt formlarında görüneceğini belirleyebilirsiniz.',
  },
  'hizmet-turleri': {
    title: 'Hizmet Türleri',
    desc: 'Dosyalarda sunulan hizmet kategorilerini buradan yönetin.',
    tip: 'Pasif hale getirilen hizmet türleri yeni dosyalarda seçim listesinden kaldırılır, mevcut dosyalar etkilenmez.',
  },
  'ihbar-konulari': {
    title: 'İhbar Konuları',
    desc: 'Dosya açılışında "Hasar" veya "Acil Yardım" sekmesi için ihbar/bildirim konularını girin.',
    tip: 'Konuları kısa ve açık tutun. Listede bulunmayan konular dosya oluşturucuların serbest metin girmesine yol açar.',
  },
  'evrak-turleri': {
    title: 'Evrak Türleri',
    desc: 'Dosyalarda talep edilecek belge kategorilerini tanımlayın.',
    tip: '"Zorunlu" olarak işaretlenen evraklar, dosya kapatılırken sistemin kontrol ettiği belgeler arasına girer.',
  },
  'is-gruplari': {
    title: 'İş Grupları & Kalemleri',
    desc: 'Maliyetlendirmede kullanılan iş grupları ve alt gruplarını hiyerarşik olarak yönetin.',
    tip: 'Her grupta benzersiz bir kod kullanın (IG001). Alt grubu hızlıca eklemek için grubun yanındaki + butonuna tıklayın.',
  },
  'hasar-turu-sablonlari': {
    title: 'Hasar Türü Şablonları',
    desc: 'Hasar türüne göre önerilecek hızlı onarım kalemlerini yönetin.',
    tip: 'Aynı hasar türü ve iş kalemi kombinasyonu bir kez tanımlanabilir.',
  },
};

type TabId = 'departmanlar' | 'musteri-tipleri' | 'iliski-turleri' | 'hizmet-turleri' | 'ihbar-konulari' | 'evrak-turleri' | 'is-gruplari' | 'hasar-turu-sablonlari' | 'birim-secenekleri' | 'musteri-kaynaklari' | 'alan-zorunluluklari';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'departmanlar',        label: 'Departmanlar',        icon: '🏢' },
  { id: 'musteri-tipleri',     label: 'Müşteri Tipleri',     icon: '🏷️' },
  { id: 'iliski-turleri',      label: 'İlişki Türleri',      icon: '🔗' },
  { id: 'hizmet-turleri',      label: 'Hizmet Türleri',      icon: '🔧' },
  { id: 'ihbar-konulari',      label: 'İhbar Konuları',      icon: '📋' },
  { id: 'evrak-turleri',       label: 'Evrak Türleri',       icon: '📁' },
  { id: 'is-gruplari',         label: 'İş Grupları',         icon: '🗂️' },
  { id: 'hasar-turu-sablonlari', label: 'Hasar Türü Şablonları', icon: '⚡' },
  { id: 'birim-secenekleri',   label: 'Birim Seçenekleri',   icon: '📐' },
  { id: 'musteri-kaynaklari',  label: 'Müşteri Kaynakları',  icon: '🌐' },
  { id: 'alan-zorunluluklari', label: 'Alan Zorunlulukları', icon: '⚙️' },
];

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TanimlarPage() {
  const [activeTab, setActiveTab] = useState<TabId>('departmanlar');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
        <span>/</span>
        <a href="/panel/ayarlar" className="hover:text-blue-600 transition-colors">Ayarlar</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Tanimlar</span>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-3"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Geri
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Tanımlar</h1>
          <p className="text-sm text-slate-500 mt-1">Operasyonu etkileyen temel tanımları yönetin.</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6 overflow-x-auto">
          <div className="flex min-w-max">
            {TABS.map((tab, idx) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                  activeTab === tab.id ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                } ${idx > 0 ? 'border-l border-l-slate-100' : ''}`}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'departmanlar'        && <DepartmanlarTab />}
        {activeTab === 'musteri-tipleri'     && <MusteriTipleriTab />}
        {activeTab === 'iliski-turleri'      && <IliskiTurleriTab />}
        {activeTab === 'hizmet-turleri'      && <HizmetTurleriTab />}
        {activeTab === 'ihbar-konulari'      && <IhbarKonulariTab />}
        {activeTab === 'evrak-turleri'       && <EvrakTurleriTab />}
        {activeTab === 'is-gruplari'         && <IsGruplariTab />}
        {activeTab === 'hasar-turu-sablonlari' && <HasarTuruSablonlariTab />}
        {activeTab === 'birim-secenekleri'   && <BirimSecenekleriTab />}
        {activeTab === 'musteri-kaynaklari'  && <MusteriKaynaklariTab />}
        {activeTab === 'alan-zorunluluklari' && <AlanZorunluluklariInlineTab />}
      </div>
    </div>
  );
}


function HasarTuruSablonlariTab() {
  const [damageType, setDamageType] = useState('FIRE_HOME');
  const [templates, setTemplates] = useState<any[]>([]);
  const [workGroups, setWorkGroups] = useState<any[]>([]);
  const [form, setForm] = useState({ workSubGroupId: '', defaultQuantitySmall: '1', defaultQuantityMedium: '1', defaultQuantityLarge: '1', sortOrder: '0' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const subGroups = workGroups.flatMap((group: any) => group.workSubGroups ?? group.subGroups ?? []);
  const loadTemplates = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/damage-repair-templates?damageType=${damageType}`, { headers: authHeader() });
      setTemplates(res.data.data ?? []);
    } catch (err: any) { console.error(err); setError(err.response?.data?.message ?? 'Şablonlar yüklenemedi.'); }
  }, [damageType]);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);
  useEffect(() => { axios.get(`${API}/work-groups?includeSubGroups=true`, { headers: authHeader() }).then((res) => setWorkGroups(res.data.data ?? [])).catch((err) => console.error(err)); }, []);
  const reset = () => { setEditingId(null); setForm({ workSubGroupId: '', defaultQuantitySmall: '1', defaultQuantityMedium: '1', defaultQuantityLarge: '1', sortOrder: '0' }); };
  const save = async () => {
    setError('');
    const payload = { damageType, workSubGroupId: form.workSubGroupId, defaultQuantitySmall: Number(form.defaultQuantitySmall), defaultQuantityMedium: Number(form.defaultQuantityMedium), defaultQuantityLarge: Number(form.defaultQuantityLarge), sortOrder: Number(form.sortOrder) };
    try { if (editingId) await axios.put(`${API}/damage-repair-templates/${editingId}`, payload, { headers: authHeader() }); else await axios.post(`${API}/damage-repair-templates`, payload, { headers: authHeader() }); reset(); loadTemplates(); }
    catch (err: any) { console.error(err); setError(err.response?.data?.message ?? 'Kayıt başarısız.'); }
  };
  const edit = (template: any) => { setEditingId(template.id); setForm({ workSubGroupId: template.workSubGroupId, defaultQuantitySmall: String(template.defaultQuantitySmall ?? 1), defaultQuantityMedium: String(template.defaultQuantityMedium ?? 1), defaultQuantityLarge: String(template.defaultQuantityLarge ?? 1), sortOrder: String(template.sortOrder ?? 0) }); };
  const remove = async (id: string) => { if (!confirm('Şablon silinsin mi?')) return; await axios.delete(`${API}/damage-repair-templates/${id}`, { headers: authHeader() }); loadTemplates(); };
  return <div className="space-y-5">{error && <ErrorAlert msg={error} onClose={() => setError('')} />}<div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-3 md:grid-cols-[220px_1fr_110px_110px_110px_90px_auto] md:items-end"><div><label className={labelCls}>Hasar türü</label><select value={damageType} onChange={(e) => setDamageType(e.target.value)} className={inputCls}>{DAMAGE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div><label className={labelCls}>İş kalemi</label><select value={form.workSubGroupId} onChange={(e) => setForm((prev) => ({ ...prev, workSubGroupId: e.target.value }))} className={inputCls}><option value="">Seçiniz</option>{subGroups.map((sub: any) => <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>)}</select></div>{(['defaultQuantitySmall', 'defaultQuantityMedium', 'defaultQuantityLarge'] as const).map((key, index) => <div key={key}><label className={labelCls}>{['Küçük', 'Orta', 'Büyük'][index]}</label><input type="number" value={form[key]} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))} className={inputCls} /></div>)}<div><label className={labelCls}>Sıra</label><input type="number" value={form.sortOrder} onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))} className={inputCls} /></div><div className="flex gap-2"><button type="button" onClick={save} disabled={!form.workSubGroupId} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{editingId ? 'Güncelle' : 'Ekle'}</button>{editingId && <button type="button" onClick={reset} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">İptal</button>}</div></div></div><div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 text-left">Kalem</th><th>Küçük</th><th>Orta</th><th>Büyük</th><th>Kullanım</th><th>Sıra</th><th></th></tr></thead><tbody>{templates.map((template) => <tr key={template.id} className="border-t border-slate-100"><td className="px-4 py-3"><strong>{template.workSubGroup?.name}</strong><div className="text-xs text-slate-400">{template.workSubGroup?.code}</div></td><td className="text-center">{template.defaultQuantitySmall ?? 1}</td><td className="text-center">{template.defaultQuantityMedium ?? 1}</td><td className="text-center">{template.defaultQuantityLarge ?? 1}</td><td className="text-center">{template.usageCount}</td><td className="text-center">{template.sortOrder}</td><td className="px-4 py-3"><RowActions onEdit={() => edit(template)} onDelete={() => remove(template.id)} /></td></tr>)}{templates.length === 0 && <tr><td colSpan={7}><EmptyState msg="Bu hasar türü için şablon yok." /></td></tr>}</tbody></table></div></div>;
}

// ── Departmanlar ──────────────────────────────────────────────────────────────

function DepartmanlarTab() {
  const { showToast } = useToast();
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ code: '', name: '', color: '#3B82F6', reportFormat: 'repair_single' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortKey, setSortKey] = useState<'name' | 'code'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const fetchDepts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/departments`, { headers: authHeader() });
      setDepts(res.data.data ?? res.data ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDepts(); }, [fetchDepts]);

  const openCreate = () => { setEditing(null); setForm({ code: '', name: '', color: '#3B82F6', reportFormat: 'repair_single' }); setError(''); setShowModal(true); };
  const openEdit = (d: Department) => { setEditing(d); setForm({ code: d.code, name: d.name, color: d.color, reportFormat: d.reportFormat }); setError(''); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) { setError('Ad ve kod zorunludur.'); return; }
    if (!CODE_REGEX.test(form.code)) { setError('Kod: sadece büyük İngilizce harf, rakam ve alt çizgi (_) kullanın.'); return; }
    const dup = depts.find(d => d.code.trim().toUpperCase() === form.code.trim().toUpperCase() && (!editing || d.id !== editing.id));
    if (dup) { setError('Bu kod zaten kullanılıyor.'); return; }
    setSaving(true); setError('');
    try {
      if (editing) {
        await axios.put(`${API}/departments/${editing.id}`, form, { headers: authHeader() });
        showToast('success', 'Departman güncellendi.');
      } else {
        await axios.post(`${API}/departments`, form, { headers: authHeader() });
        showToast('success', 'Departman eklendi.');
      }
      setShowModal(false); fetchDepts();
    } catch (e: any) { setError(e.response?.data?.message ?? 'İşlem başarısız.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/departments/${deleteTarget.id}`, { headers: authHeader() });
      showToast('success', 'Departman silindi.');
      setDeleteTarget(null); fetchDepts();
    } catch (e: any) {
      setDeleting(false);
      showToast('error', e.response?.data?.message ?? 'Silme başarısız.');
      setDeleteTarget(null);
    }
    finally { setDeleting(false); }
  };

  const toggleSort = (key: 'name' | 'code') => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = [...depts].sort((a, b) => {
    const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
    return sortDir === 'asc' ? av.localeCompare(bv, 'tr') : bv.localeCompare(av, 'tr');
  });

  return (
    <TabCard title="Departmanlar" description="Hasar türlerine göre departmanları tanımlayın." hint={TAB_HINTS.departmanlar.tip}>
      <div className="flex justify-end mb-4">
        <AddBtn onClick={openCreate} />
      </div>
      {loading ? <RowSkeleton /> : depts.length === 0 ? <EmptyState msg="Henüz departman eklenmemiş." onAdd={openCreate} /> : (
        <div className="overflow-x-auto overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-5 py-3 w-12">Renk</th>
                <SortTh label="Kod" sortKey="code" currentKey={sortKey} dir={sortDir} onToggle={(k) => toggleSort(k as 'name' | 'code')} />
                <SortTh label="Ad" sortKey="name" currentKey={sortKey} dir={sortDir} onToggle={(k) => toggleSort(k as 'name' | 'code')} />
                <th className="px-5 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map((d, idx) => (
                <tr key={d.id} className={`hover:bg-blue-50/30 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : 'bg-white'}`}>
                  <td className="px-5 py-3"><span className="inline-block w-5 h-5 rounded-full border border-white shadow" style={{ background: d.color }} /></td>
                  <td className="px-5 py-3 font-mono text-xs"><span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">{d.code}</span></td>
                  <td className="px-5 py-3 font-medium text-slate-800">{d.name}</td>
                  <td className="px-5 py-3"><RowActions onEdit={() => openEdit(d)} onDelete={() => setDeleteTarget(d)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showModal && (
        <Modal title={editing ? 'Departmanı Düzenle' : 'Yeni Departman'} onClose={() => setShowModal(false)}>
          {error && <ErrorAlert msg={error} onClose={() => setError('')} />}
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Ad <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm(p => ({
                    ...p,
                    name,
                    // Auto-generate code only when creating new, not editing
                    ...(!editing && p.code === '' || !editing && p.code === generateCodeFromName(p.name)
                      ? { code: generateCodeFromName(name) }
                      : {}),
                  }));
                }}
                onBlur={(e) => setForm(p => ({ ...p, name: toTitleCaseTR(e.target.value) }))}
              />
            </div>
            <div>
              <label className={labelCls}>Kod <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
              <input
                className={`${inputCls} uppercase font-mono`}
                placeholder="HASAR_ONARIM"
                value={form.code}
                onChange={(e) => {
                  const raw = sanitizeCode(e.target.value);
                  setForm(p => ({ ...p, code: raw }));
                }}
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.value = sanitizeCode(t.value);
                }}
              />
              <p className="text-xs text-slate-400 mt-1">{codeHelperText}</p>
            </div>
            <div>
              <label className={labelCls}>Renk</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {DEFAULT_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))} className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-slate-600 scale-110' : 'border-transparent hover:scale-105'}`} style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5"><CancelBtn onClick={() => setShowModal(false)} /><SaveBtn loading={saving} onClick={handleSave} /></div>
        </Modal>
      )}
      {deleteTarget && <ConfirmModal title="Departmanı Sil" message={`"${deleteTarget.name}" departmanını silmek istediğinize emin misiniz?`} loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} danger />}
    </TabCard>
  );
}

// ── Müşteri Tipleri ───────────────────────────────────────────────────────────

function MusteriTipleriTab() {
  const { showToast } = useToast();
  const [types, setTypes] = useState<CustomerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CustomerType | null>(null);
  const [form, setForm] = useState({ name: '', description: '', color: '#3B82F6', status: 'active' as 'active' | 'inactive' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CustomerType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/system-settings/customer-types`, { headers: authHeader() });
      // Backend returns { types: [...] } or { data: [...] } or array directly
      const raw = res.data;
      let data: CustomerType[] = [];
      if (Array.isArray(raw)) {
        data = raw;
      } else if (Array.isArray(raw?.types)) {
        data = raw.types;
      } else if (Array.isArray(raw?.data)) {
        data = raw.data;
      } else if (Array.isArray(raw?.values)) {
        data = raw.values;
      }
      if (data.length === 0) {
        const seeded: CustomerType[] = DEFAULT_CUSTOMER_TYPES.map((t, i) => ({ id: `seed-${i}`, ...t, status: 'active' as const }));
        setTypes(seeded);
      } else {
        setTypes(data);
      }
    } catch { /* API hatası — mevcut state'i koru */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', color: '#3B82F6', status: 'active' }); setError(''); setShowModal(true); };
  const openEdit = (t: CustomerType) => { setEditing(t); setForm({ name: t.name, description: t.description ?? '', color: t.color, status: t.status }); setError(''); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Ad zorunludur.'); return; }
    const dup = types.find(t => t.name.trim().toLowerCase() === form.name.trim().toLowerCase() && (!editing || t.id !== editing.id));
    if (dup) { setError('Bu isimde bir müşteri tipi zaten mevcut.'); return; }
    setSaving(true); setError('');
    try {
      let updated: CustomerType[];
      if (editing) {
        updated = types.map(t => t.id === editing.id ? { ...t, ...form } : t);
      } else {
        updated = [...types, { id: `ct-${Date.now()}`, ...form }];
      }
      await axios.put(`${API}/system-settings/customer-types`, { values: updated }, { headers: authHeader() });
      setTypes(updated);
      setShowModal(false);
      showToast('success', editing ? 'Müşteri tipi güncellendi.' : 'Müşteri tipi eklendi.');
    } catch (e: any) { setError(e.response?.data?.message ?? 'Kayıt başarısız. Lütfen tekrar deneyin.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const updated = types.filter(t => t.id !== deleteTarget.id);
      await axios.put(`${API}/system-settings/customer-types`, { values: updated }, { headers: authHeader() });
      setTypes(updated);
      showToast('success', 'Müşteri tipi silindi.');
      setDeleteTarget(null);
    } catch (e: any) { showToast('error', e.response?.data?.message ?? 'Silme başarısız.'); }
    finally { setDeleting(false); }
  };

  return (
    <TabCard title="Müşteri Tipleri" description="Müşteri kayıt formunda kullanılacak müşteri tiplerini tanımlayın." hint={TAB_HINTS['musteri-tipleri'].tip}>
      <div className="flex justify-end mb-4">
        <AddBtn onClick={openCreate} />
      </div>
      {loading ? <RowSkeleton /> : types.length === 0 ? <EmptyState msg="Henüz müşteri tipi eklenmemiş." /> : (
        <div className="space-y-2">
          {types.map(t => (
            <div key={t.id} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 rounded-full border border-white shadow shrink-0" style={{ background: t.color }} />
                <div>
                  <span className="text-sm font-medium text-slate-800">{t.name}</span>
                  {t.description && <p className="text-xs text-slate-400">{t.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${t.status === 'active' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                  {t.status === 'active' ? 'Aktif' : 'Pasif'}
                </span>
                <RowActions onEdit={() => openEdit(t)} onDelete={() => setDeleteTarget(t)} />
              </div>
            </div>
          ))}
        </div>
      )}
      {showModal && (
        <Modal title={editing ? 'Tipi Düzenle' : 'Yeni Müşteri Tipi'} onClose={() => setShowModal(false)}>
          {error && <ErrorAlert msg={error} onClose={() => setError('')} />}
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Ad <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                onBlur={(e) => setForm(p => ({ ...p, name: toTitleCaseTR(e.target.value) }))}
              />
            </div>
            <div>
              <label className={labelCls}>Açıklama</label>
              <input className={inputCls} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Renk</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {DEFAULT_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))} className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-slate-600 scale-110' : 'border-transparent hover:scale-105'}`} style={{ background: c }} />
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Durum</label>
              <select className={inputCls} value={form.status} onChange={(e) => setForm(p => ({ ...p, status: e.target.value as 'active' | 'inactive' }))}>
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5"><CancelBtn onClick={() => setShowModal(false)} /><SaveBtn loading={saving} onClick={handleSave} /></div>
        </Modal>
      )}
      {deleteTarget && <ConfirmModal title="Tipi Sil" message={`"${deleteTarget.name}" tipini silmek istediğinize emin misiniz?`} loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} danger />}
    </TabCard>
  );
}

// ── İlişki Türleri ────────────────────────────────────────────────────────────

function IliskiTurleriTab() {
  const { showToast } = useToast();
  const [types, setTypes] = useState<RelationshipType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formAreas, setFormAreas] = useState<UsageArea[]>([]);
  const [modalError, setModalError] = useState('');
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/system-settings/relationship-types`, { headers: authHeader() });
      // Handle various response shapes
      const raw = res.data;
      let data: RelationshipType[] = [];
      if (Array.isArray(raw)) {
        data = raw;
      } else if (Array.isArray(raw?.types)) {
        data = raw.types;
      } else if (Array.isArray(raw?.data)) {
        data = raw.data;
      } else if (Array.isArray(raw?.values)) {
        data = raw.values;
      }
      setTypes(data);
    } catch { /* API hatası — mevcut state'i koru */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const openCreate = () => { setEditingIdx(null); setFormLabel(''); setFormAreas([]); setModalError(''); setShowModal(true); };
  const openEdit = (idx: number) => { setEditingIdx(idx); setFormLabel(types[idx].label); setFormAreas(types[idx].usageAreas ?? []); setModalError(''); setShowModal(true); };

  const saveTypes = async (updated: RelationshipType[]) => {
    setSaving(true);
    try {
      await axios.put(`${API}/system-settings/relationship-types`, { values: updated }, { headers: authHeader() });
      setTypes(updated);
    } catch (e: any) {
      throw e;
    } finally { setSaving(false); }
  };

  const handleSave = async () => {
    if (!formLabel.trim()) { setModalError('Ad zorunludur.'); return; }
    const dup = types.find((t, i) => t.label.trim().toLowerCase() === formLabel.trim().toLowerCase() && (editingIdx === null || i !== editingIdx));
    if (dup) { setModalError('Bu isimde bir tür zaten mevcut.'); return; }
    let updated: RelationshipType[];
    if (editingIdx !== null) {
      updated = types.map((t, i) => i === editingIdx ? { ...t, label: formLabel, usageAreas: formAreas } : t);
    } else {
      updated = [...types, { label: formLabel, active: true, usageAreas: formAreas }];
    }
    try {
      await saveTypes(updated);
      showToast('success', editingIdx !== null ? 'İlişki türü güncellendi.' : 'İlişki türü eklendi.');
      setShowModal(false);
    } catch { setModalError('Kayıt başarısız. Tekrar deneyin.'); }
  };

  const handleDelete = async () => {
    if (deleteIdx === null) return;
    setDeleting(true);
    const updated = types.filter((_, i) => i !== deleteIdx);
    try {
      await saveTypes(updated);
    } catch { /* ignore */ }
    setDeleteIdx(null);
    setDeleting(false);
  };

  const toggleArea = (area: UsageArea) => {
    setFormAreas(p => p.includes(area) ? p.filter(a => a !== area) : [...p, area]);
  };

  return (
    <TabCard title="İlişki Türleri" description="Müşteri ve iş ortağı ilişki türlerini tanımlayın." hint={TAB_HINTS['iliski-turleri'].tip}>
      <div className="flex justify-end mb-4">
        <AddBtn onClick={openCreate} />
      </div>
      {loading ? <RowSkeleton /> : types.length === 0 ? <EmptyState msg="Henüz ilişki türü eklenmemiş." /> : (
        <div className="space-y-2">
          {types.map((t, idx) => (
            <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-800">{t.label}</span>
                <div className="flex gap-1">
                  {(t.usageAreas ?? []).map(a => {
                    const meta = USAGE_AREAS.find(ua => ua.value === a);
                    return meta ? <span key={a} className={`px-1.5 py-0.5 rounded text-xs border ${meta.cls}`}>{meta.label}</span> : null;
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${t.active ? 'bg-green-50 text-green-700 border-green-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                  {t.active ? 'Aktif' : 'Pasif'}
                </span>
                <RowActions onEdit={() => openEdit(idx)} onDelete={() => setDeleteIdx(idx)} />
              </div>
            </div>
          ))}
        </div>
      )}
      {showModal && (
        <Modal title={editingIdx !== null ? 'Türü Düzenle' : 'Yeni İlişki Türü'} onClose={() => setShowModal(false)}>
          {modalError && <ErrorAlert msg={modalError} onClose={() => setModalError('')} />}
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Ad <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
              <input
                className={inputCls}
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                onBlur={(e) => setFormLabel(toTitleCaseTR(e.target.value))}
              />
            </div>
            <div>
              <label className={labelCls}>Kullanım Alanları</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {USAGE_AREAS.map(a => (
                  <button key={a.value} type="button" onClick={() => toggleArea(a.value)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${formAreas.includes(a.value) ? `${a.cls} ring-2 ring-offset-1 ring-blue-400` : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5"><CancelBtn onClick={() => setShowModal(false)} /><SaveBtn loading={saving} onClick={handleSave} /></div>
        </Modal>
      )}
      {deleteIdx !== null && <ConfirmModal title="Türü Sil" message={`"${types[deleteIdx]?.label}" türünü silmek istediğinize emin misiniz?`} loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteIdx(null)} danger />}
    </TabCard>
  );
}

// ── Hizmet Türleri ────────────────────────────────────────────────────────────

function HizmetTurleriTab() {
  const { showToast } = useToast();
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ServiceType | null>(null);
  const [form, setForm] = useState({ name: '', description: '', isActive: true, sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ServiceType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/service-types`, { headers: authHeader() });
      const raw = res.data;
      let data: ServiceType[] = [];
      if (Array.isArray(raw)) data = raw;
      else if (Array.isArray(raw?.data)) data = raw.data;
      else if (Array.isArray(raw?.items)) data = raw.items;
      setTypes(data);
    } catch { /* API hatası — mevcut state'i koru */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', isActive: true, sortOrder: types.length + 1 }); setError(''); setShowModal(true); };
  const openEdit = (t: ServiceType) => { setEditing(t); setForm({ name: t.name, description: t.description ?? '', isActive: t.isActive, sortOrder: t.sortOrder }); setError(''); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Hizmet türü adı zorunludur.'); return; }
    const dup = types.find(t => t.name.trim().toLowerCase() === form.name.trim().toLowerCase() && (!editing || t.id !== editing.id));
    if (dup) { setError('Bu isimde bir hizmet türü zaten mevcut.'); return; }
    setSaving(true); setError('');
    try {
      if (editing) {
        await axios.put(`${API}/service-types/${editing.id}`, form, { headers: authHeader() });
        showToast('success', 'Hizmet türü güncellendi.');
      } else {
        await axios.post(`${API}/service-types`, form, { headers: authHeader() });
        showToast('success', 'Hizmet türü eklendi.');
      }
      setShowModal(false); fetchTypes();
    } catch (e: any) { setError(e.response?.data?.message ?? 'İşlem başarısız.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/service-types/${deleteTarget.id}`, { headers: authHeader() });
      showToast('success', 'Hizmet türü silindi.');
      setDeleteTarget(null); fetchTypes();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  const toggleSortHT = () => setSortDir(d => d === 'asc' ? 'desc' : 'asc');
  const sortedTypes = [...types].sort((a, b) => sortDir === 'asc' ? a.name.localeCompare(b.name, 'tr') : b.name.localeCompare(a.name, 'tr'));

  return (
    <TabCard title="Hizmet Türleri" description="Dosyalarda kullanılacak hizmet türlerini tanımlayın." hint={TAB_HINTS['hizmet-turleri'].tip}>
      <div className="flex justify-end mb-4">
        <AddBtn onClick={openCreate} />
      </div>
      {loading ? <RowSkeleton /> : types.length === 0 ? <EmptyState msg="Henüz hizmet türü eklenmemiş." onAdd={openCreate} /> : (
        <div className="overflow-x-auto overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-5 py-3 cursor-pointer select-none hover:text-slate-800 transition-colors" onClick={toggleSortHT}>
                  <span className="flex items-center gap-1">Ad <SortIcon dir={sortDir} active /></span>
                </th>
                <th className="text-left px-5 py-3">Açıklama</th>
                <th className="text-left px-5 py-3">Durum</th>
                <th className="px-5 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedTypes.map((t, idx) => (
                <tr key={t.id} className={`hover:bg-blue-50/30 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : 'bg-white'}`}>
                  <td className="px-5 py-3 font-medium text-slate-800">{t.name}</td>
                  <td className="px-5 py-3 text-slate-500 text-xs">{t.description ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${t.isActive ? 'bg-green-50 text-green-700 border-green-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                      {t.isActive ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-5 py-3"><RowActions onEdit={() => openEdit(t)} onDelete={() => setDeleteTarget(t)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showModal && (
        <Modal title={editing ? 'Türü Düzenle' : 'Yeni Hizmet Türü'} onClose={() => setShowModal(false)}>
          {error && <ErrorAlert msg={error} onClose={() => setError('')} />}
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Ad <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
              <input
                className={inputCls}
                placeholder="Örn: Hasar Onarım"
                value={form.name}
                onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                onBlur={(e) => setForm(p => ({ ...p, name: toTitleCaseTR(e.target.value) }))}
              />
            </div>
            <div>
              <label className={labelCls}>Açıklama</label>
              <input className={inputCls} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}>
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
              <span className="text-xs text-slate-600">Aktif</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5"><CancelBtn onClick={() => setShowModal(false)} /><SaveBtn loading={saving} onClick={handleSave} /></div>
        </Modal>
      )}
      {deleteTarget && <ConfirmModal title="Türü Sil" message={`"${deleteTarget.name}" hizmet türünü silmek istediğinize emin misiniz?`} loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} danger />}
    </TabCard>
  );
}

// ── İhbar Konuları ────────────────────────────────────────────────────────────

function IhbarKonulariTab() {
  const [hasarTypes, setHasarTypes] = useState<string[]>([]);
  const [acilTypes, setAcilTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'hasar' | 'acil'>('hasar');
  const [newValue, setNewValue] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/system-settings/ihbar-konulari`, { headers: authHeader() });
      const raw = res.data;
      // Handle { data: { hasar: [], acil: [] } } or { hasar: [], acil: [] }
      const data = raw?.data ?? raw ?? {};
      setHasarTypes(Array.isArray(data.hasar) ? data.hasar : []);
      setAcilTypes(Array.isArray(data.acil) ? data.acil : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const currentTypes = activeSubTab === 'hasar' ? hasarTypes : acilTypes;

  const save = async (updated: string[], tab: 'hasar' | 'acil' = activeSubTab) => {
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload = { hasar: tab === 'hasar' ? updated : hasarTypes, acil: tab === 'acil' ? updated : acilTypes };
      await axios.put(`${API}/system-settings/ihbar-konulari`, payload, { headers: authHeader() });
      if (tab === 'hasar') setHasarTypes(updated); else setAcilTypes(updated);
      setSuccess('Kaydedildi.');
      setTimeout(() => setSuccess(''), 2000);
    } catch { setError('Kayıt başarısız.'); }
    finally { setSaving(false); }
  };

  const handleAdd = async () => {
    const val = toTitleCaseTR(newValue.trim());
    if (!val) return;
    if (currentTypes.includes(val)) { setError('Bu konu zaten mevcut.'); return; }
    await save([...currentTypes, val]);
    setNewValue('');
  };

  const handleEdit = async (idx: number) => {
    const val = toTitleCaseTR(editValue.trim());
    if (!val) return;
    const updated = currentTypes.map((t, i) => i === idx ? val : t);
    await save(updated);
    setEditingIdx(null);
  };

  const handleDelete = async () => {
    if (deleteIdx === null) return;
    setDeleting(true);
    const updated = currentTypes.filter((_, i) => i !== deleteIdx);
    await save(updated);
    setDeleteIdx(null);
    setDeleting(false);
  };

  return (
    <TabCard title="İhbar Konuları" description="Dosya açılışında kullanılan ihbar / bildirim konularını tanımlayın." hint={TAB_HINTS['ihbar-konulari'].tip}>
      {error && <ErrorAlert msg={error} onClose={() => setError('')} />}
      {success && <SuccessAlert msg={success} />}

      <div className="flex gap-1.5 mb-4">
        <FilterBtn active={activeSubTab === 'hasar'} onClick={() => { setActiveSubTab('hasar'); setEditingIdx(null); }}>
          Hasar ({hasarTypes.length})
        </FilterBtn>
        <FilterBtn active={activeSubTab === 'acil'} onClick={() => { setActiveSubTab('acil'); setEditingIdx(null); }}>
          Acil Yardım ({acilTypes.length})
        </FilterBtn>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          className={`${inputCls} flex-1`}
          placeholder="Yeni konu ekle..."
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
        />
        <button type="button" onClick={handleAdd} disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          Ekle
        </button>
      </div>

      {loading ? <RowSkeleton /> : currentTypes.length === 0 ? <EmptyState msg="Bu kategoride konu eklenmemiş." /> : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-5 py-3">Konu</th>
                <th className="px-5 py-3 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentTypes.map((t, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3">
                    {editingIdx === idx ? (
                      <input
                        className={`${inputCls}`}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(idx); if (e.key === 'Escape') setEditingIdx(null); }}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeSubTab === 'hasar' ? 'bg-blue-400' : 'bg-red-400'}`} />
                        <span className="text-slate-800">{t}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {editingIdx === idx ? (
                      <div className="flex gap-1">
                        <button type="button" onClick={() => handleEdit(idx)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">Kaydet</button>
                        <button type="button" onClick={() => setEditingIdx(null)} className="px-3 py-1.5 border border-slate-200 text-xs rounded-lg text-slate-600">İptal</button>
                      </div>
                    ) : (
                      <RowActions onEdit={() => { setEditingIdx(idx); setEditValue(t); }} onDelete={() => setDeleteIdx(idx)} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {deleteIdx !== null && <ConfirmModal title="Konuyu Sil" message={`"${currentTypes[deleteIdx]}" konusunu silmek istediğinize emin misiniz?`} loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteIdx(null)} danger />}
    </TabCard>
  );
}

// ── Evrak Türleri ─────────────────────────────────────────────────────────────

function EvrakTurleriTab() {
  const { showToast } = useToast();
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DocumentType | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', isRequired: false, sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DocumentType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'name' | 'code'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/document-types`, { headers: authHeader() });
      setTypes(res.data.data ?? []);
    } catch { /* API hatası — mevcut state'i koru */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const filtered = types.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.code.toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => { setEditing(null); setForm({ code: '', name: '', description: '', isRequired: false, sortOrder: types.length + 1 }); setError(''); setShowModal(true); };
  const openEdit = (t: DocumentType) => { setEditing(t); setForm({ code: t.code, name: t.name, description: t.description ?? '', isRequired: t.isRequired, sortOrder: t.sortOrder }); setError(''); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) { setError('Ad ve kod zorunludur.'); return; }
    if (!CODE_REGEX.test(form.code)) { setError('Kod: sadece büyük İngilizce harf, rakam ve alt çizgi (_) kullanın.'); return; }
    const dup = types.find(t => t.name.trim().toLowerCase() === form.name.trim().toLowerCase() && (!editing || t.id !== editing.id));
    if (dup) { setError('Bu isimde bir evrak türü zaten mevcut.'); return; }
    setSaving(true); setError('');
    try {
      if (editing) {
        await axios.put(`${API}/document-types/${editing.id}`, form, { headers: authHeader() });
        showToast('success', 'Evrak türü güncellendi.');
      } else {
        await axios.post(`${API}/document-types`, form, { headers: authHeader() });
        showToast('success', 'Evrak türü eklendi.');
      }
      setShowModal(false); fetchTypes();
    } catch (e: any) { setError(e.response?.data?.message ?? 'İşlem başarısız.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/document-types/${deleteTarget.id}`, { headers: authHeader() });
      showToast('success', 'Evrak türü silindi.');
      setDeleteTarget(null); fetchTypes();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  const toggleSortET = (key: 'name' | 'code') => {
    if (sortField === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(key); setSortDir('asc'); }
  };
  const sortedFiltered = [...filtered].sort((a, b) => {
    const av = a[sortField] ?? ''; const bv = b[sortField] ?? '';
    return sortDir === 'asc' ? av.localeCompare(bv, 'tr') : bv.localeCompare(av, 'tr');
  });

  return (
    <TabCard title="Evrak Türleri" description="Dosyalarda talep edilecek evrak türlerini tanımlayın." hint={TAB_HINTS['evrak-turleri'].tip}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <input className={`${inputCls} max-w-xs`} placeholder="Evrak türü ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <AddBtn onClick={openCreate} />
      </div>
      {loading ? <RowSkeleton /> : filtered.length === 0 ? <EmptyState msg={search ? 'Sonuç bulunamadı.' : 'Henüz evrak türü eklenmemiş.'} onAdd={search ? undefined : openCreate} /> : (
        <div className="overflow-x-auto overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <SortTh label="Kod" sortKey="code" currentKey={sortField} dir={sortDir} onToggle={(k) => toggleSortET(k as 'name' | 'code')} />
                <SortTh label="Ad" sortKey="name" currentKey={sortField} dir={sortDir} onToggle={(k) => toggleSortET(k as 'name' | 'code')} />
                <th className="text-center px-5 py-3">Zorunlu</th>
                <th className="px-5 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedFiltered.map((t, idx) => (
                <tr key={t.id} className={`hover:bg-blue-50/30 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : 'bg-white'}`}>
                  <td className="px-5 py-3"><span className="px-2 py-0.5 rounded bg-slate-100 text-xs font-mono text-slate-600">{t.code}</span></td>
                  <td className="px-5 py-3 font-medium text-slate-800">{t.name}</td>
                  <td className="px-5 py-3 text-center">{t.isRequired ? <span className="text-green-600 text-xs font-medium">✓ Zorunlu</span> : <span className="text-slate-400">—</span>}</td>
                  <td className="px-5 py-3"><RowActions onEdit={() => openEdit(t)} onDelete={() => setDeleteTarget(t)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showModal && (
        <Modal title={editing ? 'Türü Düzenle' : 'Yeni Evrak Türü'} onClose={() => setShowModal(false)}>
          {error && <ErrorAlert msg={error} onClose={() => setError('')} />}
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Kod <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
              <input
                className={`${inputCls} uppercase font-mono`}
                placeholder="ET001"
                value={form.code}
                onChange={(e) => setForm(p => ({ ...p, code: sanitizeCode(e.target.value) }))}
                onInput={(e) => { const t = e.currentTarget; t.value = sanitizeCode(t.value); }}
              />
              <p className="text-xs text-slate-400 mt-1">{codeHelperText}</p>
            </div>
            <div>
              <label className={labelCls}>Ad <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                onBlur={(e) => setForm(p => ({ ...p, name: toTitleCaseTR(e.target.value) }))}
              />
            </div>
            <div>
              <label className={labelCls}>Açıklama</label>
              <input className={inputCls} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isRequired" checked={form.isRequired} onChange={(e) => setForm(p => ({ ...p, isRequired: e.target.checked }))} className="rounded border-slate-300 text-blue-600" />
              <label htmlFor="isRequired" className="text-sm text-slate-700">Zorunlu Evrak</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5"><CancelBtn onClick={() => setShowModal(false)} /><SaveBtn loading={saving} onClick={handleSave} /></div>
        </Modal>
      )}
      {deleteTarget && <ConfirmModal title="Türü Sil" message={`"${deleteTarget.name}" evrak türünü silmek istediğinize emin misiniz?`} loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} danger />}
    </TabCard>
  );
}

// ── İş Grupları ───────────────────────────────────────────────────────────────

function IsGruplariTab() {
  const { showToast } = useToast();
  const [groups, setGroups] = useState<WorkGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<WorkGroup | null>(null);
  const [groupForm, setGroupForm] = useState({ code: '', name: '', description: '', unit: '', sortOrder: 0 });
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupError, setGroupError] = useState('');
  const [deleteGroup, setDeleteGroup] = useState<WorkGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Inline quick-add sub group
  const [inlineAddGroupId, setInlineAddGroupId] = useState<string | null>(null);
  const [inlineSubForm, setInlineSubForm] = useState({ code: '', name: '', unitType: 'm²', unitPrice: '' });
  const [savingInlineSub, setSavingInlineSub] = useState(false);

  // Sub group modal state
  const [showSubModal, setShowSubModal] = useState(false);
  const [editingSubGroup, setEditingSubGroup] = useState<WorkSubGroup | null>(null);
  const [activeGroupId, setActiveGroupId] = useState('');
  const [subForm, setSubForm] = useState({ code: '', name: '', description: '', unitType: 'm²', unitPrice: '', sortOrder: 0 });
  const [savingSub, setSavingSub] = useState(false);
  const [subError, setSubError] = useState('');
  const [deleteSub, setDeleteSub] = useState<WorkSubGroup | null>(null);
  const [deletingSub, setDeletingSub] = useState(false);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const UNIT_OPTIONS = WORK_GROUP_UNIT_OPTIONS;

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/work-groups?includeSubGroups=true`, { headers: authHeader() });
      setGroups(res.data.data ?? res.data ?? []);
    } catch { /* API hatası — mevcut state'i koru */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const filtered = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()) || g.code.toLowerCase().includes(search.toLowerCase()));

  const toggleExpand = (id: string) => setExpandedGroups(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const openCreateGroup = () => { setEditingGroup(null); setGroupForm({ code: '', name: '', description: '', unit: '', sortOrder: groups.length + 1 }); setGroupError(''); setShowGroupModal(true); };
  const openEditGroup = (g: WorkGroup) => { setEditingGroup(g); setGroupForm({ code: g.code, name: g.name, description: g.description ?? '', unit: g.unit ?? '', sortOrder: g.sortOrder }); setGroupError(''); setShowGroupModal(true); };

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim() || !groupForm.code.trim()) { setGroupError('Ad ve kod zorunludur.'); return; }
    if (!CODE_REGEX.test(groupForm.code)) { setGroupError('Kod: sadece büyük İngilizce harf, rakam ve alt çizgi (_) kullanın.'); return; }
    const dup = groups.find(g => g.code.trim().toUpperCase() === groupForm.code.trim().toUpperCase() && (!editingGroup || g.id !== editingGroup.id));
    if (dup) { setGroupError('Bu kod zaten kullanılıyor.'); return; }
    setSavingGroup(true); setGroupError('');
    try {
      if (editingGroup) {
        await axios.put(`${API}/work-groups/${editingGroup.id}`, groupForm, { headers: authHeader() });
        showToast('success', 'İş grubu güncellendi.');
      } else {
        await axios.post(`${API}/work-groups`, groupForm, { headers: authHeader() });
        showToast('success', 'İş grubu eklendi.');
      }
      setShowGroupModal(false); fetchGroups();
    } catch (e: any) { setGroupError(e.response?.data?.message ?? 'İşlem başarısız.'); }
    finally { setSavingGroup(false); }
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroup) return;
    setDeletingGroup(true);
    try {
      await axios.delete(`${API}/work-groups/${deleteGroup.id}`, { headers: authHeader() });
      showToast('success', 'İş grubu silindi.');
      setDeleteGroup(null); fetchGroups();
    } catch { /* ignore */ }
    finally { setDeletingGroup(false); }
  };

  const openEditSub = (sg: WorkSubGroup) => { setEditingSubGroup(sg); setActiveGroupId(sg.workGroupId); setSubForm({ code: sg.code, name: sg.name, description: sg.description ?? '', unitType: sg.unitType, unitPrice: sg.unitPrice != null ? String(sg.unitPrice) : '', sortOrder: sg.sortOrder }); setSubError(''); setShowSubModal(true); };

  const handleSaveSub = async () => {
    if (!subForm.name.trim() || !subForm.code.trim()) { setSubError('Ad ve kod zorunludur.'); return; }
    // Kod validasyonu: sadece büyük İngilizce harf, rakam, alt çizgi
    const codeRegex = /^[A-Z0-9_]+$/;
    if (!codeRegex.test(subForm.code)) { setSubError('Kod: sadece büyük İngilizce harf, rakam ve alt çizgi kullanın.'); return; }
    setSavingSub(true); setSubError('');
    const unitPriceVal = subForm.unitPrice !== '' ? parseFloat(subForm.unitPrice) : null;
    if (unitPriceVal !== null && isNaN(unitPriceVal)) { setSubError('Geçersiz birim fiyat.'); setSavingSub(false); return; }
    if (unitPriceVal !== null && unitPriceVal < 0) { setSubError('Birim fiyat 0 veya daha büyük olmalıdır.'); setSavingSub(false); return; }
    const payload = { ...subForm, code: subForm.code, unitPrice: unitPriceVal, workGroupId: activeGroupId };
    try {
      if (editingSubGroup) {
        await axios.put(`${API}/work-groups/sub-groups/${editingSubGroup.id}`, payload, { headers: authHeader() });
      } else {
        await axios.post(`${API}/work-groups/${activeGroupId}/sub-groups`, payload, { headers: authHeader() });
      }
      setShowSubModal(false); fetchGroups();
    } catch (e: any) { setSubError(e.response?.data?.message ?? 'İşlem başarısız.'); }
    finally { setSavingSub(false); }
  };

  const handleDeleteSub = async () => {
    if (!deleteSub) return;
    setDeletingSub(true);
    try {
      await axios.delete(`${API}/work-groups/sub-groups/${deleteSub.id}`, { headers: authHeader() });
      setDeleteSub(null); fetchGroups();
    } catch { /* ignore */ }
    finally { setDeletingSub(false); }
  };

  const handleInlineAddSub = async (groupId: string) => {
    if (!inlineSubForm.code.trim() || !inlineSubForm.name.trim()) return;
    // Kod validasyonu
    const codeRegex = /^[A-Z0-9_]+$/;
    if (!codeRegex.test(inlineSubForm.code)) return;
    setSavingInlineSub(true);
    try {
      const unitPriceVal = inlineSubForm.unitPrice ? parseFloat(inlineSubForm.unitPrice) : null;
      const payload = {
        code: inlineSubForm.code.toUpperCase(),
        name: inlineSubForm.name,
        unitType: inlineSubForm.unitType,
        unitPrice: (unitPriceVal !== null && !isNaN(unitPriceVal) && unitPriceVal >= 0) ? unitPriceVal : null,
        sortOrder: 0,
      };
      await axios.post(`${API}/work-groups/${groupId}/sub-groups`, payload, { headers: authHeader() });
      setInlineAddGroupId(null);
      setInlineSubForm({ code: '', name: '', unitType: 'm²', unitPrice: '' });
      fetchGroups();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Alt grup eklenemedi';
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally { setSavingInlineSub(false); }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      { 'İş Grubu Kodu': 'BOYA', 'İş Grubu Adı': 'Boya', 'Alt Kalem Kodu': 'BOYA_001', 'Alt Kalem Adı': 'Astar', 'Birim': 'm²', 'Birim Fiyat (TL)': 45, 'Açıklama': '(opsiyonel)' },
      { 'İş Grubu Kodu': 'BOYA', 'İş Grubu Adı': 'Boya', 'Alt Kalem Kodu': 'BOYA_002', 'Alt Kalem Adı': 'Son Kat', 'Birim': 'm²', 'Birim Fiyat (TL)': 75, 'Açıklama': '' },
      { 'İş Grubu Kodu': 'CAM', 'İş Grubu Adı': 'Cam', 'Alt Kalem Kodu': 'CAM_001', 'Alt Kalem Adı': 'Düz Cam', 'Birim': 'm²', 'Birim Fiyat (TL)': 120, 'Açıklama': '' },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 28 }, { wch: 12 }, { wch: 18 }, { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'İş Grupları ve Alt Kalemleri');
    XLSX.writeFile(wb, 'is-gruplari-alt-kalemleri-sablonu.xlsx');
  };

  const handleFileUpload = async (file: File) => {
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls') && !lowerName.endsWith('.csv')) {
      setUploadError('Sadece Excel (.xlsx, .xls) veya CSV dosyası yükleyebilirsiniz.');
      showToast('error', 'Sadece Excel (.xlsx, .xls) veya CSV dosyası yükleyebilirsiniz.');
      return;
    }

    setUploading(true);
    setUploadError('');
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames.includes('İş Grupları ve Alt Kalemleri') ? 'İş Grupları ve Alt Kalemleri' : workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

      if (rows.length === 0) {
        throw new Error('Dosyada içe aktarılacak satır bulunamadı.');
      }

      const errors: string[] = [];
      const parsedRows = rows.map((row, index) => {
        const rowNumber = index + 2;
        const groupCode = sanitizeCode(String(row['İş Grubu Kodu'] ?? ''));
        const groupName = String(row['İş Grubu Adı'] ?? '').trim();
        const subCode = sanitizeCode(String(row['Alt Kalem Kodu'] ?? ''));
        const subName = String(row['Alt Kalem Adı'] ?? '').trim();
        const unitType = String(row['Birim'] ?? '').trim();
        const rawUnitPrice = String(row['Birim Fiyat (TL)'] ?? '').replace(',', '.').trim();
        const unitPrice = rawUnitPrice === '' ? 0 : Number(rawUnitPrice);
        const description = String(row['Açıklama'] ?? '').trim();

        if (!groupCode || !groupName || !subCode || !subName || !unitType) {
          errors.push(`${rowNumber}. satır: İş Grubu Kodu, İş Grubu Adı, Alt Kalem Kodu, Alt Kalem Adı ve Birim zorunludur.`);
        }
        if (groupCode && !CODE_REGEX.test(groupCode)) errors.push(`${rowNumber}. satır: İş Grubu Kodu geçersiz.`);
        if (subCode && !CODE_REGEX.test(subCode)) errors.push(`${rowNumber}. satır: Alt Kalem Kodu geçersiz.`);
        if (unitType && !WORK_GROUP_UNIT_OPTIONS.includes(unitType)) errors.push(`${rowNumber}. satır: Birim "${unitType}" geçersiz.`);
        if (Number.isNaN(unitPrice) || unitPrice < 0) errors.push(`${rowNumber}. satır: Birim Fiyat 0 veya daha büyük olmalıdır.`);

        return { rowNumber, groupCode, groupName, subCode, subName, unitType, unitPrice, description };
      });

      if (errors.length > 0) {
        throw new Error(errors.slice(0, 8).join('\n') + (errors.length > 8 ? `\n...ve ${errors.length - 8} hata daha.` : ''));
      }

      const existingRes = await axios.get(`${API}/work-groups?includeSubGroups=true`, { headers: authHeader() });
      const existingGroups: WorkGroup[] = existingRes.data.data ?? existingRes.data ?? [];
      const groupMap = new Map(existingGroups.map(group => [group.code.trim().toUpperCase(), group]));
      const createdGroupCodes = new Set<string>();
      let addedSubGroupCount = 0;

      for (const row of parsedRows) {
        let group = groupMap.get(row.groupCode);
        if (!group) {
          const groupRes = await axios.post(`${API}/work-groups`, {
            code: row.groupCode,
            name: row.groupName,
            description: '',
            unit: row.unitType,
            sortOrder: groupMap.size + 1,
          }, { headers: authHeader() });
          group = groupRes.data.data ?? groupRes.data;
          if (!group?.id) throw new Error(`${row.rowNumber}. satır: İş grubu oluşturuldu fakat ID alınamadı.`);
          groupMap.set(row.groupCode, group);
          createdGroupCodes.add(row.groupCode);
        }

        try {
          await axios.post(`${API}/work-groups/${group.id}/sub-groups`, {
            code: row.subCode,
            name: row.subName,
            description: row.description,
            unitType: row.unitType,
            unitPrice: row.unitPrice,
            sortOrder: 0,
          }, { headers: authHeader() });
          addedSubGroupCount += 1;
        } catch (e: any) {
          throw new Error(`${row.rowNumber}. satır: ${e.response?.data?.message ?? 'Alt kalem eklenemedi.'}`);
        }
      }

      await fetchGroups();
      showToast('success', `${createdGroupCodes.size} iş grubu ve ${addedSubGroupCount} alt kalem eklendi`);
    } catch (e: any) {
      const message = e.response?.data?.message ?? e.message ?? 'Dosya yüklenirken hata oluştu.';
      setUploadError(message);
      showToast('error', message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <TabCard title="İş Grupları" description="Maliyetlendirmede kullanılan iş grupları ve alt gruplarını yönetin." hint={TAB_HINTS['is-gruplari'].tip}>
      {uploadError && <ErrorAlert msg={uploadError} onClose={() => setUploadError('')} />}
      <div className="flex items-center justify-between gap-3 mb-4">
        <input className={`${inputCls} max-w-xs`} placeholder="Grup ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Excel Şablonu İndir
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {uploading ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>}
            {uploading ? 'Yükleniyor...' : 'Excel/CSV Yükle'}
          </button>
          <AddBtn onClick={openCreateGroup} label="Yeni Grup" />
        </div>
      </div>
      <div
        className={`mb-4 border-2 border-dashed rounded-xl px-5 py-4 text-center cursor-pointer transition-colors ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50'}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) handleFileUpload(file); }}
      >
        <p className="text-sm font-medium text-slate-600">Dosyayı buraya sürükleyin veya Excel/CSV yüklemek için tıklayın</p>
        <p className="text-xs text-slate-400 mt-1">.xlsx · .xls · .csv</p>
      </div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); e.target.value = ''; }} />
      {loading ? <RowSkeleton /> : filtered.length === 0 ? <EmptyState msg={search ? 'Sonuç bulunamadı.' : 'Henüz iş grubu eklenmemiş.'} /> : (
        <div className="space-y-2">
          {filtered.map(g => {
            const isOpen = expandedGroups.has(g.id);
            const subs = g.workSubGroups ?? g.subGroups ?? [];
            const isInlineAdding = inlineAddGroupId === g.id;
            return (
              <div key={g.id} className="rounded-xl border border-slate-200 overflow-hidden">
                {/* Group header */}
                <div className="flex items-center justify-between p-3.5 bg-white hover:bg-slate-50/50 transition-colors border-l-4 border-l-blue-200">
                  <button type="button" className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => toggleExpand(g.id)}>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-xs font-mono text-slate-600">{g.code}</span>
                    <span className="text-sm font-semibold text-slate-800">{g.name}</span>
                    {g.unit && <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">{g.unit}</span>}
                    <span className="text-xs text-slate-400">({subs.length} alt grup)</span>
                  </button>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      type="button"
                      title="Hızlı alt grup ekle"
                      onClick={() => {
                        setInlineAddGroupId(isInlineAdding ? null : g.id);
                        if (!isOpen) toggleExpand(g.id);
                        setInlineSubForm({ code: '', name: '', unitType: 'm²', unitPrice: '' });
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                    <RowActions onEdit={() => openEditGroup(g)} onDelete={() => setDeleteGroup(g)} />
                  </div>
                </div>
                {/* Sub groups */}
                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/30">
                    {subs.length === 0 && !isInlineAdding && (
                      <div className="px-10 py-3 text-xs text-slate-400 flex items-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Alt grup yok. Eklemek için + butonuna tıklayın.
                      </div>
                    )}
                    {subs.map(sg => (
                      <div key={sg.id} className="flex items-center justify-between px-10 py-2.5 border-b border-slate-100 last:border-0 hover:bg-white transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-1 h-4 rounded-full bg-blue-200 shrink-0" />
                          <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-xs font-mono text-slate-500">{sg.code}</span>
                          <span className="text-sm text-slate-700">{sg.name}</span>
                          <span className="text-xs text-slate-400 bg-white border border-slate-100 px-1.5 py-0.5 rounded">{sg.unitType}{sg.unitPrice != null ? ` · ${sg.unitPrice} ₺` : ''}</span>
                        </div>
                        <RowActions onEdit={() => openEditSub(sg)} onDelete={() => setDeleteSub(sg)} />
                      </div>
                    ))}
                    {/* Inline quick-add row */}
                    {isInlineAdding && (
                      <div className="px-10 py-3 border-t border-blue-100 bg-blue-50/40">
                        <p className="text-xs font-semibold text-blue-700 mb-2">Hızlı Alt Grup Ekle</p>
                        <div className="flex flex-wrap gap-2 items-end">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-slate-500">Kod</label>
                            <input
                              className={`${inputCls} w-28 uppercase font-mono text-xs`}
                              placeholder={(() => {
                                const grp = groups.find(gg => gg.id === g.id);
                                const cnt = (grp?.workSubGroups ?? grp?.subGroups)?.length ?? 0;
                                return grp ? `${grp.code}_${String(cnt + 1).padStart(3, '0')}` : 'IGK001';
                              })()}
                              value={inlineSubForm.code}
                              onChange={(e) => setInlineSubForm(p => ({ ...p, code: sanitizeCode(e.target.value) }))}
                              onInput={(e) => { const t = e.currentTarget; t.value = sanitizeCode(t.value); }}
                            />
                          </div>
                          <div className="flex flex-col gap-1 flex-1 min-w-32">
                            <label className="text-xs text-slate-500">Ad</label>
                            <input
                              className={`${inputCls} text-xs`}
                              placeholder="Alt grup adı"
                              value={inlineSubForm.name}
                              onChange={(e) => setInlineSubForm(p => ({ ...p, name: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleInlineAddSub(g.id); }}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-slate-500">Birim</label>
                            <select className={`${inputCls} w-24 text-xs`} value={inlineSubForm.unitType} onChange={(e) => setInlineSubForm(p => ({ ...p, unitType: e.target.value }))}>
                              {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-slate-500">Birim Fiyat (₺)</label>
                            <input
                              className={`${inputCls} w-28 text-xs`}
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={inlineSubForm.unitPrice}
                              onChange={(e) => setInlineSubForm(p => ({ ...p, unitPrice: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleInlineAddSub(g.id); }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleInlineAddSub(g.id)}
                            disabled={savingInlineSub}
                            className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                          >
                            {savingInlineSub ? <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                            Ekle
                          </button>
                          <button type="button" onClick={() => setInlineAddGroupId(null)} className="px-3 py-2 border border-slate-200 text-xs rounded-lg text-slate-600 hover:bg-white transition-colors">
                            İptal
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Group Modal */}
      {showGroupModal && (
        <Modal title={editingGroup ? 'Grubu Düzenle' : 'Yeni İş Grubu'} onClose={() => setShowGroupModal(false)}>
          {groupError && <ErrorAlert msg={groupError} onClose={() => setGroupError('')} />}
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Kod <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
              <input
                className={`${inputCls} uppercase font-mono`}
                placeholder={editingGroup ? groupForm.code : generateSequentialCode('IG', groups.length + 1)}
                value={groupForm.code}
                onChange={(e) => setGroupForm(p => ({ ...p, code: sanitizeCode(e.target.value) }))}
                onInput={(e) => { const t = e.currentTarget; t.value = sanitizeCode(t.value); }}
              />
              <p className="text-xs text-slate-400 mt-1">{codeHelperText}</p>
            </div>
            <div>
              <label className={labelCls}>Ad <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
              <input
                className={inputCls}
                value={groupForm.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setGroupForm(p => ({
                    ...p,
                    name,
                    ...(!editingGroup && (p.code === '' || p.code === generateCodeFromName(p.name))
                      ? { code: generateCodeFromName(name) }
                      : {}),
                  }));
                }}
                onBlur={(e) => setGroupForm(p => ({ ...p, name: toTitleCaseTR(e.target.value) }))}
              />
            </div>
            <div>
              <label className={labelCls}>Açıklama</label>
              <input className={inputCls} value={groupForm.description} onChange={(e) => setGroupForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Varsayılan Birim</label>
              <select className={inputCls} value={groupForm.unit} onChange={(e) => setGroupForm(p => ({ ...p, unit: e.target.value }))}>
                <option value="">— Seçin —</option>
                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5"><CancelBtn onClick={() => setShowGroupModal(false)} /><SaveBtn loading={savingGroup} onClick={handleSaveGroup} /></div>
        </Modal>
      )}

      {/* Sub Group Edit Modal */}
      {showSubModal && (
        <Modal title={editingSubGroup ? 'Alt Grubu Düzenle' : 'Yeni Alt Grup'} onClose={() => setShowSubModal(false)}>
          {subError && <ErrorAlert msg={subError} onClose={() => setSubError('')} />}
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Kod <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
              <input
                className={`${inputCls} uppercase font-mono`}
                placeholder={(() => {
                  const grp = groups.find(g => g.id === activeGroupId);
                  const cnt = (grp?.workSubGroups ?? grp?.subGroups)?.length ?? 0;
                  return grp ? `${grp.code}_${String(cnt + 1).padStart(3, '0')}` : 'IGK001';
                })()}
                value={subForm.code}
                onChange={(e) => setSubForm(p => ({ ...p, code: sanitizeCode(e.target.value) }))}
                onInput={(e) => { const t = e.currentTarget; t.value = sanitizeCode(t.value); }}
              />
              <p className="text-xs text-slate-400 mt-1">{codeHelperText}</p>
            </div>
            <div>
              <label className={labelCls}>Ad <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
              <input
                className={inputCls}
                value={subForm.name}
                onChange={(e) => setSubForm(p => ({ ...p, name: e.target.value }))}
                onBlur={(e) => setSubForm(p => ({ ...p, name: toTitleCaseTR(e.target.value) }))}
              />
            </div>
            <div>
              <label className={labelCls}>Açıklama</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={2}
                value={subForm.description}
                onChange={(e) => setSubForm(p => ({ ...p, description: e.target.value }))}
                placeholder="İsteğe bağlı açıklama..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Birim Tipi</label>
                <select className={inputCls} value={subForm.unitType} onChange={(e) => setSubForm(p => ({ ...p, unitType: e.target.value }))}>
                  {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Birim Fiyat (₺) <span className="text-xs font-normal text-slate-400 ml-1">(0 geçerli)</span></label>
                <input
                  className={inputCls}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={subForm.unitPrice}
                  onChange={(e) => setSubForm(p => ({ ...p, unitPrice: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5"><CancelBtn onClick={() => setShowSubModal(false)} /><SaveBtn loading={savingSub} onClick={handleSaveSub} /></div>
        </Modal>
      )}

      {deleteGroup && <ConfirmModal title="Grubu Sil" message={`"${deleteGroup.name}" grubunu ve tüm alt gruplarını silmek istediğinize emin misiniz?`} loading={deletingGroup} onConfirm={handleDeleteGroup} onCancel={() => setDeleteGroup(null)} danger />}
      {deleteSub && <ConfirmModal title="Alt Grubu Sil" message={`"${deleteSub.name}" alt grubunu silmek istediğinize emin misiniz?`} loading={deletingSub} onConfirm={handleDeleteSub} onCancel={() => setDeleteSub(null)} danger />}
    </TabCard>
  );
}

// ── Alan Zorunlulukları (Inline Tab) ──────────────────────────────────────────

function AlanZorunluluklariInlineTab() {
  return (
    <TabCard title="Alan Zorunlulukları" description="Form alanlarının zorunluluk durumlarını yönetin." hint="Departman bazlı alan zorunluluklarını ve birim/kaynak tanımlarını buradan yapılandırın.">
      <div className="py-4 text-sm text-slate-600">
        <p className="mb-4">Alan zorunlulukları yapılandırması ayrı bir sayfada yönetilmektedir. Buradan açabilirsiniz:</p>
        <a
          href="/panel/ayarlar/alan-zorunluluklari"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Alan Zorunlulukları Sayfasını Aç
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
        </a>
      </div>
    </TabCard>
  );
}

// ── Birim Seçenekleri Tab ─────────────────────────────────────────────────────

function BirimSecenekleriTab() {
  const { showToast } = useToast();
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [error, setError] = useState('');

  const fetchOptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/system-settings/unit-options`, { headers: authHeader() });
      setOptions(res.data.data ?? res.data ?? []);
    } catch { /* keep existing state */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOptions(); }, [fetchOptions]);

  const handleAdd = () => {
    const v = newValue.trim();
    if (!v) return;
    if (options.includes(v)) { setError('Bu birim zaten mevcut.'); return; }
    setError('');
    setOptions((p) => [...p, v]);
    setNewValue('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/system-settings/unit-options`, { options }, { headers: authHeader() });
      showToast('success', 'Birim seçenekleri kaydedildi.');
    } catch {
      showToast('error', 'Kaydetme başarısız oldu.');
    } finally { setSaving(false); }
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const arr = [...options];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(idx, 0, moved);
    setOptions(arr);
    setDragIdx(idx);
  };

  return (
    <TabCard title="Birim Seçenekleri" description="İş grubu ve alt grup formlarında kullanılacak birimleri yönetin." hint="m², adet, metre, saat, kg, ton gibi birimleri buradan tanımlayın. Sürükleyerek sıralayabilirsiniz.">
      {loading ? <RowSkeleton /> : (
        <>
          <div className="flex gap-2 mb-4">
            <input
              className={inputCls}
              placeholder="Yeni birim (örn: litre, cm²)"
              value={newValue}
              onChange={(e) => { setNewValue(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button type="button" onClick={handleAdd} disabled={!newValue.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors shrink-0">
              + Ekle
            </button>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}
          {options.length === 0 ? (
            <EmptyState msg="Henüz birim eklenmemiş." />
          ) : (
            <div className="rounded-xl border border-slate-100 overflow-hidden mb-4">
              {options.map((opt, i) => (
                <div key={`${opt}-${i}`}
                  draggable={editingIdx !== i}
                  onDragStart={() => editingIdx !== i && setDragIdx(i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDragEnd={() => setDragIdx(null)}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors ${editingIdx !== i ? 'cursor-grab active:cursor-grabbing' : ''} ${dragIdx === i ? 'opacity-50 bg-blue-50' : ''}`}
                >
                  <svg className="w-3 h-4 text-slate-300 shrink-0" fill="currentColor" viewBox="0 0 12 16">
                    <circle cx="4" cy="3" r="1.5" /><circle cx="8" cy="3" r="1.5" />
                    <circle cx="4" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" />
                    <circle cx="4" cy="13" r="1.5" /><circle cx="8" cy="13" r="1.5" />
                  </svg>
                  {editingIdx === i ? (
                    <input className={`${inputCls} flex-1`} value={editingValue} autoFocus
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { const v = editingValue.trim(); if (v) { const arr = [...options]; arr[i] = v; setOptions(arr); } setEditingIdx(null); }
                        if (e.key === 'Escape') setEditingIdx(null);
                      }}
                    />
                  ) : (
                    <span className="flex-1 text-sm text-slate-800">{opt}</span>
                  )}
                  <span className="text-xs text-slate-300 w-8 text-right">{i + 1}</span>
                  {editingIdx === i ? (
                    <button type="button" onClick={() => { const v = editingValue.trim(); if (v) { const arr = [...options]; arr[i] = v; setOptions(arr); } setEditingIdx(null); }}
                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Kaydet</button>
                  ) : (
                    <button type="button" onClick={() => { setEditingIdx(i); setEditingValue(opt); }}
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                  )}
                  <button type="button" onClick={() => setOptions((p) => p.filter((_, j) => j !== i))}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">{options.length} birim</span>
            <SaveBtn loading={saving} onClick={handleSave} />
          </div>
        </>
      )}
    </TabCard>
  );
}

// ── Müşteri Kaynakları Tab ────────────────────────────────────────────────────

function MusteriKaynaklariTab() {
  const { showToast } = useToast();
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [error, setError] = useState('');

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/system-settings/customer-sources`, { headers: authHeader() });
      setSources(res.data.data ?? res.data ?? []);
    } catch { /* keep existing state */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const handleAdd = () => {
    const v = toTitleCaseTR(newValue.trim());
    if (!v) return;
    if (sources.includes(v)) { setError('Bu kaynak zaten mevcut.'); return; }
    setError('');
    setSources((p) => [...p, v]);
    setNewValue('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/system-settings/customer-sources`, { values: sources }, { headers: authHeader() });
      showToast('success', 'Müşteri kaynakları kaydedildi.');
    } catch {
      showToast('error', 'Kaydetme başarısız oldu.');
    } finally { setSaving(false); }
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const arr = [...sources];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(idx, 0, moved);
    setSources(arr);
    setDragIdx(idx);
  };

  return (
    <TabCard title="Müşteri Kaynakları" description="Müşteri kayıt formunda görünen 'Müşteri Kaynağı' seçeneklerini yönetin." hint="Referans, Sosyal Medya, Web Sitesi gibi kaynakları buradan tanımlayın.">
      {loading ? <RowSkeleton /> : (
        <>
          <div className="flex gap-2 mb-4">
            <input
              className={inputCls}
              placeholder="Yeni kaynak (örn: Referans)"
              value={newValue}
              onChange={(e) => { setNewValue(e.target.value); setError(''); }}
              onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setNewValue(v); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button type="button" onClick={handleAdd} disabled={!newValue.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors shrink-0">
              + Ekle
            </button>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}
          {sources.length === 0 ? (
            <EmptyState msg="Henüz kaynak eklenmemiş." />
          ) : (
            <div className="rounded-xl border border-slate-100 overflow-hidden mb-4">
              {sources.map((src, i) => (
                <div key={`${src}-${i}`}
                  draggable={editingIdx !== i}
                  onDragStart={() => editingIdx !== i && setDragIdx(i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDragEnd={() => setDragIdx(null)}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors ${editingIdx !== i ? 'cursor-grab active:cursor-grabbing' : ''} ${dragIdx === i ? 'opacity-50 bg-blue-50' : ''}`}
                >
                  <svg className="w-3 h-4 text-slate-300 shrink-0" fill="currentColor" viewBox="0 0 12 16">
                    <circle cx="4" cy="3" r="1.5" /><circle cx="8" cy="3" r="1.5" />
                    <circle cx="4" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" />
                    <circle cx="4" cy="13" r="1.5" /><circle cx="8" cy="13" r="1.5" />
                  </svg>
                  {editingIdx === i ? (
                    <input className={`${inputCls} flex-1`} value={editingValue} autoFocus
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { const v = toTitleCaseTR(editingValue.trim()); if (v) { const arr = [...sources]; arr[i] = v; setSources(arr); } setEditingIdx(null); }
                        if (e.key === 'Escape') setEditingIdx(null);
                      }}
                    />
                  ) : (
                    <span className="flex-1 text-sm text-slate-800">{src}</span>
                  )}
                  <span className="text-xs text-slate-300 w-8 text-right">{i + 1}</span>
                  {editingIdx === i ? (
                    <button type="button" onClick={() => { const v = toTitleCaseTR(editingValue.trim()); if (v) { const arr = [...sources]; arr[i] = v; setSources(arr); } setEditingIdx(null); }}
                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Kaydet</button>
                  ) : (
                    <button type="button" onClick={() => { setEditingIdx(i); setEditingValue(src); }}
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                  )}
                  <button type="button" onClick={() => setSources((p) => p.filter((_, j) => j !== i))}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">{sources.length} kaynak</span>
            <SaveBtn loading={saving} onClick={handleSave} />
          </div>
        </>
      )}
    </TabCard>
  );
}

function SortIcon({ dir, active }: { dir: 'asc' | 'desc'; active: boolean }) {
  return (
    <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-30'}`}>
      {dir === 'asc' ? '↑' : '↓'}
    </span>
  );
}

function SortTh({ label, sortKey, currentKey, dir, onToggle }: { label: string; sortKey: string; currentKey: string; dir: 'asc' | 'desc'; onToggle: (key: string) => void }) {
  const active = currentKey === sortKey;
  return (
    <th
      className="text-left px-5 py-3 cursor-pointer select-none hover:bg-slate-100 transition-colors"
      onClick={() => onToggle(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon dir={active ? dir : 'asc'} active={active} />
      </span>
    </th>
  );
}

function TabCard({ title, description, hint, children }: { title: string; description: string; hint?: string; children: React.ReactNode }) {
  const [showHint, setShowHint] = useState(true);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{description}</p>
      </div>
      {hint && showHint && (
        <div className="mx-6 mt-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
          <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-blue-700 flex-1">{hint}</p>
          <button type="button" onClick={() => setShowHint(false)} className="text-blue-300 hover:text-blue-500 transition-colors shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ dragging: boolean; startX: number; startY: number; initX: number; initY: number }>({ dragging: false, startX: 0, startY: 0, initX: 0, initY: 0 });
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, initX: pos.x, initY: pos.y };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!dragState.current.dragging) return;
    setPos({ x: dragState.current.initX + e.clientX - dragState.current.startX, y: dragState.current.initY + e.clientY - dragState.current.startY });
  };

  const onMouseUp = () => {
    dragState.current.dragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={dialogRef}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 cursor-move select-none"
          onMouseDown={onMouseDown}
        >
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, loading, onConfirm, onCancel, danger }: { title: string; message: string; loading: boolean; onConfirm: () => void; onCancel: () => void; danger?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <CancelBtn onClick={onCancel} />
          <button type="button" onClick={onConfirm} disabled={loading} className={`px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {loading ? 'İşleniyor...' : 'Onayla'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddBtn({ onClick, label = 'Yeni Ekle' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shrink-0">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
      {label}
    </button>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{children}</button>;
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <ActionBtn title="Düzenle" onClick={onEdit}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
      </ActionBtn>
      <ActionBtn title="Sil" danger onClick={onDelete}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </ActionBtn>
    </div>
  );
}

function ActionBtn({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return <button type="button" title={title} onClick={onClick} className={`p-1.5 rounded-lg transition-colors ${danger ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>{children}</button>;
}

function SaveBtn({ loading, onClick, label = 'Kaydet' }: { loading: boolean; onClick: () => void; label?: string }) {
  return <button type="button" onClick={onClick} disabled={loading} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center gap-2">{loading && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}{loading ? 'Kaydediliyor...' : label}</button>;
}

function CancelBtn({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">İptal</button>;
}

function RowSkeleton() {
  return <div className="space-y-2 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl" />)}</div>;
}

function EmptyState({ msg, onAdd }: { msg: string; onAdd?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4" /></svg>
      </div>
      <p className="text-sm text-slate-500">{msg}</p>
      {onAdd && (
        <button type="button" onClick={onAdd} className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          İlk Kaydı Ekle
        </button>
      )}
    </div>
  );
}

function ErrorAlert({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="sticky top-0 z-40 mb-4 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 shadow-sm">
      <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="flex-1">{msg}</span>
      <button type="button" onClick={onClose} className="text-red-400 hover:text-red-600">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

function SuccessAlert({ msg }: { msg: string }) {
  return (
    <div className="sticky top-0 z-40 mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2 shadow-sm">
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      <span>{msg}</span>
    </div>
  );
}
