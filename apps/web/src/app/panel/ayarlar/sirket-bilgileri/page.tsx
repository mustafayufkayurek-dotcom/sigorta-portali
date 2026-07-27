'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { inputCls, labelCls } from '@/components/settings/SettingsUI';
import { API, authHeader } from '@/utils/api';
import { redirectAfterSettingsSave } from '@/utils/settings-save-redirect';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { formatPhone, validatePhone } from '@/utils/validators';

interface CompanyInfo {
  name: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxNumber?: string;
  tradeRegistryNo?: string;
  website?: string;
  kvkkEmail?: string;
  appUrl?: string;
  payrollEmployerEnabled?: boolean;
  payrollEmployerName?: string;
  payrollEmployerAddress?: string;
  payrollEmployerTaxNumber?: string;
  payrollEmployerTradeRegistryNo?: string;
  payrollEmployerPhone?: string;
  payrollEmployerEmail?: string;
  accountantEmail?: string;
}

const emptyForm: CompanyInfo = {
  name: '', logoUrl: '', address: '', phone: '', email: '', taxNumber: '', tradeRegistryNo: '', website: '',
  kvkkEmail: '', appUrl: 'https://app.meridyen-tr.com',
  payrollEmployerEnabled: false,
  payrollEmployerName: '', payrollEmployerAddress: '', payrollEmployerTaxNumber: '',
  payrollEmployerTradeRegistryNo: '', payrollEmployerPhone: '', payrollEmployerEmail: '',
  accountantEmail: '',
};

export default function SirketBilgileriPage() {
  const router = useRouter();
  const [form, setForm] = useState<CompanyInfo>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    axios.get(`${API}/system-settings/company-info`, { headers: authHeader() })
      .then((r) => {
        const d = r.data.data ?? {};
        setForm({
          name: d.name ?? '',
          logoUrl: d.logoUrl ?? '',
          address: d.address ?? '',
          phone: d.phone ?? '',
          email: d.email ?? '',
          taxNumber: d.taxNumber ?? '',
          tradeRegistryNo: d.tradeRegistryNo ?? '',
          website: d.website ?? '',
          kvkkEmail: d.kvkkEmail ?? '',
          appUrl: d.appUrl ?? 'https://app.meridyen-tr.com',
          payrollEmployerEnabled: Boolean(d.payrollEmployerEnabled),
          payrollEmployerName: d.payrollEmployerName ?? '',
          payrollEmployerAddress: d.payrollEmployerAddress ?? '',
          payrollEmployerTaxNumber: d.payrollEmployerTaxNumber ?? '',
          payrollEmployerTradeRegistryNo: d.payrollEmployerTradeRegistryNo ?? '',
          payrollEmployerPhone: d.payrollEmployerPhone ?? '',
          payrollEmployerEmail: d.payrollEmployerEmail ?? '',
          accountantEmail: d.accountantEmail ?? '',
        });
      })
      .catch(() => setError('Şirket bilgileri yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateForm(): boolean {
    const next: Record<string, string> = {};
    const name = form.name.trim();
    if (!name) next.name = 'Operasyon şirketi unvanı zorunludur.';
    const email = form.email?.trim() ?? '';
    if (!email) next.email = 'E-posta zorunludur.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Geçerli bir e-posta adresi girin.';

    for (const key of ['phone', 'payrollEmployerPhone'] as const) {
      const value = form[key]?.trim() ?? '';
      if (!value) continue;
      const result = validatePhone(value);
      if (!result.valid) next[key] = result.error ?? 'Geçersiz telefon numarası.';
    }

    if (form.payrollEmployerEnabled && !form.payrollEmployerName?.trim()) {
      next.payrollEmployerName = 'Bordro işvereni unvanı zorunludur.';
    }

    const accountantEmail = form.accountantEmail?.trim() ?? '';
    if (accountantEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountantEmail)) {
      next.accountantEmail = 'Geçerli bir e-posta adresi girin.';
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function applyTitleCase(field: 'name' | 'payrollEmployerName') {
    const value = form[field]?.trim();
    if (!value) return;
    setForm((prev) => ({ ...prev, [field]: toTitleCaseTR(value) }));
    clearFieldError(field);
  }

  function applyPhoneFormat(field: 'phone' | 'payrollEmployerPhone') {
    const value = form[field]?.trim();
    if (!value) {
      clearFieldError(field);
      return;
    }
    const result = validatePhone(value);
    if (!result.valid) {
      setFieldErrors((prev) => ({ ...prev, [field]: result.error ?? 'Geçersiz telefon numarası.' }));
      return;
    }
    setForm((prev) => ({ ...prev, [field]: result.formatted ?? formatPhone(value) }));
    clearFieldError(field);
  }

  async function handleSave() {
    if (!validateForm()) {
      setError('Lütfen işaretli alanları düzeltin.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      name: toTitleCaseTR(form.name.trim()),
      email: form.email?.trim(),
      payrollEmployerName: form.payrollEmployerName?.trim()
        ? toTitleCaseTR(form.payrollEmployerName.trim())
        : form.payrollEmployerName,
    };
    const { logoUrl: _logo, ...body } = payload;
    try {
      await axios.put(`${API}/system-settings/company-info`, body, { headers: authHeader() });
      redirectAfterSettingsSave(router, 'sirket-bilgileri');
    } catch (err: unknown) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 413) {
        setError('Kayıt boyutu çok büyük. Logo için Kurulum sayfasını kullanın.');
      } else if (status === 403) {
        setError('Bu işlem için ayar yönetimi yetkisi gerekir.');
      } else {
        setError('Kayıt sırasında hata oluştu.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SettingsPageLayout title="Şirket Bilgileri" description="Yükleniyor...">
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      </SettingsPageLayout>
    );
  }

  return (
    <SettingsPageLayout
      title="Şirket Bilgileri"
      description="Operasyon şirketi (Meridyen) ve isteğe bağlı bordro işvereni (Safran) bilgileri sözleşmelere otomatik yansır."
    >
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-blue-800 mb-6">
        Logo ve tema ayarları için{' '}
        <Link href="/panel/ayarlar/kurulum" className="font-semibold underline">Kurulum</Link>
        ; sözleşme metinleri için{' '}
        <Link href="/panel/ayarlar/sozlesmeler" className="font-semibold underline">Sözleşmeler</Link>
        {' '}sayfasını kullanın. Sözleşme onayı yalnızca <strong>iç personel</strong> (admin, müdür, dosya/saha personeli, finans) için zorunludur; tedarikçi ve eksper kapsam dışıdır.
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Operasyon Şirketi (Meridyen)</h2>
        <p className="text-xs text-slate-500">Hasar dosyası süreçlerini yöneten taraf; KVKK veri sorumlusu olarak metinlerde yer alır.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls}>Şirket Unvanı <span className="text-status-danger">*</span></label>
            <input
              className={`${inputCls}${fieldErrors.name ? ' border-red-300 focus:ring-red-400' : ''}`}
              value={form.name}
              onChange={(e) => { setForm({ ...form, name: e.target.value }); clearFieldError('name'); }}
              onBlur={() => applyTitleCase('name')}
              placeholder="Meridyen Assistance Ltd. Şti."
            />
            {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
          </div>
          <div>
            <label className={labelCls}>Vergi No</label>
            <input className={inputCls} value={form.taxNumber ?? ''} onChange={(e) => setForm({ ...form, taxNumber: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Ticaret Sicil No</label>
            <input className={inputCls} value={form.tradeRegistryNo ?? ''} onChange={(e) => setForm({ ...form, tradeRegistryNo: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Adres</label>
            <textarea className={inputCls} rows={2} value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Telefon</label>
            <input
              className={`${inputCls}${fieldErrors.phone ? ' border-red-300 focus:ring-red-400' : ''}`}
              value={form.phone ?? ''}
              onChange={(e) => { setForm({ ...form, phone: e.target.value }); clearFieldError('phone'); }}
              onBlur={() => applyPhoneFormat('phone')}
              placeholder="0532 123 45 67"
            />
            {fieldErrors.phone && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>}
          </div>
          <div>
            <label className={labelCls}>E-posta <span className="text-status-danger">*</span></label>
            <input
              className={`${inputCls}${fieldErrors.email ? ' border-red-300 focus:ring-red-400' : ''}`}
              type="email"
              value={form.email ?? ''}
              onChange={(e) => { setForm({ ...form, email: e.target.value }); clearFieldError('email'); }}
            />
            {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
          </div>
          <div>
            <label className={labelCls}>Web Sitesi</label>
            <input className={inputCls} value={form.website ?? ''} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://meridyenassistance.com" />
          </div>
          <div>
            <label className={labelCls}>KVKK İletişim E-postası</label>
            <input className={inputCls} type="email" value={form.kvkkEmail ?? ''} onChange={(e) => setForm({ ...form, kvkkEmail: e.target.value })} placeholder="Boşsa genel e-posta kullanılır" />
          </div>
          <div>
            <label className={labelCls}>Uygulama Adresi</label>
            <input className={inputCls} value={form.appUrl ?? ''} onChange={(e) => setForm({ ...form, appUrl: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 mt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Bordro İşvereni (Safran) — Opsiyonel</h2>
            <p className="text-xs text-slate-500 mt-1">
              Belirsiz süreli sözleşmeli personelin bordrolu olduğu şirket. Etkinleştirildiğinde sözleşmelere bilgilendirme maddesi eklenir; OİB/İŞKUR izni gerekmez.
            </p>
          </div>
          <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={Boolean(form.payrollEmployerEnabled)}
              onChange={(e) => setForm({ ...form, payrollEmployerEnabled: e.target.checked })}
              className="rounded border-slate-300"
            />
            <span className="text-xs font-medium text-slate-700">Sözleşmelerde kullan</span>
          </label>
        </div>

        {form.payrollEmployerEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div className="md:col-span-2">
              <label className={labelCls}>Bordro İşvereni Unvanı <span className="text-status-danger">*</span></label>
              <input
                className={`${inputCls}${fieldErrors.payrollEmployerName ? ' border-red-300 focus:ring-red-400' : ''}`}
                value={form.payrollEmployerName ?? ''}
                onChange={(e) => { setForm({ ...form, payrollEmployerName: e.target.value }); clearFieldError('payrollEmployerName'); }}
                onBlur={() => applyTitleCase('payrollEmployerName')}
                placeholder="Safran Birleşik Hizmetler A.Ş."
              />
              {fieldErrors.payrollEmployerName && <p className="mt-1 text-xs text-red-600">{fieldErrors.payrollEmployerName}</p>}
            </div>
            <div>
              <label className={labelCls}>Vergi No</label>
              <input className={inputCls} value={form.payrollEmployerTaxNumber ?? ''} onChange={(e) => setForm({ ...form, payrollEmployerTaxNumber: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Ticaret Sicil No</label>
              <input className={inputCls} value={form.payrollEmployerTradeRegistryNo ?? ''} onChange={(e) => setForm({ ...form, payrollEmployerTradeRegistryNo: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Adres</label>
              <textarea className={inputCls} rows={2} value={form.payrollEmployerAddress ?? ''} onChange={(e) => setForm({ ...form, payrollEmployerAddress: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Telefon</label>
              <input
                className={`${inputCls}${fieldErrors.payrollEmployerPhone ? ' border-red-300 focus:ring-red-400' : ''}`}
                value={form.payrollEmployerPhone ?? ''}
                onChange={(e) => { setForm({ ...form, payrollEmployerPhone: e.target.value }); clearFieldError('payrollEmployerPhone'); }}
                onBlur={() => applyPhoneFormat('payrollEmployerPhone')}
                placeholder="0532 123 45 67"
              />
              {fieldErrors.payrollEmployerPhone && <p className="mt-1 text-xs text-red-600">{fieldErrors.payrollEmployerPhone}</p>}
            </div>
            <div>
              <label className={labelCls}>E-posta</label>
              <input className={inputCls} type="email" value={form.payrollEmployerEmail ?? ''} onChange={(e) => setForm({ ...form, payrollEmployerEmail: e.target.value })} />
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 mt-6">
        <h2 className="text-sm font-semibold text-slate-900">Mali Müşavir</h2>
        <p className="text-xs text-slate-500">
          Puantaj gönderiminde varsayılan alıcı e-posta adresi olarak kullanılır.
        </p>
        <div className="max-w-md">
          <label className={labelCls}>Mali Müşavir E-posta</label>
          <input
            className={`${inputCls}${fieldErrors.accountantEmail ? ' border-red-300 focus:ring-red-400' : ''}`}
            type="email"
            value={form.accountantEmail ?? ''}
            onChange={(e) => { setForm({ ...form, accountantEmail: e.target.value }); clearFieldError('accountantEmail'); }}
            onBlur={() => {
              const value = form.accountantEmail?.trim() ?? '';
              if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                setFieldErrors((prev) => ({ ...prev, accountantEmail: 'Geçerli bir e-posta adresi girin.' }));
              }
            }}
            placeholder="muhasebe@ornek.com"
          />
          {fieldErrors.accountantEmail && <p className="mt-1 text-xs text-red-600">{fieldErrors.accountantEmail}</p>}
        </div>
      </section>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </SettingsPageLayout>
  );
}
