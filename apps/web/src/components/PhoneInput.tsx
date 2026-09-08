'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  COUNTRY_CODES,
  CountryCode,
  DEFAULT_COUNTRY,
  formatLocalDigits,
  parseInternationalPhone,
  toInternationalPhone,
} from '@/data/country-codes';

interface PhoneInputProps {
  value: string;
  onChange: (international: string) => void;
  onBlur?: (international: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function PhoneInput({ value, onChange, onBlur, className = '', placeholder, disabled }: PhoneInputProps) {
  const parsed = parseInternationalPhone(value);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(parsed.country);
  const [localDigits, setLocalDigits] = useState(parsed.localDigits);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const next = parseInternationalPhone(value);
    setSelectedCountry(next.country);
    setLocalDigits(next.localDigits);
  }, [value]);

  useLayoutEffect(() => {
    if (!dropdownOpen || !wrapRef.current) {
      setMenuPos(null);
      return;
    }
    const rect = wrapRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 288) });
  }, [dropdownOpen]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setDropdownOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [dropdownOpen]);

  useEffect(() => {
    if (dropdownOpen) {
      const t = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [dropdownOpen]);

  const filteredCountries = COUNTRY_CODES.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.dialCode.includes(q) || c.code.toLowerCase().includes(q);
  });

  const handleLocalChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').replace(/^0+/, '').slice(0, selectedCountry.phoneLength);
    setLocalDigits(digits);
    onChange(toInternationalPhone(selectedCountry.dialCode, digits));
  };

  const handleCountrySelect = (country: CountryCode) => {
    setSelectedCountry(country);
    setDropdownOpen(false);
    setSearch('');
    const digits = localDigits.slice(0, country.phoneLength);
    setLocalDigits(digits);
    onChange(toInternationalPhone(country.dialCode, digits));
  };

  const displayLocal = formatLocalDigits(selectedCountry, localDigits);

  return (
    <div
      className={`relative flex h-10 min-w-0 items-stretch rounded-lg border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 ${className}`}
      ref={wrapRef}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setDropdownOpen((o) => !o)}
        className="flex h-full shrink-0 items-center gap-1.5 border-r border-slate-200 bg-slate-50 px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Ülke kodu"
        aria-expanded={dropdownOpen}
      >
        <span className="text-base leading-none">{selectedCountry.flag}</span>
        <span className="text-xs text-slate-600">{selectedCountry.dialCode}</span>
        <svg className={`h-3 w-3 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <input
        type="tel"
        inputMode="numeric"
        className={`min-w-0 flex-1 border-0 bg-transparent px-3 text-sm tabular-nums focus:outline-none focus:ring-0 ${disabled ? 'text-slate-400' : 'text-slate-800'}`}
        placeholder={placeholder ?? selectedCountry.format}
        value={displayLocal}
        disabled={disabled}
        onChange={(e) => handleLocalChange(e.target.value)}
        onBlur={() => {
          if (onBlur) onBlur(toInternationalPhone(selectedCountry.dialCode, localDigits));
        }}
      />

      {dropdownOpen && menuPos && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[220] rounded-xl border border-slate-200 bg-white shadow-xl"
              style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
            >
              <div className="border-b border-slate-100 p-2">
                <input
                  ref={searchRef}
                  type="text"
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Ülke ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="max-h-52 overflow-y-auto py-1">
                {filteredCountries.length === 0 ? (
                  <p className="px-4 py-3 text-center text-xs text-slate-400">Ülke bulunamadı</p>
                ) : filteredCountries.map((c) => (
                  <button
                    key={`${c.code}-${c.dialCode}`}
                    type="button"
                    onClick={() => handleCountrySelect(c)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-blue-50 ${
                      selectedCountry.code === c.code ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                    }`}
                  >
                    <span className="w-6 text-center text-base leading-none">{c.flag}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="font-mono text-xs text-slate-400">{c.dialCode}</span>
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
