'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { inputCls, labelCls } from '@/components/settings/SettingsUI';
import { API, authHeader } from '@/utils/api';

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
}

const emptyForm: CompanyInfo = {
  name: '', logoUrl: '', address: '', phone: '', email: '', taxNumber: '', tradeRegistryNo: '', website: '',
  kvkkEmail: '', appUrl: 'https://app.meridyen-tr.com',
  payrollEmployerEnabled: false,
  payrollEmployerName: '', payrollEmployerAddress: '', payrollEmployerTaxNumber: '',
  payrollEmployerTradeRegistryNo: '', payrollEmployerPhone: '', payrollEmployerEmail: '',
};

export default function SirketBilgileriPage() {
  const [form, setForm] = useState<CompanyInfo>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
        });
      })
      .catch(() => setError('Şirket bilgileri yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!form.name.trim()) { setError('Operasyon şirketi adı zorunludur.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      await axios.put(`${API}/system-settings/company-info`, form, { headers: authHeader() });
      setSuccess('Şirket bilgileri kaydedildi. KVKK/gizlilik metinleri bir sonraki girişte güncellenmiş içerikle sunulur.');
      setTimeout(() => setSuccess(''), 4000);
    } catch {
      setError('Kayıt sırasında hata oluştu.');
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
      {success && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
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
            <label className={labelCls}>Şirket Unvanı <span className="text-red-500">*</span></label>
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Meridyen Assistance Ltd. Şti." />
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
            <input className={inputCls} value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>E-posta</label>
            <input className={inputCls} type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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
              <label className={labelCls}>Bordro İşvereni Unvanı</label>
              <input className={inputCls} value={form.payrollEmployerName ?? ''} onChange={(e) => setForm({ ...form, payrollEmployerName: e.target.value })} placeholder="Safran Birleşik Hizmetler A.Ş." />
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
              <input className={inputCls} value={form.payrollEmployerPhone ?? ''} onChange={(e) => setForm({ ...form, payrollEmployerPhone: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>E-posta</label>
              <input className={inputCls} type="email" value={form.payrollEmployerEmail ?? ''} onChange={(e) => setForm({ ...form, payrollEmployerEmail: e.target.value })} />
            </div>
          </div>
        )}
      </section>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </SettingsPageLayout>
  );
}
