'use client';

interface Props {
  title?: string;
  roleName: string;
  departmentNames: string[];
  primaryDepartmentName: string;
  assignmentEnabled: boolean;
  assignmentRoleLabel: string;
  countrywide: boolean;
  regionCount: number;
  workflowLabels: string[];
}

export function UserImpactSummary({
  title = 'Etki Özeti',
  roleName,
  departmentNames,
  primaryDepartmentName,
  assignmentEnabled,
  assignmentRoleLabel,
  countrywide,
  regionCount,
  workflowLabels,
}: Props) {
  const rows = [
    { label: 'Rol', value: roleName || '—' },
    { label: 'Departmanlar', value: departmentNames.length ? departmentNames.join(', ') : '—' },
    { label: 'Varsayılan Departman', value: primaryDepartmentName || '—' },
    { label: 'Atama uygunluğu', value: assignmentEnabled ? 'Açık' : 'Kapalı' },
    { label: 'Dosya Atama Rolü', value: assignmentRoleLabel || '—' },
    { label: 'Çalışma Kapsamı', value: countrywide ? 'Tüm Türkiye' : `${regionCount} bölge` },
    { label: 'Workflow', value: workflowLabels.length ? workflowLabels.join(', ') : '—' },
  ];

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
      <h4 className="mb-3 text-base font-bold text-slate-900">{title}</h4>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl bg-white/80 border border-blue-100 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">{row.label}</p>
            <p className="text-sm font-medium text-slate-800">{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}