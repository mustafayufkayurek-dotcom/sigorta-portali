'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LoginBrandLogo } from '@/components/brand/LoginBrandLogo';
import {
  getHizmetAbsoluteUrl,
  type HizmetPageContent,
  HIZMET_PAGES,
} from '@/lib/marketing-hizmetler';

type Props = {
  content: HizmetPageContent;
};

export function HizmetMarketingPage({ content }: Props) {
  const [copied, setCopied] = useState(false);
  const [absoluteUrl, setAbsoluteUrl] = useState(`https://app.meridyen-tr.com${content.path}`);

  useEffect(() => {
    setAbsoluteUrl(getHizmetAbsoluteUrl(content.path));
  }, [content.path]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="hizmet-root">
      <style>{`
        @import url(https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600&display=swap);

        .hizmet-root {
          --navy: #0b1f3a;
          --navy-mid: #123063;
          --accent: #3b9eff;
          --ice: #e8f1fb;
          min-height: 100dvh;
          background: linear-gradient(165deg, #0b1f3a 0%, #123063 48%, #0a1830 100%);
          color: #fff;
          font-family: 'DM Sans', sans-serif;
        }
        .hizmet-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: max(10px, env(safe-area-inset-top)) 28px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(11, 31, 58, 0.92);
          backdrop-filter: blur(10px);
          position: sticky;
          top: 0;
          z-index: 40;
        }
        .hizmet-nav-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .hizmet-nav-link {
          color: rgba(255,255,255,0.88);
          text-decoration: none;
          font-size: 0.86rem;
          font-weight: 600;
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.14);
          transition: background 0.2s, border-color 0.2s;
        }
        .hizmet-nav-link:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(59,158,255,0.45);
        }
        .hizmet-nav-cta {
          background: #3b9eff;
          border-color: #3b9eff;
          color: #fff;
        }
        .hizmet-nav-cta:hover {
          background: #2d8aeb;
          border-color: #2d8aeb;
        }
        .hizmet-main {
          max-width: 1080px;
          margin: 0 auto;
          padding: 36px 24px 64px;
        }
        .link-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          padding: 12px 14px;
          margin-bottom: 28px;
        }
        .link-bar-label {
          font-size: 0.72rem;
          font-weight: 600;
          color: rgba(232,241,251,0.7);
          text-transform: none;
          white-space: nowrap;
        }
        .link-bar-url {
          flex: 1;
          min-width: 180px;
          font-size: 0.78rem;
          color: #9fd0ff;
          word-break: break-all;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        .link-bar-btn {
          border: none;
          border-radius: 10px;
          background: rgba(59,158,255,0.2);
          color: #fff;
          font-size: 0.78rem;
          font-weight: 600;
          padding: 8px 12px;
          cursor: pointer;
          white-space: nowrap;
        }
        .link-bar-btn:hover { background: rgba(59,158,255,0.35); }
        .link-bar-btn.copied { background: rgba(34,197,94,0.28); }
        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 0.78rem;
          font-weight: 600;
          color: rgba(232,241,251,0.82);
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 999px;
          padding: 6px 12px;
          margin-bottom: 16px;
        }
        .eyebrow-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 3px rgba(34,197,94,0.2);
        }
        .hero-title {
          font-family: 'Sora', sans-serif;
          font-size: clamp(1.8rem, 3.6vw, 2.75rem);
          font-weight: 700;
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin: 0 0 14px;
        }
        .hero-lead {
          max-width: 720px;
          font-size: 1.05rem;
          line-height: 1.55;
          color: rgba(226,232,240,0.88);
          margin: 0 0 36px;
        }
        .grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-bottom: 40px;
        }
        .card {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 18px 16px;
        }
        .card h3 {
          margin: 0 0 8px;
          font-size: 0.95rem;
          font-weight: 600;
          font-family: 'Sora', sans-serif;
        }
        .card p {
          margin: 0;
          font-size: 0.84rem;
          line-height: 1.5;
          color: rgba(226,232,240,0.78);
        }
        .section-title {
          font-family: 'Sora', sans-serif;
          font-size: 1.15rem;
          font-weight: 600;
          margin: 0 0 14px;
        }
        .steps {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 40px;
        }
        .step {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 14px;
          padding: 16px 14px;
        }
        .step-n {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 8px;
          background: rgba(59,158,255,0.2);
          color: #9fd0ff;
          font-size: 0.75rem;
          font-weight: 700;
          margin-bottom: 10px;
        }
        .step h4 {
          margin: 0 0 6px;
          font-size: 0.88rem;
          font-weight: 600;
        }
        .step p {
          margin: 0;
          font-size: 0.78rem;
          line-height: 1.45;
          color: rgba(226,232,240,0.72);
        }
        .closing {
          background: linear-gradient(135deg, rgba(59,158,255,0.18), rgba(255,255,255,0.04));
          border: 1px solid rgba(59,158,255,0.35);
          border-radius: 18px;
          padding: 22px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .closing p {
          margin: 0;
          font-family: 'Sora', sans-serif;
          font-size: 1.05rem;
          font-weight: 600;
          line-height: 1.4;
          max-width: 640px;
        }
        .closing a {
          text-decoration: none;
          background: #3b9eff;
          color: #fff;
          font-weight: 700;
          font-size: 0.9rem;
          padding: 12px 18px;
          border-radius: 12px;
        }
        .sibling-nav {
          margin-top: 36px;
          padding-top: 22px;
          border-top: 1px solid rgba(255,255,255,0.1);
        }
        .sibling-nav h3 {
          margin: 0 0 12px;
          font-size: 0.9rem;
          font-weight: 600;
          color: rgba(232,241,251,0.75);
        }
        .sibling-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .sibling-list a {
          text-decoration: none;
          color: #fff;
          font-size: 0.8rem;
          font-weight: 600;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.05);
        }
        .sibling-list a[aria-current="page"] {
          border-color: rgba(59,158,255,0.55);
          background: rgba(59,158,255,0.18);
        }
        @media (max-width: 900px) {
          .grid-3, .steps { grid-template-columns: 1fr 1fr; }
          .hizmet-main { padding: 24px 16px 48px; }
        }
        @media (max-width: 560px) {
          .grid-3, .steps { grid-template-columns: 1fr; }
          .hizmet-nav { padding-left: 14px; padding-right: 14px; }
        }
      `}</style>

      <nav className="hizmet-nav">
        <Link href="/giris" aria-label="Giriş sayfasına dön">
          <LoginBrandLogo alt="Meridyen Assistance" />
        </Link>
        <div className="hizmet-nav-actions">
          <a className="hizmet-nav-link" href="tel:08508852555">
            0 850 885 25 55
          </a>
          <Link className="hizmet-nav-link hizmet-nav-cta" href="/giris">
            Kullanıcı Girişi
          </Link>
        </div>
      </nav>

      <main className="hizmet-main">
        <div className="link-bar">
          <span className="link-bar-label">Kopyalanabilir Link</span>
          <span className="link-bar-url">{absoluteUrl}</span>
          <button
            type="button"
            className={`link-bar-btn${copied ? ' copied' : ''}`}
            onClick={copyLink}
          >
            {copied ? 'Kopyalandı' : 'Linki Kopyala'}
          </button>
        </div>

        <div className="eyebrow">
          <span className="eyebrow-dot" />
          {content.eyebrow}
        </div>
        <h1 className="hero-title">{content.title}</h1>
        <p className="hero-lead">{content.lead}</p>

        <div className="grid-3">
          {content.highlights.map((item) => (
            <article key={item.title} className="card">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>

        <h2 className="section-title">Süreç Nasıl İşler</h2>
        <div className="steps">
          {content.steps.map((step, index) => (
            <article key={step.title} className="step">
              <div className="step-n">{index + 1}</div>
              <h4>{step.title}</h4>
              <p>{step.text}</p>
            </article>
          ))}
        </div>

        <div className="closing">
          <p>{content.closing}</p>
          <Link href="/giris">Platforma Giriş</Link>
        </div>

        <div className="sibling-nav">
          <h3>Diğer Hizmet Sayfaları</h3>
          <div className="sibling-list">
            {HIZMET_PAGES.map((page) => (
              <Link
                key={page.slug}
                href={page.path}
                aria-current={page.slug === content.slug ? 'page' : undefined}
              >
                {page.title}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
