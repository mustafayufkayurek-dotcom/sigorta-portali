'use client';

import Link from 'next/link';
import type {
  InsurancePortalRealStats,
  InsurancePortalViewMode,
  InsurancePortalVitrinStats,
} from './insurance-portal-map.types';

type InsurancePortalSummaryPanelProps = {
  viewMode: InsurancePortalViewMode;
  realStats: InsurancePortalRealStats;
  vitrinStats: InsurancePortalVitrinStats | null;
  companyLabel?: string;
};

function StatRow({
  label,
  value,
  suffix,
  accent,
  pulse,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  accent?: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className={`text-xl font-bold tabular-nums ${accent ?? 'text-slate-800'}`}>
            {value}
            {suffix ? <span className="text-sm font-semibold ml-0.5">{suffix}</span> : null}
          </p>
          {pulse ? <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> : null}
        </div>
      </div>
    </div>
  );
}

export default function InsurancePortalSummaryPanel({
  viewMode,
  realStats,
  vitrinStats,
  companyLabel,
}: InsurancePortalSummaryPanelProps) {
  const isNetwork = viewMode === 'network';

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-4 w-1 rounded-full bg-blue-600" />
          <h3 className="text-sm font-semibold text-slate-800">
            {isNetwork ? 'Ağ Özeti' : 'Dosya Özeti'}
          </h3>
        </div>
        {companyLabel ? (
          <p className="text-xs text-slate-500 mb-3">{companyLabel}</p>
        ) : null}

        <div className="space-y-2">
          <StatRow
            label="Bekleyen Onaylar"
            value={realStats.pendingApprovals}
            accent={realStats.pendingApprovals > 0 ? 'text-amber-700' : 'text-slate-800'}
            pulse={realStats.pendingApprovals > 0}
          />
          <StatRow label="Toplam Dosya" value={realStats.totalFiles} accent="text-blue-700" />
          <StatRow label="Haritadaki Nokta" value={realStats.mapPinCount} />
        </div>
      </div>

      {isNetwork && vitrinStats ? (
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <h3 className="text-sm font-semibold text-indigo-900">Meridyen Hasar Ağı</h3>
          </div>
          <p className="text-[11px] text-indigo-700/80 mb-3 leading-relaxed">
            Günlük vitrin metrikleri — gerçek dosya sayılarına ek sunum değerleri.
          </p>
          <div className="space-y-2">
            <StatRow label="Ağ Noktası" value={vitrinStats.networkNodes} accent="text-indigo-800" />
            <StatRow label="Aktif Müdahale" value={vitrinStats.activeInterventions} accent="text-indigo-800" />
            <StatRow
              label="Ortalama Yanıt"
              value={vitrinStats.avgResponseMinutes}
              suffix=" Dk"
              accent="text-indigo-800"
            />
            <StatRow
              label="Memnuniyet Oranı"
              value={vitrinStats.satisfactionPct}
              suffix="%"
              accent="text-emerald-700"
            />
            <StatRow label="Bölge Kapsamı" value={vitrinStats.partnerRegions} accent="text-indigo-800" />
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex-1">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Hızlı Erişim</h3>
        <div className="space-y-2">
          <Link
            href="/panel/sigorta-portal/onaylar"
            className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:border-amber-300 hover:bg-amber-50 transition-colors"
          >
            <span>Onaylar</span>
            {realStats.pendingApprovals > 0 ? (
              <span className="rounded-full bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5">
                {realStats.pendingApprovals}
              </span>
            ) : (
              <span className="text-slate-400 text-xs">→</span>
            )}
          </Link>
          <Link
            href="/panel/sigorta-portal/dosyalar"
            className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <span>Dosyalar</span>
            <span className="text-blue-700 text-xs font-semibold">{realStats.totalFiles}</span>
          </Link>
          <Link
            href="/panel/sigorta-portal/faturalar"
            className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:border-purple-300 hover:bg-purple-50 transition-colors"
          >
            <span>Faturalar</span>
            <span className="text-slate-400 text-xs">→</span>
          </Link>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 p-4 shadow-md">
        <p className="text-[10px] font-bold tracking-[0.15em] text-blue-200">Meridyen Assistance</p>
        <p className="text-white text-sm font-semibold mt-1">Türkiye Geneli Hasar Ağı</p>
        <p className="text-blue-100 text-xs mt-2 leading-relaxed">
          Konut, endüstriyel ve deniz hasarlarında sahada ve merkezde koordineli müdahale.
        </p>
      </div>
    </div>
  );
}
