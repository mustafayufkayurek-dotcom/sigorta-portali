'use client';

import { EntityDocumentsTab } from '@/components/EntityDocumentsTab';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://app.meridyen-tr.com/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }
function fmtDate(d: string | null | undefined) { return d ? new Date(d).toLocaleDateString('tr-TR') : '—'; }

type InsuranceTab = 'profil' | 'evraklar';

const TABS: { id: InsuranceTab; label: string }[] = [
  { id: 'profil', label: 'Profil' },
  { id: 'evraklar', label: 'Evraklar' },
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <h4 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">{title}</h4>
      {children}
    </div>
  );
}

// ── Profil Tab ──────────────────────────────────────────────────────────────────
function ProfilTab({ company }: { company: any }) {
  const fields = [
    { label: 'Şirket Adı', value: company.name ?? '—' },
    { label: 'Kod', value: company.code ?? '—' },
    { label: 'Vergi No', value: company.taxNumber ?? '—' },
    { label: 'E-posta', value: company.contactEmail ?? '—' },
    { label: 'Telefon', value: company.contactPhone ?? '—' },
    { label: 'Adres', value: company.address ?? '—' },
    { label: 'Durum', value: company.status === 'active' ? 'Aktif' : 'Pasif' },
    { label: 'Kayıt Tarihi', value: fmtDate(company.createdAt) },
    { label: 'Güncelleme Tarihi', value: fmtDate(company.updatedAt) },
  ];

  return (
    <div className="space-y-4">
      <SectionCard title="Şirket Bilgileri">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="text-xs text-slate-400">{f.label}</p>
              <p className="text-sm font-medium text-slate-800">{f.value}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      {company.notes && (
        <SectionCard title="Notlar">
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{company.notes}</p>
        </SectionCard>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────────
export default function SigortaSirketiDetayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<InsuranceTab>('profil');

  const loadCompany = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await axios.get(`${API}/insurance-companies/${id}`, { headers: authHeader() });
      setCompany(r.data.data ?? r.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadCompany(); }, [loadCompany]);

  if (loading) return <div className="text-slate-400 py-16 text-center">Yükleniyor...</div>;
  if (!company) return <div className="text-slate-400 py-16 text-center">Sigorta şirketi bulunamadı.</div>;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button type="button" onClick={() => router.back()} className="text-slate-400 hover:text-slate-700 text-sm">← Geri</button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900">{company.name}</h2>
          <p className="text-sm text-slate-400">{company.code ?? ''}</p>
        </div>
        <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${company.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
          {company.status === 'active' ? 'Aktif' : 'Pasif'}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-6">
        {TABS.map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'profil' && <ProfilTab company={company} />}
      {activeTab === 'evraklar' && (
        <EntityDocumentsTab
          mode="entity"
          entityType="insurance_company"
          entityId={id!}
          title="Evraklar"
        />
      )}
    </div>
  );
}
