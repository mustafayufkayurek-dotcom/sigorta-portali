'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { GirisLoginPanel } from '@/components/giris/GirisLoginPanel';
import {
  padRenewalUnit,
  siteRenewalParts,
  type SiteRenewalParts,
} from '@/utils/site-renewal';
import { YenileniyoruzChrome } from './yenileniyoruz-chrome';

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

function StatsBand() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.3 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const files = useCountUp(1200, 1600, visible);
  const sla = useCountUp(985, 1400, visible);
  const hours = useCountUp(48, 1200, visible);
  const insurersCount = useCountUp(8, 900, visible);

  const stats = [
    { value: files, suffix: '+', label: 'Tamamlanan Dosya' },
    { value: sla / 10, suffix: '%', label: 'Zamanında Kapanma', isDecimal: true },
    { value: hours, suffix: ' Saat', label: 'Ort. Müdahale Süresi' },
    { value: insurersCount, suffix: '+', label: 'Sigorta Şirketi Güveni' },
  ];

  return (
    <div ref={ref} className="stats-band">
      {stats.map((s) => (
        <div key={s.label} className="stat-item">
          <span className="stat-value">
            {s.isDecimal ? s.value.toFixed(1) : s.value}{s.suffix}
          </span>
          <span className="stat-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

const features = [
  {
    href: '/yenileniyoruz/konut-endustriyel-onarim',
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
    href: '/yenileniyoruz/sektor-ozel-yazilim',
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
    href: '/yenileniyoruz/eksper-koordinasyon',
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
    href: '/yenileniyoruz/turkiye',
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

const UNITS: Array<{ key: keyof Omit<SiteRenewalParts, 'expired'>; label: string }> = [
  { key: 'days', label: 'Gün' },
  { key: 'hours', label: 'Saat' },
  { key: 'minutes', label: 'Dakika' },
  { key: 'seconds', label: 'Saniye' },
];

export default function YenileniyoruzPage() {
  const [parts, setParts] = useState<SiteRenewalParts | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showClock, setShowClock] = useState(true);

  useEffect(() => {
    setMounted(true);
    const tick = () => setParts(siteRenewalParts(Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const hide = () => setShowClock(false);
    window.addEventListener('click', hide);
    return () => window.removeEventListener('click', hide);
  }, []);

  return (
    <YenileniyoruzChrome>
      <div className="hero-section renewal-hero">
        <div className="marketing-panel">
          <div className="renewal-hero-top">
            <div className="renewal-hero-copy">
              <div className="hero-badge fade-up-1">
                <span className="hero-badge-dot" />
                Hasar Platformu
              </div>
              <h1 className="hero-title fade-up-2">
                Tüm Süreçlerde<br />
                <span className="hero-title-accent">Güvenilir Çözüm</span><br />
                Ortağınız
              </h1>
              <p className="hero-sub fade-up-3">Tek Platform, Sınırsız Kontrol</p>
            </div>
            {showClock ? (
              <div className="renewal-overlay-card" aria-labelledby="renewal-title">
                <h2 id="renewal-title" className="renewal-title">Yenileniyoruz</h2>
                <p className="renewal-sub">Yeni sitemiz kısa süre içinde açılacak.</p>
                <div className="renewal-clock" aria-live="polite">
                  {UNITS.map((unit) => (
                    <div key={unit.key} className="renewal-unit">
                      <span className="renewal-unit-value">
                        {parts ? padRenewalUnit(parts[unit.key]) : '—'}
                      </span>
                      <span className="renewal-unit-label">{unit.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="feature-grid fade-up-4">
            {features.map((f) => (
              <Link key={f.title} href={f.href} className="feature-card">
                {f.svg}
                <div className="feature-title">{f.title}</div>
              </Link>
            ))}
          </div>
          {mounted && <StatsBand />}
        </div>

        <GirisLoginPanel />
      </div>

      <div className="insurers-strip">
        <div className="insurers-strip-label">Çalıştığımız Sigorta Şirketleri</div>
        <div style={{ overflow: 'hidden' }}>
          <div className="marquee-track">
            {[...insurers, ...insurers].map((name, i) => (
              <div key={`${name}-${i}`} className="insurer-tag">
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
    </YenileniyoruzChrome>
  );
}
