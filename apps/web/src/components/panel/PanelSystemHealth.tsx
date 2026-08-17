'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  HardDrive,
  Mail,
  Server,
  Wrench,
  Workflow,
  Cpu,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type HealthStatus = 'active' | 'degraded' | 'maintenance' | 'unknown';
type ServiceTone = 'up' | 'down' | 'degraded' | 'unknown';

type ServiceCheck = {
  status?: string;
  error?: string;
  healthy?: boolean;
  enabled?: boolean;
};

type HealthPayload = {
  status?: string;
  ok?: boolean;
  maintenanceMode?: boolean;
  uptime?: number;
  timestamp?: string;
  version?: string;
  services?: {
    database?: ServiceCheck;
    redis?: ServiceCheck;
    cache?: ServiceCheck;
    mail?: ServiceCheck;
    queue?: ServiceCheck;
    storage?: ServiceCheck;
    worker?: ServiceCheck;
  };
};

function resolveStatus(data: HealthPayload | null, error: boolean): HealthStatus {
  if (error || !data) return 'degraded';
  if (data.maintenanceMode) return 'maintenance';
  const s = String(data.status ?? '').toLowerCase();
  if (s === 'ok' || s === 'healthy' || data.ok === true) return 'active';
  if (s === 'degraded' || s === 'warn') return 'degraded';
  if (s === 'maintenance') return 'maintenance';
  return 'active';
}

function serviceTone(check: ServiceCheck | undefined, fallback: ServiceTone = 'unknown'): ServiceTone {
  if (!check) return fallback;
  if (typeof check.healthy === 'boolean') {
    if (check.enabled === false) return 'unknown';
    return check.healthy ? 'up' : 'down';
  }
  const s = String(check.status ?? '').toLowerCase();
  if (s === 'up' || s === 'ok' || s === 'healthy' || s === 'active') return 'up';
  if (s === 'degraded' || s === 'warn') return 'degraded';
  if (s === 'down' || s === 'error' || s === 'fail') return 'down';
  return fallback;
}

function toneFromOverall(status: HealthStatus): ServiceTone {
  if (status === 'active') return 'up';
  if (status === 'maintenance') return 'degraded';
  if (status === 'degraded') return 'down';
  return 'unknown';
}

const STATUS_UI: Record<
  HealthStatus,
  { label: string; dot: string; border: string; bg: string; text: string; Icon: typeof CheckCircle2 }
> = {
  active: {
    label: 'Operasyon Aktif',
    dot: 'bg-status-success',
    border: 'border-emerald-200 dark:border-emerald-800',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    Icon: CheckCircle2,
  },
  degraded: {
    label: 'Bozulmuş',
    dot: 'bg-status-warning',
    border: 'border-amber-200 dark:border-amber-800',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-800 dark:text-amber-300',
    Icon: AlertTriangle,
  },
  maintenance: {
    label: 'Bakım',
    dot: 'bg-slate-500',
    border: 'border-slate-300 dark:border-slate-600',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-200',
    Icon: Wrench,
  },
  unknown: {
    label: 'Kontrol',
    dot: 'bg-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
    bg: 'bg-slate-50 dark:bg-slate-900',
    text: 'text-slate-600 dark:text-slate-300',
    Icon: Activity,
  },
};

const TONE_LABEL: Record<ServiceTone, string> = {
  up: 'Aktif',
  down: 'Kapalı',
  degraded: 'Zayıf',
  unknown: 'Bilinmiyor',
};

const TONE_CLASS: Record<ServiceTone, string> = {
  up: 'text-emerald-700 dark:text-emerald-300',
  down: 'text-red-600 dark:text-red-400',
  degraded: 'text-amber-700 dark:text-amber-300',
  unknown: 'text-slate-400',
};

const TONE_DOT: Record<ServiceTone, string> = {
  up: 'bg-status-success',
  down: 'bg-status-danger',
  degraded: 'bg-status-warning',
  unknown: 'bg-slate-300',
};

type ServiceRow = {
  key: string;
  label: string;
  tone: ServiceTone;
  Icon: typeof Server;
};

/** Topbar Sistem Sağlık — Operasyon Aktif tıklanınca popover */
export function PanelSystemHealth() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<HealthStatus>('unknown');
  const [payload, setPayload] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<HealthPayload>('/health');
      setPayload(data);
      setStatus(resolveStatus(data, false));
      setLastChecked(new Date());
    } catch {
      setPayload(null);
      setStatus('degraded');
      setLastChecked(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchHealth();
    const id = window.setInterval(() => void fetchHealth(), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const ui = STATUS_UI[status];
  const Icon = ui.Icon;
  const overall = toneFromOverall(status);
  const services = payload?.services;

  const rows: ServiceRow[] = [
    {
      key: 'api',
      label: 'API',
      tone: overall,
      Icon: Server,
    },
    {
      key: 'database',
      label: 'Database',
      tone: serviceTone(services?.database, overall),
      Icon: Database,
    },
    {
      key: 'mail',
      label: 'Mail',
      tone: serviceTone(services?.mail, 'unknown'),
      Icon: Mail,
    },
    {
      key: 'queue',
      label: 'Queue',
      tone: serviceTone(services?.queue ?? services?.redis, overall),
      Icon: Workflow,
    },
    {
      key: 'storage',
      label: 'Storage',
      tone: serviceTone(services?.storage ?? services?.cache, overall === 'up' ? 'up' : 'unknown'),
      Icon: HardDrive,
    },
    {
      key: 'worker',
      label: 'Worker',
      tone: serviceTone(services?.worker ?? services?.redis, overall),
      Icon: Cpu,
    },
  ];

  return (
    <div className="relative hidden xl:block" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void fetchHealth();
        }}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${ui.border} ${ui.bg} ${ui.text}`}
        title="Sistem Sağlık Paneli"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${ui.dot}`} aria-hidden="true" />
        {ui.label}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Sistem Sağlık"
          className="absolute right-0 top-full z-50 mt-2 w-[22rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <Icon className={`h-4 w-4 ${ui.text}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sistem Sağlık</p>
              <p className={`text-xs font-medium ${ui.text}`}>{ui.label}</p>
            </div>
            {loading ? (
              <span className="text-[10px] text-slate-400">Yenileniyor…</span>
            ) : null}
          </div>

          <ul className="divide-y divide-slate-100 px-1 py-1 dark:divide-slate-800">
            {rows.map((row) => {
              const RowIcon = row.Icon;
              return (
                <li key={row.key} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <RowIcon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    {row.label}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 font-medium ${TONE_CLASS[row.tone]}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[row.tone]}`} aria-hidden="true" />
                    {TONE_LABEL[row.tone]}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
            <span className="text-[10px] text-slate-400">
              Son:{' '}
              {lastChecked
                ? lastChecked.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                : '—'}
              {payload?.uptime != null
                ? ` · ${Math.floor(payload.uptime / 3600)}s ${Math.floor((payload.uptime % 3600) / 60)}dk`
                : ''}
            </span>
            <button
              type="button"
              onClick={() => void fetchHealth()}
              className="text-xs font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Yenile
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
