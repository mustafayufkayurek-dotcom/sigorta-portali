'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SlidePanel } from '@/components/SlidePanel';
import { EmergencyCaseNewForm } from '@/components/emergency/EmergencyCaseNewForm';
import { getCases, updateCaseStatus, EmergencyCase, EmergencyStatus } from '@/utils/emergencyApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<EmergencyStatus, { label: string; color: string; badge: string }> = {
  GELEN: { label: 'Yeni İhbar', color: 'bg-slate-50 border-slate-200', badge: 'bg-slate-100 text-slate-700' },
  ATANDI: { label: 'Tespit Aşamasında', color: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  SAHADA: { label: 'Onarım Aşamasında', color: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700' },
  COZULDU: { label: 'Dosya Kapatıldı', color: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700' },
  FATURALANDILDI: { label: 'Finansa Aktarıldı', color: 'bg-purple-50 border-purple-200', badge: 'bg-purple-100 text-purple-700' },
};

const COLUMNS: EmergencyStatus[] = ['GELEN', 'ATANDI', 'SAHADA', 'COZULDU', 'FATURALANDILDI'];

const URGENCY_BADGE: Record<string, string> = {
  DUSUK: 'bg-slate-100 text-slate-600',
  NORMAL: 'bg-blue-50 text-blue-600',
  YUKSEK: 'bg-orange-50 text-orange-600',
  KRITIK: 'bg-red-100 text-red-700',
};

const URGENCY_LABEL: Record<string, string> = {
  DUSUK: 'Düşük',
  NORMAL: 'Normal',
  YUKSEK: 'Yüksek',
  KRITIK: 'Kritik',
};

function OverdueBadge({ level }: { level: string }) {
  if (level === 'none') return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
      level === 'critical' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
    }`}>
      {level === 'critical' ? '15+ gün' : '7+ gün'} faturasız
    </span>
  );
}

function KanbanCard({
  card,
  onMove,
}: {
  card: EmergencyCase;
  onMove: (id: string, from: EmergencyStatus, to: EmergencyStatus) => void;
}) {
  const currentIdx = COLUMNS.indexOf(card.status);
  const nextStatus = currentIdx < COLUMNS.length - 1 ? COLUMNS[currentIdx + 1] : null;

  return (
    <div
      className={`bg-white border rounded-xl p-3 shadow-sm space-y-2 cursor-pointer hover:shadow-md transition-shadow ${
        card.overdueLevel === 'critical' ? 'border-red-300 ring-1 ring-red-200' :
        card.overdueLevel === 'warning' ? 'border-yellow-300' : 'border-slate-100'
      }`}
    >
      <Link href={`/panel/acil-yardim/${card.id}`} className="block">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-mono text-slate-400">{card.caseNo}</p>
            <p className="text-sm font-semibold text-slate-900 truncate">{card.customerName}</p>
          </div>
          <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${URGENCY_BADGE[card.urgency]}`}>
            {URGENCY_LABEL[card.urgency]}
          </span>
        </div>
        <p className="text-xs text-slate-500 truncate">{card.address}</p>
        <p className="text-xs text-blue-600 font-medium">{card.issueType}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {card.totalGelir > 0 && (
              <span className="text-[10px] text-green-700 font-semibold">
                +{card.totalGelir.toLocaleString('tr-TR')} ₺
              </span>
            )}
            {card.totalGider > 0 && (
              <span className="text-[10px] text-red-600 font-semibold">
                -{card.totalGider.toLocaleString('tr-TR')} ₺
              </span>
            )}
          </div>
          <OverdueBadge level={card.overdueLevel} />
        </div>
      </Link>

      {/* Hızlı İlerleme butonu */}
      {nextStatus && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); onMove(card.id, card.status, nextStatus); }}
          className="w-full text-[10px] font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50 py-1 rounded-lg transition-colors border border-slate-100 hover:border-blue-200"
        >
          {STATUS_CONFIG[nextStatus].label} &rarr;
        </button>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AcilYardimPage() {
  return (
    <Suspense fallback={(
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )}
    >
      <AcilYardimPageContent />
    </Suspense>
  );
}

function AcilYardimPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [scopeUserId, setScopeUserId] = useState<string | undefined>(undefined);
  const [showNewPanel, setShowNewPanel] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [createdNotice, setCreatedNotice] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('user') ?? '{}';
      try {
        const u = JSON.parse(raw);
        const rc = (u?.role?.code ?? u?.roleCode ?? '').toLowerCase();
        if (rc === 'office_staff') setScopeUserId(u?.id ?? undefined);
      } catch { /* ignore */ }
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getCases({ search: filterSearch || undefined, assignedUserId: scopeUserId });
      setCases(res.data);
    } catch {
      setError('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [filterSearch, scopeUserId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get('yeni') !== '1') return;
    setFormSession((s) => s + 1);
    setShowNewPanel(true);
    router.replace('/panel/acil-yardim', { scroll: false });
  }, [searchParams, router]);

  // Debounce arama
  useEffect(() => {
    const t = setTimeout(() => setFilterSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  async function handleMove(id: string, _from: EmergencyStatus, to: EmergencyStatus) {
    setCases((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: to, ...(to === 'COZULDU' ? { resolvedAt: new Date().toISOString() } : {}) } : c,
      ),
    );
    try {
      await updateCaseStatus(id, to);
    } catch {
      load(); // geri al
    }
  }

  const grouped = COLUMNS.reduce<Record<EmergencyStatus, EmergencyCase[]>>(
    (acc, col) => {
      acc[col] = cases.filter((c) => c.status === col);
      return acc;
    },
    {} as Record<EmergencyStatus, EmergencyCase[]>,
  );

  // Üst istatistik
  const overdueCount = cases.filter((c) => c.overdueLevel !== 'none').length;

  function openNewPanel() {
    setFormSession((s) => s + 1);
    setShowNewPanel(true);
  }

  function handleCreateSuccess(_caseId: string) {
    setShowNewPanel(false);
    void load();
    setCreatedNotice('Dosya oluşturuldu');
    setTimeout(() => setCreatedNotice(''), 3000);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/panel')}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title="Dashboard'a dön"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="page-header-icon">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="page-title">Acil Yardım Operasyon Merkezi</h1>
            <p className="page-subtitle">{cases.length} aktif acil yardım dosyası</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <Link
              href="/panel/acil-yardim/finans?invoiceStatus=overdue"
              className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 text-xs font-semibold rounded-xl border border-red-200 hover:bg-red-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {overdueCount} Gecikmiş Fatura
            </Link>
          )}
          <Link href="/panel/acil-yardim/finans" className="btn-secondary text-xs">
            Finans
          </Link>
          {createdNotice && (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
              {createdNotice}
            </span>
          )}
          <button type="button" onClick={openNewPanel} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Yeni Dosya
          </button>
        </div>
      </div>

      <SlidePanel
        open={showNewPanel}
        onClose={() => setShowNewPanel(false)}
        title="Yeni Acil Yardım Dosyası"
        width={600}
        scrollContent={false}
      >
        <EmergencyCaseNewForm
          key={formSession}
          variant="panel"
          onCancel={() => setShowNewPanel(false)}
          onSuccess={handleCreateSuccess}
        />
      </SlidePanel>

      {/* Arama */}
      <div className="relative max-w-xs">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Müşteri, adres, dosya no..."
          className="input-base-sm pl-9"
        />
      </div>

      {/* Kanban */}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-start">
          {COLUMNS.map((col) => {
            const cfg = STATUS_CONFIG[col];
            const cards = grouped[col];
            return (
              <div key={col} className={`rounded-2xl border p-3 space-y-2 ${cfg.color}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-700">{cfg.label}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                    {cards.length}
                  </span>
                </div>
                {cards.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">Dosya yok</div>
                ) : (
                  cards.map((card) => (
                    <KanbanCard key={card.id} card={card} onMove={handleMove} />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
