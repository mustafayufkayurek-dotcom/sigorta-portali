'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { API } from '@/utils/api';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>('Meridyen Assistance');

  useEffect(() => {
    if (!token) setError('Geçersiz veya eksik token. Lütfen tekrar şifre sıfırlama talebinde bulunun.');
    axios.get(`${API}/system-settings/company-info`)
      .then((r) => {
        const d = r.data?.data ?? {};
        if (d.logoUrl) {
          const busted = d.logoUrl.includes('?') ? d.logoUrl : `${d.logoUrl}?v=${Date.now()}`;
          setCompanyLogo(busted);
        }
        if (d.name) setCompanyName(d.name);
      })
      .catch(() => {});
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }
    if (newPassword.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/auth/reset-password`, { token, newPassword });
      setSuccess(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Bir hata oluştu. Token geçersiz veya süresi dolmuş olabilir.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:wght@400;500;600&display=swap");

        :root {
          --navy: #0b1f3a;
          --navy-mid: #123063;
          --blue-light: #2d72d9;
          --accent: #3b9eff;
          --slate: #64748b;
        }

        * { box-sizing: border-box; }

        .rp-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f1f5f9;
          font-family: 'DM Sans', sans-serif;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
        }

        .rp-card {
          background: #fff;
          border-radius: 18px;
          padding: 40px 36px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.10);
        }

        .rp-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 28px;
        }

        .rp-logo-shield {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, var(--blue-light), var(--accent));
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .rp-logo-text {
          font-family: 'Sora', sans-serif;
          font-size: 1rem;
          font-weight: 700;
          color: var(--navy);
          letter-spacing: -0.02em;
        }

        .rp-logo-text span { color: var(--accent); }

        .rp-heading {
          font-family: 'Sora', sans-serif;
          font-size: 1.3rem;
          font-weight: 700;
          color: var(--navy);
          letter-spacing: -0.03em;
          margin-bottom: 6px;
        }

        .rp-sub {
          color: var(--slate);
          font-size: 0.84rem;
          margin-bottom: 24px;
        }

        .rp-label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          color: #374151;
          margin-bottom: 6px;
        }

        .rp-input-wrap {
          position: relative;
          margin-bottom: 16px;
        }

        .rp-input {
          width: 100%;
          padding: 11px 42px 11px 40px;
          border-radius: 10px;
          border: 1.5px solid #d1d5db;
          background: #fff;
          font-size: 0.875rem;
          color: #111827;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          font-family: 'DM Sans', sans-serif;
        }

        .rp-input:focus {
          border-color: var(--blue-light);
          box-shadow: 0 0 0 3px rgba(45,114,217,0.12);
        }

        .rp-input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          pointer-events: none;
        }

        .rp-input-btn {
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
        }

        .rp-error {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 16px;
        }

        .rp-error-text {
          font-size: 0.83rem;
          color: #b91c1c;
          font-weight: 500;
        }

        .rp-success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          margin-bottom: 20px;
        }

        .rp-submit {
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

        .rp-submit:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .rp-submit:disabled { opacity: 0.65; cursor: not-allowed; }

        .rp-back {
          display: block;
          text-align: center;
          margin-top: 16px;
          font-size: 0.82rem;
          color: var(--blue-light);
          cursor: pointer;
          background: none;
          border: none;
          width: 100%;
          font-family: 'DM Sans', sans-serif;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>

      <div className="rp-root">
        <div className="rp-card">
          <div className="rp-logo">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={companyName}
                style={{ height: 36, width: 'auto', maxWidth: 160, objectFit: 'contain', borderRadius: 6 }}
                onError={() => setCompanyLogo(null)}
              />
            ) : (
              <>
                <div className="rp-logo-shield">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="white" fillOpacity="0.9"/>
                    <path d="M9 12l2 2 4-4" stroke="rgba(45,114,217,1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="rp-logo-text">Meridyen <span>Assistance</span></span>
              </>
            )}
          </div>

          <h2 className="rp-heading">Yeni Şifre Belirle</h2>
          <p className="rp-sub">Güvenli bir şifre oluşturun.</p>

          {error && (
            <div className="rp-error">
              <svg style={{ flexShrink: 0, marginTop: 1 }} width="16" height="16" fill="none" stroke="#dc2626" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="rp-error-text">{error}</p>
            </div>
          )}

          {success ? (
            <div>
              <div className="rp-success">
                <svg width="36" height="36" fill="none" viewBox="0 0 24 24" style={{ margin: '0 auto 12px', display: 'block' }}>
                  <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="2" fill="none"/>
                  <path d="M8 12l3 3 5-5" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p style={{ fontSize: '0.92rem', color: '#166534', fontWeight: 600, margin: '0 0 4px' }}>
                  Şifreniz güncellendi!
                </p>
                <p style={{ fontSize: '0.8rem', color: '#15803d', margin: 0 }}>
                  Artık yeni şifrenizle giriş yapabilirsiniz.
                </p>
              </div>
              <button className="rp-submit" onClick={() => router.push('/giris')}>
                Giriş Sayfasına Dön
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label className="rp-label" htmlFor="newPassword">Yeni Şifre</label>
              <div className="rp-input-wrap">
                <svg className="rp-input-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="En az 6 karakter"
                  className="rp-input"
                  required
                  autoComplete="new-password"
                />
                <button type="button" className="rp-input-btn" onClick={() => setShowNew(v => !v)} tabIndex={-1}>
                  {showNew ? (
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

              <label className="rp-label" htmlFor="confirmPassword">Şifre Tekrar</label>
              <div className="rp-input-wrap">
                <svg className="rp-input-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Şifreyi tekrar girin"
                  className="rp-input"
                  required
                  autoComplete="new-password"
                />
                <button type="button" className="rp-input-btn" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}>
                  {showConfirm ? (
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

              <button type="submit" className="rp-submit" disabled={loading || !token}>
                {loading ? (
                  <>
                    <svg className="spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="4" className="opacity-25" />
                      <path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Güncelleniyor...
                  </>
                ) : 'Şifremi Güncelle'}
              </button>
            </form>
          )}

          <button className="rp-back" onClick={() => router.push('/giris')}>
            ← Giriş sayfasına dön
          </button>
        </div>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#64748b' }}>Yükleniyor...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
