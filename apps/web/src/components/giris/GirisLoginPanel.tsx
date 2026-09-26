'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API } from '@/utils/api';
import {
  storeAuthAfterLogin,
  loadRememberedLoginForm,
  setRememberMePreference,
  establishWebAuthCookies,
} from '@/utils/auth-session';
import { getLoginHomePath } from '@/utils/panel-access';
import { safePanelNextPath } from '@/lib/panel-auth-gate';
import { isCompanyWebsiteHost, softwareLoginHref, SOFTWARE_LOGIN_URL } from '@/utils/site-renewal';
import { extractLoginEmailCode } from '@/utils/login-email-code-fill';
import { maskLoginMailbox } from '@sigorta/shared';

const API_URL = API;

function loginErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const apiMessage = err.response?.data?.message;
    if (!err.response || (typeof status === 'number' && status >= 500)) {
      return 'Giriş şu an yapılamıyor. Şifre yanlış değil; sistem kapalı. Biraz sonra tekrar deneyin.';
    }
    return typeof apiMessage === 'string' && apiMessage.trim() ? apiMessage : 'E-posta veya şifre hatalı.';
  }
  return 'E-posta veya şifre hatalı.';
}

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [fpEmail, setFpEmail] = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState('');
  const [fpDone, setFpDone] = useState(false);

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError('');
    setFpLoading(true);
    try {
      await axios.post(`${API_URL}/auth/forgot-password`, { email: fpEmail });
      setFpDone(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setFpError(axiosErr.response?.data?.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setFpLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, padding: '32px 28px',
        width: '100%', maxWidth: 400,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        fontFamily: 'var(--login-font-sans)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--login-font-display)', fontSize: '1.1rem', fontWeight: 700, color: '#0b1f3a', margin: 0 }}>
            Şifremi Unuttum
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }} aria-label="Kapat">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {!fpDone ? (
          <>
            <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: 20 }}>
              Kayıtlı e-posta adresinizi girin. Şifre sıfırlama bağlantısı gönderilecek.
            </p>
            {fpError && (
              <p style={{ fontSize: '0.82rem', color: '#b91c1c', marginBottom: 14, fontWeight: 500 }}>{fpError}</p>
            )}
            <form onSubmit={handleForgot}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                E-posta Adresi
              </label>
              <input
                type="email"
                value={fpEmail}
                onChange={(e) => setFpEmail(e.target.value)}
                placeholder="ornek@sirket.com"
                required
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 10, marginBottom: 16,
                  border: '1.5px solid #d1d5db', fontSize: '0.875rem', boxSizing: 'border-box',
                }}
              />
              <button
                type="submit"
                disabled={fpLoading}
                className="submit-btn"
              >
                {fpLoading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
              </button>
            </form>
          </>
        ) : (
          <button type="button" onClick={onClose} className="submit-btn">Giriş sayfasına dön</button>
        )}
      </div>
    </div>
  );
}

export function GirisLoginPanel({ handoffToSoftware = false }: { handoffToSoftware?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [cookieLabel, setCookieLabel] = useState('Çerez Politikası');
  const codeInputRef = useRef<HTMLInputElement>(null);
  const [footerYear, setFooterYear] = useState<number | null>(null);
  const [systemReady, setSystemReady] = useState<boolean | null>(null);
  const [softwareHref, setSoftwareHref] = useState('');
  const authHydrated = useRef(false);

  useEffect(() => {
    setFooterYear(new Date().getFullYear());
    if (handoffToSoftware) {
      setSoftwareHref(softwareLoginHref(window.location.host));
    }
    if (!handoffToSoftware && !authHydrated.current) {
      authHydrated.current = true;
      const saved = loadRememberedLoginForm();
      if (saved.email) setEmail(saved.email);
      setRememberMe(saved.remember);
      setFormReady(true);
    }
    if (!handoffToSoftware) {
      const reason = new URLSearchParams(window.location.search).get('reason');
      if (reason === 'session_expired') {
        setError('Oturum süreniz doldu. Lütfen tekrar giriş yapın.');
      } else if (reason === 'timeout') {
        setError('Hareketsizlik nedeniyle oturumunuz sonlandırıldı. Lütfen tekrar giriş yapın.');
      } else if (reason === 'logout') {
        setError('Çıkış yapıldı. Devam etmek için şifrenizle giriş yapın.');
      } else if (reason === 'auth') {
        setError('Devam etmek için e-posta ve şifrenizle giriş yapın.');
      }
    }

    axios.get(`${API_URL}/system-settings/company-info`)
      .then(() => setSystemReady(true))
      .catch(() => setSystemReady(false));
    if (handoffToSoftware || isCompanyWebsiteHost(window.location.host)) {
      setCookieLabel('Çerezleri Yönet');
    }
  }, [handoffToSoftware]);

  useEffect(() => {
    if (!challengeId) return;
    setEmailCode('');
    codeInputRef.current?.focus();

    const clearIfLeft = () => {
      if (document.visibilityState === 'hidden') setEmailCode('');
    };
    const clearOnRestore = (event: PageTransitionEvent) => {
      if (event.persisted) setEmailCode('');
    };
    document.addEventListener('visibilitychange', clearIfLeft);
    window.addEventListener('pageshow', clearOnRestore);
    return () => {
      document.removeEventListener('visibilitychange', clearIfLeft);
      window.removeEventListener('pageshow', clearOnRestore);
    };
  }, [challengeId]);

  const handleRememberChange = (checked: boolean) => {
    setRememberMe(checked);
    setRememberMePreference(checked, checked ? email : undefined);
  };

  const scrollFieldIntoView = (e: React.FocusEvent<HTMLInputElement>) => {
    if (typeof window === 'undefined' || window.innerWidth > 900) return;
    window.setTimeout(() => {
      e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 280);
  };

  const finishLogin = async (payload: { tokens?: { accessToken?: string; refreshToken?: string }; user?: { role?: { code?: string } } }) => {
    const tokens = payload?.tokens;
    const user = payload?.user;
    if (!tokens?.accessToken || !tokens.refreshToken || !user) {
      throw new Error('Giriş yanıtı beklenen formatta değil.');
    }
    const sessionTokens = { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    const normalizedEmail = email.trim().toLowerCase();
    storeAuthAfterLogin(sessionTokens, rememberMe, normalizedEmail);
    await establishWebAuthCookies(sessionTokens, rememberMe);
    setRememberMePreference(rememberMe, normalizedEmail);
    localStorage.setItem('user', JSON.stringify(user));
    window.dispatchEvent(new Event('meridyen:user-updated'));
    const next = safePanelNextPath(new URLSearchParams(window.location.search).get('next'));
    const home = next ?? getLoginHomePath(String(user?.role?.code ?? ''));
    router.replace(home);
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await axios.post(
        `${API_URL}/auth/login`,
        { email: normalizedEmail, password },
        { withCredentials: true },
      );
      const payload = response.data?.data ?? response.data;
      if (payload?.requiresEmailCode && payload?.challengeId) {
        setChallengeId(String(payload.challengeId));
        setEmailCode('');
        return;
      }
      await finishLogin(payload);
    } catch (err: unknown) {
      setError(loginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/auth/login/verify-email-code`,
        { challengeId, code: emailCode.trim() },
        { withCredentials: true },
      );
      const payload = response.data?.data ?? response.data;
      await finishLogin(payload);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const apiMessage = axiosErr.response?.data?.message;
      setError(typeof apiMessage === 'string' && apiMessage.trim() ? apiMessage : 'Kod hatalı.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/auth/login/resend-email-code`,
        { challengeId },
        { withCredentials: true },
      );
      const payload = response.data?.data ?? response.data;
      if (payload?.challengeId) setChallengeId(String(payload.challengeId));
      setEmailCode('');
      setNotice('Yeni kod e-postanıza gitti. Satır boş kalır; Yapıştır ile yazın.');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      const status = axiosErr.response?.status;
      const apiMessage = axiosErr.response?.data?.message;
      if (status === 429) {
        setError('Biraz sonra yeniden deneyin.');
      } else {
        setError(typeof apiMessage === 'string' && apiMessage.trim() ? apiMessage : 'Kod yeniden gönderilemedi.');
      }
    } finally {
      setLoading(false);
    }
  };

  const backToPassword = () => {
    setChallengeId('');
    setEmailCode('');
    setError('');
    setNotice('');
    setLoading(false);
  };

  return (
    <>
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
      <div className="login-panel">
        <div className="login-scroll">
          <div className="login-panel-header fade-up-1">
            <div className="login-header">
              <h2 className="login-heading">Kullanıcı Girişi</h2>
            </div>
            <div className={`status-pill login-panel-status${systemReady === false ? ' is-closed' : ''}`}>
              <span className="status-dot" />
              {systemReady === false ? 'Sistem Kapalı' : 'Sistem Aktif'}
            </div>
          </div>
          <p className="login-sub fade-up-2">Kurumsal bilgilerinizle giriş yapın.</p>
          {handoffToSoftware ? (
          <a
            className="submit-btn"
            href={softwareHref || SOFTWARE_LOGIN_URL}
            onClick={(e) => {
              e.preventDefault();
              window.location.assign(softwareLoginHref(window.location.host));
            }}
          >
            Giriş Yap
          </a>
          ) : (
          <>
          {error && (
            <div className="error-box">
              <p className="error-text">{error}</p>
            </div>
          )}
          {notice && !error && (
            <p className="login-sub fade-up-2" style={{ marginTop: 0 }}>{notice}</p>
          )}
          {challengeId ? (
          <div>
            <p className="login-sub fade-up-2" style={{ marginTop: 0 }}>
              Kod yalnızca {maskLoginMailbox(email)} kutusuna gider; bu satıra kendiliğinden yazılmaz.
              Gelenlerde yoksa Gereksiz veya Silinmiş Öğeler’e bakın.
            </p>
            <form onSubmit={handleEmailCode} noValidate>
            <label className="form-label" htmlFor="login-email-code">Giriş Kodu</label>
            <div className="form-input-wrap" style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <input
                ref={codeInputRef}
                id="login-email-code"
                name="login-email-code"
                type="text"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onPaste={(e) => {
                  const text = e.clipboardData?.getData('text') ?? '';
                  const code = extractLoginEmailCode(text);
                  if (!code) return;
                  e.preventDefault();
                  setEmailCode(code);
                }}
                onFocus={scrollFieldIntoView}
                placeholder=""
                className="form-input scroll-input-safe"
                required
                maxLength={11}
                aria-label="Giriş Kodu"
              />
              <button
                type="button"
                className="forgot-link"
                style={{
                  marginTop: 0,
                  flexShrink: 0,
                  minHeight: 44,
                  padding: '0 14px',
                  border: '1px solid #dbe3ee',
                  borderRadius: 12,
                  background: '#fff',
                  fontWeight: 600,
                }}
                onClick={() => {
                  const fail = () => {
                    codeInputRef.current?.focus();
                    setNotice('Kodu mailden kopyalayıp bu kutuya yapıştırın.');
                  };
                  if (!navigator.clipboard?.readText) {
                    fail();
                    return;
                  }
                  void navigator.clipboard.readText().then((text) => {
                    const code = extractLoginEmailCode(text);
                    if (code) {
                      setEmailCode(code);
                      setNotice('');
                      return;
                    }
                    fail();
                  }).catch(() => fail());
                }}
              >
                Yapıştır
              </button>
            </div>
            <button type="submit" className="submit-btn" disabled={loading || emailCode.length !== 6}>
              {loading ? 'Kontrol Ediliyor...' : 'Kodu Onayla'}
            </button>
            </form>
            <button type="button" className="forgot-link" style={{ marginTop: 12 }} onClick={() => void handleResendCode()} disabled={loading}>
              Kodu Yeniden Gönder
            </button>
            <button
              type="button"
              className="forgot-link"
              style={{ marginTop: 8, display: 'block' }}
              onMouseDown={(e) => {
                e.preventDefault();
                backToPassword();
              }}
              onClick={(e) => {
                e.preventDefault();
                backToPassword();
              }}
            >
              Şifre Ekranına Dön
            </button>
          </div>
          ) : (
          <form onSubmit={handleLogin} noValidate>
            <label className="form-label" htmlFor="renewal-email">E-posta Adresi</label>
            <div className="form-input-wrap">
              <svg className="form-input-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <input
                id="renewal-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={scrollFieldIntoView}
                placeholder="ornek@sirket.com"
                className="form-input scroll-input-safe"
                required
                autoComplete="email"
              />
            </div>
            <label className="form-label" htmlFor="renewal-password">Şifre</label>
            <div className="form-input-wrap">
              <svg className="form-input-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <input
                id="renewal-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={scrollFieldIntoView}
                placeholder="••••••••"
                className="form-input scroll-input-safe"
                style={{ paddingRight: 40 }}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="form-input-btn"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
            <div className="remember-row">
              <label htmlFor="renewal-remember" className="remember-choice">
                <input
                  type="checkbox"
                  id="renewal-remember"
                  checked={formReady ? rememberMe : false}
                  onChange={(e) => handleRememberChange(e.target.checked)}
                  className="remember-checkbox"
                />
                <span className="checkbox-text">Beni Hatırla</span>
              </label>
              <button type="button" className="forgot-link" onClick={() => setShowForgot(true)}>Şifremi Unuttum</button>
            </div>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
          )}
          </>
          )}
          <p className="login-footer">
            {footerYear == null
              ? '© Meridyen Assistance. Tüm hakları saklıdır.'
              : `© ${footerYear} Meridyen Assistance. Tüm hakları saklıdır.`}
          </p>
          <p className="login-footer" style={{ marginTop: 8 }}>
            <a href="/kvkk">KVKK Aydınlatma</a>
            {' · '}
            <a href="/gizlilik">Gizlilik</a>
            {' · '}
            <a href="/cerez-politikasi">{cookieLabel}</a>
          </p>
        </div>
        <div className="login-legal-note">
          <span>Meridyen Asistans</span>
          <span>Safran Birleşik Hizmetler Yan Kuruluşudur</span>
        </div>
      </div>
    </>
  );
}
