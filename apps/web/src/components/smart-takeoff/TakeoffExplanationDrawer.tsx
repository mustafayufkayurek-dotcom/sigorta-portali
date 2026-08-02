'use client';

import { SlidePanel } from '@/components/SlidePanel';
import type { TakeoffLineItem } from './smart-takeoff.types';
import { formatTakeoffQuantity } from './smart-takeoff-api';

type TakeoffExplanationDrawerProps = {
  open: boolean;
  lineItem: TakeoffLineItem | null;
  onClose: () => void;
};

export function TakeoffExplanationDrawer({ open, lineItem, onClose }: TakeoffExplanationDrawerProps) {
  if (!lineItem) return null;

  const { explanation } = lineItem;

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={lineItem.displayName}
      subtitle="Hesaplama Açıklaması"
      width={520}
    >
      <div className="space-y-4 p-4">
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500">Özet</p>
          <p className="mt-1 text-sm text-slate-800">{explanation.humanReadableText}</p>
        </section>

        <section>
          <p className="text-xs font-medium text-slate-500">Ölçüm Özeti</p>
          <p className="mt-1 text-sm text-slate-800">{explanation.measureSummary || '—'}</p>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500">Motor Miktarı</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatTakeoffQuantity(lineItem.quantityEngine, lineItem.unit)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Kullanılan Miktar</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatTakeoffQuantity(lineItem.quantityFinal, lineItem.unit)}
            </p>
          </div>
        </section>

        {explanation.overrideSummary ? (
          <section className="rounded-xl border border-status-warning/30 bg-status-warning/5 p-3">
            <p className="text-xs font-medium text-status-warning">Manuel Düzeltme</p>
            <p className="mt-1 text-sm text-slate-800">{explanation.overrideSummary}</p>
          </section>
        ) : null}

        {explanation.decisionPath.length > 0 ? (
          <section>
            <p className="text-xs font-medium text-slate-500">Karar Yolu</p>
            <ul className="mt-2 space-y-1">
              {explanation.decisionPath.map((step, index) => (
                <li key={`${step}-${index}`} className="text-sm text-slate-700">
                  {index + 1}. {step}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {explanation.calculationSteps.length > 0 ? (
          <section>
            <p className="text-xs font-medium text-slate-500">Hesaplama Adımları</p>
            <ol className="mt-2 space-y-2">
              {explanation.calculationSteps.map((step) => (
                <li
                  key={step.order}
                  className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <span className="font-medium text-slate-900">{step.order}. {step.label}</span>
                  {step.output != null ? (
                    <span className="ml-2 text-slate-500">→ {String(step.output)}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {lineItem.overrides.length > 0 ? (
          <section>
            <p className="text-xs font-medium text-slate-500">Düzeltme Geçmişi</p>
            <ul className="mt-2 space-y-2">
              {lineItem.overrides.map((o) => (
                <li
                  key={o.id}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    o.active
                      ? 'border-brand-200 bg-brand-50 text-slate-800'
                      : 'border-slate-100 bg-slate-50 text-slate-500'
                  }`}
                >
                  <p>
                    {formatTakeoffQuantity(o.quantityEnginePreserved, lineItem.unit)} →{' '}
                    {formatTakeoffQuantity(o.quantityOverride, lineItem.unit)}
                  </p>
                  <p className="mt-1">{o.reason}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </SlidePanel>
  );
}
