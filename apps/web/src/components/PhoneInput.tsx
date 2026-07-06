'use client';

import { useState, useRef, useEffect } from 'react';
import { COUNTRY_CODES, CountryCode, DEFAULT_COUNTRY, toInternationalPhone } from '@/data/country-codes';

interface PhoneInputProps {
  value: string;            // Uluslararası format: +905321234567 veya yerel format
  onChange: (international: string) => void;
  onBlur?: (international: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Uluslararası format (+905321234567) içinde ülke kodunu tespit eder.
 * Bulamazsa DEFAULT (TR) döner.
 */
function parseInternational(value: string): { country: CountryCode; local: string } {
  if (!value) return { country: DEFAULT_COUNTRY, local: '' };

  // Önce uzun dial kodlarından başla (örn: +994, +380)
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  for (const c of sorted) {
    if (value.startsWith(c.dialCode)) {
      return { country: c, local: value.slice(c.dialCode.length).replace(/^0+/, '') };
    }
  }
  // Dial kodu yoksa, ham numara Türkiye varsayımıyla parse et
  return { country: DEFAULT_COUNTRY, local: value.replace(/^0+/, '') };
}

export function PhoneInput({ value, onChange, onBlur, className = '', placeholder, disabled }: PhoneInputProps) {
  const { country: initCountry, local: initLocal } = parseInternational(value);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(initCountry);
  const [localNumber, setLocalNumber] = useState(initLocal);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Dışarıdan value değiştiğinde (örn: edit modu) senkronize et
  useEffect(() => {
    if (value) {
      const { country, local } = parseInternational(value);
      setSelectedCountry(country);
      setLocalNumber(local);
    }
  }, []); // Yalnızca ilk render'da

  // Dropdown dışına tıklandığında kapat
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Dropdown açılınca arama alanına odaklan
  useEffect(() => {
    if (dropdownOpen) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [dropdownOpen]);

  const filteredCountries = COUNTRY_CODES.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.dialCode.includes(q) || c.code.toLowerCase().includes(q);
  });

  const handleLocalChange = (raw: string) => {
    // Başındaki 0'ı kaldır
    let cleaned = raw.replace(/^0+/, '');
    // Sadece rakam ve boşluk
    cleaned = cleaned.replace(/[^\d\s]/g, '');
    setLocalNumber(cleaned);
    const intl = toInternationalPhone(selectedCountry.dialCode, cleaned);
    onChange(intl);
  };

  const handleCountrySelect = (country: CountryCode) => {
    setSelectedCountry(country);
    setDropdownOpen(false);
    setSearch('');
    const intl = toInternationalPhone(country.dialCode, localNumber);
    onChange(intl);
  };

  const inputBase = `min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-0 ${disabled ? 'text-gray-400' : 'text-gray-800'}`;

  return (
    <div className={`relative flex min-w-0 items-stretch border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-400 transition-colors ${className}`}
      ref={dropdownRef}>
      {/* Ülke Kodu Seçici Butonu */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setDropdownOpen((o) => !o)}
        className="flex items-center gap-1.5 pl-3 pr-2.5 py-2 bg-gray-50 border-r border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="text-base leading-none">{selectedCountry.flag}</span>
        <span className="text-xs text-gray-600">{selectedCountry.dialCode}</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Numara Input */}
      <input
        type="tel"
        className={inputBase}
        placeholder={placeholder ?? selectedCountry.format}
        value={localNumber}
        maxLength={selectedCountry.phoneLength + 4} // boşluklar için +4
        disabled={disabled}
        onChange={(e) => handleLocalChange(e.target.value)}
        onBlur={() => {
          if (onBlur) {
            const intl = toInternationalPhone(selectedCountry.dialCode, localNumber);
            onBlur(intl);
          }
        }}
      />

      {/* Dropdown */}
      {dropdownOpen && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* Arama */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                placeholder="Ülke ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {/* Liste */}
          <div className="max-h-52 overflow-y-auto py-1">
            {filteredCountries.length === 0 ? (
              <p className="text-xs text-gray-400 px-4 py-3 text-center">Ülke bulunamadı</p>
            ) : filteredCountries.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => handleCountrySelect(c)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-indigo-50 ${selectedCountry.code === c.code ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}`}
              >
                <span className="text-base leading-none w-6 text-center">{c.flag}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-xs text-gray-400 font-mono">{c.dialCode}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
