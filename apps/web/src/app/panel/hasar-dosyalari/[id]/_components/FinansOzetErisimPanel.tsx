'use client';

import {
  assigneeCanViewFinans,
  FinVisConfig,
  setAssigneeFinansView,
} from './financial-visibility-config';

function ErisimToggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (canView: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex shrink-0 border-b border-slate-200">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(true)}
        className={`px-2 py-1 text-[11px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap disabled:opacity-50 ${
          value
            ? 'border-brand-600 text-brand-600'
            : 'border-transparent text-slate-500 hover:text-slate-700'
        }`}
      >
        Görüntüleyebilir
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(false)}
        className={`px-2 py-1 text-[11px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap disabled:opacity-50 ${
          !value
            ? 'border-brand-600 text-brand-600'
            : 'border-transparent text-slate-500 hover:text-slate-700'
        }`}
      >
        Görüntüleyemez
      </button>
    </div>
  );
}

function ErisimSatiri({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (canView: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5">
      <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap max-w-[120px] truncate" title={label}>
        {label}
      </span>
      <ErisimToggle value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export function FinansOzetErisimPanel({
  config,
  saving,
  officeAssignees,
  onChange,
}: {
  config: FinVisConfig;
  saving: boolean;
  officeAssignees: { id: string; name: string; label: string }[];
  onChange: (next: FinVisConfig) => void;
}) {
  return (
    <div className="pt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[11px] font-semibold text-slate-500 shrink-0">Finans Özeti Erişimi</span>
        <ErisimSatiri
          label="Finans / Muhasebe"
          value={config.roles.finance}
          disabled={saving}
          onChange={(canView) => onChange({ ...config, roles: { ...config.roles, finance: canView } })}
        />
        <ErisimSatiri
          label="Yönetici / Müdür"
          value={config.roles.manager}
          disabled={saving}
          onChange={(canView) => onChange({ ...config, roles: { ...config.roles, manager: canView } })}
        />
        {officeAssignees.length === 0 ? (
          <span className="text-[11px] text-slate-400 italic">Dosya sorumlusu atanmamış</span>
        ) : (
          officeAssignees.map((p) => (
            <ErisimSatiri
              key={p.id}
              label={p.name}
              value={assigneeCanViewFinans(p.id, 'office_staff', config, officeAssignees)}
              disabled={saving}
              onChange={(canView) =>
                onChange(setAssigneeFinansView(p.id, canView, 'office_staff', config, officeAssignees))
              }
            />
          ))
        )}
        {saving && <span className="text-[11px] text-slate-400">Kaydediliyor…</span>}
      </div>
    </div>
  );
}
