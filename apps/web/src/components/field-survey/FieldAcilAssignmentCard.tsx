'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { toWhatsAppLink } from '@/utils/date-helpers';
import { formatPhoneGrouped } from '@/utils/validators';
import { fieldStaffAcilHref } from '@/utils/field-staff-claim-view';
import { resolveAcilInsuredName } from '@sigorta/shared';
import type { EmergencyCase } from '@/utils/emergencyApi';

function formatClock(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function FieldAcilAssignmentCard({
  item,
  showLastActivity = true,
}: {
  item: EmergencyCase;
  showLastActivity?: boolean;
}) {
  const fileNo = item.fileNo?.trim() || item.caseNo || '—';
  const insured =
    resolveAcilInsuredName({
      personField: item.customerName,
      notes: item.notes,
    }) || item.customerName || '—';
  const phone = (item.customerPhone || '').trim();
  const displayPhone = phone ? formatPhoneGrouped(phone) : '';
  const telHref = phone ? `tel:${phone.replace(/\s/g, '')}` : null;
  const waLink = phone ? toWhatsAppLink(phone) : null;
  const cityLine = [item.district, item.city].filter(Boolean).join(' / ');
  const subject = item.issueType?.trim() || 'Acil Yardım';

  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/[0.03]"
      data-testid="saha-acil-dosya-karti"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-orange-50/80 via-white to-white px-3.5 py-2.5 sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="font-mono text-sm font-bold text-slate-950">{fileNo}</span>
          <span className="rounded-lg bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-950 ring-1 ring-orange-300/80">
            Acil Yardım
          </span>
        </div>
        {showLastActivity ? (
          <p className="text-[11px] text-slate-500">
            Son işlem:{' '}
            <span className="font-medium text-slate-700">{formatClock(item.updatedAt)}</span>
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 p-3.5 sm:p-4 lg:flex-row lg:items-stretch lg:justify-between">
        <div className="min-w-0 flex-[1.4] space-y-2.5">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
              <p className="text-[11px] font-medium text-slate-500">Sigortalı</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-950">{insured}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
              <p className="text-[11px] font-medium text-slate-500">Konu / Yer</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">{subject}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{cityLine || item.address || '—'}</p>
            </div>
          </div>
          <div className="rounded-xl border border-orange-100 bg-orange-50/30 px-3 py-2.5">
            <p className="text-[11px] font-medium text-slate-500">İletişim</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {telHref ? (
                <a
                  href={telHref}
                  className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Ara {displayPhone}
                </a>
              ) : (
                <span className="text-xs text-slate-500">Telefon yok</span>
              )}
              {waLink ? (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200"
                >
                  WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-col justify-center gap-1.5 border-t border-slate-100 pt-3 lg:w-[11.5rem] lg:border-l lg:border-t-0 lg:pl-3.5 lg:pt-0">
          <Link
            href={fieldStaffAcilHref(item.id)}
            className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-brand-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Dosyaya Git
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
