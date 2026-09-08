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
  const mainPlaceholder = phoneType === 'landline' ? '212 123 4567' : '532 133 4144';

  return (
    <div className="space-y-2 w-full min-w-0">
      <div className="flex flex-wrap gap-1.5 items-stretch w-full min-w-0">
        <span className="flex h-10 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
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
          className="h-10 w-[6.75rem] flex-shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-xs transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          value={phoneType}
          onChange={(e) => onPhoneTypeChange(e.target.value as ContactPhoneType)}
          aria-label="Telefon türü"
        >
          <option value="gsm">GSM</option>
          <option value="landline">Sabit Hat</option>
        </select>
        <div className="flex-1 min-w-0 basis-[min(100%,8rem)]">
          <PhoneInput
            className="w-full min-w-0"
            value={phone}
            onChange={onPhoneChange}
            onBlur={onPhoneBlur}
            placeholder={mainPlaceholder}
          />
        </div>
      </div>
      {phoneType === 'landline' && (
        <div className="flex items-center gap-2 pl-10 sm:pl-[7.75rem]">
          <label className="text-xs font-medium text-slate-500 shrink-0">Dahili</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            placeholder="Örn: 1234"
            className="h-10 w-24 rounded-lg border border-slate-200 px-2.5 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={extensionNo}
            onChange={(e) => onExtensionChange(e.target.value.replace(/\D/g, '').slice(0, 5))}
          />
          <span className="text-[10px] text-slate-400">Opsiyonel</span>
        </div>
      )}
    </div>
  );
}
