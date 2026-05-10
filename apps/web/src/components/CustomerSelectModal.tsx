'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

type Customer = {
  id: string;
  type: string;
  fullName?: string | null;
  companyName?: string | null;
  identityNo?: string | null;
  taxNumber?: string | null;
  phone?: string | null;
  email?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
  /** Called when user clicks "+ Yeni Müşteri Ekle" */
  onCreateNew?: () => void;
};

export function CustomerSelectModal({ open, onClose, onSelect, onCreateNew }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (q: string, type: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (q.trim()) params.set('search', q.trim());
      if (type) params.set('type', type);
      const r = await axios.get(`${API}/customers?${params}`, { headers: authHeader() });
      setCustomers(r.data.data || []);
      setTotal(r.data.meta?.total ?? 0);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => load(search, typeFilter), 250);
    return () => clearTimeout(timer);
  }, [open, search, typeFilter, load]);

  useEffect(() => {
    if (open) {
      setSearch('');
      setTypeFilter('');
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open]);

  if (!open) return null;

  const displayName = (c: Customer) =>
    c.type === 'individual'
      ? (c.fullName ?? '—')
      : (c.companyName ?? '—');

  const idNo = (c: Customer) =>
    c.type === 'individual'
      ? (c.identityNo ?? '—')
      : (c.taxNumber ?? '—');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">Müşteri Seç</h3>
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
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Tüm Tipler</option>
            <option value="individual">Bireysel</option>
            <option value="corporate">Kurumsal</option>
          </select>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="text-gray-400 text-sm py-12 text-center">Yükleniyor...</div>
          ) : customers.length === 0 ? (
            <div className="text-gray-400 text-sm py-12 text-center">
              {search || typeFilter ? 'Müşteri Bulunamadı.' : 'Arama Yapın veya Tüm Müşterileri Görüntüleyin.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="text-left px-5 py-2.5">Ad / Ünvan</th>
                  <th className="text-left px-4 py-2.5">Tip</th>
                  <th className="text-left px-4 py-2.5">TC / Vergi No</th>
                  <th className="text-left px-4 py-2.5">Telefon</th>
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
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${c.type === 'individual' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                        {c.type === 'individual' ? 'Bireysel' : 'Kurumsal'}
                      </span>
                    </td>
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
          <span className="text-xs text-gray-400">{total > 0 ? `${total} Müşteri Bulundu` : ''}</span>
          <div className="flex gap-2">
            {onCreateNew && (
              <button type="button"
                onClick={() => { onCreateNew(); onClose(); }}
                className="text-sm bg-green-50 text-green-700 border border-green-200 px-4 py-1.5 rounded-lg hover:bg-green-100"
              >
                + Yeni Müşteri Ekle
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
