'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { API, authHeader } from '@/utils/api';

// ── Types ──────────────────────────────────────────────────────────────────────
interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  category: 'dosyalar' | 'acil_dosyalar' | 'mailler' | 'musteriler' | 'tedarikciler' | 'eksperler' | 'faturalar';
}

interface SearchResults {
  dosyalar: SearchResultItem[];
  acil_dosyalar: SearchResultItem[];
  mailler: SearchResultItem[];
  musteriler: SearchResultItem[];
  tedarikciler: SearchResultItem[];
  eksperler: SearchResultItem[];
  faturalar: SearchResultItem[];
  total: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  dosyalar:     'Dosya',
  acil_dosyalar:'Acil',
  mailler:      'Gelen Kutusu',
  musteriler:   'Müşteri',
  tedarikciler: 'Tedarikçi',
  eksperler:    'Eksper',
  faturalar:    'Fatura',
};

const CATEGORY_ICONS: Record<string, string> = {
  dosyalar:     '📁',
  acil_dosyalar:'🚨',
  mailler:      '📧',
  musteriler:   '👤',
  tedarikciler: '🏭',
  eksperler:    '🔍',
  faturalar:    '🧾',
};

const SEARCH_HINT =
  'Dosya, Müşteri, Personel, Telefon, Plaka, Tedarikçi, Operasyon…';

const PINNED_HINTS = [
  { label: 'Dosya No', hint: 'Dosya' },
  { label: 'Plaka', hint: 'Plaka' },
  { label: 'Telefon', hint: 'Telefon' },
  { label: 'Personel', hint: 'Personel' },
  { label: 'Tedarikçi', hint: 'Tedarikçi' },
];

const RECENT_SEARCHES_KEY = 'globalSearch_recent';
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveRecentSearch(q: string) {
  if (!q.trim()) return;
  const prev = getRecentSearches();
  const next = [q, ...prev.filter((s) => s !== q)].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
}

// ── Hook ───────────────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Main Component ─────────────────────────────────────────────────────────────
interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const debouncedQuery = useDebounce(query, 300);

  // Flat list for keyboard navigation
  const flatItems: SearchResultItem[] = results
    ? [
        ...results.dosyalar,
        ...results.acil_dosyalar,
        ...results.mailler,
        ...results.musteriler,
        ...results.tedarikciler,
        ...results.eksperler,
        ...results.faturalar,
      ]
    : [];

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(null);
      setActiveIndex(-1);
      setRecentSearches(getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Fetch results
  useEffect(() => {
    if (!open) return;
    if (debouncedQuery.trim().length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `${API}/search?q=${encodeURIComponent(debouncedQuery)}`,
          { headers: authHeader() },
        );
        if (!res.ok) throw new Error('search failed');
        const data: SearchResults = await res.json();
        if (!cancelled) {
          setResults(data);
          setActiveIndex(-1);
        }
      } catch {
        if (!cancelled) setResults(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedQuery, open]);

  const navigate = useCallback(
    (item: SearchResultItem) => {
      saveRecentSearch(query);
      onClose();
      router.push(item.url);
    },
    [query, onClose, router],
  );

  const handleRecentClick = (s: string) => {
    setQuery(s);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, -1));
      } else if (e.key === 'Enter' && activeIndex >= 0 && flatItems[activeIndex]) {
        navigate(flatItems[activeIndex]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flatItems, activeIndex, navigate, onClose]);

  if (!open) return null;

  const categories: Array<keyof SearchResults> = [
    'dosyalar', 'acil_dosyalar', 'mailler', 'musteriler', 'tedarikciler', 'eksperler', 'faturalar',
  ];

  let globalIdx = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-0 top-[10vh] mx-auto w-full max-w-2xl px-4 z-[201]">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden">

          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
            {loading ? (
              <svg className="w-5 h-5 text-blue-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={SEARCH_HINT}
              className="flex-1 text-sm text-slate-800 placeholder-slate-400 bg-transparent outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="shrink-0 w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors"
              >
                <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <kbd className="shrink-0 hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 rounded border border-slate-200">
              ESC
            </kbd>
          </div>

          {/* Body */}
          <div className="max-h-[60vh] overflow-y-auto">

            {/* Recent searches (empty state) */}
            {!query && recentSearches.length > 0 && (
              <div className="px-4 py-3">
                <p className="mb-2 text-[10px] font-semibold text-slate-400">Son Aramalar</p>
                <div className="flex flex-wrap gap-1.5">
                  {recentSearches.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleRecentClick(s)}
                      className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
                    >
                      <svg className="h-3 w-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sık kullanılan arama ipuçları */}
            {!query && (
              <div className="border-t border-slate-50 px-4 py-3">
                <p className="mb-2 text-[10px] font-semibold text-slate-400">Sık Kullanılan</p>
                <div className="flex flex-wrap gap-1.5">
                  {PINNED_HINTS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setQuery(p.hint)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty no-query state */}
            {!query && recentSearches.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <svg className="h-10 w-10 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-sm text-slate-400">Aramak İçin Yazmaya Başlayın</p>
                <p className="max-w-sm px-4 text-xs text-slate-300">{SEARCH_HINT}</p>
              </div>
            )}

            {/* Minimum char hint */}
            {query.length === 1 && (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-400">En az 2 karakter girin...</p>
              </div>
            )}

            {/* No results */}
            {query.length >= 2 && !loading && results && results.total === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <svg className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-slate-500 font-medium">Sonuç bulunamadı</p>
                <p className="text-xs text-slate-400">
                  <span className="font-medium text-slate-500">&quot;{query}&quot;</span> için eşleşen kayıt yok
                </p>
              </div>
            )}

            {/* Results by category */}
            {results && results.total > 0 && categories.map((cat) => {
              const items = results[cat] as SearchResultItem[];
              if (!items.length) return null;
              return (
                <div key={cat} className="py-2">
                  <p className="flex items-center gap-1.5 px-4 pb-1.5 pt-1 text-[10px] font-semibold text-slate-400">
                    <span>{CATEGORY_ICONS[cat]}</span>
                    {CATEGORY_LABELS[cat]}
                    <span className="ml-auto font-normal normal-case tracking-normal text-slate-300">{items.length}</span>
                  </p>
                  {items.map((item) => {
                    const idx = globalIdx++;
                    const isActive = activeIndex === idx;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => navigate(item)}
                        className={`mx-2 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                        style={{ width: 'calc(100% - 1rem)', minHeight: 36 }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-700' : 'text-slate-800'}`}>
                            {item.title}
                          </p>
                          {item.subtitle && (
                            <p className={`text-xs truncate mt-0.5 ${isActive ? 'text-blue-500' : 'text-slate-400'}`}>
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                        <svg className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer hints */}
          {results && results.total > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-100 bg-slate-50/50">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded border border-slate-200 bg-white text-[9px]">↑↓</kbd>
                gezin
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded border border-slate-200 bg-white text-[9px]">↵</kbd>
                aç
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded border border-slate-200 bg-white text-[9px]">ESC</kbd>
                kapat
              </span>
              <span className="ml-auto text-[10px] text-slate-400">
                {results.total} sonuç · Ctrl+K / ⌘K
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
