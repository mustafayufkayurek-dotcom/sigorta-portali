'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { API, authHeader, ensureSessionBeforeMutation } from '@/utils/api';
import { getAccessToken } from '@/utils/auth-session';
import { reportCaughtError } from '@/utils/report-caught-error';
import { createInFlightGuard } from '@/utils/in-flight-guard';
import { getApiErrorMessage } from '@/utils/api-error';

export type PickedCustomer = {
  id: string;
  displayName: string;
  phone?: string | null;
  email?: string | null;
  customerType: 'individual' | 'corporate';
  identityNo?: string | null;
  taxNumber?: string | null;
};

type Props = {
  onSelect: (customer: PickedCustomer) => void;
  onClose: () => void;
};

const TYPE_LABEL: Record<string, string> = { individual: 'Bireysel', corporate: 'Kurumsal' };

const emptyNew = {
  customerType: 'individual' as 'individual' | 'corporate',
  fullName: '',
  companyName: '',
  identityNo: '',
  taxNumber: '',
  phone: '',
  email: '',
};

export function CustomerPickerModal({ onSelect, onClose }: Props) {
  const [view, setView] = useState<'list' | 'new'>('list');

  // List view state
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;
  const searchRef = useRef<HTMLInputElement>(null);

  // New customer form state
  const [newForm, setNewForm] = useState({ ...emptyNew });
  const [saving, setSaving] = useState(false);
  const [newError, setNewError] = useState('');
  const submitGuard = useRef(createInFlightGuard());

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), page: String(page) });
      if (search.trim()) params.set('search', search.trim());
      if (typeFilter) params.set('customerType', typeFilter);
      const r = await axios.get(`${API}/customers?${params}`, { headers: authHeader() });
      setCustomers(r.data.data || []);
      setTotal(r.data.meta?.total ?? (r.data.data?.length ?? 0));
    } catch (e) {
      reportCaughtError(e, 'Müşteri listesi yüklenemedi. Lütfen tekrar deneyin.');
      setCustomers([]);
      setTotal(0);
    } finally { setLoading(false); }
  }, [search, typeFilter, page]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  // Auto-focus search box on open
  useEffect(() => {
    if (view === 'list') setTimeout(() => searchRef.current?.focus(), 50);
  }, [view]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSelect = (c: any) => {
    const displayName = c.customerType === 'individual'
      ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.fullName || '—'
      : c.companyName ?? '—';
    onSelect({
      id: c.id,
      displayName,
      phone: c.phone ?? null,
      email: c.email ?? null,
      customerType: c.customerType,
      identityNo: c.identityNo ?? null,
      taxNumber: c.taxNumber ?? null,
    });
  };

  const handleSaveNew = async () => {
    setNewError('');
    if (newForm.customerType === 'individual' && !newForm.fullName.trim()) {
      setNewError('Ad Soyad Zorunludur.'); return;
    }
    if (newForm.customerType === 'corporate' && !newForm.companyName.trim()) {
      setNewError('Şirket Adı Zorunludur.'); return;
    }
    if (!submitGuard.current.tryStart()) return;
    setSaving(true);
    try {
      const sessionOk = await ensureSessionBeforeMutation();
      if (!sessionOk || !getAccessToken()) {
        setNewError('Oturum süresi doldu. Sayfayı yenileyin veya tekrar giriş yapın.');
        return;
      }
      const payload: any = {
        customerType: newForm.customerType,
        phone: newForm.phone || null,
        email: newForm.email || null,
      };
      if (newForm.customerType === 'individual') {
        const parts = newForm.fullName.trim().split(' ');
        payload.firstName = parts.slice(0, -1).join(' ') || parts[0];
        payload.lastName = parts.length > 1 ? parts[parts.length - 1] : '';
        if (newForm.identityNo) payload.identityNo = newForm.identityNo;
      } else {
        payload.companyName = newForm.companyName.trim();
        if (newForm.taxNumber) payload.taxNumber = newForm.taxNumber;
      }
      const r = await axios.post(`${API}/customers`, payload, { headers: authHeader() });
      const created = r.data.data;
      handleSelect({ ...created, fullName: newForm.fullName || newForm.companyName });
    } catch (e: unknown) {
      setNewError(getApiErrorMessage(e, 'Müşteri Oluşturulamadı.'));
    } finally {
      setSaving(false);
      submitGuard.current.end();
    }
  };

  const getDisplayName = (c: any) => {
    if (c.customerType === 'individual') {
      return `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.fullName || '—';
    }
    return c.companyName ?? '—';
  };

  const getIdField = (c: any) => {
    if (c.customerType === 'individual') return c.identityNo ? `TC: ${c.identityNo}` : '';
    return c.taxNumber ? `VN: ${c.taxNumber}` : '';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          {view === 'list' ? (
            <>
              <h3 className="text-base font-semibold text-gray-900">Müşteri Seç</h3>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => { setView('new'); setNewForm({ ...emptyNew }); setNewError(''); }}
                  className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                >
                  + Yeni Müşteri Ekle
                </button>
                <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setView('list')} className="text-gray-400 hover:text-gray-700">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="text-base font-semibold text-gray-900">Yeni Müşteri Ekle</h3>
              </div>
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {view === 'list' ? (
            <div className="p-4">
              {/* Search + Filter */}
              <div className="flex gap-2 mb-3">
                <input
                  ref={searchRef}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Ad, telefon, TC / Vergi No ile ara..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
                <select
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                >
                  <option value="">Tüm Tipler</option>
                  <option value="individual">Bireysel</option>
                  <option value="corporate">Kurumsal</option>
                </select>
              </div>

              {/* Table */}
              {loading ? (
                <div className="py-12 text-center text-gray-400 text-sm">Yükleniyor...</div>
              ) : customers.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  {search ? 'Arama Sonucu Bulunamadı.' : 'Müşteri Bulunamadı.'}
                </div>
              ) : (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500">
                        <th className="text-center px-4 py-2.5">Ad / Şirket</th>
                        <th className="text-center px-4 py-2.5">Tip</th>
                        <th className="text-center px-4 py-2.5">Kimlik / Vergi</th>
                        <th className="text-center px-4 py-2.5">Telefon</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {customers.map((c) => (
                        <tr
                          key={c.id}
                          onClick={() => handleSelect(c)}
                          className="hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-2.5 font-medium text-gray-800">{getDisplayName(c)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-block text-xs rounded-full px-2 py-0.5 ${c.customerType === 'individual' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                              {TYPE_LABEL[c.customerType] ?? c.customerType}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{getIdField(c) || '—'}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{c.phone || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {total > limit && (
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-400">{total} Müşteri · Sayfa {page}</span>
                  <div className="flex gap-2">
                    <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Önceki</button>
                    <button disabled={page * limit >= total} onClick={() => setPage((p) => p + 1)} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-50">Sonraki →</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* New Customer Form */
            <div className="p-5 space-y-4">
              {/* Type Toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewForm((p) => ({ ...p, customerType: 'individual' }))}
                  className={`flex-1 py-2 rounded-lg text-sm border transition-all ${newForm.customerType === 'individual' ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  Bireysel
                </button>
                <button
                  type="button"
                  onClick={() => setNewForm((p) => ({ ...p, customerType: 'corporate' }))}
                  className={`flex-1 py-2 rounded-lg text-sm border transition-all ${newForm.customerType === 'corporate' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  Kurumsal
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {newForm.customerType === 'individual' ? (
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Ad Soyad *</label>
                    <input
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="Zorunlu Alan"
                      value={newForm.fullName}
                      onChange={(e) => setNewForm((p) => ({ ...p, fullName: e.target.value }))}
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Şirket Adı *</label>
                    <input
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="Zorunlu Alan"
                      value={newForm.companyName}
                      onChange={(e) => setNewForm((p) => ({ ...p, companyName: e.target.value }))}
                      autoFocus
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    {newForm.customerType === 'individual' ? 'TC Kimlik No' : 'Vergi No'}
                  </label>
                  {newForm.customerType === 'individual' ? (
                    <input
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="Opsiyonel"
                      value={newForm.identityNo}
                      onChange={(e) => setNewForm((p) => ({ ...p, identityNo: e.target.value }))}
                    />
                  ) : (
                    <input
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="Opsiyonel"
                      value={newForm.taxNumber}
                      onChange={(e) => setNewForm((p) => ({ ...p, taxNumber: e.target.value }))}
                    />
                  )}
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Telefon</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Opsiyonel"
                    value={newForm.phone}
                    onChange={(e) => setNewForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs text-gray-500 block mb-1">E-posta</label>
                  <input
                    type="email"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Opsiyonel"
                    value={newForm.email}
                    onChange={(e) => setNewForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
              </div>

              {newError && <p className="text-xs text-red-500">{newError}</p>}

              <div className="flex gap-2 pt-2">
                <button type="button"
                  onClick={handleSaveNew}
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Kaydediliyor...' : 'Oluştur ve Seç'}
                </button>
                <button type="button"
                  onClick={() => setView('list')}
                  className="flex-1 border border-gray-200 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Geri Dön
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
