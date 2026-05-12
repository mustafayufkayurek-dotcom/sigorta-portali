'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { inputCls, labelCls } from '@/components/settings/SettingsUI';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://app.meridyen-tr.com/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

interface TurmobConfig {
  apiUrl: string;
  apiKey: string;
  username: string;
  password: string;
  active: boolean;
}

const defaultConfig: TurmobConfig = {
  apiUrl: '',
  apiKey: '',
  username: '',
  password: '',
  active: false,
};

export default function EntegrasyonlarPage() {
  const [config, setConfig] = useState<TurmobConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/system-settings/turmob-config`, { headers: authHeader() });
        if (res.data?.data) {
          const d = res.data.data;
          setConfig({
            apiUrl: d.apiUrl ?? '',
            apiKey: d.apiKey ?? '',
            username: d.username ?? '',
            password: d.password ?? '',
            active: d.active ?? false,
          });
        }
      } catch {
        // Config yoksa varsayılan kalır
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChange = (field: keyof TurmobConfig, value: string | boolean) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
    setSaveError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError('');
    try {
      await axios.put(`${API}/system-settings/turmob-config`, config, { headers: authHeader() });
      setSaveSuccess(true);
    } catch (e: any) {
      setSaveError(e.response?.data?.message ?? 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center text-slate-400 py-12">Yükleniyor...</div>;
  }

  return (
    <SettingsPageLayout
      title="Entegrasyonlar"
      description="Üçüncü taraf servis entegrasyonlarını yapılandırın"
    >

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sol: TÜRMOB Ayarları */}
        <div className="lg:col-span-2 space-y-6">
          {/* Durum */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">TÜRMOB Entegrasyonu</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Vergi numarasına bağlı ünvan sorgulaması için TÜRMOB API bağlantısını yapılandırın
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleChange('active', !config.active)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  config.active ? 'bg-blue-600' : 'bg-slate-200'
                }`}
                role="switch"
                aria-checked={config.active}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                    config.active ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {config.active && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Entegrasyon Aktif
              </span>
            )}
            {!config.active && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400 mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Entegrasyon Pasif
              </span>
            )}
          </div>

          {/* API Bağlantı Bilgileri */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 pb-3 border-b border-slate-50">
              API Bağlantı Bilgileri
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>API URL</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="https://api.turmob.org.tr/sorgu?vkn={taxNumber}"
                  value={config.apiUrl}
                  onChange={(e) => handleChange('apiUrl', e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1">
                  {`{taxNumber}`} ifadesi sorgu sırasında vergi numarası ile değiştirilir
                </p>
              </div>
              <div>
                <label className={labelCls}>API Key / Token (Varsa)</label>
                <input
                  type="password"
                  className={inputCls}
                  placeholder="Bearer token veya API anahtarı"
                  value={config.apiKey}
                  onChange={(e) => handleChange('apiKey', e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          {/* Kimlik Doğrulama */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 pb-3 border-b border-slate-50">
              Kimlik Doğrulama (Opsiyonel)
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Kullanıcı Adı</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="TÜRMOB kullanıcı adı (opsiyonel)"
                  value={config.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Şifre</label>
                <input
                  type="password"
                  className={inputCls}
                  placeholder="TÜRMOB şifresi (opsiyonel)"
                  value={config.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          {/* Kaydet */}
          <div className="flex items-center gap-4">
            <button type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white text-sm px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            {saveSuccess && (
              <span className="text-sm text-green-600 font-medium">Ayarlar Kaydedildi.</span>
            )}
            {saveError && (
              <span className="text-sm text-red-600">{saveError}</span>
            )}
          </div>
        </div>

        {/* Sağ: Bilgi Paneli */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 sticky top-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">TÜRMOB Hakkında</h3>
            <div className="space-y-3 text-xs text-slate-500">
              <p>
                TÜRMOB (Türkiye Serbest Muhasebeci Mali Müşavirler ve Yeminli Mali Müşavirler Odaları Birliği)
                vergi numarasına bağlı ünvan sorgulama servisi.
              </p>
              <p>
                TÜRMOB&apos;un resmi API&apos;si herkese açık değildir. Genellikle üye girişi ile veya
                özel entegrasyon anlaşması ile erişim sağlanır.
              </p>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mt-2">
                <p className="text-amber-700 font-medium mb-1">Yapılandırma Notu</p>
                <p className="text-amber-600">
                  API bilgilerini TÜRMOB veya yetkili bir muhasebe yazılımı sağlayıcısından temin edin.
                  Ayarlar boşsa veya entegrasyon pasifse sorgular çalışmayacaktır.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-50">
              <p className="text-xs font-medium text-slate-500 mb-2">Durum</p>
              <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${config.active ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-500'}`}>
                <span className={`w-2 h-2 rounded-full ${config.active ? 'bg-green-500' : 'bg-slate-400'}`} />
                {config.active ? 'Entegrasyon Aktif' : 'Entegrasyon Pasif'}
              </div>
              {config.active && !config.apiUrl && (
                <div className="mt-2 flex items-center gap-2 text-xs bg-red-50 text-red-600 rounded-lg px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  API URL girilmemiş — sorgular çalışmayacak
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </SettingsPageLayout>
  );
}
