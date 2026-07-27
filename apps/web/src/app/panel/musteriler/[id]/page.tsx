'use client';

import { API, authHeader, getToken } from '@/utils/api';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { EntityDocumentsTab } from '@/components/EntityDocumentsTab';
import { LocationPreview } from '@/components/LocationPickerModal';
import { PhoneContactActions } from '@/components/ui/PhoneContactActions';
import { ADDRESS_FIELD } from '@/constants/address-fields';
import { useToast } from '@/contexts/ToastContext';
import { fmtDate } from '@/utils/date-helpers';
import { formatDisplayLabel } from '@/utils/text-helpers';
import { customerSubTypeLabel, CUSTOMER_RELATION_SECTION_TITLE, customerServiceTypeLabel, formatCustomerUpdatedMeta, isHasarCustomerServiceType } from '@/utils/customer-form-helpers';
import { CardNotesDisplay } from '@/components/card-notes/CardNotesDisplay';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';



function getCurrentUserRole(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('currentUser');
    if (raw) {
      const u = JSON.parse(raw);
      return u?.roleCode ?? u?.role?.code ?? null;
    }
    const token = getToken();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.roleCode ?? null;
  } catch { return null; }
}

function maskTC(tc: string | null | undefined): string {
  if (!tc) return '—';
  if (tc.length < 5) return '***';
  return tc.slice(0, 3) + '*'.repeat(tc.length - 5) + tc.slice(-2);
}

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-emerald-100 text-emerald-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-red-100 text-red-700',
};
const SOURCE_LABEL: Record<string, string> = {
  insurance_referral: 'Sigorta Şirketi', referral: 'Referans', web: 'Web', returning: 'Tekrar Müşteri',
};
const CONTACT_TYPE_ICON: Record<string, string> = {
  phone: '📞', email: '✉', fax: '🖷', whatsapp: '💬',
};

const BRANCH_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
];

type CustomerTab = 'profil' | 'yetkili' | 'iletisim' | 'dosyalar' | 'evraklar' | 'analiz';

const TABS: { id: CustomerTab; label: string; icon: string }[] = [
  { id: 'profil', label: 'Profil', icon: '👤' },
  { id: 'yetkili', label: 'Yetkili & İletişim', icon: '📡' },
  { id: 'dosyalar', label: 'Hasar Dosyaları', icon: '📂' },
  { id: 'evraklar', label: 'Evraklar', icon: '📄' },
  { id: 'analiz', label: 'Branş Analizi', icon: '📊' },
];

// ── Shared Components ──────────────────────────────────────────────────────────
function SectionCard({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-slate-400 tracking-wide mb-0.5">{label}</p>
      <div className="text-sm text-slate-800 font-medium">{value || <span className="text-slate-300">—</span>}</div>
    </div>
  );
}

function Badge({ variant, children }: { variant: 'green' | 'gray' | 'blue' | 'purple' | 'amber' | 'orange' | 'red' | 'indigo'; children: React.ReactNode }) {
  const cls = {
    green: 'bg-green-50 text-green-700 border-green-100',
    gray: 'bg-slate-100 text-slate-500 border-slate-200',
    blue: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  }[variant];
  return <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${cls}`}>{children}</span>;
}

// ── Profil Tab ────────────────────────────────────────────────────────────────
function CustomerProfilTab({ customer, isFieldStaff, onReload, onEdit }: { customer: any; isFieldStaff: boolean; onReload: () => void; onEdit: () => void }) {
  const isCorporate = (customer.customerType ?? customer.entityType) === 'corporate';
  const subTypeLabel = customerSubTypeLabel(customer.subType);

  const handleClearLocation = async () => {
    try {
      await axios.patch(`${API}/customers/${customer.id}`, { latitude: null, longitude: null }, { headers: authHeader() });
      onReload();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Temel Bilgiler */}
        <SectionCard title="Temel Bilgiler" subtitle={isCorporate ? 'Kurumsal müşteri' : 'Bireysel müşteri'}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {isCorporate ? (
              <>
                <InfoRow label="Şirket Adı" value={customer.companyName} className="col-span-2" />
                <InfoRow label="Alt Tip" value={subTypeLabel ? (
                  <Badge variant="blue">{subTypeLabel}</Badge>
                ) : null} />
                <InfoRow label="Vergi No" value={customer.taxNumber} />
                <InfoRow label="Vergi Dairesi" value={customer.taxOffice} />
                <InfoRow label="Yetkili" value={customer.authorizedPerson} className="col-span-2" />
              </>
            ) : (
              <>
                <InfoRow label="Ad Soyad" value={`${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()} className="col-span-2" />
                <InfoRow label="TC Kimlik" value={
                  customer.identityNo ? (
                    <span className="font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100 text-xs">
                      {isFieldStaff ? maskTC(customer.identityNo) : customer.identityNo}
                    </span>
                  ) : null
                } />
                <InfoRow label="Alt Tip" value={subTypeLabel ? (
                  <Badge variant={customer.subType === 'insured' ? 'orange' : customer.subType === 'private_customer' ? 'green' : 'purple'}>{subTypeLabel}</Badge>
                ) : null} />
              </>
            )}
          </div>
        </SectionCard>

        {/* İletişim */}
        <SectionCard title="İletişim Bilgileri">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <InfoRow label="Telefon" value={customer.phone ? (
              <PhoneContactActions phone={customer.phone} variant="inline" size="sm" />
            ) : null} />
            <InfoRow label="E-posta" value={customer.email ? (
              <a href={`mailto:${customer.email}`} className="text-emerald-600 hover:underline">{customer.email}</a>
            ) : null} />
            <InfoRow label="İl" value={customer.city} />
            <InfoRow label="İlçe" value={customer.district} />
            {customer.neighborhood && <InfoRow label={ADDRESS_FIELD.neighborhood} value={customer.neighborhood} />}
            {customer.streetName && <InfoRow label={ADDRESS_FIELD.street} value={customer.streetName} />}
            {(customer.buildingNo || customer.doorNo) && (
              <InfoRow
                label="Bina / Daire"
                value={[customer.buildingNo && `No: ${customer.buildingNo}`, customer.doorNo && `D: ${customer.doorNo}`].filter(Boolean).join(' · ')}
              />
            )}
            <InfoRow label={ADDRESS_FIELD.openAddress} value={customer.address} className="col-span-2" />
          </div>
          {customer.latitude != null && customer.longitude != null ? (
            <div className="mt-4 pt-4 border-t border-slate-50">
              <p className="text-xs font-medium text-slate-400 tracking-wide mb-2">Harita Konumu</p>
              <LocationPreview
                lat={customer.latitude}
                lng={customer.longitude}
                addressLabel={[customer.city, customer.district, customer.address].filter(Boolean).join(', ') || undefined}
                onEdit={onEdit}
                onClear={handleClearLocation}
                accentColor="emerald"
              />
            </div>
          ) : (
            <div className="mt-4 pt-4 border-t border-slate-50">
              <p className="text-xs text-slate-400 mb-2">Harita konumu kayıtlı değil. Saha ziyaretinde yol tarifi için konum ekleyin.</p>
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                Konum Ekle
              </button>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title={CUSTOMER_RELATION_SECTION_TITLE} subtitle="Kayıt anı ilişki bilgileri">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <InfoRow label="Kaynak" value={customer.source ? SOURCE_LABEL[customer.source] ?? customer.source : null} />
            <InfoRow label="Takip Tarihi" value={customer.followUpDate ? (
              <span className={`${new Date(customer.followUpDate) < new Date() ? 'text-red-600' : 'text-slate-800'}`}>
                {fmtDate(customer.followUpDate)}
              </span>
            ) : null} />
            <InfoRow label="Memnuniyet" value={customer.satisfactionScore ? (
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} className={`text-base ${s <= customer.satisfactionScore ? 'text-yellow-400' : 'text-slate-200'}`}>★</span>
                ))}
                <span className="text-xs text-slate-500 ml-1">{customer.satisfactionScore}/5</span>
              </div>
            ) : null} />
            <InfoRow label="Kayıt Tarihi" value={fmtDate(customer.createdAt)} />
          </div>
          {Array.isArray(customer.tags) && customer.tags.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-50">
              <p className="text-xs font-medium text-slate-400 tracking-wide mb-2">Etiketler</p>
              <div className="flex flex-wrap gap-1.5">
                {customer.tags.map((t: string) => <Badge key={t} variant="amber">{t}</Badge>)}
              </div>
            </div>
          )}
        </SectionCard>

        {/* İstatistik */}
        <SectionCard title="Dosya İstatistikleri">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Toplam Dosya', value: customer._count?.claimFiles ?? 0, color: 'text-emerald-600' },
              { label: 'Durum', value: (
                <Badge variant={customer.status === 'active' ? 'green' : customer.status === 'blacklisted' ? 'red' : 'gray'}>
                  {customer.status === 'active' ? '● Aktif' : customer.status === 'blacklisted' ? '⛔ Kara Liste' : '● Arşiv'}
                </Badge>
              ), color: '' },
            ].map((stat, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-3 text-center">
                {typeof stat.value === 'number' ? (
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                ) : (
                  <div className="flex justify-center pt-1">{stat.value}</div>
                )}
                <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Kart Notları" subtitle="Kayıt ve düzenleme sırasında girilen numaralı notlar">
        <CardNotesDisplay notesRaw={customer.notes} />
      </SectionCard>

      {/* Hizmet Türü & Branşlar: sigortalı (insured/private_customer) ve kurumsal müşterilerde gizli */}
      {!(customer.subType === 'insured' || customer.subType === 'private_customer' || isCorporate) &&
       (customer.serviceType || (Array.isArray(customer.serviceBranches) && customer.serviceBranches.length > 0)) && (
        <SectionCard title="Hizmet Türü & Branşlar">
          <div className="flex flex-wrap gap-2">
            {customer.serviceType && (
              <span className={`inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full border ${
                isHasarCustomerServiceType(customer.serviceType)
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}>
                {customerServiceTypeLabel(customer.serviceType)}
              </span>
            )}
            {Array.isArray(customer.serviceBranches) && customer.serviceBranches.map((b: string) => (
              <span key={b} className="inline-flex items-center text-xs px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
                {b}
              </span>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── Yetkili & İletişim Tab ────────────────────────────────────────────────────
function YetkiliIletisimTab({ customer }: { customer: any }) {
  const contacts: any[] = customer.contacts || [];
  const contactInfos: any[] = customer.contactInfos || [];

  return (
    <div className="space-y-4">
      <SectionCard title="Yetkili Kişiler" subtitle={`${contacts.length} kişi kayıtlı`}>
        {contacts.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Yetkili Kişi Eklenmemiş.</p>
        ) : (
          <div className="space-y-3">
            {contacts.map((c: any, i: number) => (
              <div key={c.id ?? i} className={`flex items-start gap-3 p-4 rounded-xl border ${c.isPrimary ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${c.isPrimary ? 'bg-emerald-600' : 'bg-slate-400'}`}>
                  {(c.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                    {c.isPrimary && <Badge variant="blue">Birincil</Badge>}
                  </div>
                  {c.role && <p className="text-xs text-slate-500 mt-0.5">{c.role}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {c.phone && (
                      <PhoneContactActions phone={c.phone} variant="inline" />
                    )}
                    {c.email && <a href={`mailto:${c.email}`} className="text-xs text-slate-600 hover:text-emerald-600">✉ {c.email}</a>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Ek İletişim Kanalları" subtitle={`${contactInfos.length} kayıtlı kanal`}>
        {contactInfos.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Ek İletişim Kanalı Eklenmemiş.</p>
        ) : (
          <div className="space-y-2">
            {contactInfos.map((ci: any, i: number) => (
              <div key={ci.id ?? i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{CONTACT_TYPE_ICON[ci.type] ?? '📞'}</span>
                  <div>
                    {(ci.type === 'phone' || ci.type === 'whatsapp') ? (
                      <a href={`tel:${ci.value}`} className="text-sm font-medium text-emerald-600 hover:underline">{ci.value}</a>
                    ) : ci.type === 'email' ? (
                      <a href={`mailto:${ci.value}`} className="text-sm font-medium text-emerald-600 hover:underline">{ci.value}</a>
                    ) : (
                      <p className="text-sm font-medium text-slate-800">{ci.value}</p>
                    )}
                    <p className="text-xs text-slate-400 capitalize">{ci.label === 'general' ? 'Genel' : ci.label === 'work' ? 'İş' : 'Kişisel'}</p>
                  </div>
                </div>
                <Badge variant="blue">{ci.type === 'phone' ? 'Telefon' : ci.type === 'email' ? 'E-posta' : ci.type === 'fax' ? 'Faks' : 'WhatsApp'}</Badge>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Hasar Dosyaları Tab ───────────────────────────────────────────────────────
function CustomerDosyalarTab({ customerId }: { customerId: string }) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<any>(null);

  const load = () => {
    setLoading(true);
    axios.get(`${API}/customers/${customerId}/claim-files?limit=50`, { headers: authHeader() })
      .then((r) => setFiles(r.data.data || [])).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [customerId]);

  if (loading) return <div className="text-slate-400 py-12 text-center">Yükleniyor...</div>;

  return (
    <>
      <SectionCard title="Hasar Dosyaları" subtitle={`${files.length} dosya`}>
        {!files.length ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-2 text-xl">📂</div>
            <p className="text-slate-500 font-medium text-sm">Hasar Dosyası Bulunamadı.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.id} className="border border-slate-100 rounded-xl hover:border-emerald-200 transition-all">
                <div className="flex items-center justify-between p-3.5">
                  <a href={`/panel/hasar-dosyalari/${f.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 text-sm flex-shrink-0">📋</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{f.claimNo ?? f.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{formatDisplayLabel(f.subject)} · {fmtDate(f.incidentDate)}</p>
                    </div>
                  </a>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className={`text-xs rounded-full px-2.5 py-1 font-medium ${STATUS_BADGE[f.currentStatus?.code ?? ''] ?? 'bg-slate-100 text-slate-500'}`}>
                      {f.currentStatus?.name ?? f.status ?? '—'}
                    </span>
                    {/* Önizleme */}
                    <button
                      type="button"
                      title="Önizle"
                      onClick={() => setPreviewFile(previewFile?.id === f.id ? null : f)}
                      className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Dosya Önizleme Modalı */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">
                Dosya Detayı — {previewFile.claimNo ?? previewFile.id.slice(0, 8).toUpperCase()}
              </h3>
              <button type="button" onClick={() => setPreviewFile(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'Konu', value: formatDisplayLabel(previewFile.subject) },
                { label: 'Durum', value: previewFile.currentStatus?.name ?? previewFile.status },
                { label: 'Hasar Tarihi', value: fmtDate(previewFile.incidentDate) },
                { label: 'Oluşturulma', value: fmtDate(previewFile.createdAt) },
              ].map((row) => row.value ? (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-slate-400">{row.label}</span>
                  <span className="font-medium text-slate-800">{row.value}</span>
                </div>
              ) : null)}
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPreviewFile(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Kapat</button>
              <a href={`/panel/hasar-dosyalari/${previewFile.id}`} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Dosyaya Git</a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Branş Analizi Tab ─────────────────────────────────────────────────────────
interface BranchRow {
  branch: string;
  total: number;
  open: number;
  closed: number;
  avgCloseDays: number | null;
  lastFileDate: string | null;
}

interface DistributionData {
  rows: BranchRow[];
  summary: {
    totalFiles: number;
    mostActiveBranch: string | null;
    avgCloseDays: number | null;
    branchCount: number;
  };
}

interface TrendData {
  trend: Record<string, unknown>[];
  branches: string[];
}

function CustomerAnalizTab({ customerId }: { customerId: string }) {
  const [distData, setDistData] = useState<DistributionData | null>(null);
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = authHeader();
    Promise.all([
      axios.get(`${API}/analytics/branch-distribution?customerId=${customerId}`, { headers }),
      axios.get(`${API}/analytics/branch-trend?customerId=${customerId}&months=12`, { headers }),
    ])
      .then(([distRes, trendRes]) => {
        setDistData(distRes.data.data);
        setTrendData(trendRes.data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <svg className="w-8 h-8 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Analiz Yükleniyor...</span>
        </div>
      </div>
    );
  }

  if (!distData) {
    return <div className="text-center py-12 text-slate-400">Veri Bulunamadı.</div>;
  }

  const { rows, summary } = distData;
  const pieData = rows.map((r) => ({ name: r.branch, value: r.total }));

  return (
    <div className="space-y-5">
      {/* Özet Metrikler */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Dosya', value: summary.totalFiles, icon: '📂', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Aktif Branş', value: summary.branchCount, icon: '🏷', color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'En Aktif Branş', value: summary.mostActiveBranch ?? '—', icon: '🏆', color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Ort. Kapanma', value: summary.avgCloseDays != null ? `${summary.avgCloseDays} gün` : '—', icon: '⏱', color: 'text-green-600', bg: 'bg-green-50' },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <div className={`w-9 h-9 ${m.bg} rounded-xl flex items-center justify-center text-lg mb-2`}>{m.icon}</div>
            <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SectionCard title="Branş Dağılımı">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={BRANCH_COLORS[i % BRANCH_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${v} dosya`, 'Adet']} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Branş Bazlı Dosya Sayısı">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={rows} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="branch" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" name="Toplam" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="open" name="Açık" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="closed" name="Kapalı" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>
      )}

      {trendData && trendData.trend?.length > 0 && (
        <SectionCard title="Aylık Dosya Trendi (Son 12 Ay)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData.trend} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend iconType="circle" iconSize={8} />
              {(trendData.branches ?? []).slice(0, 5).map((b: string, i: number) => (
                <Line key={b} type="monotone" dataKey={b} stroke={BRANCH_COLORS[i % BRANCH_COLORS.length]}
                  strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
      )}

      <SectionCard title="Branş Detay Tablosu">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Veri yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Branş', 'Toplam', 'Açık', 'Kapalı', 'Ort. Süre', 'Son Dosya'].map((h, i) => (
                    <th key={h} className={`py-2.5 text-xs font-semibold text-slate-500 tracking-wide ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.branch} className={`border-b border-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BRANCH_COLORS[i % BRANCH_COLORS.length] }} />
                        <span className="font-medium text-slate-800">{row.branch}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <span className="font-semibold text-emerald-600">{row.total}</span>
                    </td>
                    <td className="py-3 text-right">
                      <span className="text-amber-600 font-medium">{row.open}</span>
                    </td>
                    <td className="py-3 text-right">
                      <span className="text-green-600 font-medium">{row.closed}</span>
                    </td>
                    <td className="py-3 text-right text-slate-600">
                      {row.avgCloseDays != null ? `${row.avgCloseDays} gün` : '—'}
                    </td>
                    <td className="py-3 text-right text-slate-500 text-xs">
                      {fmtDate(row.lastFileDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CustomerTab>('profil');
  const [userRoleCode, setUserRoleCode] = useState<string | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);

  useEffect(() => {
    setUserRoleCode(getCurrentUserRole());
  }, []);

  const isFieldStaff = userRoleCode === 'field_staff' || userRoleCode === 'FIELD_STAFF';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/customers/${id}`, { headers: authHeader() });
      setCustomer(r.data.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleArchive = async () => {
    setArchiveLoading(true);
    try {
      await axios.post(`${API}/customers/${id}/archive`, {}, { headers: authHeader() });
      setArchiveConfirm(false);
      showToast('success', 'Müşteri Arşivlendi');
      await load();
    } catch (e: any) {
      showToast('error', e?.response?.data?.message ?? 'Arşivleme başarısız');
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleReactivate = async () => {
    setReactivateLoading(true);
    try {
      await axios.post(`${API}/customers/${id}/reactivate`, {}, { headers: authHeader() });
      showToast('success', 'Müşteri Yeniden Aktifleştirildi');
      await load();
    } catch (e: any) {
      showToast('error', e?.response?.data?.message ?? 'Aktifleştirme başarısız');
    } finally {
      setReactivateLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <svg className="w-8 h-8 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">Yükleniyor...</span>
      </div>
    </div>
  );
  if (!customer) return <div className="text-center py-16 text-slate-400">Müşteri Bulunamadı.</div>;

  const isCorporate = (customer.customerType ?? customer.entityType) === 'corporate';
  const displayName = isCorporate
    ? customer.companyName ?? '—'
    : `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() || '—';
  const subTypeLabel = customerSubTypeLabel(customer.subType);
  const contactCount = customer.contacts?.length ?? 0;
  const isOverdue = customer.followUpDate && new Date(customer.followUpDate) < new Date();

  return (
    <div>
      {/* ── Back ── */}
      <button type="button" onClick={() => router.push('/panel/musteriler')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Müşteriler
      </button>

      {/* ── Header Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-5">
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-sm ${isCorporate ? 'bg-emerald-600' : 'bg-purple-600'}`}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-slate-900">{displayName}</h1>
                  {/* Fix #7: inline badge ismin yanında */}
                  <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${isCorporate ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                    {isCorporate ? '🏢 Kurumsal' : '👤 Bireysel'}
                  </span>
                  {subTypeLabel && (
                    <Badge variant={
                      customer.subType === 'insured' ? 'orange'
                        : customer.subType === 'private_customer' ? 'green'
                          : customer.subType === 'sigorta_sirketi' || customer.subType === 'asistan_firmasi' ? 'blue'
                            : 'purple'
                    }>{subTypeLabel}</Badge>
                  )}
                </div>
                {customer.city && (
                  <p className="text-xs text-slate-400 mt-0.5">📍 {customer.city}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {!isFieldStaff && customer.status !== 'passive' && (
                  <button
                    type="button"
                    onClick={() => setArchiveConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    Arşivle
                  </button>
                )}
                {!isFieldStaff && customer.status === 'passive' && (
                  <button
                    type="button"
                    onClick={handleReactivate}
                    disabled={reactivateLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-emerald-200 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                  >
                    {reactivateLoading ? 'Aktifleştiriliyor...' : 'Yeniden Aktifleştir'}
                  </button>
                )}
                {/* Fix #6: Düzenle butonu */}
                {!isFieldStaff && (
                  <button
                    type="button"
                    onClick={() => router.push(`/panel/musteriler?edit=${id}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Düzenle
                  </button>
                )}
                {isOverdue && (
                  <Badge variant="red">⏰ Takip Geçti</Badge>
                )}
                {customer.status === 'blacklisted' && (
                  <Badge variant="red">⛔ Kara Liste</Badge>
                )}
                <Badge variant={customer.status === 'active' ? 'green' : customer.status === 'blacklisted' ? 'red' : 'gray'}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${customer.status === 'active' ? 'bg-green-500' : customer.status === 'blacklisted' ? 'bg-status-danger' : 'bg-slate-400'}`} />
                  {customer.status === 'active' ? 'Aktif' : customer.status === 'blacklisted' ? 'Kara Liste' : 'Arşiv'}
                </Badge>
              </div>
            </div>
            {/* Quick contact */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
              {customer.phone && (
                <PhoneContactActions phone={customer.phone} variant="inline" size="sm" />
              )}
              {customer.email && <a href={`mailto:${customer.email}`} className="text-xs text-slate-500 hover:text-emerald-600">✉ {customer.email}</a>}
              {customer.identityNo && (
                <span className="text-xs text-slate-400">
                  TC: {isFieldStaff ? maskTC(customer.identityNo) : customer.identityNo}
                </span>
              )}
              {customer.taxNumber && <span className="text-xs text-slate-400">VKN: {customer.taxNumber}</span>}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-50">
          {[
            { label: 'Hasar Dosyası', value: customer._count?.claimFiles ?? 0 },
            { label: 'Yetkili Kişi', value: contactCount },
            { label: 'Memnuniyet', value: customer.satisfactionScore ? `${customer.satisfactionScore}/5 ★` : '—' },
            { label: 'Kayıt Tarihi', value: fmtDate(customer.createdAt) },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-sm font-bold text-slate-800">{stat.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
        {formatCustomerUpdatedMeta(customer) && (
          <p className="mt-3 text-xs text-slate-500">
            Son Güncelleme: <span className="font-medium text-slate-700">{formatCustomerUpdatedMeta(customer)}</span>
          </p>
        )}

        {/* Tags */}
        {Array.isArray(customer.tags) && customer.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-slate-50">
            {customer.tags.map((t: string) => (
              <Badge key={t} variant="amber">{t}</Badge>
            ))}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm mb-5 overflow-x-auto">
        <div className="flex min-w-max">
          {TABS.map((tab) => (
            <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-600 bg-emerald-50/30'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              <span>{tab.icon}</span>
              {tab.label}
              {tab.id === 'dosyalar' && (customer._count?.claimFiles ?? 0) > 0 && (
                <span className="ml-1 bg-emerald-100 text-emerald-700 text-xs rounded-full px-1.5 py-0.5 font-semibold">
                  {customer._count?.claimFiles}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'profil' && <CustomerProfilTab customer={customer} isFieldStaff={isFieldStaff} onReload={load} onEdit={() => router.push(`/panel/musteriler?edit=${id}`)} />}
      {activeTab === 'yetkili' && <YetkiliIletisimTab customer={customer} />}
      {activeTab === 'dosyalar' && <CustomerDosyalarTab customerId={id!} />}
      {activeTab === 'evraklar' && (
        <EntityDocumentsTab
          mode="entity"
          entityType="customer"
          entityId={id!}
          customerSubType={customer.subType}
          title="Müşteri Evrakları"
        />
      )}
      {activeTab === 'analiz' && <CustomerAnalizTab customerId={id!} />}

      {/* Arşivle Onay Modalı */}
      {archiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Müşteriyi Arşivle</h3>
            <p className="text-xs text-slate-500 mb-5">
              <span className="font-medium text-slate-700">{displayName}</span> arşive alınacak. Açık dosya veya aktif portal bağlantısı varsa işlem reddedilir. Emin misiniz?
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setArchiveConfirm(false)} disabled={archiveLoading}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">İptal</button>
              <button type="button" onClick={handleArchive} disabled={archiveLoading}
                className="px-4 py-2 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50">
                {archiveLoading ? 'Arşivleniyor...' : 'Arşivle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
