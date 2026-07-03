'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  repairReportStatusBadge,
  repairReportStatusLabel,
} from '@/utils/repair-report-status';
import { SectionCard } from '../claim-detail-ui';
import { API, authHeader } from '../claim-detail-utils';

const DAMAGE_CODES = [
  'Dahili Su', 'Yangın', 'Deprem', 'Sel-Seylap', 'Fırtına',
  'Heyelan', 'İnfilak', 'Taşıt Çarpması', 'Gemi-Tekne', 'İnşaat', 'Cam Kırılması',
];

type WizardStep = 'department' | 'type' | 'config';
type DeptOption = { id: string; code: string; name: string; color: string; reportFormat: string };
type StatusFilter = 'all' | 'pending' | 'draft' | 'approved' | 'rejected';

type RepairReportListItem = {
  id: string;
  reportNo: string;
  status: string;
  reportType: string;
  reportDate?: string;
  createdAt: string;
  versionNo?: number;
  originalReportId?: string | null;
  revisionCount?: number;
  revisedAt?: string | null;
  _count?: { items: number; images: number };
};

type ReportChain = {
  rootId: string;
  latest: RepairReportListItem;
  older: RepairReportListItem[];
  allVersions: RepairReportListItem[];
};

const REPORT_TYPE_LABEL: Record<string, string> = {
  single: 'Tek Hasarlı',
  multi: 'Çok Hasarlı',
  emergency: 'Acil Yardım',
};

const REPORT_TYPE_SHORT: Record<string, string> = {
  single: 'TH',
  multi: 'ÇH',
  emergency: 'AY',
};

const REPORT_TYPE_STYLE: Record<string, string> = {
  single: 'bg-blue-50 text-blue-600',
  multi: 'bg-indigo-50 text-indigo-600',
  emergency: 'bg-red-50 text-red-600',
};

function isPendingStatus(status: string) {
  return ['submitted', 'pending_approval', 'sent_for_external_approval'].includes(status);
}

function isApprovedStatus(status: string) {
  return ['approved', 'externally_approved'].includes(status);
}

function isRejectedStatus(status: string) {
  return ['rejected', 'externally_rejected'].includes(status);
}

function getRootId(report: RepairReportListItem): string {
  return report.originalReportId ?? report.id;
}

function matchesStatusFilter(status: string, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'pending') return isPendingStatus(status);
  if (filter === 'draft') return status === 'draft';
  if (filter === 'approved') return isApprovedStatus(status);
  if (filter === 'rejected') return isRejectedStatus(status);
  return true;
}

function chainMatchesFilter(chain: ReportChain, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  return chain.allVersions.some((v) => matchesStatusFilter(v.status, filter));
}

function groupReportsIntoChains(reports: RepairReportListItem[]): ReportChain[] {
  const byRoot = new Map<string, RepairReportListItem[]>();
  for (const report of reports) {
    const rootId = getRootId(report);
    const list = byRoot.get(rootId) ?? [];
    list.push(report);
    byRoot.set(rootId, list);
  }

  return Array.from(byRoot.entries())
    .map(([rootId, versions]) => {
      const sorted = [...versions].sort(
        (a, b) => (b.versionNo ?? 1) - (a.versionNo ?? 1),
      );
      return {
        rootId,
        latest: sorted[0],
        older: sorted.slice(1),
        allVersions: sorted,
      };
    })
    .sort((a, b) => {
      const dateA = new Date(a.latest.reportDate ?? a.latest.createdAt).getTime();
      const dateB = new Date(b.latest.reportDate ?? b.latest.createdAt).getTime();
      return dateB - dateA;
    });
}

function formatReportDate(report: RepairReportListItem): string {
  return new Date(report.reportDate ?? report.createdAt).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ReportChainRow({
  chain,
  claimId,
}: {
  chain: ReportChain;
  claimId: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const report = chain.latest;
  const needsAction = isPendingStatus(report.status) || report.status === 'draft';
  const showVersionBadge = (report.versionNo ?? 1) > 1 || (report.revisionCount ?? 0) > 0;

  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${REPORT_TYPE_STYLE[report.reportType] ?? 'bg-slate-50 text-slate-600'}`}
          >
            {REPORT_TYPE_SHORT[report.reportType] ?? 'R'}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-slate-800 text-sm">{report.reportNo}</p>
              {showVersionBadge && (
                <span className="text-[10px] font-medium text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                  v{report.versionNo ?? 1}
                </span>
              )}
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${repairReportStatusBadge(report.status)}`}
              >
                {repairReportStatusLabel(report.status)}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {REPORT_TYPE_LABEL[report.reportType] ?? report.reportType}
              {' · '}
              {formatReportDate(report)}
              {report.revisedAt && (
                <>
                  {' · '}
                  <span className="text-purple-600">
                    Revize Edildi{' '}
                    {new Date(report.revisedAt).toLocaleDateString('tr-TR')}
                  </span>
                </>
              )}
              {report._count && ` · ${report._count.items} kalem · ${report._count.images} fotoğraf`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {needsAction && (
            <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
              İşlem Gerekli
            </span>
          )}
          <button
            type="button"
            onClick={() =>
              router.push(`/panel/hasar-dosyalari/${claimId}/onarim-raporu/${report.id}`)
            }
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium"
          >
            Rapora Git
          </button>
        </div>
      </div>

      {chain.older.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full px-4 py-2 text-left text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {expanded ? 'Önceki Versiyonları Gizle' : `Önceki Versiyonlar (${chain.older.length})`}
          </button>
          {expanded && (
            <div className="px-4 pb-3 space-y-1.5">
              {chain.older.map((v) => (
                <div
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                      v{v.versionNo ?? 1}
                    </span>
                    <span className="text-sm text-slate-700">{v.reportNo}</span>
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${repairReportStatusBadge(v.status)}`}
                    >
                      {repairReportStatusLabel(v.status)}
                    </span>
                    <span className="text-xs text-slate-400">{formatReportDate(v)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/panel/hasar-dosyalari/${claimId}/onarim-raporu/${v.id}`)
                    }
                    className="text-xs text-purple-600 hover:underline shrink-0"
                  >
                    Aç
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function YeniRaporWizard({
  claimId,
  onCreated,
  onClose,
}: {
  claimId: string;
  onCreated: (reportId: string) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<WizardStep>('department');
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [selectedDept, setSelectedDept] = useState<DeptOption | null>(null);
  const [reportType, setReportType] = useState<'single' | 'multi' | 'emergency' | null>(null);
  const [singleDamageCode, setSingleDamageCode] = useState('');
  const [multiDamageCodes, setMultiDamageCodes] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${API}/departments`, { headers: authHeader() })
      .then((r) => setDepartments(r.data.data ?? []))
      .catch(console.error);
  }, []);

  const toggleMultiCode = (code: string) => {
    setMultiDamageCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const handleDeptSelect = (dept: DeptOption) => {
    setSelectedDept(dept);
    setReportType(null);
    setSingleDamageCode('');
    setMultiDamageCodes([]);
  };

  const proceedFromDept = () => {
    if (!selectedDept) return;
    if (selectedDept.reportFormat === 'emergency') {
      setReportType('emergency');
      setStep('config');
    } else {
      setStep('type');
    }
  };

  const canProceed = () => {
    if (step === 'department') return selectedDept !== null;
    if (step === 'type') return reportType !== null;
    if (reportType === 'emergency') return true;
    if (reportType === 'single') return singleDamageCode !== '';
    if (reportType === 'multi') return multiDamageCodes.length >= 2;
    return false;
  };

  const handleCreate = async () => {
    if (!reportType || !selectedDept) return;
    setCreating(true);
    setError('');
    try {
      const res = await axios.post(
        `${API}/claim-files/${claimId}/repair-reports`,
        {
          reportType,
          reportDate: new Date().toISOString(),
          departmentId: selectedDept.id,
        },
        { headers: authHeader() },
      );
      const created = res.data.data;
      if (!created?.id) throw new Error('Rapor oluşturulamadı');

      if (reportType === 'single' && singleDamageCode) {
        await axios.post(
          `${API}/repair-reports/${created.id}/damage-types`,
          { damageTypeCode: singleDamageCode, damageTypeName: singleDamageCode, sortOrder: 0 },
          { headers: authHeader() },
        );
      } else if (reportType === 'multi') {
        await Promise.all(
          multiDamageCodes.map((code, idx) =>
            axios.post(
              `${API}/repair-reports/${created.id}/damage-types`,
              { damageTypeCode: code, damageTypeName: code, sortOrder: idx },
              { headers: authHeader() },
            ),
          ),
        );
      }
      onCreated(created.id);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Hata oluştu');
    } finally {
      setCreating(false);
    }
  };

  if (step === 'department') {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Adım 1</span>
            <h3 className="text-base font-semibold text-slate-800">Departman Seçin</h3>
          </div>
          <p className="text-sm text-slate-500 mb-5">Hangi departman için rapor oluşturuyorsunuz?</p>

          {departments.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <p>Henüz departman tanımlanmamış.</p>
              <a href="/panel/ayarlar/departmanlar" className="text-blue-600 hover:underline mt-1 block">Departman oluşturmak için tıklayın</a>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {departments.filter((d) => d.reportFormat === 'repair').map((d) => (
                <button type="button"
                  key={d.id}
                  onClick={() => handleDeptSelect(d)}
                  className={`border-2 rounded-xl p-4 text-left transition-all ${
                    selectedDept?.id === d.id
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg mb-2.5 flex items-center justify-center text-white text-xs font-bold" style={{ background: d.color }}>
                    {d.name.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="font-semibold text-slate-800 text-sm">{d.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Hasar onarım raporu</p>
                </button>
              ))}
              {departments.filter((d) => d.reportFormat === 'emergency').map((d) => (
                <button type="button"
                  key={d.id}
                  onClick={() => handleDeptSelect(d)}
                  className={`border-2 rounded-xl p-4 text-left transition-all ${
                    selectedDept?.id === d.id
                      ? 'border-red-500 bg-red-50 ring-2 ring-red-200'
                      : 'border-slate-200 hover:border-red-300 hover:bg-red-50/40'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg mb-2.5 flex items-center justify-center text-white text-xs font-bold" style={{ background: d.color }}>
                    {d.name.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="font-semibold text-slate-800 text-sm">{d.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Acil yardım raporu</p>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-5">
            <button type="button"
              onClick={proceedFromDept}
              disabled={!selectedDept}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Devam
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
              İptal
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'type') {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Adım 2/3</span>
            <h3 className="text-base font-semibold text-slate-800">Rapor Türü Seçin</h3>
            <button type="button" onClick={() => setStep('department')} className="ml-auto text-xs text-slate-400 hover:text-slate-600">Geri</button>
          </div>
          <p className="text-sm text-slate-500 mb-5">Hasar dosyasının yapısına uygun türü seçin.</p>

          <div className="grid grid-cols-2 gap-4">
            <button type="button"
              onClick={() => setReportType('single')}
              className={`border-2 rounded-xl p-5 text-left transition-all ${
                reportType === 'single'
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm mb-3">TH</div>
              <p className="font-semibold text-slate-800 text-sm mb-1">Tek Hasarlı</p>
              <p className="text-xs text-slate-500">Tek hasar nedeni, hızlı giriş</p>
            </button>

            <button type="button"
              onClick={() => setReportType('multi')}
              className={`border-2 rounded-xl p-5 text-left transition-all ${
                reportType === 'multi'
                  ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                  : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm mb-3">ÇH</div>
              <p className="font-semibold text-slate-800 text-sm mb-1">Çok Hasarlı</p>
              <p className="text-xs text-slate-500">2+ hasar nedeni, kalem bazlı</p>
            </button>
          </div>

          <div className="flex gap-2 mt-5">
            <button type="button"
              onClick={() => { if (reportType) setStep('config'); }}
              disabled={!reportType}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Devam
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
              İptal
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isEmergency = reportType === 'emergency';
  const stepLabel = isEmergency ? 'Adım 2/2' : 'Adım 3/3';
  const stepTitle = isEmergency ? 'Acil Yardım Raporu Bilgileri' : (reportType === 'single' ? 'Hasar Nedeni & Bilgiler' : 'Hasar Nedenleri Seçin');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{stepLabel}</span>
          <h3 className="text-base font-semibold text-slate-800">{stepTitle}</h3>
          <button type="button" onClick={() => isEmergency ? setStep('department') : setStep('type')} className="ml-auto text-xs text-slate-400 hover:text-slate-600">Geri</button>
        </div>

        {isEmergency ? (
          <div className="space-y-4 mt-4">
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
              Acil yardım raporu — hızlı giriş formatı
            </div>
            <p className="text-xs text-slate-500">Eksper ofisi ve raporlayan bilgileri otomatik atanacak.</p>
          </div>
        ) : reportType === 'single' ? (
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-2">Hasar Nedeni *</label>
              <div className="grid grid-cols-2 gap-2">
                {DAMAGE_CODES.map((code) => (
                  <button type="button"
                    key={code}
                    onClick={() => setSingleDamageCode(code)}
                    className={`text-left px-3 py-2 rounded-lg text-xs border transition-all ${
                      singleDamageCode === code
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50/50'
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Hasar nedenlerini seçin{' '}
                <span className="text-slate-400 font-normal">(en az 2)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {DAMAGE_CODES.map((code) => {
                  const selected = multiDamageCodes.includes(code);
                  return (
                    <button type="button"
                      key={code}
                      onClick={() => toggleMultiCode(code)}
                      className={`text-left px-3 py-2 rounded-lg text-xs border flex items-center gap-2 transition-all ${
                        selected
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold'
                          : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 text-xs ${selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                        {selected ? '✓' : ''}
                      </span>
                      {code}
                    </button>
                  );
                })}
              </div>
              {multiDamageCodes.length > 0 && (
                <p className="text-xs text-indigo-600 mt-2 font-medium">
                  {multiDamageCodes.length} hasar nedeni seçildi
                </p>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button type="button"
            onClick={handleCreate}
            disabled={creating || !canProceed()}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creating ? 'Oluşturuluyor...' : 'Raporu Oluştur'}
          </button>
          <button type="button" onClick={onClose} className="flex-1 border border-slate-200 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
            İptal
          </button>
        </div>
      </div>
    </div>
  );
}

export function OnarimRaporuTab({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [reports, setReports] = useState<RepairReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/claim-files/${claimId}/repair-reports`, { headers: authHeader() });
      setReports(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const handleCreated = (reportId: string) => {
    setShowWizard(false);
    router.push(`/panel/hasar-dosyalari/${claimId}/onarim-raporu/${reportId}`);
  };

  const chains = useMemo(() => groupReportsIntoChains(reports), [reports]);

  const counts = useMemo(() => ({
    total: chains.length,
    pending: chains.filter((c) => c.allVersions.some((v) => isPendingStatus(v.status))).length,
    draft: chains.filter((c) => c.allVersions.some((v) => v.status === 'draft')).length,
    approved: chains.filter((c) => c.allVersions.some((v) => isApprovedStatus(v.status))).length,
    rejected: chains.filter((c) => c.allVersions.some((v) => isRejectedStatus(v.status))).length,
  }), [chains]);

  const filteredChains = useMemo(
    () => chains.filter((c) => chainMatchesFilter(c, statusFilter)),
    [chains, statusFilter],
  );

  const filterTabs: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: `Tümü (${counts.total})` },
    { id: 'pending', label: `Onay Bekleyen (${counts.pending})` },
    { id: 'draft', label: `Taslak (${counts.draft})` },
    { id: 'approved', label: `Onaylı (${counts.approved})` },
    { id: 'rejected', label: `Reddedilen (${counts.rejected})` },
  ];

  if (loading) return <div className="text-slate-400 py-8 text-center">Yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <SectionCard title="Onarım Raporları">
        {reports.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl">
            <p className="text-sm text-slate-500 mb-1">Henüz onarım raporu oluşturulmamış.</p>
            <p className="text-xs text-slate-400 mb-5">
              Bu dosya için departman ve hasar türü seçerek ilk raporu oluşturabilirsiniz.
            </p>
            <button
              type="button"
              onClick={() => setShowWizard(true)}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Yeni Rapor Oluştur
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 -mt-1">
              <div className="flex flex-wrap gap-1.5">
                {filterTabs.map((tab) => (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      statusFilter === tab.id
                        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowWizard(true)}
                className="shrink-0 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Yeni Rapor
              </button>
            </div>

            {!filteredChains.length ? (
              <div className="text-slate-400 py-10 text-center border border-dashed border-slate-200 rounded-xl">
                Bu durumda rapor bulunmuyor.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredChains.map((chain) => (
                  <ReportChainRow key={chain.rootId} chain={chain} claimId={claimId} />
                ))}
              </div>
            )}
          </>
        )}
      </SectionCard>

      {showWizard && (
        <YeniRaporWizard claimId={claimId} onCreated={handleCreated} onClose={() => setShowWizard(false)} />
      )}
    </div>
  );
}
