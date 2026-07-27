'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { getCases, type EmergencyCase } from '@/utils/emergencyApi';
import { API, authHeader } from '@/utils/api';
import { getAccessToken } from '@/utils/auth-session';
import { toTitleCaseTR } from '@/utils/text-helpers';

export interface LinkPickerHasarFile {
  id: string;
  fileNo: string;
  claimNo: string | null;
  description: string;
  lossType?: string | null;
  statusName?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  preferredTab?: 'hasar' | 'acil';
  initialSearch?: string;
  onSelectClaim: (file: LinkPickerHasarFile) => void;
  onSelectEmergency: (file: EmergencyCase) => void;
}

type TabId = 'hasar' | 'acil';

export function InboxLinkFilePickerModal({
  open,
  onClose,
  preferredTab = 'hasar',
  initialSearch = '',
  onSelectClaim,
  onSelectEmergency,
}: Props) {
  const [tab, setTab] = useState<TabId>(preferredTab);
  const [search, setSearch] = useState('');
  const [hasarRows, setHasarRows] = useState<LinkPickerHasarFile[]>([]);
  const [hasarLoading, setHasarLoading] = useState(false);
  const [acilRows, setAcilRows] = useState<EmergencyCase[]>([]);
  const [acilLoading, setAcilLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadHasar = useCallback(async (q: string) => {
    if (!getAccessToken()) return;
    setHasarLoading(true);
    try {
      const res = await axios.get(`${API}/expenses/browse-files`, {
        headers: authHeader(),
        params: { search: q.trim() || undefined, page: 1, limit: 20, segment: 'hasar' },
      });
      setHasarRows((res.data?.data ?? []) as LinkPickerHasarFile[]);
    } catch {
      setHasarRows([]);
    } finally {
      setHasarLoading(false);
    }
  }, []);

  const loadAcil = useCallback(async (q: string) => {
    setAcilLoading(true);
    try {
      const res = await getCases({ search: q.trim() || undefined });
      setAcilRows(res.data);
    } catch {
      setAcilRows([]);
    } finally {
      setAcilLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setTab(preferredTab);
    setSearch(initialSearch);
    setTimeout(() => searchInputRef.current?.focus(), 80);
  }, [open, preferredTab, initialSearch]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      if (tab === 'hasar') void loadHasar(search);
      else void loadAcil(search);
    }, 260);
    return () => clearTimeout(timer);
  }, [open, tab, search, loadHasar, loadAcil]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Dosyaya Bağla</h3>
            <p className="mt-1 text-xs text-slate-500">
              Gelen e-postayı mevcut hasar veya acil yardım dosyasına bağlayın.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl font-light leading-none text-slate-400 hover:text-slate-600"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-100 px-5 pt-3">
          {([
            { id: 'hasar' as const, label: 'Hasar Dosyası' },
            { id: 'acil' as const, label: 'Acil Yardım' },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border border-b-0 border-slate-200 bg-white text-blue-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="border-b border-slate-50 px-5 py-3">
          <input
            ref={searchInputRef}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder={tab === 'hasar' ? 'Dosya no, hasar no veya sigortalı adı…' : 'Dosya no veya müşteri adı…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'hasar' && (
            hasarLoading ? (
              <p className="py-12 text-center text-sm text-slate-400">Yükleniyor…</p>
            ) : hasarRows.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">Eşleşen hasar dosyası bulunamadı.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-[11px] font-medium text-slate-500">
                    <th className="px-4 py-2.5 font-semibold">Dosya No</th>
                    <th className="px-4 py-2.5 font-semibold">Sigortalı</th>
                    <th className="px-4 py-2.5 font-semibold w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hasarRows.map((row) => (
                    <tr key={row.id} className="hover:bg-blue-50/70">
                      <td className="px-4 py-3">
                        <p className="font-mono font-semibold text-slate-800">{row.fileNo}</p>
                        {row.claimNo && <p className="text-[10px] text-slate-400">Hasar: {row.claimNo}</p>}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {row.description ? toTitleCaseTR(row.description) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => { onSelectClaim(row); onClose(); }}
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          Bağla
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {tab === 'acil' && (
            acilLoading ? (
              <p className="py-12 text-center text-sm text-slate-400">Yükleniyor…</p>
            ) : acilRows.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">Eşleşen acil yardım dosyası bulunamadı.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-[11px] font-medium text-slate-500">
                    <th className="px-4 py-2.5 font-semibold">Dosya No</th>
                    <th className="px-4 py-2.5 font-semibold">Müşteri</th>
                    <th className="px-4 py-2.5 font-semibold w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {acilRows.map((row) => (
                    <tr key={row.id} className="hover:bg-orange-50/70">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs text-slate-500">{row.caseNo}</p>
                        {row.fileNo && <p className="font-mono font-semibold text-slate-800">{row.fileNo}</p>}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {toTitleCaseTR(row.customerName)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => { onSelectEmergency(row); onClose(); }}
                          className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
                        >
                          Bağla
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </div>
  );
}
