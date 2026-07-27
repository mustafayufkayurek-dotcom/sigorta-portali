'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { ADDRESS_FIELD } from '@/constants/address-fields';
import { provinces as STATIC_PROVINCES, districts as STATIC_DISTRICTS } from '@/data/turkey-locations';
import { CustomerSelectModal } from '@/components/CustomerSelectModal';
import { useToast } from '@/contexts/ToastContext';
import { toTitleCaseTR, resolveClaimIhbarKonusu } from '@/utils/text-helpers';
import { customerDisplayName } from '@/utils/customer-form-helpers';
import { HASAR_EXPERT_CUSTOMER_SUB_TYPE } from '@/app/panel/kullanicilar/_lib/user-invite-config';
import { resolveHasarInsuredName } from '@/utils/claim-insured-display';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Düşük' },
  { value: 'normal', label: 'Normal' },
  { value: 'medium', label: 'Orta' },
  { value: 'high', label: 'Yüksek' },
  { value: 'critical', label: 'Kritik' },
] as const;

type OfficeUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  role?: { code?: string | null } | null;
};

type CustomerLite = {
  id: string;
  fullName?: string | null;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

function findProvinceCode(cityName: string | null | undefined): string {
  const needle = (cityName ?? '').trim().toLocaleLowerCase('tr-TR');
  if (!needle || needle === 'belirtilmemiş') return '';
  const match = STATIC_PROVINCES.find((p) => p.name.toLocaleLowerCase('tr-TR') === needle);
  return match?.code ?? '';
}

function officeUserLabel(u: OfficeUser | null | undefined): string {
  if (!u) return '';
  const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  return name || u.email || u.id;
}

const fieldCls =
  'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60';

export function DosyaBilgileriEditModal({
  claim,
  onClose,
  onSaved,
}: {
  claim: any;
  onClose: () => void;
  onSaved: (patch: Partial<any>) => void;
}) {
  const { showToast } = useToast();
  const addr = claim.propertyAddress ?? {};

  const [insuredName, setInsuredName] = useState(
    () => resolveHasarInsuredName(claim) !== '—' ? resolveHasarInsuredName(claim) : (claim.insuredName ?? ''),
  );
  const [insuredPhone, setInsuredPhone] = useState(claim.insuredPhone ?? '');
  const [policyNo, setPolicyNo] = useState(claim.policyNo ?? '');
  const [lossType, setLossType] = useState(() => {
    const konu = resolveClaimIhbarKonusu(claim);
    return konu !== '—' ? konu : (claim.lossType ?? '');
  });
  const [description, setDescription] = useState(claim.description ?? '');
  const [priority, setPriority] = useState((claim.priority ?? 'normal').toLowerCase());
  const [cityCode, setCityCode] = useState(() => findProvinceCode(addr.city));
  const [city, setCity] = useState(addr.city && addr.city !== 'Belirtilmemiş' ? addr.city : '');
  const [district, setDistrict] = useState(addr.district ?? '');
  const [addressLine, setAddressLine] = useState(addr.addressLine ?? '');
  const [customer, setCustomer] = useState<CustomerLite | null>(claim.customer ?? null);
  const [assignedOfficeUserId, setAssignedOfficeUserId] = useState(claim.assignedOfficeUserId ?? '');
  const [officeUsers, setOfficeUsers] = useState<OfficeUser[]>([]);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const districts = useMemo(
    () => (cityCode ? (STATIC_DISTRICTS[cityCode] ?? []) : []),
    [cityCode],
  );

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/users?limit=200`, { headers: authHeader() })
      .then((r) => {
        if (cancelled) return;
        const rows = (r.data?.data ?? r.data ?? []) as OfficeUser[];
        const list = Array.isArray(rows) ? rows : [];
        const officeRoles = new Set(['office_staff', 'admin', 'manager', 'ops_manager']);
        setOfficeUsers(
          list.filter((u) => {
            const role = String(u.role?.code ?? '').toLowerCase();
            return officeRoles.has(role) || u.id === claim.assignedOfficeUserId;
          }),
        );
      })
      .catch(() => {
        if (!cancelled) setOfficeUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [claim.assignedOfficeUserId]);

  const officeOptions = useMemo(() => {
    const list = [...officeUsers];
    const current = claim.assignedOfficeUser as OfficeUser | undefined;
    if (current?.id && !list.some((u) => u.id === current.id)) {
      list.unshift(current);
    }
    return list;
  }, [officeUsers, claim.assignedOfficeUser]);

  const save = async () => {
    setError('');
    const name = toTitleCaseTR(insuredName.trim());
    const phone = insuredPhone.replace(/\D/g, '').trim();
    const policy = policyNo.trim();
    const konu = toTitleCaseTR(lossType.trim());
    const ihbar = description.trim();
    const line = toTitleCaseTR(addressLine.trim());
    const cityName = city.trim();
    const districtName = district.trim();

    if (!policy) {
      setError('Poliçe no zorunludur');
      return;
    }
    if (!konu) {
      setError('İhbar konusu zorunludur');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        insuredName: name || null,
        insuredPhone: phone || null,
        policyNo: policy,
        lossType: konu,
        description: ihbar || null,
        priority: priority || 'normal',
        customerId: customer?.id ?? null,
        assignedOfficeUserId: assignedOfficeUserId || null,
        city: cityName || 'Belirtilmemiş',
        district: districtName || null,
        propertyAddress: line || [cityName, districtName].filter(Boolean).join(' / ') || 'Belirtilmemiş',
      };

      const r = await axios.patch(`${API}/claim-files/${claim.id}`, payload, { headers: authHeader() });
      const updated = r.data?.data ?? r.data;
      const nextOffice =
        updated?.assignedOfficeUser
        ?? officeOptions.find((u) => u.id === assignedOfficeUserId)
        ?? (assignedOfficeUserId ? claim.assignedOfficeUser : null);
      onSaved({
        insuredName: updated?.insuredName ?? (name || null),
        insuredPhone: updated?.insuredPhone ?? (phone || null),
        policyNo: updated?.policyNo ?? policy,
        lossType: updated?.lossType ?? konu,
        description: updated?.description ?? (ihbar || null),
        priority: updated?.priority ?? priority,
        customerId: updated?.customerId ?? customer?.id ?? null,
        customer: updated?.customer ?? customer,
        assignedOfficeUserId: updated?.assignedOfficeUserId ?? (assignedOfficeUserId || null),
        assignedOfficeUser: nextOffice,
        propertyAddress: updated?.propertyAddress ?? {
          ...(claim.propertyAddress ?? {}),
          city: cityName || 'Belirtilmemiş',
          district: districtName || null,
          addressLine: line || [cityName, districtName].filter(Boolean).join(' / ') || 'Belirtilmemiş',
        },
        claimSubject: updated?.claimSubject ?? claim.claimSubject,
        departmentFileSubject: updated?.departmentFileSubject ?? claim.departmentFileSubject,
      });
      showToast('success', 'Dosya Bilgileri Güncellendi');
      onClose();
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.message ?? e.message
        : 'Kaydedilemedi';
      const text = Array.isArray(msg) ? msg.join(', ') : String(msg);
      setError(text);
      showToast('error', text || 'Dosya Bilgileri Güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
          role="dialog"
          aria-labelledby="dosya-bilgileri-edit-title"
        >
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div>
              <h3 id="dosya-bilgileri-edit-title" className="text-base font-semibold text-slate-800">
                Dosya Bilgilerini Düzenle
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Yanlış girilen il, adres, ihbar ve sorumlu bilgilerini düzeltebilirsiniz.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-xl leading-none px-1"
              aria-label="Kapat"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Sigortalı Adı</label>
                <input
                  className={fieldCls}
                  value={insuredName}
                  onChange={(e) => setInsuredName(e.target.value)}
                  onBlur={(e) => {
                    const v = toTitleCaseTR(e.target.value.trim());
                    if (v) setInsuredName(v);
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Sigortalı Telefon</label>
                <input
                  className={fieldCls}
                  value={insuredPhone}
                  onChange={(e) => setInsuredPhone(e.target.value)}
                  placeholder="05XX XXX XX XX"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Poliçe No <span className="text-status-danger">*</span>
                </label>
                <input
                  className={fieldCls}
                  value={policyNo}
                  onChange={(e) => setPolicyNo(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Öncelik</label>
                <select
                  className={fieldCls}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  İhbar Konusu <span className="text-status-danger">*</span>
                </label>
                <input
                  className={fieldCls}
                  value={lossType}
                  onChange={(e) => setLossType(e.target.value)}
                  onBlur={(e) => {
                    const v = toTitleCaseTR(e.target.value.trim());
                    if (v) setLossType(v);
                  }}
                  placeholder="Örn. Konut Cam"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">İhbar İçeriği</label>
                <textarea
                  className={`${fieldCls} resize-y min-h-[72px]`}
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-3">
              <p className="text-xs font-medium text-slate-600">Hasar Adresi</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">{ADDRESS_FIELD.province}</label>
                  <select
                    className={fieldCls}
                    value={cityCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      const prov = STATIC_PROVINCES.find((p) => p.code === code);
                      setCityCode(code);
                      setCity(prov?.name ?? '');
                      setDistrict('');
                    }}
                  >
                    <option value="">{ADDRESS_FIELD.provincePlaceholder}</option>
                    {STATIC_PROVINCES.map((p) => (
                      <option key={p.code} value={p.code}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">{ADDRESS_FIELD.district}</label>
                  <select
                    className={fieldCls}
                    value={district}
                    disabled={!cityCode}
                    onChange={(e) => setDistrict(e.target.value)}
                  >
                    <option value="">{ADDRESS_FIELD.districtPlaceholder}</option>
                    {district && !districts.includes(district) && (
                      <option value={district}>{district}</option>
                    )}
                    {districts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">{ADDRESS_FIELD.openAddress}</label>
                  <textarea
                    className={`${fieldCls} resize-y min-h-[56px]`}
                    rows={2}
                    value={addressLine}
                    onChange={(e) => setAddressLine(e.target.value)}
                    onBlur={(e) => {
                      const v = toTitleCaseTR(e.target.value.trim());
                      if (v) setAddressLine(v);
                    }}
                    placeholder={ADDRESS_FIELD.openAddressPlaceholder}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Eksper Ofisi</label>
                <div className="flex gap-2">
                  <input
                    className={`${fieldCls} flex-1`}
                    value={customer ? customerDisplayName(customer) : ''}
                    readOnly
                    placeholder="Seçilmedi"
                  />
                  <button
                    type="button"
                    onClick={() => setCustomerPickerOpen(true)}
                    className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-brand-600 hover:bg-blue-50"
                  >
                    Seç
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Dosya Sorumlusu</label>
                <select
                  className={fieldCls}
                  value={assignedOfficeUserId}
                  onChange={(e) => setAssignedOfficeUserId(e.target.value)}
                >
                  <option value="">Atanmamış</option>
                  {officeOptions.map((u) => (
                    <option key={u.id} value={u.id}>{officeUserLabel(u)}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>

      <CustomerSelectModal
        open={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={(c) => {
          setCustomer(c);
          setCustomerPickerOpen(false);
        }}
        subTypeFilter={HASAR_EXPERT_CUSTOMER_SUB_TYPE}
        hideTypeColumn
      />
    </>
  );
}
