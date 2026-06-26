'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
}
function authHeader() {
  return { Authorization: `Bearer ${getToken()}` };
}

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  status: string;
  mustChangePassword?: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  role?: { id: string; name: string; code: string } | null;
}

interface AgreementAcceptance {
  id: string;
  acceptedAt: string;
  ipAddress?: string | null;
  signature?: string | null;
  agreement: {
    id: string;
    title: string;
    type: string;
    version: string;
  };
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const inputCls =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-slate-50 disabled:text-slate-500';

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-50">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

const typeLabels: Record<string, string> = {
  kvkk: 'KVKK Aydınlatma Metni',
  gizlilik: 'Gizlilik Taahhütnamesi',
  is_sozlesmesi: 'İş Sözleşmesi',
};

export default function ProfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptances, setAcceptances] = useState<AgreementAcceptance[]>([]);

  // Şifre değiştir formu
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordRepeat, setNewPasswordRepeat] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  // Şifre gizle/göster
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    // Önce localStorage'dan hızlıca yükle
    const cached = localStorage.getItem('user');
    if (cached) {
      setProfile(JSON.parse(cached));
      setLoading(false);
    }

    // Sonra API'den taze veri çek
    axios
      .get(`${API}/auth/me`, { headers: authHeader() })
      .then((r) => {
        const data = r.data.data;
        setProfile(data);
        localStorage.setItem('user', JSON.stringify(data));
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Kabul edilen sözleşmeler
    fetch(`${API}/agreements/my-acceptances`, { headers: authHeader() })
      .then((r) => r.json())
      .then((json) => setAcceptances(json?.data ?? []))
      .catch(() => {});
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (!oldPassword || !newPassword || !newPasswordRepeat) {
      setPwdError('Tüm alanları doldurun.');
      return;
    }
    if (newPassword.length < 6) {
      setPwdError('Yeni şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (newPassword !== newPasswordRepeat) {
      setPwdError('Yeni şifreler eşleşmiyor.');
      return;
    }

    setPwdSaving(true);
    try {
      const response = await axios.post(
        `${API}/auth/change-password`,
        { oldPassword, newPassword },
        { headers: authHeader() },
      );
      const updatedUser = response.data?.data;
      if (updatedUser) {
        setProfile(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        window.dispatchEvent(new CustomEvent('user-updated', { detail: updatedUser }));
      }
      setPwdSuccess('Şifreniz başarıyla güncellendi.');
      setOldPassword('');
      setNewPassword('');
      setNewPasswordRepeat('');
      if (updatedUser?.mustChangePassword === false) {
        setTimeout(() => router.push('/panel'), 1200);
      }
    } catch (err: any) {
      setPwdError(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          'Şifre değiştirme başarısız. Mevcut şifrenizi kontrol edin.',
      );
    } finally {
      setPwdSaving(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-slate-400">Profil yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-sm text-slate-400">Profil bilgisi alınamadı.</p>
      </div>
    );
  }

  const initials = `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`;
  const mustChangePassword = profile.mustChangePassword === true;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {mustChangePassword && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-semibold text-amber-900">İlk giriş — şifrenizi güncellemeniz gerekiyor</p>
          <p className="mt-1 text-sm text-amber-800">
            Size iletilen geçici şifreyle giriş yaptınız. Devam etmeden önce aşağıdan kalıcı bir şifre belirleyin.
          </p>
        </div>
      )}
      {/* Profil başlık kartı */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-md">
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900">
              {profile.firstName} {profile.lastName}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{profile.email}</p>
            <div className="flex items-center gap-3 mt-2">
              {profile.role && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {profile.role.name}
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  profile.status === 'active'
                    ? 'bg-green-50 text-green-700 border border-green-100'
                    : 'bg-slate-50 text-slate-500 border border-slate-100'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${profile.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`}
                />
                {profile.status === 'active' ? 'Aktif' : 'Pasif'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Kişisel Bilgiler */}
      <SectionCard title="Kişisel Bilgiler">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Ad</label>
            <input type="text" value={profile.firstName} className={inputCls} disabled readOnly />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Soyad</label>
            <input type="text" value={profile.lastName} className={inputCls} disabled readOnly />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">E-posta</label>
            <input type="email" value={profile.email} className={inputCls} disabled readOnly />
          </div>
          {profile.phone && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Telefon</label>
              <input type="text" value={profile.phone} className={inputCls} disabled readOnly />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Son Giriş</label>
            <input
              type="text"
              value={fmtDate(profile.lastLoginAt)}
              className={inputCls}
              disabled
              readOnly
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Kayıt Tarihi</label>
            <input
              type="text"
              value={fmtDate(profile.createdAt)}
              className={inputCls}
              disabled
              readOnly
            />
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-400 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Kişisel bilgilerinizi değiştirmek için sistem yöneticinizle iletişime geçin.
        </p>
      </SectionCard>

      {/* Kabul Edilen Sözleşmeler */}
      <SectionCard title="Sözleşmeler ve Onaylar">
        {acceptances.length === 0 ? (
          <p className="text-sm text-slate-400">Henüz onaylanmış sözleşme yok.</p>
        ) : (
          <div className="space-y-3">
            {acceptances.map((acc) => (
              <div key={acc.id} className="flex items-start justify-between gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{acc.agreement.title}</p>
                    <p className="text-xs text-slate-500">
                      {typeLabels[acc.agreement.type] ?? acc.agreement.type} — v{acc.agreement.version}
                    </p>
                    {acc.signature && (
                      <p className="text-xs text-slate-400 mt-0.5">İmza: {acc.signature}</p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-green-600 font-medium">Onaylandı</p>
                  <p className="text-xs text-slate-400 mt-0.5">{fmtDate(acc.acceptedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Şifre Değiştir */}
      <SectionCard title={mustChangePassword ? 'Kalıcı Şifre Belirle' : 'Şifre Değiştir'}>
        <form onSubmit={handleChangePassword} className="space-y-4">
          {pwdError && (
            <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{pwdError}</p>
            </div>
          )}

          {pwdSuccess && (
            <div className="flex items-start gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
              <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-green-700">{pwdSuccess}</p>
            </div>
          )}

          {/* Mevcut Şifre */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Mevcut Şifre <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className={`${inputCls} pr-10`}
                placeholder="Mevcut şifreniz"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowOld((v) => !v)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showOld ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Yeni Şifre */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Yeni Şifre <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`${inputCls} pr-10`}
                placeholder="En az 6 karakter"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showNew ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </>
                  )}
                </svg>
              </button>
            </div>

            {/* Güç göstergesi */}
            {newPassword && (
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4].map((i) => {
                  const strength =
                    newPassword.length >= 12 && /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword)
                      ? 4
                      : newPassword.length >= 8 && (/[A-Z]/.test(newPassword) || /[0-9]/.test(newPassword))
                      ? 3
                      : newPassword.length >= 6
                      ? 2
                      : 1;
                  return (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= strength
                          ? strength >= 3
                            ? 'bg-green-500'
                            : strength === 2
                            ? 'bg-yellow-400'
                            : 'bg-red-400'
                          : 'bg-slate-100'
                      }`}
                    />
                  );
                })}
                <span className="text-xs text-slate-400 ml-1">
                  {newPassword.length < 6
                    ? 'Çok zayıf'
                    : newPassword.length < 8
                    ? 'Zayıf'
                    : newPassword.length < 12
                    ? 'Orta'
                    : 'Güçlü'}
                </span>
              </div>
            )}
          </div>

          {/* Tekrar Yeni Şifre */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Yeni Şifre (Tekrar) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showRepeat ? 'text' : 'password'}
                value={newPasswordRepeat}
                onChange={(e) => setNewPasswordRepeat(e.target.value)}
                className={`${inputCls} pr-10 ${
                  newPasswordRepeat && newPassword !== newPasswordRepeat
                    ? 'border-red-300 focus:ring-red-400'
                    : newPasswordRepeat && newPassword === newPasswordRepeat
                    ? 'border-green-300 focus:ring-green-400'
                    : ''
                }`}
                placeholder="Yeni şifrenizi tekrar girin"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowRepeat((v) => !v)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showRepeat ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </>
                  )}
                </svg>
              </button>
            </div>
            {newPasswordRepeat && newPassword !== newPasswordRepeat && (
              <p className="mt-1.5 text-xs text-red-500">Şifreler eşleşmiyor.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={pwdSaving || !oldPassword || !newPassword || !newPasswordRepeat}
            className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #1a4080 0%, #1e5aa8 100%)' }}
          >
            {pwdSaving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Güncelleniyor...
              </span>
            ) : (
              mustChangePassword ? 'Kalıcı Şifremi Kaydet' : 'Şifremi Güncelle'
            )}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
