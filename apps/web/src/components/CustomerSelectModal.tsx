'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { customerDisplayName } from '@/utils/customer-form-helpers';
import { API, authHeader } from '@/utils/api';
import { HASAR_EXPERT_CUSTOMER_SUB_TYPE } from '@/app/panel/kullanicilar/_lib/user-invite-config';

type Customer = {
  id: string;
  type: string;
  fullName?: string | null;
  companyName?: string | null;
  identityNo?: string | null;
  taxNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  subType?: string | null;
  entityType?: string | null;
  status?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
  /** Called when user clicks "+ Yeni Müşteri Ekle" */
  onCreateNew?: () => void;
  /** Müşteri alt tipi filtresi (ör. asistan_firmasi) */
  subTypeFilter?: string;
  /** Hasar dosyası gibi akışlarda bireysel/kurumsal sütununu gizle */
  hideTypeColumn?: boolean;
};

function resultCountLabel(subTypeFilter: string | undefined, total: number): string {
  if (total <= 0) return '';
  if (subTypeFilter === HASAR_EXPERT_CUSTOMER_SUB_TYPE || subTypeFilter === 'eksper') {
    return `${total} Eksper Ofisi Bulundu`;
  }
  if (subTypeFilter === 'asistan_firmasi') {
    return `${total} Asistan Firması Bulundu`;
  }
  return `${total} Müşteri Bulundu`;
}

function emptyStateLabel(subTypeFilter: string | undefined, hasFilter: boolean): string {
  if (subTypeFilter === HASAR_EXPERT_CUSTOMER_SUB_TYPE || subTypeFilter === 'eksper') {
    return hasFilter
      ? 'Eksper Ofisi Bulunamadı.'
      : 'Kayıtlı eksper ofisi bulunamadı. Müşteriler’den Eksper Firması olarak ekleyin.';
  }
  if (subTypeFilter === 'asistan_firmasi') {
    return hasFilter ? 'Asistan Firması Bulunamadı.' : 'Kayıtlı asistan firması bulunamadı.';
  }
  return hasFilter ? 'Müşteri Bulunamadı.' : 'Arama Yapın veya Tüm Müşterileri Görüntüleyin.';
}

export function CustomerSelectModal({ open, onClose, onSelect, onCreateNew, subTypeFilter, hideTypeColumn }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isExpertPicker =
    subTypeFilter === HASAR_EXPERT_CUSTOMER_SUB_TYPE || subTypeFilter === 'eksper';
  const isAssistantPicker = subTypeFilter === 'asistan_firmasi';
  const hideEntityTypeFilter = Boolean(hideTypeColumn || isExpertPicker || isAssistantPicker);

  const load = useCallback(async (q: string, type: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: isExpertPicker || isAssistantPicker ? '500' : '50',
        status: 'active',
      });
      if (q.trim()) params.set('search', q.trim());
      if (type) params.set('customerType', type);
      else if (isExpertPicker || isAssistantPicker) params.set('customerType', 'corporate');
      if (subTypeFilter) params.set('subType', subTypeFilter);
      const r = await axios.get(`${API}/customers?${params}`, { headers: authHeader() });
      const rows = (r.data.data || []).map((c: Customer & { entityType?: string; subType?: string | null }) => ({
        ...c,
        type: c.type ?? c.entityType ?? 'corporate',
        subType: c.subType ?? null,
      }));
      setCustomers(rows);
      setTotal(r.data.meta?.total ?? rows.length);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [subTypeFilter, isExpertPicker, isAssistantPicker]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => load(search, typeFilter), 250);
    return () => clearTimeout(timer);
  }, [open, search, typeFilter, subTypeFilter, load]);

  useEffect(() => {
    if (open) {
      setSearch('');
      setTypeFilter('');
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open]);

  if (!open) return null;

  const modalTitle =
    subTypeFilter === 'asistan_firmasi'
      ? 'Asistan Firması Seç'
      : subTypeFilter === 'eksper_firmasi' || subTypeFilter === 'eksper'
        ? 'Eksper Ofisi Seç'
        : subTypeFilter
          ? 'Müşteri Seç'
          : 'Müşteri Seç';

  const displayName = (c: Customer) => customerDisplayName(c);

  const idNo = (c: Customer) =>
    c.type === 'individual'
      ? (c.identityNo ?? '—')
      : (c.taxNumber ?? '—');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">{modalTitle}</h3>
          <button type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-light leading-none"
          >
            ×
          </button>
        </div>

        {/* Search & Filter */}
        <div className="px-5 py-3 border-b border-gray-50 flex flex-wrap gap-2">
          <input
            ref={searchInputRef}
            className="flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="İsim, Telefon, TC veya Vergi No ile Ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {!hideEntityTypeFilter && (
            <select
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Tüm Tipler</option>
              <option value="individual">Bireysel</option>
              <option value="corporate">Kurumsal</option>
            </select>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="text-gray-400 text-sm py-12 text-center">Yükleniyor...</div>
          ) : customers.length === 0 ? (
            <div className="text-gray-400 text-sm py-12 text-center">
              {emptyStateLabel(subTypeFilter, Boolean(search || typeFilter))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="text-xs text-gray-500">
                  <th className="text-center px-5 py-2.5">Ad / Ünvan</th>
                  {!hideTypeColumn && <th className="text-center px-4 py-2.5">Tip</th>}
                  <th className="text-center px-4 py-2.5">TC / Vergi No</th>
                  <th className="text-center px-4 py-2.5">Telefon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => { onSelect(c); onClose(); }}
                  >
                    <td className="px-5 py-3 font-medium text-gray-800">{displayName(c)}</td>
                    {!hideTypeColumn && (
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${c.type === 'individual' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                          {c.type === 'individual' ? 'Bireysel' : 'Kurumsal'}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{idNo(c)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{c.phone ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">{resultCountLabel(subTypeFilter, total)}</span>
          <div className="flex gap-2">
            {onCreateNew && (
              <button type="button"
                onClick={() => { onCreateNew(); onClose(); }}
                className="text-sm bg-green-50 text-green-700 border border-green-200 px-4 py-1.5 rounded-lg hover:bg-green-100"
              >
                {isExpertPicker ? '+ Yeni Eksper Ofisi' : isAssistantPicker ? '+ Yeni Asistan Firması' : '+ Yeni Müşteri Ekle'}
              </button>
            )}
            <button type="button"
              onClick={onClose}
              className="text-sm border border-gray-200 text-gray-600 px-4 py-1.5 rounded-lg hover:bg-gray-50"
            >
              İptal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
