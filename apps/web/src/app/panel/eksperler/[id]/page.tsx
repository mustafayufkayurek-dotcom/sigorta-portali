'use client';

import { API, authHeader } from '@/utils/api';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { formatClaimSubjectLabel } from '@/utils/text-helpers';


function fmtDate(d: string | null | undefined) { return d ? new Date(d).toLocaleDateString('tr-TR') : '—'; }
function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}

type ProfileTab = 'overview' | 'assignments' | 'performance';

const TABS: { id: ProfileTab; label: string }[] = [
  { id: 'overview', label: 'Genel Bilgiler' },
  { id: 'assignments', label: 'Atamalar & Raporlar' },
  { id: 'performance', label: 'Performans' },
];

const ASSIGNMENT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Bekliyor', color: 'bg-yellow-100 text-yellow-700' },
  accepted: { label: 'Kabul Edildi', color: 'bg-blue-100 text-blue-700' },
  rejected: { label: 'Reddedildi', color: 'bg-red-100 text-red-700' },
  completed: { label: 'Tamamlandı', color: 'bg-green-100 text-green-700' },
};

const REPORT_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Taslak', color: 'bg-slate-100 text-slate-600' },
  submitted: { label: 'Sunuldu', color: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Onaylandı', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Reddedildi', color: 'bg-red-100 text-red-700' },
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <h4 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">{title}</h4>
      {children}
    </div>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-slate-800'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdjusterProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [adjuster, setAdjuster] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      axios.get(`${API}/adjusters/${id}`, { headers: authHeader() }),
      axios.get(`${API}/adjusters/${id}/performance`, { headers: authHeader() }),
    ]).then(([adjRes, metRes]) => {
      setAdjuster(adjRes.data.data);
      setMetrics(metRes.data.data);
      setEditForm(adjRes.data.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { id: _id, createdAt, updatedAt, assignments, appointments, _count, ...data } = editForm;
      if (typeof data.specialties === 'string') {
        data.specialties = data.specialties.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      const res = await axios.patch(`${API}/adjusters/${id}`, data, { headers: authHeader() });
      setAdjuster(res.data.data);
      setEditing(false);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  if (loading) return <div className="text-slate-400 py-16 text-center">Yükleniyor...</div>;
  if (!adjuster) return <div className="text-slate-400 py-16 text-center">Eksper bulunamadı.</div>;

  const scoreColor = (s: number) => s >= 80 ? 'text-green-600' : s >= 60 ? 'text-yellow-500' : 'text-status-danger';

  const radarData = metrics ? [
    { subject: 'Tamamlanma', value: metrics.completionRate },
    { subject: 'Hız', value: Math.max(0, 100 - (metrics.avgReportDays ?? 0) * 2) },
    { subject: 'Revizyon-Suz', value: Math.max(0, 100 - metrics.revisionRate) },
    { subject: 'Toplam İş', value: Math.min(100, (metrics.total ?? 0) * 5) },
  ] : [];

  const assignmentBarData = adjuster.assignments?.slice(0, 12).map((a: any, i: number) => ({
    name: `#${i + 1}`,
    hasar: a.claimFile?.fileNo ?? `Dosya ${i + 1}`,
    rapor: a.report?.estimatedDamage ? Math.round(a.report.estimatedDamage / 1000) : 0,
  })) ?? [];

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <button type="button" onClick={() => router.push('/panel/musteriler?subType=eksper_firmasi')} className="text-slate-400 hover:text-slate-700 text-sm mt-1">← Müşterilere Dön</button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {adjuster.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{adjuster.name}</h2>
              <p className="text-sm text-slate-400">{adjuster.company ?? 'Bağımsız'} · {adjuster.city}{adjuster.region ? `, ${adjuster.region}` : ''}</p>
              {adjuster.licenseNo && <p className="text-xs text-slate-300">Lisans: {adjuster.licenseNo}</p>}
            </div>
          </div>
        </div>
        <button type="button" onClick={() => setEditing(!editing)} className="text-sm border border-slate-200 px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-50">
          {editing ? 'İptal' : 'Düzenle'}
        </button>
      </div>

      {/* Metrics Summary */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
          <MetricCard label="Performans Skoru" value={metrics.performanceScore} color={scoreColor(metrics.performanceScore)} />
          <MetricCard label="Toplam Atama" value={metrics.total} />
          <MetricCard label="Tamamlanan" value={metrics.completed} color="text-green-600" />
          <MetricCard label="Ort. Rapor Süresi" value={metrics.avgReportDays ? `${metrics.avgReportDays} gün` : '—'} />
          <MetricCard label="Revizyon Oranı" value={`%${metrics.revisionRate}`} color={metrics.revisionRate > 20 ? 'text-status-danger' : 'text-green-600'} />
        </div>
      )}

      {/* Eksper Bilgileri Bandı — tüm sekmelerde sabit */}
      <div className="mb-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
            {adjuster.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-xs text-blue-400 font-medium tracking-wide leading-none mb-0.5">Eksper</p>
            <p className="text-sm font-semibold text-blue-800 truncate">{adjuster.name}</p>
          </div>
        </div>
        {adjuster.phone && (
          <div className="min-w-0">
            <p className="text-xs text-blue-400 leading-none mb-0.5">Telefon</p>
            <a href={`tel:${adjuster.phone}`} className="text-sm font-medium text-blue-700 hover:underline">{adjuster.phone}</a>
          </div>
        )}
        {adjuster.email && (
          <div className="min-w-0">
            <p className="text-xs text-blue-400 leading-none mb-0.5">E-posta</p>
            <a href={`mailto:${adjuster.email}`} className="text-sm font-medium text-blue-700 hover:underline truncate">{adjuster.email}</a>
          </div>
        )}
        {adjuster.company && (
          <div className="min-w-0">
            <p className="text-xs text-blue-400 leading-none mb-0.5">Şirket</p>
            <p className="text-sm font-medium text-blue-700">{adjuster.company}</p>
          </div>
        )}
        {adjuster.insuranceCompanies?.length > 0 && (
          <div className="min-w-0">
            <p className="text-xs text-blue-400 leading-none mb-0.5">Sigorta Şirketleri</p>
            <div className="flex flex-wrap gap-1">
              {(adjuster.insuranceCompanies as { id: string; name: string }[]).map((ic) => (
                <span key={ic.id} className="inline-block text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-medium">{ic.name}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-6">
        {TABS.map((tab) => (
          <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {editing ? (
            <SectionCard title="Eksper Bilgilerini Düzenle">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { k: 'name', label: 'Ad Soyad', type: 'text' },
                  { k: 'company', label: 'Şirket', type: 'text' },
                  { k: 'licenseNo', label: 'Lisans No', type: 'text' },
                  { k: 'phone', label: 'Telefon', type: 'text' },
                  { k: 'email', label: 'E-posta', type: 'email' },
                  { k: 'city', label: 'Şehir', type: 'text' },
                  { k: 'region', label: 'Bölge', type: 'text' },
                ].map((f) => (
                  <div key={f.k}>
                    <label className="text-xs text-slate-500 block mb-1">{f.label}</label>
                    <input type={f.type} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={editForm[f.k] ?? ''} onChange={(e) => setEditForm((p: any) => ({ ...p, [f.k]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Durum</label>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={editForm.status ?? 'active'} onChange={(e) => setEditForm((p: any) => ({ ...p, status: e.target.value }))}>
                    <option value="active">Aktif</option>
                    <option value="passive">Pasif</option>
                    <option value="suspended">Askıya Alındı</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 block mb-1">Uzmanlık Alanları (Virgülle Ayırın)</label>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={Array.isArray(editForm.specialties) ? editForm.specialties.join(', ') : editForm.specialties ?? ''} onChange={(e) => setEditForm((p: any) => ({ ...p, specialties: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 block mb-1">Notlar</label>
                  <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" rows={3} value={editForm.notes ?? ''} onChange={(e) => setEditForm((p: any) => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>
              <button type="button" onClick={handleSave} disabled={saving} className="mt-4 bg-brand-600 text-white px-6 py-2 rounded-xl text-sm hover:bg-brand-700 disabled:opacity-50">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </SectionCard>
          ) : (
            <SectionCard title="Kişisel & İletişim Bilgileri">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                {[
                  { label: 'Ad Soyad', value: adjuster.name },
                  { label: 'Şirket', value: adjuster.company },
                  { label: 'Lisans No', value: adjuster.licenseNo },
                  { label: 'Telefon', value: adjuster.phone },
                  { label: 'E-posta', value: adjuster.email },
                  { label: 'Şehir', value: adjuster.city },
                  { label: 'Bölge', value: adjuster.region },
                  { label: 'Durum', value: adjuster.status },
                  { label: 'Kayıt Tarihi', value: fmtDate(adjuster.createdAt) },
                ].map((f) => (
                  <div key={f.label}>
                    <p className="text-xs text-slate-400">{f.label}</p>
                    <p className="text-sm font-medium text-slate-800">{f.value ?? '—'}</p>
                  </div>
                ))}
              </div>
              {adjuster.specialties?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-slate-400 mb-2">Uzmanlık Alanları</p>
                  <div className="flex flex-wrap gap-2">
                    {adjuster.specialties.map((s: string) => (
                      <span key={s} className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {adjuster.insuranceCompanies?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-slate-400 mb-2">Çalıştığı Sigorta Şirketleri</p>
                  <div className="flex flex-wrap gap-2">
                    {(adjuster.insuranceCompanies as { id: string; name: string }[]).map((ic) => (
                      <span key={ic.id} className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs px-2.5 py-1 rounded-full font-medium">{ic.name}</span>
                    ))}
                  </div>
                </div>
              )}
              {adjuster.notes && (
                <div className="mt-4 p-3 bg-amber-50 rounded-lg text-sm text-amber-700">{adjuster.notes}</div>
              )}
            </SectionCard>
          )}

          {/* Şirket bazlı dosya özeti (claim data'dan) */}
          {(() => {
            const companyMap: Record<string, { name: string; count: number; completed: number }> = {};
            (adjuster.assignments ?? []).forEach((a: any) => {
              const ic = a.claimFile?.insuranceCompany;
              if (!ic?.id) return;
              if (!companyMap[ic.id]) companyMap[ic.id] = { name: ic.name, count: 0, completed: 0 };
              companyMap[ic.id].count += 1;
              if (a.status === 'completed') companyMap[ic.id].completed += 1;
            });
            const entries = Object.values(companyMap).sort((a, b) => b.count - a.count);
            if (entries.length === 0) return null;
            return (
              <SectionCard title="Sigorta Şirketi Bazlı Dosya Özeti">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {entries.map((e) => (
                    <div key={e.name} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
                          {e.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="text-sm font-medium text-slate-800 truncate max-w-[160px]">{e.name}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-slate-800">{e.count} dosya</p>
                        <p className="text-xs text-green-600">{e.completed} tamamlandı</p>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            );
          })()}
        </div>
      )}

      {/* Assignments Tab */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          {!adjuster.assignments?.length ? (
            <div className="text-slate-400 py-12 text-center">Atama bulunamadı.</div>
          ) : (
            adjuster.assignments.map((a: any) => (
              <div key={a.id} className="bg-white rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <a href={`/panel/hasar-dosyalari/${a.claimFile?.id}`} className="font-semibold text-blue-700 hover:underline">
                      {a.claimFile?.fileNo ?? '—'}
                    </a>
                    <p className="text-xs text-slate-400">{formatClaimSubjectLabel(a.claimFile?.lossType, a.claimFile?.productBranch)}</p>
                    {a.claimFile?.insuranceCompany?.name && (
                      <span className="inline-block mt-1 text-[10px] leading-none bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full px-2 py-0.5 font-medium">
                        {a.claimFile.insuranceCompany.name}
                      </span>
                    )}
                  </div>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ASSIGNMENT_STATUS[a.status]?.color ?? 'bg-slate-100 text-slate-600'}`}>
                    {ASSIGNMENT_STATUS[a.status]?.label ?? a.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 flex gap-4">
                  <span>Atandı: {fmtDate(a.assignedAt)}</span>
                  {a.appointmentDate && <span>Randevu: {fmtDate(a.appointmentDate)}</span>}
                  {a.visitDate && <span>Ziyaret: {fmtDate(a.visitDate)}</span>}
                </div>
                {a.report && (
                  <div className="mt-3 bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-700">Rapor: {a.report.reportNo}</p>
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${REPORT_STATUS[a.report.status]?.color ?? 'bg-slate-100 text-slate-600'}`}>
                        {REPORT_STATUS[a.report.status]?.label ?? a.report.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                      <p>Tarih: {fmtDate(a.report.reportDate)}</p>
                      {a.report.estimatedDamage && <p>Tahmini Hasar: {fmtCurrency(a.report.estimatedDamage)}</p>}
                      {a.report.recommendation && <p>Tavsiye: {a.report.recommendation}</p>}
                      {a.report.rejectionReason && <p className="text-status-danger">Red Sebebi: {a.report.rejectionReason}</p>}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && metrics && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SectionCard title="Performans Profili">
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#6B7280' }} />
                  <Radar name="Performans" dataKey="value" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </SectionCard>

            <SectionCard title="Özet Metrikler">
              <div className="space-y-4">
                {[
                  { label: 'Performans Skoru', value: metrics.performanceScore, max: 100, color: '#3B82F6' },
                  { label: 'Tamamlanma Oranı', value: metrics.completionRate, max: 100, color: '#10B981' },
                  { label: 'Revizyon Sıklığı', value: metrics.revisionRate, max: 100, color: '#EF4444', reverse: true },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">{m.label}</span>
                      <span className="font-semibold" style={{ color: m.color }}>%{m.value}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, m.value)}%`, backgroundColor: m.color }}
                      />
                    </div>
                  </div>
                ))}
                <div className="mt-2 pt-3 border-t border-slate-50 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Toplam Atama</span><span className="font-medium">{metrics.total}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Tamamlanan</span><span className="font-medium text-green-600">{metrics.completed}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Bekleyen</span><span className="font-medium text-yellow-500">{metrics.pending}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Toplam Rapor</span><span className="font-medium">{metrics.totalReports}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Reddedilen Rapor</span><span className="font-medium text-status-danger">{metrics.rejectedReports}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Ort. Rapor Süresi</span><span className="font-medium">{metrics.avgReportDays ? `${metrics.avgReportDays} gün` : '—'}</span></div>
                </div>
              </div>
            </SectionCard>
          </div>

          {assignmentBarData.length > 0 && (
            <SectionCard title="Atama Bazlı Tahmini Hasar (₺K)">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={assignmentBarData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                  <Tooltip formatter={(v) => [`${v ?? 0}K ₺`, 'Tahmini Hasar']} />
                  <Bar dataKey="rapor" fill="#6366F1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}
