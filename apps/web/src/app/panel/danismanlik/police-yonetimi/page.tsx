'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, Plus, Search } from 'lucide-react';
import { useApiQuery } from '@/hooks/useApi';
import { asList } from '@/utils/emergency-list-unwrap';
import { resolveHasarInsuredName } from '@/utils/claim-insured-display';

type PolicyRow = {
  id: string;
  fileNumber?: string | null;
  policyNo?: string | null;
  insuredName?: string | null;
  insuranceCompany?: { name?: string | null } | null;
  customer?: {
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
    entityType?: string | null;
    type?: string | null;
  } | null;
};

function realPolicyNo(value: unknown): string {
  const text = String(value ?? '').trim();
  const folded = text.toLocaleLowerCase('tr-TR');
  if (!text || folded === 'belirtilmedi' || folded === 'n/a' || text === '—' || text === '-') return '';
  return text;
}

export default function PoliceYonetimiPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, refetch } = useApiQuery<unknown>(
    ['police-yonetimi'],
    '/claim-files?limit=200',
  );

  const rows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('tr-TR');
    return asList<PolicyRow>(data)
      .map((row) => ({ row, policyNo: realPolicyNo(row.policyNo) }))
      .filter((item) => item.policyNo)
      .filter((item) => {
        if (!needle) return true;
        const insured = resolveHasarInsuredName(item.row);
        const haystack = [
          item.policyNo,
          item.row.fileNumber,
          item.row.insuranceCompany?.name,
          insured,
        ].join(' ').toLocaleLowerCase('tr-TR');
        return haystack.includes(needle);
      });
  }, [data, search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="page-title flex items-center gap-2">
          <FileText className="h-5 w-5 text-brand-600" />
          Poliçe Yönetimi
        </h2>
        <Link
          href="/panel/hasar-dosyalari?yeni=1&hizmet=danismanlik"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white"
        >
          <Plus className="h-3.5 w-3.5" />
          Yeni Dosya
        </Link>
      </div>

      <div className="filter-bar !mb-0 !py-2.5">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm"
            placeholder="Poliçe no, sigortalı, dosya no"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {isLoading ? (
          <p className="px-4 py-8 text-sm text-slate-500">Poliçeler yükleniyor...</p>
        ) : isError ? (
          <div className="px-4 py-8">
            <p className="text-sm text-status-danger">Poliçeler yüklenirken hata oluştu.</p>
            <button type="button" className="mt-2 text-xs font-semibold text-brand-700" onClick={() => void refetch()}>
              Tekrar Dene
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-500">
            {search.trim() ? 'Bu aramaya uyan poliçe yok.' : 'Kayıtlı poliçe numarası yok.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Poliçe No</th>
                  <th className="px-4 py-2.5 font-medium">Sigorta Şirketi</th>
                  <th className="px-4 py-2.5 font-medium">Sigortalı</th>
                  <th className="px-4 py-2.5 font-medium">Dosya No</th>
                  <th className="px-4 py-2.5 font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ row, policyNo }) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{policyNo}</td>
                    <td className="px-4 py-2.5 text-slate-700">{row.insuranceCompany?.name?.trim() || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-700">{resolveHasarInsuredName(row)}</td>
                    <td className="px-4 py-2.5 text-slate-700">{row.fileNumber?.trim() || '—'}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/panel/hasar-dosyalari/${row.id}`} className="text-xs font-semibold text-brand-700">
                        Dosyayı Aç
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
