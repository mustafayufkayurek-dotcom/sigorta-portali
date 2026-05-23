'use client';

import { ScopeValidationErrors } from '../_lib/user-scope-validation';
import { RoleScopeRules, ScopeFormState, isRequired, isVisible } from '../_lib/user-scope-rules';

interface Option {
  id: string;
  name: string;
  code?: string;
}

interface ServiceArea {
  provinceId: string;
  districtId: string | null;
}

interface Props {
  sectionId?: string;
  title?: string;
  rules: RoleScopeRules;
  departments: Option[];
  operationScopes: Option[];
  assignmentRoles: Option[];
  workflows: Option[];
  provinces: Array<{ id: string; name: string; plateCode?: string }>;
  districts: Array<{ id: string; name: string }>;
  formScope: {
    departmentIds: string[];
    primaryDepartmentId: string;
    operationScope: string;
    workflowScopeCodes: string[];
    assignmentEnabled: boolean;
    assignmentRoleCode: string;
    countrywide: boolean;
    serviceAreas: ServiceArea[];
  };
  errors: ScopeValidationErrors;
  selectedProvinceId: string;
  onSelectedProvinceChange: (value: string) => void;
  onToggleDepartment: (value: string) => void;
  onScopeChange: (field: keyof ScopeFormState, value: any) => void;
  onToggleWorkflow: (value: string) => void;
  onToggleServiceArea: (provinceId: string, districtId: string | null) => void;
  onAddWholeProvince: () => void;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-500">{message}</p>;
}

export function UserScopeSections({
  sectionId,
  title = 'Operasyon Yapısı',
  rules,
  departments,
  operationScopes,
  assignmentRoles,
  workflows,
  provinces,
  districts,
  formScope,
  errors,
  selectedProvinceId,
  onSelectedProvinceChange,
  onToggleDepartment,
  onScopeChange,
  onToggleWorkflow,
  onToggleServiceArea,
  onAddWholeProvince,
}: Props) {
  const selectedDepartments = departments.filter((item) => formScope.departmentIds.includes(item.id));

  return (
    <div className="space-y-6">
      <section id={sectionId} className="rounded-2xl border border-slate-200 p-4">
        <h4 className="mb-4 text-base font-bold text-slate-900">{title}</h4>
        <div className="grid gap-4 md:grid-cols-2">
          {isVisible(rules.departmentScope) && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Departman Yetkisi
                {isRequired(rules.departmentScope) && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 p-3">
                {departments.map((department) => {
                  const checked = formScope.departmentIds.includes(department.id);
                  return (
                    <label
                      key={department.id}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        checked
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleDepartment(department.id)}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      {department.name}
                    </label>
                  );
                })}
              </div>
              <FieldError message={errors.departmentIds} />
            </div>
          )}

          {isVisible(rules.primaryDepartment) && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Varsayılan Departman
                {isRequired(rules.primaryDepartment) && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <select
                value={formScope.primaryDepartmentId}
                onChange={(e) => onScopeChange('primaryDepartmentId', e.target.value)}
                disabled={selectedDepartments.length === 0}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
              >
                <option value="">Varsayılan departman seçin...</option>
                {selectedDepartments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-0.5">Kullanıcının sistemde ilk açılacağı ana departmandır.</p>
              <FieldError message={errors.primaryDepartmentId} />
            </div>
          )}

          {isVisible(rules.operationScope) && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Çalışma Kapsamı
                {isRequired(rules.operationScope) && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <select
                value={formScope.operationScope}
                onChange={(e) => onScopeChange('operationScope', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
              >
                <option value="">Çalışma kapsamı seçin...</option>
                {operationScopes.map((option) => (
                  <option key={option.code ?? option.id} value={option.code ?? option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-0.5">Kullanıcının işlem yapabileceği operasyon alanlarını belirler.</p>
              <FieldError message={errors.operationScope} />
            </div>
          )}

          {isVisible(rules.workflowScope) && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                İş Akışı Kapsamı
                {isRequired(rules.workflowScope) && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {workflows.map((workflow) => {
                  const key = workflow.code ?? workflow.id;
                  return (
                    <label key={key} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={formScope.workflowScopeCodes.includes(key)}
                        onChange={() => onToggleWorkflow(key)}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      {workflow.name}
                    </label>
                  );
                })}
              </div>
              <FieldError message={errors.workflowScopeCodes} />
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 p-4">
        <h4 className="text-sm font-semibold text-slate-900 mb-4">Atama Uygunluğu</h4>
        <div className="grid gap-4 md:grid-cols-2">
          {isVisible(rules.assignmentEnabled) && (
            <div className="rounded-xl border border-slate-200 px-4 py-3 md:col-span-2">
              <label className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
                <span>
                  Dosya Atanabilir mi?
                  {isRequired(rules.assignmentEnabled) && <span className="text-red-500 ml-0.5">*</span>}
                </span>
                <input
                  type="checkbox"
                  checked={formScope.assignmentEnabled}
                  onChange={(e) => onScopeChange('assignmentEnabled', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
              </label>
              <p className="text-xs text-gray-400 mt-0.5">Bu kullanıcıya dosya atanıp atanamayacağını belirler.</p>
            </div>
          )}

          {isVisible(rules.assignmentRole) && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Dosya Atama Rolü
                {isRequired(rules.assignmentRole) && formScope.assignmentEnabled && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <select
                value={formScope.assignmentRoleCode}
                onChange={(e) => onScopeChange('assignmentRoleCode', e.target.value)}
                disabled={!formScope.assignmentEnabled}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm disabled:bg-slate-50"
              >
                <option value="">Dosya atama rolü seçin...</option>
                {assignmentRoles.map((option) => (
                  <option key={option.code ?? option.id} value={option.code ?? option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <FieldError message={errors.assignmentRoleCode} />
            </div>
          )}

          {isVisible(rules.countrywide) && (
            <div className="rounded-xl border border-slate-200 px-4 py-3">
              <label className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
                <span>
                  Tüm Türkiye kapsamı
                  {isRequired(rules.countrywide) && <span className="text-red-500 ml-0.5">*</span>}
                </span>
                <input
                  type="checkbox"
                  checked={formScope.countrywide}
                  onChange={(e) => onScopeChange('countrywide', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
              </label>
            </div>
          )}

          {isVisible(rules.regionScope) && !formScope.countrywide && (
            <div className="md:col-span-2 rounded-xl border border-slate-200 p-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Bölge kapsamı
                {isRequired(rules.regionScope) && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <div className="flex gap-2 mb-3">
                <select
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                  value={selectedProvinceId}
                  onChange={(e) => onSelectedProvinceChange(e.target.value)}
                >
                  <option value="">İl seçin...</option>
                  {provinces.map((province) => (
                    <option key={province.id} value={province.id}>
                      {province.plateCode ? `${province.plateCode} - ` : ''}
                      {province.name}
                    </option>
                  ))}
                </select>
                {selectedProvinceId && (
                  <button
                    type="button"
                    onClick={onAddWholeProvince}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700"
                  >
                    Tüm İlçeleri Ekle
                  </button>
                )}
              </div>

              {selectedProvinceId && districts.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  {districts.map((district) => {
                    const checked = formScope.serviceAreas.some(
                      (item) => item.provinceId === selectedProvinceId && item.districtId === district.id,
                    );
                    return (
                      <label key={district.id} className="flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleServiceArea(selectedProvinceId, district.id)}
                          className="rounded border-slate-300 text-blue-600"
                        />
                        {district.name}
                      </label>
                    );
                  })}
                </div>
              )}

              {formScope.serviceAreas.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {formScope.serviceAreas.map((item) => {
                    const province = provinces.find((entry) => entry.id === item.provinceId);
                    const district = districts.find((entry) => entry.id === item.districtId);
                    const label = item.districtId
                      ? `${province?.name ?? item.provinceId} / ${district?.name ?? item.districtId}`
                      : `${province?.name ?? item.provinceId} (Tümü)`;
                    return (
                      <span
                        key={`${item.provinceId}:${item.districtId ?? ''}`}
                        className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs text-blue-700"
                      >
                        {label}
                        <button
                          type="button"
                          onClick={() => onToggleServiceArea(item.provinceId, item.districtId)}
                          className="text-blue-400 hover:text-red-500"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <FieldError message={errors.serviceAreas} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}