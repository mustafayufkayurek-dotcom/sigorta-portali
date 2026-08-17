'use client';

import { SlidePanel } from '@/components/SlidePanel';
import { TrDateInput } from '@/components/ui/TrDateInput';
import type { SurveyCampaignStatus } from '@/utils/surveyApi';
import type { FileChannelFilter, SurveyResultsFilters } from '../_lib/survey-results-types';

const STATUS_OPTIONS: { value: SurveyCampaignStatus; label: string }[] = [
  { value: 'pending', label: 'Taslak' },
  { value: 'sent', label: 'Aktif' },
  { value: 'completed', label: 'Tamamlandı' },
  { value: 'expired', label: 'Süresi Doldu' },
];

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-slate-500">{label}</p>
      {children}
      {hint ? <p className="mt-1.5 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

const selectCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm';
const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm';

export function FilterDrawer({
  open,
  onClose,
  draft,
  onChange,
  onApply,
  onReset,
  companyOptions,
}: {
  open: boolean;
  onClose: () => void;
  draft: SurveyResultsFilters;
  onChange: (next: SurveyResultsFilters) => void;
  onApply: () => void;
  onReset: () => void;
  companyOptions: { id: string; name: string }[];
}) {
  const toggleStatus = (status: SurveyCampaignStatus) => {
    const has = draft.statuses.includes(status);
    onChange({
      ...draft,
      statuses: has ? draft.statuses.filter((s) => s !== status) : [...draft.statuses, status],
    });
  };

  return (
    <SlidePanel open={open} onClose={onClose} title="Filtrele" width={420} scrollContent={false}>
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <Field label="Tarih Aralığı">
            <div className="grid grid-cols-2 gap-2">
              <TrDateInput
                value={draft.dateFrom}
                onChange={(dateFrom) => onChange({ ...draft, dateFrom })}
                className={inputCls}
              />
              <TrDateInput
                value={draft.dateTo}
                onChange={(dateTo) => onChange({ ...draft, dateTo })}
                className={inputCls}
              />
            </div>
          </Field>

          <Field label="Durum">
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => {
                const active = draft.statuses.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleStatus(opt.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
                      active
                        ? 'bg-blue-50 text-blue-700 ring-brand-600/30'
                        : 'bg-white text-slate-600 ring-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Departman" hint="Veri alanı henüz bağlı değil.">
            <input
              className={inputCls}
              value={draft.department}
              onChange={(e) => onChange({ ...draft, department: e.target.value })}
              placeholder="Tümü"
            />
          </Field>

          <Field label="Sigorta Şirketi" hint="API üzerinden uygulanır.">
            <select
              className={selectCls}
              value={draft.insuranceCompanyId || ''}
              onChange={(e) =>
                onChange({ ...draft, insuranceCompanyId: e.target.value || null })
              }
            >
              <option value="">Tümü</option>
              {companyOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Eksper Ofisi" hint="Veri alanı henüz bağlı değil.">
            <input
              className={inputCls}
              value={draft.expertOffice}
              onChange={(e) => onChange({ ...draft, expertOffice: e.target.value })}
              placeholder="Tümü"
            />
          </Field>

          <Field label="Personel" hint="Veri alanı henüz bağlı değil.">
            <input
              className={inputCls}
              value={draft.staff}
              onChange={(e) => onChange({ ...draft, staff: e.target.value })}
              placeholder="Tümü"
            />
          </Field>

          <Field label="Tedarikçi" hint="Veri alanı henüz bağlı değil.">
            <input
              className={inputCls}
              value={draft.vendor}
              onChange={(e) => onChange({ ...draft, vendor: e.target.value })}
              placeholder="Tümü"
            />
          </Field>

          <Field label="Hasar Türü" hint="Veri alanı henüz bağlı değil.">
            <input
              className={inputCls}
              value={draft.damageType}
              onChange={(e) => onChange({ ...draft, damageType: e.target.value })}
              placeholder="Tümü"
            />
          </Field>

          <Field label="Acil Yardım / Hasar">
            <select
              className={selectCls}
              value={draft.channel}
              onChange={(e) =>
                onChange({ ...draft, channel: e.target.value as FileChannelFilter })
              }
            >
              <option value="all">Tümü</option>
              <option value="hasar">Hasar</option>
              <option value="acil">Acil Yardım</option>
            </select>
          </Field>

          <Field label="Puan Aralığı">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                max={5}
                step={0.1}
                className={inputCls}
                placeholder="Min"
                value={draft.scoreMin ?? ''}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    scoreMin: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
              <input
                type="number"
                min={1}
                max={5}
                step={0.1}
                className={inputCls}
                placeholder="Max"
                value={draft.scoreMax ?? ''}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    scoreMax: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </div>
          </Field>

          <Field
            label="NPS Aralığı"
            hint="0–10 NPS skoru tanımlı değil; bu filtre sonuç döndürmez."
          >
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={-100}
                max={100}
                className={inputCls}
                placeholder="Min"
                value={draft.npsMin ?? ''}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    npsMin: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
              <input
                type="number"
                min={-100}
                max={100}
                className={inputCls}
                placeholder="Max"
                value={draft.npsMax ?? ''}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    npsMax: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </div>
          </Field>
        </div>

        <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={onReset}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sıfırla
          </button>
          <button
            type="button"
            onClick={onApply}
            className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Uygula
          </button>
        </div>
      </div>
    </SlidePanel>
  );
}
