'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { relativeTime } from '@/utils/date-helpers';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return phone;
  return digits.slice(0, 4) + '***' + digits.slice(-4);
}

interface CustomerFile {
  id: string;
  fileNo: string;
  statusName: string;
  isClosed: boolean;
  updatedAt: string;
}

interface MyCustomer {
  customerId: string;
  name: string;
  phone: string | null;
  totalFiles: number;
  openFiles: number;
  closedFiles: number;
  lastActivityDate: string;
  files: CustomerFile[];
}

export default function CarilerimPage() {
  const [customers, setCustomers] = useState<MyCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await fetch(`${API}/customers/my-customers`, { headers: authHeader() });
        if (!res.ok) throw new Error('Veriler alınamadı');
        const json = await res.json();
        setCustomers(json.data ?? []);
      } catch (err: any) {
        setError(err.message ?? 'Bir hata oluştu');
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Carilerim yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <p className="text-red-500 text-sm font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Carilerim</h1>
          <p className="text-sm text-slate-500 mt-0.5">Atanmış dosyalardaki müşterileriniz</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="font-medium text-slate-700">{customers.length}</span> müşteri
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Müşteri ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
        />
      </div>

      {/* Customer List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-slate-500 font-medium">
            {search ? 'Eşleşen müşteri bulunamadı' : 'Henüz atanmış müşteriniz yok'}
          </p>
          <p className="text-slate-400 text-sm mt-1">
            {search ? 'Farklı bir arama deneyin' : 'Size atanan dosyalardaki müşteriler burada görünür'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((customer) => (
            <div key={customer.customerId} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              {/* Card Header */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 truncate">{customer.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{maskPhone(customer.phone)}</p>
                  </div>
                  <Link
                    href={`/panel/musteriler?highlight=${customer.customerId}`}
                    className="shrink-0 text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Detay
                  </Link>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="font-medium">{customer.totalFiles}</span> dosya
                  </div>
                  {customer.openFiles > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {customer.openFiles} açık
                    </span>
                  )}
                  {customer.closedFiles > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      {customer.closedFiles} kapalı
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 mt-2">
                  Son işlem: {relativeTime(customer.lastActivityDate)}
                </p>
              </div>

              {/* Expand toggle */}
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === customer.customerId ? null : customer.customerId)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 text-xs text-slate-500 hover:bg-slate-100/80 transition-colors"
              >
                <span>{expandedId === customer.customerId ? 'Dosyaları gizle' : 'Dosyaları göster'}</span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${expandedId === customer.customerId ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded Files */}
              {expandedId === customer.customerId && (
                <div className="divide-y divide-slate-100">
                  {customer.files.map((file) => (
                    <Link
                      key={file.id}
                      href={`/panel/hasar-dosyalari/${file.id}`}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-blue-50/40 transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-xs font-mono text-slate-700 group-hover:text-blue-700 truncate">{file.fileNo}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          file.isClosed
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {file.statusName}
                        </span>
                        <svg className="w-3 h-3 text-slate-300 group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
