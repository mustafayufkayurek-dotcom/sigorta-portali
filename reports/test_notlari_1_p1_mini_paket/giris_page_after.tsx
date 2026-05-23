'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API } from '@/utils/api';

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
      <svg viewBox="0 0 48 48" fill="none" className="feature-icon-svg">
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
      <svg viewBox="0 0 48 48" fill="none" className="feature-icon-svg">
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
      <svg viewBox="0 0 48 48" fill="none" className="feature-icon-svg">
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
      <svg viewBox="0 0 48 48" fill="none" className="feature-icon-svg">
        <path d="M24 4C16.268 4 10 10.268 10 18c0 11 14 26 14 26s14-15 14-26c0-7.732-6.268-14-14-14z" stroke="currentColor" strokeWidth="2.5" fill="none"/>
        <circle cx="24" cy="18" r="5" stroke="currentColor" strokeWidth="2" fill="none"/>
        <path d="M8 40 Q16 36 24 38 Q32 40 40 36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" strokeDasharray="2 2"/>
      </svg>
    ),
  },
];

/* ─────────────────────────── Insurers Marquee ──────────────────────── */
const insurers = [
  { name: 'Türkiye Sigorta', color: '#c8102e' },
  { name: 'Anadolu Sigorta', color: '#003087' },
  { name: 'Neova Sigorta', color: '#00843D' },
  { name: 'Ray Sigorta', color: '#005BAC' },
  { name: 'Allianz Sigorta', color: '#003781' },
  { name: 'Quick Sigorta', color: '#FF6600' },
  { name: 'Bereket Sigorta', color: '#008542' },
  { name: 'Sompo Sigorta', color: '#E60012' },
  { name: 'Hepiyi Sigorta', color: '#7B2D8B' },
  { name: 'Aksigorta', color: '#D4202B' },
];

/* ─────────────────────────── Main Page ─────────────────────────────── */
function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [fpEmail, setFpEmail] = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState('');
  const [fpToken, setFpToken] = useState('');
  const [fpDone, setFpDone] = useState(false);

  void fpToken;

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError('');
    setFpLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/forgot-password`, { email: fpEmail });
      setFpToken(res.data.data.token);
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
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: '1.1rem', fontWeight: 700, color: '#0b1f3a', margin: 0 }}>
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
                    boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif",
                  }}
                />
              </div>
              <button
                type="submit" disabled={fpLoading}
                style={{
                  width: '100%', padding: '11px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, #123063 0%, #2d72d9 100%)',
                  color: '#fff', fontSize: '0.875rem', fontWeight: 700,
                  fontFamily: "'DM Sans', sans-serif",
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
                E-posta adresinize şifre sıfırlama bağlantısı gönderildi. Lütfen gelen kutunuzu kontrol edin. Bağlantı 15 dakika geçerlidir.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%', padding: '11px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #123063 0%, #2d72d9 100%)',
                color: '#fff', fontSize: '0.875rem', fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>('Meridyen Assistance');

  useEffect(() => {
    setMounted(true);
    try {
      const savedEmail = localStorage.getItem('rememberedEmail');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {
      // localStorage erişim hatası sessizce yoksay
    }
    // Fetch company logo from public API (no auth required)
    axios.get(`${API_URL}/system-settings/company-info`)
      .then((r) => {
        const d = r.data?.data ?? {};
        if (d.logoUrl) {
          const busted = d.logoUrl.includes('?') ? d.logoUrl : `${d.logoUrl}?v=${Date.now()}`;
          setCompanyLogo(busted);
        }
        if (d.name) setCompanyName(d.name);
      })
      .catch(() => {
        // fallback: keep defaults
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });
      const { tokens, user } = response.data.data;

      if (rememberMe) {
        localStorage.setItem('accessToken', tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);
        localStorage.setItem('rememberedEmail', email);
        // 7 gün için token süresini kaydet
        const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
        localStorage.setItem('tokenExpiry', String(expiry));
      } else {
        // Session storage kullan
        sessionStorage.setItem('accessToken', tokens.accessToken);
        sessionStorage.setItem('refreshToken', tokens.refreshToken);
        localStorage.setItem('accessToken', tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);
        localStorage.removeItem('rememberedEmail');
      }
      localStorage.setItem('user', JSON.stringify(user));

      router.push('/panel');
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
      <style>{`
        /* ── Fonts ── */
        @import url("https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:wght@400;500;600&display=swap");

        :root {
          --navy: #0b1f3a;
          --navy-mid: #123063;
          --blue: #1852a0;
          --blue-light: #2d72d9;
          --accent: #3b9eff;
          --ice: #e8f1fb;
          --white: #ffffff;
          --slate: #64748b;
          --slate-light: #f1f5f9;
        }

        * { box-sizing: border-box; }

        .login-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--white);
          font-family: 'DM Sans', sans-serif;
        }

        /* ── TOP NAV BAR ── */
        .top-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 40px;
          background: var(--navy);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .top-nav-logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .logo-shield {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, var(--blue-light), var(--accent));
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .logo-text {
          font-family: 'Sora', sans-serif;
          font-size: 1.1rem;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.02em;
        }
        .logo-text span {
          color: var(--accent);
        }
        .nav-contacts {
          display: flex;
          gap: 24px;
          align-items: center;
        }
        .nav-contact-item {
          display: flex;
          align-items: center;
          gap: 6px;
          color: rgba(255,255,255,0.75);
          font-size: 0.8rem;
          font-weight: 500;
        }
        .nav-contact-item svg {
          color: var(--accent);
          flex-shrink: 0;
        }
        .status-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 999px;
          padding: 5px 12px;
          color: rgba(255,255,255,0.8);
          font-size: 0.75rem;
          font-weight: 500;
        }
        .status-dot {
          width: 7px;
          height: 7px;
          background: #4ade80;
          border-radius: 50%;
          animation: pulse-dot 2s infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }

        /* ── HERO SPLIT ── */
        .hero-section {
          display: flex;
          flex: 1;
          min-height: 0;
        }

        /* ── LEFT MARKETING PANEL ── */
        .marketing-panel {
          flex: 1 1 55%;
          background: linear-gradient(150deg, var(--navy) 0%, var(--navy-mid) 55%, var(--blue) 100%);
          padding: 56px 56px 0;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }
        .marketing-panel::before {
          content: '';
          position: absolute;
          top: -120px;
          right: -120px;
          width: 480px;
          height: 480px;
          background: radial-gradient(circle, rgba(59,158,255,0.12), transparent 70%);
          pointer-events: none;
        }
        .marketing-panel::after {
          content: '';
          position: absolute;
          bottom: 80px;
          left: -80px;
          width: 320px;
          height: 320px;
          background: radial-gradient(circle, rgba(45,114,217,0.14), transparent 70%);
          pointer-events: none;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 999px;
          padding: 6px 16px;
          color: rgba(255,255,255,0.7);
          font-size: 0.75rem;
          font-weight: 500;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          width: fit-content;
          margin-bottom: 28px;
        }
        .hero-badge-dot {
          width: 6px;
          height: 6px;
          background: #60d394;
          border-radius: 50%;
        }

        .hero-title {
          font-family: 'Sora', sans-serif;
          font-size: clamp(1.8rem, 2.8vw, 2.6rem);
          font-weight: 800;
          color: #fff;
          line-height: 1.18;
          letter-spacing: -0.03em;
          margin-bottom: 16px;
        }
        .hero-title-accent {
          background: linear-gradient(90deg, var(--accent), #7dd3fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-sub {
          color: rgba(186,210,245,0.85);
          font-size: 1rem;
          line-height: 1.65;
          max-width: 440px;
          margin-bottom: 40px;
          font-weight: 400;
        }

        /* ── Feature Cards ── */
        .feature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 44px;
          position: relative;
          z-index: 1;
        }
        .feature-card {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 18px 16px;
          backdrop-filter: blur(10px);
          transition: background 0.25s, border-color 0.25s, transform 0.25s;
          cursor: default;
        }
        .feature-card:hover {
          background: rgba(255,255,255,0.11);
          border-color: rgba(59,158,255,0.4);
          transform: translateY(-2px);
        }
        .feature-icon-svg {
          width: 36px;
          height: 36px;
          color: var(--accent);
          margin-bottom: 10px;
        }
        .feature-title {
          color: #fff;
          font-size: 0.82rem;
          font-weight: 600;
          line-height: 1.35;
          font-family: 'DM Sans', sans-serif;
        }

        /* ── Stats Band ── */
        .stats-band {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          background: rgba(255,255,255,0.04);
          border-top: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px 16px 0 0;
          position: relative;
          z-index: 1;
        }
        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px 8px;
          border-right: 1px solid rgba(255,255,255,0.06);
        }
        .stat-item:last-child { border-right: none; }
        .stat-value {
          font-family: 'Sora', sans-serif;
          font-size: 1.4rem;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.04em;
          white-space: nowrap;
        }
        .stat-label {
          color: rgba(186,210,245,0.6);
          font-size: 0.68rem;
          font-weight: 500;
          text-align: center;
          margin-top: 3px;
          line-height: 1.3;
        }

        /* ── RIGHT LOGIN PANEL ── */
        .login-panel {
          flex: 0 0 420px;
          width: 420px;
          display: flex;
          flex-direction: column;
          background: var(--slate-light);
          border-left: 1px solid rgba(0,0,0,0.06);
        }
        .login-scroll {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 48px 40px;
        }
        .login-heading {
          font-family: 'Sora', sans-serif;
          font-size: 1.45rem;
          font-weight: 700;
          color: var(--navy);
          letter-spacing: -0.03em;
          margin-bottom: 4px;
        }
        .login-sub {
          color: var(--slate);
          font-size: 0.85rem;
          margin-bottom: 28px;
        }

        .form-label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          color: #374151;
          margin-bottom: 6px;
        }
        .form-input-wrap {
          position: relative;
          margin-bottom: 16px;
        }
        .form-input {
          width: 100%;
          padding: 11px 14px 11px 40px;
          border-radius: 10px;
          border: 1.5px solid #d1d5db;
          background: #fff;
          font-size: 0.875rem;
          color: #111827;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          font-family: 'DM Sans', sans-serif;
        }
        .form-input::placeholder { color: #9ca3af; }
        .form-input:focus {
          border-color: var(--blue-light);
          box-shadow: 0 0 0 3px rgba(45,114,217,0.12);
        }
        .form-input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          pointer-events: none;
        }
        .form-input-btn {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #9ca3af;
          display: flex;
          align-items: center;
          padding: 4px;
          transition: color 0.2s;
          z-index: 2;
        }
        .form-input-btn:hover { color: #374151; }

        .error-box {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 16px;
        }
        .error-text {
          font-size: 0.83rem;
          color: #b91c1c;
          font-weight: 500;
        }

        .remember-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 0.82rem;
          color: #374151;
          user-select: none;
        }
        .checkbox-box {
          width: 18px;
          height: 18px;
          border-radius: 5px;
          border: 2px solid #d1d5db;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, border-color 0.15s;
          flex-shrink: 0;
        }
        .checkbox-box.checked {
          background: var(--blue-light);
          border-color: var(--blue-light);
        }
        .forgot-link {
          font-size: 0.78rem;
          color: var(--blue-light);
          font-weight: 500;
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
          text-decoration: none;
          transition: color 0.2s;
        }
        .forgot-link:hover { color: var(--navy); }

        .submit-btn {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, var(--navy-mid) 0%, var(--blue-light) 100%);
          color: #fff;
          font-size: 0.875rem;
          font-weight: 700;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.2s, transform 0.15s;
          letter-spacing: 0.01em;
        }
        .submit-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
        }
        .submit-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
          transform: none;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 0.8s linear infinite; }

        .login-footer {
          text-align: center;
          font-size: 0.72rem;
          color: #9ca3af;
          margin-top: 24px;
        }

        /* ── reCAPTCHA wrapper ── */
        .recaptcha-wrap {
          display: flex;
          justify-content: center;
          margin-bottom: 20px;
        }

        /* ── INSURERS MARQUEE STRIP ── */
        .insurers-strip {
          background: var(--navy);
          padding: 20px 0 16px;
          overflow: hidden;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .insurers-strip-label {
          text-align: center;
          color: rgba(255,255,255,0.35);
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 12px;
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee-scroll 28s linear infinite;
          gap: 0;
        }
        .marquee-track:hover { animation-play-state: paused; }
        @keyframes marquee-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .insurer-tag {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 20px;
          border-right: 1px solid rgba(255,255,255,0.06);
          white-space: nowrap;
          font-size: 0.8rem;
          font-weight: 600;
          color: rgba(255,255,255,0.7);
          transition: color 0.2s;
          cursor: default;
        }
        .insurer-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .insurers-cta {
          text-align: center;
          margin-top: 10px;
          font-size: 0.72rem;
          color: rgba(255,255,255,0.3);
          letter-spacing: 0.02em;
        }

        /* ── Entrance animations ── */
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up-1 { animation: fade-up 0.55s ease both 0.05s; }
        .fade-up-2 { animation: fade-up 0.55s ease both 0.15s; }
        .fade-up-3 { animation: fade-up 0.55s ease both 0.25s; }
        .fade-up-4 { animation: fade-up 0.55s ease both 0.35s; }
        .fade-up-5 { animation: fade-up 0.55s ease both 0.45s; }

        /* ── RESPONSIVE ── */
        @media (max-width: 1100px) {
          .login-panel { flex: 0 0 380px; width: 380px; }
          .marketing-panel { padding: 44px 40px 0; }
        }
        @media (max-width: 900px) {
          .hero-section { flex-direction: column; }
          .marketing-panel { flex: none; padding: 36px 24px 0; }
          .login-panel { flex: none; width: 100%; border-left: none; border-top: 1px solid rgba(0,0,0,0.06); }
          .login-scroll { padding: 36px 24px; }
          .stats-band { grid-template-columns: repeat(2, 1fr); }
          .nav-contacts { display: none; }
        }
        @media (max-width: 540px) {
          .feature-grid { grid-template-columns: 1fr; }
          .top-nav { padding: 12px 20px; }
          .stats-band { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      <div className="login-root">

        {/* ── TOP NAV ── */}
        <nav className="top-nav">
          <div className="top-nav-logo">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={companyName}
                className="logo-img"
                style={{ height: 36, width: 'auto', maxWidth: 160, objectFit: 'contain', borderRadius: 6 }}
                onError={() => setCompanyLogo(null)}
              />
            ) : (
              <>
                <div className="logo-shield">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="white" fillOpacity="0.9"/>
                    <path d="M9 12l2 2 4-4" stroke="rgba(45,114,217,1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="logo-text">Meridyen <span>Assistance</span></span>
              </>
            )}
          </div>

          <div className="nav-contacts">
            <div className="nav-contact-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21L8.5 10.5s1 3 5 5l1.113-1.724a1 1 0 011.21-.502l4.493 1.498A1 1 0 0121 15.72V19a2 2 0 01-2 2h-1C9.163 21 3 14.837 3 7V5z"/>
              </svg>
              <span>0 850 885 25 55</span>
            </div>
            <div className="nav-contact-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                <line x1="12" y1="18" x2="12.01" y2="18"/>
              </svg>
              <span>GSM: 0533 633 07 13</span>
            </div>
          </div>

          <div className="status-pill">
            <span className="status-dot" />
            Sistem Aktif
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
              <h2 className="login-heading fade-up-1">Sisteme Giriş</h2>
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
                    placeholder="ornek@sirket.com"
                    className="form-input"
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
                    placeholder="••••••••"
                    className="form-input"
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
                  <label
                    className="checkbox-label"
                    onClick={() => setRememberMe((v) => !v)}
                    role="checkbox"
                    aria-checked={rememberMe}
                  >
                    <div className={`checkbox-box${rememberMe ? ' checked' : ''}`}>
                      {rememberMe && (
                        <svg width="10" height="10" fill="none" stroke="white" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    Beni Hatırla
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
                © {mounted ? new Date().getFullYear() : ''} Meridyen Assistance. Tüm hakları saklıdır.
              </p>
            </div>
          </div>
        </div>

        {/* ── INSURERS MARQUEE ── */}
        <div className="insurers-strip">
          <div className="insurers-strip-label">Çalıştığımız Sigorta Şirketleri</div>
          <div style={{ overflow: 'hidden' }}>
            <div className="marquee-track">
              {[...insurers, ...insurers].map((ins, i) => (
                <div key={i} className="insurer-tag">
                  <span className="insurer-dot" style={{ background: ins.color }} />
                  {ins.name}
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
