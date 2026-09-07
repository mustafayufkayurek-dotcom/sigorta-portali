'use client';

import Link from 'next/link';
import { KVKK_ACIK_RIZA_LABEL } from '@/lib/legal-documents';

export function KvkkConsentCheckbox({
  checked,
  onChange,
  disabled,
  id = 'kvkk-acik-riza',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-slate-600">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <span>
        {KVKK_ACIK_RIZA_LABEL}{' '}
        <Link href="/kvkk" target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:text-brand-800">
          Metni oku
        </Link>
      </span>
    </label>
  );
}
