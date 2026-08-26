'use client';

import { useEffect, useRef, useState } from 'react';
import { toTitleCaseTR } from '@/utils/text-helpers';
import type { InboxFileOpenDraft } from '@/utils/inbox-file-open-draft';
import { fetchInboxFileSubjectNames } from '@/utils/damage-reason-options';
import { matchCatalogFileSubject } from '@sigorta/shared';
import { isInsuranceBrandFileNo } from '@/utils/claim-list-column-fields';
import {
  CUSTOMER_TYPE_OPTIONS,
  DEFAULT_CUSTOMER_SUB_TYPES,
  customerSubTypesForPicker,
  type CustomerType,
} from '@/utils/customer-form-helpers';

interface InsuranceCompany {
  id: string;
  name: string;
}

interface CustomerMatchCandidate {
  id: string;
  name: string;
}

interface RoutingSuggestion {
  suggestedAssigneeId?: string | null;
  suggestedAssigneeName?: string | null;
  customerMatch: {
    status: 'found' | 'ambiguous' | 'not_found';
    customer?: CustomerMatchCandidate;
    candidates?: CustomerMatchCandidate[];
  };
  assistantCustomerMatch?: {
    status: 'found' | 'ambiguous' | 'not_found';
    customer?: CustomerMatchCandidate;
    candidates?: CustomerMatchCandidate[];
  };
  warnings: string[];
  insuranceCompanyId?: string | null;
  confidence?: number;
  reasons?: string[];
  city?: string | null;
  district?: string | null;
}

interface AutoAssignPreview {
  suggestion: RoutingSuggestion;
  missingFields: string[];
  departmentCode: string | null;
  departmentName: string | null;
}

interface PanelUser {
  id: string;
  firstName: string;
  lastName: string;
}

function ReadonlyRow({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800 mt-0.5">{value}</dd>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  onBlurTitleCase,
  required,
  disabled,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlurTitleCase?: boolean;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  multiline?: boolean;
}) {
  const cls =
    'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60';

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">
        {label}
        {required && <span className="text-status-danger ml-0.5">*</span>}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={
            onBlurTitleCase
              ? (e) => {
                  const v = toTitleCaseTR(e.target.value.trim());
                  if (v) onChange(v);
                }
              : undefined
          }
          rows={2}
          disabled={disabled}
          placeholder={placeholder}
          className={`${cls} resize-none`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={
            onBlurTitleCase
              ? (e) => {
                  const v = toTitleCaseTR(e.target.value.trim());
                  if (v) onChange(v);
                }
              : undefined
          }
          disabled={disabled}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </div>
  );
}

function NewCustomerTypeFields({
  entityType,
  subType,
  onEntityTypeChange,
  onSubTypeChange,
  disabled,
}: {
  entityType: CustomerType;
  subType: string;
  onEntityTypeChange: (v: CustomerType) => void;
  onSubTypeChange: (v: string) => void;
  disabled?: boolean;
}) {
  const subOptions = customerSubTypesForPicker(DEFAULT_CUSTOMER_SUB_TYPES, entityType);

  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Müşteri Tipi
          <span className="text-status-danger ml-0.5">*</span>
        </label>
        <select
          value={entityType}
          onChange={(e) => {
            const next = e.target.value as CustomerType;
            onEntityTypeChange(next);
            const nextSubs = customerSubTypesForPicker(DEFAULT_CUSTOMER_SUB_TYPES, next);
            const keep = nextSubs.some((s) => s.value === subType);
            if (!keep) {
              onSubTypeChange(next === 'individual' ? 'insured' : (nextSubs[0]?.value ?? ''));
            }
          }}
          disabled={disabled}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
        >
          {CUSTOMER_TYPE_OPTIONS.map((opt) => (
            <option key={opt.val} value={opt.val}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Alt Tip
          <span className="text-status-danger ml-0.5">*</span>
        </label>
        <select
          value={subType}
          onChange={(e) => onSubTypeChange(e.target.value)}
          disabled={disabled}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
        >
          <option value="">Alt tip seçin…</option>
          {subOptions.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function InboxOpenFileModal({
  open,
  kind,
  draft,
  instruction,
  onInstructionChange,
  confirmLabel,
  loading,
  error,
  routing,
  users,
  usersLoading,
  selectedAssigneeId,
  onAssigneeChange,
  selectedCustomerId,
  onCustomerChange,
  createNewCustomer,
  onCreateNewCustomerChange,
  newCustomerEntityType = 'individual',
  onNewCustomerEntityTypeChange,
  newCustomerSubType = 'insured',
  onNewCustomerSubTypeChange,
  insuredName,
  onInsuredNameChange,
  insuredPhone,
  onInsuredPhoneChange,
  insuredAddress,
  onInsuredAddressChange,
  fileNo,
  onFileNoChange,
  policyNo,
  onPolicyNoChange,
  claimNo,
  onClaimNoChange,
  lossType,
  onLossTypeChange,
  fileSubject,
  onFileSubjectChange,
  insuranceCompanies,
  insuranceCompanyId,
  onInsuranceCompanyChange,
  insuranceRequired,
  assistantCompanies,
  selectedAssistantCustomerId,
  onAssistantCustomerChange,
  assigneeAssistantScopeLabel,
  missingFields,
  autoAssignPreview,
  autoAssignLoading,
  onRequestAutoAssign,
  onAcceptAutoAssign,
  onRejectAutoAssign,
  contextLoading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  kind: 'claim' | 'emergency';
  draft: InboxFileOpenDraft | null;
  contextLoading?: boolean;
  instruction: string;
  onInstructionChange: (v: string) => void;
  confirmLabel: string;
  loading: boolean;
  error: string;
  routing?: RoutingSuggestion | null;
  users?: PanelUser[];
  usersLoading?: boolean;
  selectedAssigneeId?: string;
  onAssigneeChange?: (v: string) => void;
  selectedCustomerId?: string;
  onCustomerChange?: (v: string) => void;
  createNewCustomer?: boolean;
  onCreateNewCustomerChange?: (v: boolean) => void;
  newCustomerEntityType?: CustomerType;
  onNewCustomerEntityTypeChange?: (v: CustomerType) => void;
  newCustomerSubType?: string;
  onNewCustomerSubTypeChange?: (v: string) => void;
  insuredName: string;
  onInsuredNameChange: (v: string) => void;
  insuredPhone: string;
  onInsuredPhoneChange: (v: string) => void;
  insuredAddress: string;
  onInsuredAddressChange: (v: string) => void;
  fileNo: string;
  onFileNoChange: (v: string) => void;
  policyNo: string;
  onPolicyNoChange: (v: string) => void;
  claimNo: string;
  onClaimNoChange: (v: string) => void;
  lossType: string;
  onLossTypeChange: (v: string) => void;
  fileSubject: string;
  onFileSubjectChange: (v: string) => void;
  insuranceCompanies?: InsuranceCompany[];
  insuranceCompanyId?: string;
  onInsuranceCompanyChange?: (v: string) => void;
  insuranceRequired?: boolean;
  assistantCompanies?: CustomerMatchCandidate[];
  selectedAssistantCustomerId?: string;
  onAssistantCustomerChange?: (v: string) => void;
  assigneeAssistantScopeLabel?: string;
  missingFields?: string[];
  autoAssignPreview?: AutoAssignPreview | null;
  autoAssignLoading?: boolean;
  onRequestAutoAssign?: () => void;
  onAcceptAutoAssign?: () => void;
  onRejectAutoAssign?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [subjectCatalog, setSubjectCatalog] = useState<string[]>([]);
  const userTouchedSubject = useRef(false);

  useEffect(() => {
    if (!open) {
      userTouchedSubject.current = false;
      setSubjectCatalog([]);
      return;
    }
    let cancelled = false;
    void fetchInboxFileSubjectNames(kind)
      .then((names) => {
        if (!cancelled) setSubjectCatalog(names);
      })
      .catch(() => {
        if (!cancelled) setSubjectCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, kind]);

  useEffect(() => {
    if (!open || userTouchedSubject.current || subjectCatalog.length === 0) return;
    const matched = matchCatalogFileSubject(fileSubject, subjectCatalog);
    if (matched && matched !== fileSubject) onFileSubjectChange(matched);
  }, [open, subjectCatalog, fileSubject, onFileSubjectChange]);

  if (!open || !draft) return null;

  const insuranceOk =
    kind !== 'claim'
    || !insuranceRequired
    || !!insuranceCompanyId
    || (insuranceCompanies?.length ?? 0) <= 1;
  const insuredOk = !!insuredName.trim();
  const assistantOk = kind !== 'emergency' || !!selectedAssistantCustomerId?.trim();
  const instructionOk = instruction.trim().length >= 3;
  const newCustomerTypeOk =
    !createNewCustomer
    || (!!newCustomerEntityType && !!newCustomerSubType?.trim());
  const fileNoBrand = isInsuranceBrandFileNo(fileNo, draft.insurer);
  const fileNoIsPolicy = Boolean(fileNo.trim() && policyNo.trim() && fileNo.trim() === policyNo.trim());
  const fileSubjectOk = !!fileSubject.trim();
  const canConfirm =
    !loading && instructionOk && insuranceOk && insuredOk && assistantOk && newCustomerTypeOk && fileSubjectOk && !fileNoBrand && !fileNoIsPolicy;

  const confirmBlockers: string[] = [];
  if (!instructionOk) confirmBlockers.push('Talimat en az 3 karakter olmalı');
  if (!insuredOk) confirmBlockers.push('Sigortalı adı soyadı gerekli');
  if (!fileSubjectOk) confirmBlockers.push('Dosya konusu seçilmeli');
  if (kind === 'emergency' && !assistantOk) confirmBlockers.push('Asistan firması seçilmeli');
  if (kind === 'claim' && !insuranceOk) confirmBlockers.push('Sigorta şirketi seçilmeli');
  if (fileNoBrand) confirmBlockers.push('Dosya No sigorta şirketi adı olamaz');
  if (fileNoIsPolicy) confirmBlockers.push('Poliçe numarası dosya no olarak kaydedilemez');
  if (createNewCustomer && !newCustomerTypeOk) {
    confirmBlockers.push('Müşteri tipi ve alt tip seçilmeli');
  }

  const enableCreateCustomerToggle = !!onCreateNewCustomerChange;
  const showTypeFields =
    !!createNewCustomer
    && !!onNewCustomerEntityTypeChange
    && !!onNewCustomerSubTypeChange;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[92vh] flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
          <h3 className="text-lg font-bold text-slate-800">
            {kind === 'claim' ? 'Hasar Dosyası Aç' : 'Acil Yardım Dosyası Aç'}
          </h3>
          <p className="text-sm text-slate-500 mt-1 line-clamp-2" title={draft.subject}>
            {draft.subject}
          </p>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {draft.manualFallback && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              Mail içeriği otomatik okunamadı veya eksik. Tüm alanları manuel girebilirsiniz;
              dosya sorumlusu eksper sisteme giremese bile dosyayı buradan tamamlayabilir.
            </div>
          )}

          {draft.fileNoWarning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
              {draft.fileNoWarning}
            </div>
          )}

          {contextLoading && (
            <p className="text-xs text-slate-400 animate-pulse">Mail alanları güncelleniyor…</p>
          )}

          {routing && routing.warnings.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {routing.warnings
                .filter((w) => !w.startsWith('Eksik bilgi:'))
                .map((w) => (
                  <span key={w} className="badge badge-amber">{w}</span>
                ))}
            </div>
          )}

          {missingFields && missingFields.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50/60 px-3 py-2.5">
              <p className="text-xs font-medium text-red-800 mb-1.5">Eksik Bilgiler</p>
              <ul className="text-sm text-red-900/90 space-y-0.5 list-disc list-inside">
                {missingFields.map((field) => (
                  <li key={field}>
                    {field.startsWith('Eksik bilgi:') ? field.replace('Eksik bilgi: ', '') : field}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-red-700/80 mt-1.5">
                Eksik alanları manuel tamamlayın veya mail kaynağını kontrol edin.
              </p>
            </div>
          )}

          {draft.aiSummary && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2.5">
              <p className="text-xs font-medium text-blue-800 mb-1">AI Özeti</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{draft.aiSummary}</p>
            </div>
          )}

          <section className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 bg-slate-50/80 border-b border-slate-100">
              <p className="text-xs font-medium text-slate-600">İhbar Bağlamı</p>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-3 py-3 text-sm">
              <ReadonlyRow label="İhbar Konusu" value={draft.subject} />
              <ReadonlyRow label="Form Türü" value={draft.formTitle} />
              <ReadonlyRow label="Asistan Firma" value={draft.assistantFirm} />
              <ReadonlyRow
                label="Gönderen Personel"
                value={
                  draft.senderPerson
                    ? `${draft.senderPerson} · ${draft.senderEmail}`
                    : draft.senderEmail
                }
              />
              <ReadonlyRow label="Sigorta Şirketi (Mail)" value={draft.insurer} />
              <ReadonlyRow label="Hasar Açıklaması" value={draft.description} />
            </dl>
          </section>

          <section className="rounded-xl border border-emerald-200 bg-emerald-50/30 overflow-hidden">
            <div className="px-3 py-2 border-b border-emerald-100 bg-emerald-50/60">
              <p className="text-xs font-medium text-emerald-800">Sigortalı Bilgileri</p>
              <p className="text-[11px] text-emerald-700/80 mt-0.5">
                Mail formundan çıkarıldı — dosyaya bu bilgiler yazılır
              </p>
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <FieldInput
                  label="Sigortalı Adı Soyadı"
                  value={insuredName}
                  onChange={onInsuredNameChange}
                  onBlurTitleCase
                  required
                  disabled={loading || usersLoading}
                />
              </div>
              <FieldInput
                label="Sigortalı Telefonu"
                value={insuredPhone}
                onChange={onInsuredPhoneChange}
                disabled={loading || usersLoading}
                placeholder="05xx xxx xx xx"
              />
              <FieldInput
                label="Dosya No"
                value={fileNo}
                onChange={onFileNoChange}
                disabled={loading || usersLoading}
                placeholder="Mail / referans"
              />
              <div className="sm:col-span-2">
                <FieldInput
                  label="Sigortalı Adresi"
                  value={insuredAddress}
                  onChange={onInsuredAddressChange}
                  onBlurTitleCase
                  disabled={loading || usersLoading}
                  multiline
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 bg-slate-50/80 border-b border-slate-100">
              <p className="text-xs font-medium text-slate-600">Dosya Detayları</p>
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Dosya Konusu
                  <span className="text-status-danger ml-0.5">*</span>
                </label>
                <select
                  value={fileSubject}
                  onChange={(e) => {
                    userTouchedSubject.current = true;
                    onFileSubjectChange(e.target.value);
                  }}
                  disabled={loading || usersLoading}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                >
                  <option value="">Seçiniz...</option>
                  {subjectCatalog.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  {fileSubject.trim() && !subjectCatalog.some((n) => n.toLocaleLowerCase('tr-TR') === fileSubject.trim().toLocaleLowerCase('tr-TR')) && (
                    <option value={fileSubject}>{fileSubject}</option>
                  )}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Katalogdan seçin. Mail konusu kaba ise (ör. Tesisat) doğru hizmet kolunu işaretleyin.
                </p>
              </div>
              <FieldInput
                label="Poliçe No"
                value={policyNo}
                onChange={onPolicyNoChange}
                disabled={loading || usersLoading}
              />
              <FieldInput
                label="Referans No"
                value={claimNo}
                onChange={onClaimNoChange}
                disabled={loading || usersLoading}
              />
              <FieldInput
                label="Hasar Şekli"
                value={lossType}
                onChange={onLossTypeChange}
                onBlurTitleCase
                disabled={loading || usersLoading}
                placeholder="Formdan çıkarılan hasar türü"
              />
            </div>
          </section>

          {onAssigneeChange && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-medium text-slate-600">
                  Dosya Sorumlusu
                </label>
                {onRequestAutoAssign && (
                  <button
                    type="button"
                    onClick={onRequestAutoAssign}
                    disabled={loading || usersLoading || autoAssignLoading}
                    className="text-xs font-medium text-brand-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    {autoAssignLoading ? 'Hesaplanıyor…' : 'Otomatik Ata'}
                  </button>
                )}
              </div>

              {autoAssignPreview && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-2">
                  <p className="text-xs font-medium text-blue-900">Otomatik Atama Önerisi</p>
                  {autoAssignPreview.departmentName && (
                    <p className="text-sm text-slate-700">
                      Departman: <span className="font-medium">{autoAssignPreview.departmentName}</span>
                    </p>
                  )}
                  {autoAssignPreview.suggestion.city && (
                    <p className="text-sm text-slate-700">
                      Bölge:{' '}
                      <span className="font-medium">
                        {autoAssignPreview.suggestion.city}
                        {autoAssignPreview.suggestion.district
                          ? ` / ${autoAssignPreview.suggestion.district}`
                          : ''}
                      </span>
                    </p>
                  )}
                  {autoAssignPreview.suggestion.suggestedAssigneeName ? (
                    <p className="text-sm text-slate-700">
                      Önerilen Sorumlu:{' '}
                      <span className="font-medium">
                        {autoAssignPreview.suggestion.suggestedAssigneeName}
                      </span>
                      {typeof autoAssignPreview.suggestion.confidence === 'number' && (
                        <span className="text-slate-500 ml-1">
                          (%{Math.round(autoAssignPreview.suggestion.confidence * 100)} güven)
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-amber-800">
                      Departman ve bölgeye uygun otomatik sorumlu bulunamadı.
                    </p>
                  )}
                  {autoAssignPreview.suggestion.reasons && autoAssignPreview.suggestion.reasons.length > 0 && (
                    <ul className="text-[11px] text-slate-600 list-disc list-inside">
                      {autoAssignPreview.suggestion.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  )}
                  {autoAssignPreview.missingFields.length > 0 && (
                    <p className="text-xs text-red-700">
                      Eksik: {autoAssignPreview.missingFields.join(', ')}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    {onAcceptAutoAssign && (
                      <button
                        type="button"
                        onClick={onAcceptAutoAssign}
                        disabled={loading || !autoAssignPreview.suggestion.suggestedAssigneeId}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50"
                      >
                        Onayla
                      </button>
                    )}
                    {onRejectAutoAssign && (
                      <button
                        type="button"
                        onClick={onRejectAutoAssign}
                        disabled={loading}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
                      >
                        Reddet
                      </button>
                    )}
                  </div>
                </div>
              )}

              <select
                value={selectedAssigneeId ?? ''}
                onChange={(e) => onAssigneeChange(e.target.value)}
                disabled={loading || usersLoading}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              >
                <option value="">Sorumlu seçin…</option>
                {routing?.suggestedAssigneeId && routing.suggestedAssigneeName && (
                  <option value={routing.suggestedAssigneeId}>
                    {routing.suggestedAssigneeName} (Önerilen)
                  </option>
                )}
                {(users ?? [])
                  .filter((u) => u.id !== routing?.suggestedAssigneeId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
              </select>
              {(users ?? []).length === 0 && !usersLoading && (
                <p className="text-[11px] text-amber-700">
                  Atanabilir dosya sorumlusu listesi boş. Departman üyeliği veya yetki kontrol edin.
                </p>
              )}

              {kind === 'emergency' && onAssistantCustomerChange && (
                <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-3 space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Asistan Firma Sorumluluğu
                      <span className="text-status-danger ml-0.5">*</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Dosyanın hangi asistan firmasına bağlanacağını seçin. Mailden gelen firma ön seçilir.
                    </p>
                  </div>
                  {assigneeAssistantScopeLabel && selectedAssigneeId && (
                    <p className="text-xs text-orange-900/90 rounded-lg bg-orange-100/70 px-2.5 py-1.5">
                      Seçilen sorumlunun kapsamı: <span className="font-medium">{assigneeAssistantScopeLabel}</span>
                    </p>
                  )}
                  {routing?.assistantCustomerMatch?.status === 'ambiguous'
                    && routing.assistantCustomerMatch.candidates
                    && routing.assistantCustomerMatch.candidates.length > 0 ? (
                    <select
                      value={selectedAssistantCustomerId ?? ''}
                      onChange={(e) => onAssistantCustomerChange(e.target.value)}
                      disabled={loading || usersLoading}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white"
                    >
                      <option value="">Asistan firması seçin…</option>
                      {routing.assistantCustomerMatch.candidates.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={selectedAssistantCustomerId ?? ''}
                      onChange={(e) => onAssistantCustomerChange(e.target.value)}
                      disabled={loading || usersLoading}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white"
                    >
                      <option value="">Asistan firması seçin…</option>
                      {(assistantCompanies ?? []).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                  {draft.assistantFirm && (
                    <p className="text-[11px] text-slate-500">
                      Mail kaynağı: {draft.assistantFirm}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {kind === 'claim' && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 space-y-2">
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1">Eksper Ofisi</p>
                <p className="text-sm text-slate-600">
                  Gönderen e-posta ile eksper ofisi otomatik bağlanır (müşteri kartı eşleşirse).
                  Sigortalı bilgileri yukarıdaki alanlardan dosyaya yazılır.
                </p>
              </div>
              {enableCreateCustomerToggle && (
                <div className="pt-1 border-t border-slate-200/80">
                  <p className="text-xs font-medium text-slate-600 mb-1.5">Sigortalı Müşteri Kartı</p>
                  <p className="text-[11px] text-slate-500 mb-2">
                    İsteğe bağlı: sigortalı için ayrı CRM kartı oluşturur. Dosyanın eksper ofisi bağlantısını değiştirmez.
                  </p>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={!!createNewCustomer}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        onCreateNewCustomerChange?.(checked);
                        if (checked) {
                          onNewCustomerEntityTypeChange?.('individual');
                          onNewCustomerSubTypeChange?.('insured');
                        }
                      }}
                      disabled={loading || usersLoading}
                    />
                    Yeni Müşteri Oluştur ({insuredName || 'sigortalı adı'})
                  </label>
                  {showTypeFields && (
                    <NewCustomerTypeFields
                      entityType={newCustomerEntityType}
                      subType={newCustomerSubType}
                      onEntityTypeChange={onNewCustomerEntityTypeChange}
                      onSubTypeChange={onNewCustomerSubTypeChange}
                      disabled={loading || usersLoading}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {kind === 'emergency' && (routing || onCustomerChange) && onCustomerChange && routing && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
              <p className="text-xs font-medium text-slate-600 mb-2">Müşteri</p>
              {routing.customerMatch.status === 'found' && routing.customerMatch.customer && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    checked={!createNewCustomer}
                    onChange={() => onCreateNewCustomerChange?.(false)}
                  />
                  Mevcut Müşteri: {routing.customerMatch.customer.name}
                </label>
              )}
              {routing.customerMatch.status === 'ambiguous' && routing.customerMatch.candidates && (
                <select
                  value={selectedCustomerId ?? ''}
                  onChange={(e) => {
                    onCreateNewCustomerChange?.(false);
                    onCustomerChange(e.target.value);
                  }}
                  disabled={loading || createNewCustomer}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white mb-2"
                >
                  <option value="">Müşteri seçin…</option>
                  {routing.customerMatch.candidates.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              {routing.customerMatch.status === 'not_found' && (
                <>
                  <p className="text-sm text-slate-600 mb-2">
                    Sigortalı müşteri kaydı bulunamadı. Dosyayı müşteri bağlamadan açabilirsiniz.
                  </p>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={!!createNewCustomer}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        onCreateNewCustomerChange?.(checked);
                        if (checked) {
                          onNewCustomerEntityTypeChange?.('individual');
                          onNewCustomerSubTypeChange?.('insured');
                        }
                      }}
                    />
                    Yeni Müşteri Oluştur ({insuredName || 'sigortalı adı'})
                  </label>
                </>
              )}
              {(routing.customerMatch.status === 'found' || routing.customerMatch.status === 'ambiguous') && (
                <label className="flex items-center gap-2 text-sm text-slate-700 mt-2">
                  <input
                    type="radio"
                    checked={!!createNewCustomer}
                    onChange={() => {
                      onCreateNewCustomerChange?.(true);
                      onNewCustomerEntityTypeChange?.('individual');
                      onNewCustomerSubTypeChange?.('insured');
                    }}
                  />
                  Yeni Müşteri Oluştur
                </label>
              )}
              {showTypeFields && (
                <NewCustomerTypeFields
                  entityType={newCustomerEntityType}
                  subType={newCustomerSubType}
                  onEntityTypeChange={onNewCustomerEntityTypeChange}
                  onSubTypeChange={onNewCustomerSubTypeChange}
                  disabled={loading || usersLoading}
                />
              )}
            </div>
          )}

          {kind === 'claim' && insuranceCompanies && insuranceCompanies.length > 0 && (
            <>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Sigorta Şirketi (Sistem)
                {insuranceRequired && <span className="text-status-danger ml-0.5">*</span>}
              </label>
              <select
                value={insuranceCompanyId ?? ''}
                onChange={(e) => onInsuranceCompanyChange?.(e.target.value)}
                disabled={loading}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              >
                {insuranceCompanies.length > 1 && (
                  <option value="">Sigorta şirketi seçin…</option>
                )}
                {insuranceCompanies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </>
          )}

          <FieldInput
            label="Talimat / Not"
            value={instruction}
            onChange={onInstructionChange}
            disabled={loading}
            multiline
            placeholder="Dosya sorumlusuna iletilecek talimat…"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 px-6 pb-2">{error}</p>
        )}

        <div className="flex flex-col items-end gap-1.5 px-6 py-4 border-t border-slate-100 shrink-0">
          {!canConfirm && !loading && confirmBlockers.length > 0 && (
            <p className="text-[11px] text-slate-500 w-full text-right">
              {confirmBlockers.join(' · ')}
            </p>
          )}
          <div className="flex justify-end gap-3 w-full">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl disabled:opacity-50"
          >
            {loading ? 'İşleniyor…' : confirmLabel}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
