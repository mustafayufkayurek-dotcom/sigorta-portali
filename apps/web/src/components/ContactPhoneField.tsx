'use client';

import { PhoneInput } from '@/components/PhoneInput';

export type ContactPhoneType = 'gsm' | 'landline';

interface ContactPhoneFieldProps {
  phone: string;
  phoneType: ContactPhoneType;
  extensionNo: string;
  onPhoneChange: (value: string) => void;
  onPhoneTypeChange: (type: ContactPhoneType) => void;
  onExtensionChange: (value: string) => void;
  onPhoneBlur?: (value: string) => void;
}

export function ContactPhoneField({
  phone,
  phoneType,
  extensionNo,
  onPhoneChange,
  onPhoneTypeChange,
  onExtensionChange,
  onPhoneBlur,
}: ContactPhoneFieldProps) {
  return (
    <div className="flex gap-1.5 items-center w-full">
      <span className="flex-shrink-0 w-8 h-9 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-200 text-slate-400">
        {phoneType === 'gsm' ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <rect x="5" y="2" width="14" height="20" rx="2" strokeWidth={1.8} />
            <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        )}
      </span>
      <select
        className="border border-slate-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors bg-white flex-shrink-0 h-9"
        value={phoneType}
        onChange={(e) => onPhoneTypeChange(e.target.value as ContactPhoneType)}
      >
        <option value="gsm">GSM</option>
        <option value="landline">Sabit Hat</option>
      </select>
      <PhoneInput
        className="flex-1 min-w-0"
        value={phone}
        onChange={onPhoneChange}
        onBlur={onPhoneBlur}
      />
      {phoneType === 'landline' && (
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          placeholder="Dahili"
          className="w-16 border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors flex-shrink-0 h-9"
          value={extensionNo}
          onChange={(e) => onExtensionChange(e.target.value.replace(/\D/g, '').slice(0, 5))}
        />
      )}
    </div>
  );
}
