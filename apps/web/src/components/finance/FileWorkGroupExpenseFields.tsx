'use client';

import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { formatTryAmount } from '@/utils/format-try-amount';

export type FileWorkGroupAuditLine = {
  workGroupId: string;
  workGroupName: string;
  budgeted: number;
  spent: number;
  remaining: number;
  source: 'butce' | 'rapor_alis';
  jobDefinitions: string[];
};

const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

export function FileWorkGroupExpenseFields({
  groups,
  workGroupId,
  workSubGroupName,
  onWorkGroup,
  onJob,
  inputClassName,
}: {
  groups: FileWorkGroupAuditLine[];
  workGroupId: string;
  workSubGroupName: string;
  onWorkGroup: (id: string) => void;
  onJob: (name: string) => void;
  inputClassName: string;
}) {
  const selected = groups.find((g) => g.workGroupId === workGroupId) ?? null;
  const fmt = (n: number) => formatTryAmount(n, { fractionDigits: 0 });

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Bu dosyanın onarım raporunda iş grubu yok. Masraf, rapor satırından denetlenir — önce rapora iş grubu ekleyin.
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="file-work-group-expense-fields">
      <div>
        <label className={labelCls}>
          İş Grubu / İş Tanımı{' '}
          <span className="ml-1 text-xs font-normal text-slate-400">(Zorunlu)</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <SearchableSelect
            options={groups.map((g) => ({ value: g.workGroupId, label: g.workGroupName }))}
            value={workGroupId}
            onChange={(id) => {
              onWorkGroup(id);
              onJob('');
            }}
            placeholder="İş grubu ara..."
            emptyText="Raporda iş grubu yok"
            inputClassName={inputClassName}
          />
          <SearchableSelect
            options={(selected?.jobDefinitions ?? []).map((n) => ({ value: n, label: n }))}
            value={workSubGroupName}
            onChange={onJob}
            placeholder={!workGroupId ? 'Önce iş grubu seçin…' : 'İş tanımı ara...'}
            emptyText="İş tanımı yok"
            disabled={!workGroupId}
            inputClassName={inputClassName}
          />
        </div>
      </div>
      {selected && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
          <p className="mb-1.5 text-[10px] text-slate-500">
            {selected.source === 'butce' ? 'Bütçelenen (iş grubu)' : 'Rapor alış tutarı (iş grubu)'}
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="text-[10px] text-slate-500">Plan</p>
              <p className="font-semibold text-slate-800">{fmt(selected.budgeted)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Harcanan</p>
              <p className="font-semibold text-brand-700">{fmt(selected.spent)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Kalan</p>
              <p className={`font-semibold ${selected.remaining < 0 ? 'text-red-700' : 'text-status-success'}`}>
                {fmt(selected.remaining)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
