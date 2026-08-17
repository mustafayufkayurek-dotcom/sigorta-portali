'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API } from '@/utils/api';
import { LoginBrandLogo } from '@/components/brand/LoginBrandLogo';
import {
  attemptAutoLogin,
  storeAuthAfterLogin,
  loadRememberedLoginForm,
  setRememberMePreference,
  isPasswordLoginRequired,
} from '@/utils/auth-session';
import { getLoginHomePath, readStoredPanelUser } from '@/utils/panel-access';

const API_URL = API;

/* ─────────────────────────── Count-up hook ─────────────────────────── */
function useCountUp(target: number, duration = 1800, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return value;
}

/* ─────────────────────────── Stats Band ────────────────────────────── */
function StatsBand() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const files = useCountUp(1200, 1600, visible);
  const sla = useCountUp(985, 1400, visible);
  const hours = useCountUp(48, 1200, visible);
  const insurers = useCountUp(8, 900, visible);

  const stats = [
    { value: files, suffix: '+', label: 'Tamamlanan Dosya' },
    { value: sla / 10, suffix: '%', label: 'Zamanında Kapanma', isDecimal: true },
    { value: hours, suffix: ' Saat', label: 'Ort. Müdahale Süresi' },
    { value: insurers, suffix: '+', label: 'Sigorta Şirketi Güveni' },
  ];

  return (
    <div ref={ref} className="stats-band">
      {stats.map((s, i) => (
        <div key={i} className="stat-item">
          <span className="stat-value">
            {s.isDecimal ? (s.value).toFixed(1) : s.value}{s.suffix}
          </span>
          <span className="stat-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── Feature Cards ─────────────────────────── */
const features = [
  {
    title: 'Konut ve Endüstriyel Onarım',
    svg: (
      <svg viewBox="0 0 48 48" width={36} height={36} fill="none" className="feature-icon-svg">
        <path d="M6 20L24 6l18 14v22H30v-10h-12v10H6V20z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" fill="none"/>
        <rect x="20" y="32" width="8" height="10" stroke="currentColor" strokeWidth="2" fill="none"/>
        <path d="M34 10h6v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <rect x="35" y="20" width="8" height="10" rx="1" stroke="currentColor" strokeWidth="1.8" fill="none"/>
        <line x1="37" y1="24" x2="41" y2="24" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    title: 'Sektöre Özel Yazılım Hizmetleri',
    svg: (
      <svg viewBox="0 0 48 48" width={36} height={36} fill="none" className="feature-icon-svg">
        <rect x="4" y="8" width="40" height="28" rx="3" stroke="currentColor" strokeWidth="2.5" fill="none"/>
        <line x1="4" y1="32" x2="44" y2="32" stroke="currentColor" strokeWidth="2"/>
        <line x1="18" y1="40" x2="30" y2="40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="24" y1="36" x2="24" y2="40" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <polyline points="13,20 18,15 22,19 27,13 34,19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <circle cx="34" cy="19" r="2" fill="currentColor"/>
      </svg>
    ),
  },
  {
    title: 'Eksper Koordinasyon Ağı',
    svg: (
      <svg viewBox="0 0 48 48" width={36} height={36} fill="none" className="feature-icon-svg">
        <circle cx="24" cy="24" r="4" stroke="currentColor" strokeWidth="2.5" fill="none"/>
        <circle cx="8" cy="12" r="3.5" stroke="currentColor" strokeWidth="2" fill="none"/>
        <circle cx="40" cy="12" r="3.5" stroke="currentColor" strokeWidth="2" fill="none"/>
        <circle cx="8" cy="36" r="3.5" stroke="currentColor" strokeWidth="2" fill="none"/>
        <circle cx="40" cy="36" r="3.5" stroke="currentColor" strokeWidth="2" fill="none"/>
        <line x1="11" y1="14" x2="21" y2="21" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 2"/>
        <line x1="37" y1="14" x2="27" y2="21" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 2"/>
        <line x1="11" y1="34" x2="21" y2="27" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 2"/>
        <line x1="37" y1="34" x2="27" y2="27" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 2"/>
      </svg>
    ),
  },
  {
    title: "Tüm Türkiye'deyiz",
    svg: (
      <svg viewBox="0 0 48 48" width={36} height={36} fill="none" className="feature-icon-svg">
        <path d="M24 4C16.268 4 10 10.268 10 18c0 11 14 26 14 26s14-15 14-26c0-7.732-6.268-14-14-14z" stroke="currentColor" strokeWidth="2.5" fill="none"/>
        <circle cx="24" cy="18" r="5" stroke="currentColor" strokeWidth="2" fill="none"/>
        <path d="M8 40 Q16 36 24 38 Q32 40 40 36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" strokeDasharray="2 2"/>
      </svg>
    ),
  },
];

/* ─────────────────────────── Insurers Marquee ──────────────────────── */
const insurers = [
  'Türkiye Sigorta',
  'Anadolu Sigorta',
  'Neova Sigorta',
  'Ray Sigorta',
  'Allianz Sigorta',
  'Quick Sigorta',
  'Bereket Sigorta',
  'Sompo Sigorta',
  'Hepiyi Sigorta',
  'Aksigorta',
];

/* ─────────────────────────── Main Page ─────────────────────────────── */
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
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                padding: '10px 12px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start'
              }}>
                <svg width="15" height="15" fill="none" stroke="#dc2626" viewBox="0 0 24 24" style={{ marginTop: 1, flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p style={{ fontSize: '0.82rem', color: '#b91c1c', margin: 0, fontWeight: 500 }}>{fpError}</p>
              </div>
            )}
            <form onSubmit={handleForgot}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                E-posta Adresi
              </label>
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}
                  width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <input
                  type="email" value={fpEmail}
                  onChange={(e) => setFpEmail(e.target.value)}
                  placeholder="ornek@sirket.com"
                  required
                  style={{
                    width: '100%', padding: '11px 14px 11px 40px', borderRadius: 10,
                    border: '1.5px solid #d1d5db', background: '#fff',
                    fontSize: '0.875rem', color: '#111827', outline: 'none',
                    boxSizing: 'border-box', fontFamily: 'var(--login-font-sans)',
                  }}
                />
              </div>
              <button
                type="submit" disabled={fpLoading}
                style={{
                  width: '100%', padding: '11px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, #123063 0%, #2d72d9 100%)',
                  color: '#fff', fontSize: '0.875rem', fontWeight: 700,
                  fontFamily: 'var(--login-font-sans)',
                  cursor: fpLoading ? 'not-allowed' : 'pointer',
                  opacity: fpLoading ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {fpLoading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
              </button>
            </form>
          </>
        ) : (
          <div>
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
              padding: '14px 16px', marginBottom: 16,
            }}>
              <p style={{ fontSize: '0.84rem', color: '#166534', margin: 0, fontWeight: 700 }}>
                Şifre sıfırlama bağlantısı gönderildi
              </p>
              <p style={{ fontSize: '0.78rem', color: '#166534', margin: '8px 0 0' }}>
                E-posta adresinize şifre sıfırlama bağlantısı gönderildi. Lütfen gelen kutunuzu kontrol edin. Bağlantı 1 saat geçerlidir.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%', padding: '11px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #123063 0%, #2d72d9 100%)',
                color: '#fff', fontSize: '0.875rem', fontWeight: 700,
                fontFamily: 'var(--login-font-sans)', cursor: 'pointer',
              }}
            >
              Giriş sayfasına dön
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * useSearchParams + Suspense fallback={null} hydration kırıyordu:
 * sunucu boş fallback, istemci dolu form → Text/Suspense mismatch.
 * reason yalnızca client’ta window.location’dan okunur.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [companyName, setCompanyName] = useState<string>('Meridyen Assistance');
  const [footerYear, setFooterYear] = useState<number | null>(null);
  const authHydrated = useRef(false);

  useEffect(() => {
    setMounted(true);
    setFooterYear(new Date().getFullYear());

    const reason = new URLSearchParams(window.location.search).get('reason');
    if (reason === 'session_expired') {
      setError('Oturum süreniz doldu. Lütfen tekrar giriş yapın.');
    } else if (reason === 'timeout') {
      setError('Hareketsizlik nedeniyle oturumunuz sonlandırıldı. Lütfen tekrar giriş yapın.');
    } else if (reason === 'logout') {
      setError('Çıkış yapıldı. Devam etmek için şifrenizle giriş yapın.');
    }
    if (!authHydrated.current) {
      authHydrated.current = true;
      const saved = loadRememberedLoginForm();
      if (saved.email) setEmail(saved.email);
      setRememberMe(saved.remember);
      setFormReady(true);
    }

    const blockAuto =
      isPasswordLoginRequired()
      || reason === 'logout'
      || reason === 'timeout'
      || reason === 'session_expired';

    if (!blockAuto) {
      attemptAutoLogin(API_URL).then((ok) => {
        if (ok) {
          router.replace(getLoginHomePath(String(readStoredPanelUser()?.role?.code ?? '')));
        }
      });
    }

    // Fetch public company name only; login logo is fixed to the accepted static brand asset.
    axios.get(`${API_URL}/system-settings/company-info`)
      .then((r) => {
        const d = r.data?.data ?? {};
        if (d.name) setCompanyName(d.name);
      })
      .catch(() => {
        // fallback: keep local logo asset
      });
  }, [router]);

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

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const shouldRemember = rememberMe;

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await axios.post(
        `${API_URL}/auth/login`,
        {
          email: normalizedEmail,
          password,
        },
        { withCredentials: true },
      );
      const payload = response.data?.data ?? response.data;
      const tokens = payload?.tokens;
      const user = payload?.user;
      if (!tokens?.accessToken || !user) {
        throw new Error('Giriş yanıtı beklenen formatta değil.');
      }

      storeAuthAfterLogin(tokens, shouldRemember, normalizedEmail);
      setRememberMePreference(shouldRemember, normalizedEmail);
      localStorage.setItem('user', JSON.stringify(user));
      window.dispatchEvent(new Event('meridyen:user-updated'));

      router.replace(getLoginHomePath(String(user?.role?.code ?? '')));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg = axiosErr.response?.data?.message || 'E-posta veya şifre hatalı.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
      

      <div className="login-root">

        {/* ── TOP NAV ── */}
        <nav className="top-nav">
          <div className="top-nav-logo">
            <LoginBrandLogo alt={companyName} />
          </div>

          <div className="nav-right">
            <div className="nav-contacts">
              <div className="nav-contact-title">Destek Hattı</div>
              <a className="nav-contact-item" href="tel:+908508852555" aria-label="Telefon ile destek hattını ara">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21L8.5 10.5s1 3 5 5l1.113-1.724a1 1 0 011.21-.502l4.493 1.498A1 1 0 0121 15.72V19a2 2 0 01-2 2h-1C9.163 21 3 14.837 3 7V5z"/>
                </svg>
                <span>0 850 885 25 55</span>
              </a>
              <a className="nav-contact-item" href="tel:+905336330713" aria-label="GSM destek hattını ara">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                  <line x1="12" y1="18" x2="12.01" y2="18"/>
                </svg>
                <span>0533 633 07 13</span>
              </a>
              <a className="nav-contact-item nav-contact-whatsapp" href="https://api.whatsapp.com/send?phone=905336330713" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp destek hattını aç">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20.5 11.7a8.5 8.5 0 01-12.6 7.4L4 20l.9-3.8a8.5 8.5 0 1115.6-4.5z"/>
                  <path d="M9.2 8.8c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .5.4l.7 1.7c.1.2.1.4 0 .5l-.4.5c-.1.1-.2.3-.1.5.3.7 1.1 1.7 2.2 2.2.2.1.3.1.5-.1l.6-.7c.1-.2.3-.2.5-.1l1.7.8c.2.1.4.2.4.4 0 .4-.2 1.2-.8 1.5-.5.3-1.7.3-3.3-.5-2.8-1.3-4.5-3.9-4.7-5.6-.1-.6.1-.9.4-1z"/>
                </svg>
                <span>WhatsApp Destek</span>
              </a>
            </div>
          </div>
        </nav>

        {/* ── HERO ── */}
        <div className="hero-section">

          {/* ── LEFT MARKETING ── */}
          <div className="marketing-panel">
            <div className="hero-badge fade-up-1">
              <span className="hero-badge-dot" />
              Hasar Platformu
            </div>

            <h1 className="hero-title fade-up-2">
              Tüm Süreçlerde<br />
              <span className="hero-title-accent">Güvenilir Çözüm</span><br />
              Ortağınız
            </h1>

            <p className="hero-sub fade-up-3">
              Tek Platform, Sınırsız Kontrol
            </p>

            {/* Feature Cards */}
            <div className="feature-grid fade-up-4">
              {features.map((f) => (
                <div key={f.title} className="feature-card">
                  {f.svg}
                  <div className="feature-title">{f.title}</div>
                </div>
              ))}
            </div>

            {/* Stats */}
            {mounted && <StatsBand />}
          </div>

          {/* ── RIGHT LOGIN FORM ── */}
          <div className="login-panel">
            <div className="login-scroll">
              <div className="login-panel-header fade-up-1">
                <div className="login-header">
                  <h2 className="login-heading">Kullanıcı Girişi</h2>
                </div>
                <div className="status-pill login-panel-status">
                  <span className="status-dot" />
                  Sistem Aktif
                </div>
              </div>
              <p className="login-sub fade-up-2">Kurumsal bilgilerinizle giriş yapın.</p>

              {error && (
                <div className="error-box">
                  <svg style={{ flexShrink: 0, marginTop: 1 }} width="16" height="16" fill="none" stroke="#dc2626" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="error-text">{error}</p>
                </div>
              )}

              <form onSubmit={handleLogin} noValidate>
                {/* E-posta */}
                <label className="form-label" htmlFor="email">E-posta Adresi</label>
                <div className="form-input-wrap">
                  <svg className="form-input-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <input
                    id="email"
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

                {/* Şifre */}
                <label className="form-label" htmlFor="password">Şifre</label>
                <div className="form-input-wrap">
                  <svg className="form-input-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input
                    id="password"
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
                    {showPassword ? (
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Remember / Forgot */}
                <div className="remember-row">
                  <label htmlFor="remember-me" className="remember-choice">
                    <input
                      type="checkbox"
                      id="remember-me"
                      name="remember"
                      checked={formReady ? rememberMe : false}
                      onChange={(e) => handleRememberChange(e.target.checked)}
                      className="remember-checkbox"
                    />
                    <span className="checkbox-text">Beni Hatırla</span>
                  </label>
                  <button type="button" className="forgot-link" onClick={() => setShowForgot(true)}>Şifremi Unuttum</button>
                </div>

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <svg className="spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="4" opacity="0.25" />
                        <path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Giriş Yapılıyor...
                    </>
                  ) : 'Giriş Yap'}
                </button>
              </form>

              <p className="login-footer">
                {footerYear == null
                  ? '© Meridyen Assistance. Tüm hakları saklıdır.'
                  : `© ${footerYear} Meridyen Assistance. Tüm hakları saklıdır.`}
              </p>
            </div>
            <div className="login-legal-note">
              <span>Meridyen Asistans</span>
              <span>Safran Birleşik Hizmetler Yan Kuruluşudur</span>
            </div>
          </div>
        </div>

        {/* ── INSURERS MARQUEE ── */}
        <div className="insurers-strip">
          <div className="insurers-strip-label">Çalıştığımız Sigorta Şirketleri</div>
          <div style={{ overflow: 'hidden' }}>
            <div className="marquee-track">
              {[...insurers, ...insurers].map((name, i) => (
                <div key={i} className="insurer-tag">
                  <span className="insurer-dot" />
                  {name}
                </div>
              ))}
            </div>
          </div>
          <div className="insurers-cta">
            Tam Liste ve Detaylı Bilgi İçin Bizimle İletişime Geçiniz
          </div>
        </div>

      </div>
    </>
  );
}
