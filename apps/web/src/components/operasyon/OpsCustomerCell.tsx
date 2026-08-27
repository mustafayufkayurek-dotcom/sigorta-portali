'use client';

import { useRouter } from 'next/navigation';
import type { KeyboardEvent, MouseEvent } from 'react';
import {
  OPERATION_CUSTOMER_SHORT_UNSET,
  OPERATION_CUSTOMER_UNDEFINED,
} from '@/utils/operation-customer-display';

export function OpsCustomerCell({
  name,
  typeLabel,
  kind,
  href,
}: {
  name: string;
  typeLabel: string | null;
  kind?: 'hasar' | 'acil';
  href?: string | null;
}) {
  const router = useRouter();
  const undefinedName = name === OPERATION_CUSTOMER_UNDEFINED;
  const shortUnset = name === OPERATION_CUSTOMER_SHORT_UNSET;
  const showName = Boolean(name);
  const goToCard = (e: MouseEvent | KeyboardEvent) => {
    if (!href) return;
    e.preventDefault();
    e.stopPropagation();
    router.push(href);
  };

  return (
    <div className="min-w-0 text-left" data-testid="ops-customer-cell" data-kind={kind}>
      {showName ? (
        href ? (
          <span
            role="link"
            tabIndex={0}
            className="cursor-pointer text-left text-sm font-semibold text-amber-800 underline decoration-amber-400 underline-offset-2 hover:text-amber-950"
            title="Müşteri kartında Kısa Ad tanımla"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={goToCard}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') goToCard(e);
            }}
          >
            {name}
          </span>
        ) : (
          <div
            className={`[overflow-wrap:anywhere] ${
              undefinedName ? 'text-slate-500' : shortUnset ? 'text-sm font-semibold text-amber-800' : 'text-sm font-semibold text-slate-900'
            }`}
            title={name}
          >
            {name}
          </div>
        )
      ) : null}
      {typeLabel ? (
        <div
          className={`[overflow-wrap:anywhere] text-[10px] font-medium ${
            showName ? 'mt-0.5 ' : ''
          }${kind === 'hasar' ? 'font-normal text-slate-400' : 'text-slate-400'}`}
          title={typeLabel}
        >
          {typeLabel}
        </div>
      ) : null}
    </div>
  );
}
