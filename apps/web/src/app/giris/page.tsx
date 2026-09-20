'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API } from '@/utils/api';
import { LoginBrandLogo } from '@/components/brand/LoginBrandLogo';
import { GirisLoginPanel } from '@/components/giris/GirisLoginPanel';

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
export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [companyName, setCompanyName] = useState<string>('Meridyen Assistance');

  useEffect(() => {
    setMounted(true);
    axios.get(`${API_URL}/system-settings/company-info`)
      .then((r) => {
        const d = r.data?.data ?? {};
        if (d.name) setCompanyName(d.name);
      })
      .catch(() => {});
  }, []);

  return (
    <>
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

          <GirisLoginPanel />
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
