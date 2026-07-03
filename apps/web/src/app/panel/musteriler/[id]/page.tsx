'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { EntityDocumentsTab } from '@/components/EntityDocumentsTab';
import { PhoneContactActions } from '@/components/ui/PhoneContactActions';
import { LocationPickerModal, LocationPreview, type LatLng } from '@/components/LocationPickerModal';
import { NeighborhoodSelect } from '@/components/ui/NeighborhoodSelect';
import { ADDRESS_FIELD } from '@/constants/address-fields';
import { provinces as STATIC_PROVINCES, districts as STATIC_DISTRICTS } from '@/data/turkey-locations';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { geocodeAddressCascade } from '@/utils/geocode-address';
import { customerSubTypeLabel, CUSTOMER_RELATION_SECTION_TITLE } from '@/utils/customer-form-helpers';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }
function fmtDate(d: string | null | undefined) { return d ? new Date(d).toLocaleDateString('tr-TR') : '—'; }

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

  // Quick note state
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const existingNotes = customer.notes ? customer.notes + '\n\n' : '';
      await axios.patch(`${API}/customers/${customer.id}`, {
        notes: existingNotes + `[${new Date().toLocaleDateString('tr-TR')}] ${noteText.trim()}`,
      }, { headers: authHeader() });
      setNoteText('');
      setNoteSuccess(true);
      setTimeout(() => setNoteSuccess(false), 2500);
      onReload();
    } catch (e) { console.error(e); } finally { setSavingNote(false); }
  };

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
          <div className="mt-4 pt-4 border-t border-slate-50">
            <Link
              href="/panel/crm"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-lg border border-emerald-100 transition-colors"
            >
              CRM modülünde takip ve not geçmişi
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </SectionCard>

        {/* İstatistik */}
        <SectionCard title="Dosya İstatistikleri">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Toplam Dosya', value: customer._count?.claimFiles ?? 0, color: 'text-emerald-600' },
              { label: 'Durum', value: (
                <Badge variant={customer.status === 'active' ? 'green' : customer.status === 'blacklisted' ? 'red' : 'gray'}>
                  {customer.status === 'active' ? '● Aktif' : customer.status === 'blacklisted' ? '⛔ Kara Liste' : '● Pasif'}
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

      {/* Notlar + Not Ekle */}
      <SectionCard title="Notlar" action={
        <span className="text-xs text-slate-400">Hızlı not ekle</span>
      }>
        {customer.notes ? (
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed mb-4">{customer.notes}</p>
        ) : (
          <p className="text-sm text-slate-400 mb-4">Henüz not eklenmemiş.</p>
        )}
        <div className="border-t border-slate-50 pt-4">
          <div className="flex gap-2 items-end">
            <textarea
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
              rows={2}
              placeholder="Not ekle..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <button
              type="button"
              onClick={handleAddNote}
              disabled={savingNote || !noteText.trim()}
              className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {savingNote ? 'Ekleniyor...' : 'Not Ekle'}
            </button>
          </div>
          {noteSuccess && (
            <p className="text-xs text-green-600 mt-1.5">Not başarıyla eklendi.</p>
          )}
        </div>
      </SectionCard>

      {/* Hizmet Türü & Branşlar: sigortalı (insured/private_customer) ve kurumsal müşterilerde gizli */}
      {!(customer.subType === 'insured' || customer.subType === 'private_customer' || isCorporate) &&
       (customer.serviceType || (Array.isArray(customer.serviceBranches) && customer.serviceBranches.length > 0)) && (
        <SectionCard title="Hizmet Türü & Branşlar">
          <div className="flex flex-wrap gap-2">
            {customer.serviceType && (
              <span className={`inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full border ${
                customer.serviceType === 'HASAR'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}>
                {customer.serviceType === 'HASAR' ? 'Hasar' : 'Acil Yardım'}
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
  const [rejectionReasonFileId, setRejectionReasonFileId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    axios.get(`${API}/claim-files?customerId=${customerId}&limit=50`, { headers: authHeader() })
      .then((r) => setFiles(r.data.data || [])).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [customerId]);

  const handleApprove = async (fileId: string) => {
    setActionLoading(fileId + '-approve');
    try {
      await axios.patch(`${API}/claim-files/${fileId}`, { approvalStatus: 'approved' }, { headers: authHeader() });
      load();
    } catch (e) { console.error(e); } finally { setActionLoading(null); }
  };

  const handleReject = async (fileId: string) => {
    if (!rejectionReason.trim()) return;
    setActionLoading(fileId + '-reject');
    try {
      await axios.patch(`${API}/claim-files/${fileId}`, { approvalStatus: 'rejected', rejectionReason: rejectionReason.trim() }, { headers: authHeader() });
      setRejectionReasonFileId(null);
      setRejectionReason('');
      load();
    } catch (e) { console.error(e); } finally { setActionLoading(null); }
  };

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
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{f.subject ?? '—'} · {f.incidentDate ? new Date(f.incidentDate).toLocaleDateString('tr-TR') : '—'}</p>
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
                    {/* Onayla */}
                    <button
                      type="button"
                      title="Onayla"
                      onClick={() => handleApprove(f.id)}
                      disabled={actionLoading === f.id + '-approve'}
                      className="p-1.5 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    {/* Reddet */}
                    <button
                      type="button"
                      title="Reddet"
                      onClick={() => {
                        setRejectionReasonFileId(rejectionReasonFileId === f.id ? null : f.id);
                        setRejectionReason('');
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                {/* Red Nedeni alanı */}
                {rejectionReasonFileId === f.id && (
                  <div className="px-4 pb-3 border-t border-slate-50 pt-3 bg-red-50/40">
                    <p className="text-xs font-medium text-red-700 mb-1.5">Red Nedeni</p>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 border border-red-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
                        placeholder="Red nedenini girin..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleReject(f.id); }}
                      />
                      <button
                        type="button"
                        onClick={() => handleReject(f.id)}
                        disabled={!rejectionReason.trim() || actionLoading === f.id + '-reject'}
                        className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        Reddet
                      </button>
                    </div>
                  </div>
                )}
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
                { label: 'Konu', value: previewFile.subject },
                { label: 'Durum', value: previewFile.currentStatus?.name ?? previewFile.status },
                { label: 'Hasar Tarihi', value: previewFile.incidentDate ? new Date(previewFile.incidentDate).toLocaleDateString('tr-TR') : null },
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

// ── Edit Modal ─────────────────────────────────────────────────────────────────
function EditCustomerModal({ customer, onClose, onSaved }: { customer: any; onClose: () => void; onSaved: () => void }) {
  const isCorporate = (customer.customerType ?? customer.entityType) === 'corporate';
  const matchedProv = STATIC_PROVINCES.find((p) => p.name === customer.city);
  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';
  const [form, setForm] = useState({
    firstName: customer.firstName ?? '',
    lastName: customer.lastName ?? '',
    companyName: customer.companyName ?? '',
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    cityCode: matchedProv?.code ?? '',
    city: customer.city ?? '',
    district: customer.district ?? '',
    neighborhood: customer.neighborhood ?? '',
    streetName: customer.streetName ?? '',
    buildingNo: customer.buildingNo ?? '',
    doorNo: customer.doorNo ?? '',
    address: customer.address ?? '',
  });
  const currentDistricts = form.cityCode ? (STATIC_DISTRICTS[form.cityCode] ?? []) : [];
  const [locationCoords, setLocationCoords] = useState<LatLng | null>(
    customer.latitude != null && customer.longitude != null
      ? { lat: customer.latitude, lng: customer.longitude }
      : null,
  );
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addressLabel = [
    form.neighborhood,
    form.streetName,
    form.buildingNo ? `No: ${form.buildingNo}` : '',
    form.doorNo ? `D: ${form.doorNo}` : '',
    form.address,
    form.district,
    form.city,
  ].filter(Boolean).join(', ');

  const handleGeocodeAddress = async () => {
    if (!form.city?.trim()) return;
    setGeocoding(true);
    setGeocodeMsg(null);
    try {
      const result = await geocodeAddressCascade({
        city: form.city,
        district: form.district,
        neighborhood: form.neighborhood,
        streetName: form.streetName,
        siteName: form.address,
        buildingNo: form.buildingNo,
      });
      if (result) {
        setLocationCoords({ lat: result.lat, lng: result.lng });
        const shortName = result.displayName.split(',').slice(0, 2).join(',');
        setGeocodeMsg(result.approximate ? `Yaklaşık konum: ${shortName}` : `Konum bulundu: ${shortName}`);
      } else {
        setGeocodeMsg('Konum bulunamadı. Haritadan veya GPS ile belirleyin.');
      }
    } catch {
      setGeocodeMsg('Geocoding başarısız.');
    } finally {
      setGeocoding(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const addressParts = [
        form.neighborhood,
        form.streetName,
        form.buildingNo ? `No: ${form.buildingNo}` : '',
        form.doorNo ? `D: ${form.doorNo}` : '',
      ].filter(Boolean);
      const computedAddress = addressParts.length > 0 ? addressParts.join(' ') : (form.address || null);
      await axios.patch(`${API}/customers/${customer.id}`, {
        firstName: form.firstName,
        lastName: form.lastName,
        companyName: form.companyName,
        phone: form.phone,
        email: form.email,
        city: form.city || null,
        district: form.district || null,
        neighborhood: form.neighborhood || null,
        streetName: form.streetName || null,
        buildingNo: form.buildingNo || null,
        doorNo: form.doorNo || null,
        address: computedAddress,
        latitude: locationCoords?.lat ?? null,
        longitude: locationCoords?.lng ?? null,
      }, { headers: authHeader() });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Kayıt başarısız');
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
            <h3 className="text-sm font-semibold text-slate-800">Müşteri Düzenle</h3>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-5 space-y-3">
            {isCorporate ? (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Şirket Adı</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                  onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, companyName: v })); }} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Ad</label>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                    onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, firstName: v })); }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Soyad</label>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                    onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, lastName: v })); }} />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Telefon</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">E-posta</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{ADDRESS_FIELD.province}</label>
                <select className={inp} value={form.cityCode}
                  onChange={(e) => {
                    const prov = STATIC_PROVINCES.find((p) => p.code === e.target.value);
                    setForm((p) => ({ ...p, cityCode: e.target.value, city: prov?.name ?? '', district: '', neighborhood: '' }));
                  }}>
                  <option value="">{ADDRESS_FIELD.provincePlaceholder}</option>
                  {STATIC_PROVINCES.map((p) => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{ADDRESS_FIELD.district}</label>
                <select className={inp} value={form.district} disabled={!form.cityCode}
                  onChange={(e) => setForm((p) => ({ ...p, district: e.target.value, neighborhood: '' }))}>
                  <option value="">{ADDRESS_FIELD.districtPlaceholder}</option>
                  {currentDistricts.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{ADDRESS_FIELD.neighborhood}</label>
              <NeighborhoodSelect
                provinceName={form.city}
                districtName={form.district}
                value={form.neighborhood}
                onChange={(v) => setForm((p) => ({ ...p, neighborhood: v }))}
                inputClassName={inp}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{ADDRESS_FIELD.street}</label>
              <input className={inp} placeholder={ADDRESS_FIELD.streetPlaceholder}
                value={form.streetName}
                onChange={(e) => setForm((p) => ({ ...p, streetName: e.target.value }))}
                onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, streetName: v })); }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{ADDRESS_FIELD.buildingNo}</label>
                <input className={inp} placeholder={ADDRESS_FIELD.buildingNoPlaceholder}
                  value={form.buildingNo} onChange={(e) => setForm((p) => ({ ...p, buildingNo: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{ADDRESS_FIELD.doorNo}</label>
                <input className={inp} placeholder={ADDRESS_FIELD.doorNoPlaceholder}
                  value={form.doorNo} onChange={(e) => setForm((p) => ({ ...p, doorNo: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{ADDRESS_FIELD.siteName}</label>
              <input className={inp} placeholder={ADDRESS_FIELD.siteNamePlaceholder}
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, address: v })); }} />
            </div>

            <div className="pt-1 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 tracking-wide mb-2">Harita Konumu</p>
              <div className="flex flex-wrap gap-2 mb-2">
                <button
                  type="button"
                  disabled={geocoding || !addressLabel}
                  onClick={handleGeocodeAddress}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {geocoding ? 'Aranıyor...' : 'Konumu Bul'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLocationPicker(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${locationCoords ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                >
                  {locationCoords ? 'Konum Seçildi' : 'Haritadan Konum Seç'}
                </button>
              </div>
              {geocodeMsg && (
                <p className={`text-xs mb-2 px-3 py-2 rounded-lg ${geocodeMsg.startsWith('Konum bulundu') ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {geocodeMsg}
                </p>
              )}
              {locationCoords && (
                <LocationPreview
                  lat={locationCoords.lat}
                  lng={locationCoords.lng}
                  addressLabel={addressLabel || undefined}
                  onEdit={() => setShowLocationPicker(true)}
                  onClear={() => { setLocationCoords(null); setGeocodeMsg(null); }}
                  accentColor="emerald"
                />
              )}
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          </div>
          <div className="px-5 pb-5 flex justify-end gap-2 sticky bottom-0 bg-white border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">İptal</button>
            <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>

      <LocationPickerModal
        open={showLocationPicker}
        initial={locationCoords}
        addressHint={addressLabel || undefined}
        onConfirm={(coords) => { setLocationCoords(coords); setShowLocationPicker(false); setGeocodeMsg(null); }}
        onClose={() => setShowLocationPicker(false)}
      />
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CustomerTab>('profil');
  const [showEditModal, setShowEditModal] = useState(false);
  const [userRoleCode, setUserRoleCode] = useState<string | null>(null);

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
                {/* Fix #6: Düzenle butonu */}
                {!isFieldStaff && (
                  <button
                    type="button"
                    onClick={() => setShowEditModal(true)}
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
                <Badge variant={customer.status === 'active' ? 'green' : 'gray'}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${customer.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`} />
                  {customer.status === 'active' ? 'Aktif' : 'Pasif'}
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
        <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-50">
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
      {activeTab === 'profil' && <CustomerProfilTab customer={customer} isFieldStaff={isFieldStaff} onReload={load} onEdit={() => setShowEditModal(true)} />}
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

      {/* Edit Modal */}
      {showEditModal && (
        <EditCustomerModal customer={customer} onClose={() => setShowEditModal(false)} onSaved={load} />
      )}
    </div>
  );
}
