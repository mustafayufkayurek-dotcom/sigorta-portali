'use client';

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_AGREEMENT_TEMPLATES } from '@sigorta/shared';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { sanitizeDocumentHtml } from '@/utils/sanitize-html';
import { apiClient } from '@/lib/api-client';
import { getAccessToken } from '@/utils/auth-session';

interface PendingAgreement {
  id: string;
  title: string;
  type: string;
  version: string;
  content?: string;
}

function fallbackAgreementHtml(type: string): string {
  if (type === 'kvkk') return DEFAULT_AGREEMENT_TEMPLATES.kvkk;
  if (type === 'gizlilik') return DEFAULT_AGREEMENT_TEMPLATES.gizlilik;
  return '<p>Sözleşme içeriği yüklenemedi. Lütfen sistem yöneticisine başvurun.</p>';
}

function resolveAgreementHtml(type: string, raw?: string | null): string {
  const trimmed = raw?.trim();
  if (trimmed) return trimmed;
  return fallbackAgreementHtml(type);
}

interface Props {
  pendingAgreements: PendingAgreement[];
  onAllAccepted: () => void;
  onDismiss?: () => void;
}

export default function AgreementConsentModal({ pendingAgreements, onAllAccepted, onDismiss }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [content, setContent] = useState<string>('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [checked, setChecked] = useState(false);
  const [signature, setSignature] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [signatureWarning, setSignatureWarning] = useState('');
  const [scrolledAt, setScrolledAt] = useState<string | null>(null);
  const [checkboxConfirmedAt, setCheckboxConfirmedAt] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Resolve logged-in user's full name from localStorage
  const getLoggedInFullName = (): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        const fn = (u.firstName ?? u.first_name ?? '').trim();
        const ln = (u.lastName ?? u.last_name ?? '').trim();
        if (fn || ln) return `${fn} ${ln}`.trim();
      }
      // Try parsing from JWT
      const token = getAccessToken();
      if (token) {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          const fn = (payload.firstName ?? payload.first_name ?? payload.name ?? '').trim();
          const ln = (payload.lastName ?? payload.last_name ?? '').trim();
          if (fn || ln) return `${fn} ${ln}`.trim();
        }
      }
    } catch { /* ignore */ }
    return null;
  };

  const checkSignatureMatch = (value: string) => {
    const trimmed = toTitleCaseTR(value.trim());
    if (!trimmed) { setSignatureWarning(''); return; }
    const expectedName = getLoggedInFullName();
    if (!expectedName) { setSignatureWarning(''); return; }
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
      .replace(/İ/g, 'i').replace(/I/g, 'ı').replace(/Ğ/g, 'ğ').replace(/Ü/g, 'ü')
      .replace(/Ş/g, 'ş').replace(/Ö/g, 'ö').replace(/Ç/g, 'ç');
    if (normalize(trimmed) !== normalize(expectedName)) {
      setSignatureWarning(`Girilen isim (${trimmed}) hesabınızdaki isimle (${expectedName}) uyuşmuyor. Lütfen kendi adınızı ve soyadınızı yazın.`);
    } else {
      setSignatureWarning('');
    }
  };

  const current = pendingAgreements[currentIndex];
  const expectedFullName = getLoggedInFullName();

  useEffect(() => {
    if (!current) return;
    setLoadingContent(true);
    setScrolledToBottom(false);
    setChecked(false);
    setSignature(expectedFullName ? toTitleCaseTR(expectedFullName) : '');
    setSignatureWarning('');
    setScrolledAt(null);
    setCheckboxConfirmedAt(null);
    setError('');

    apiClient
      .get<{ content?: string; type?: string }>(`/agreements/${current.id}`)
      .then((data) => setContent(resolveAgreementHtml(current.type, data?.content)))
      .catch(() => setContent(fallbackAgreementHtml(current.type)))
      .finally(() => setLoadingContent(false));
  }, [currentIndex, current?.id, current?.type, expectedFullName]);

  // Kısa belgelerde veya boş scroll alanında otomatik "okundu" say
  useEffect(() => {
    if (loadingContent) return;
    const el = scrollRef.current;
    if (!el) return;
    const timer = window.setTimeout(() => {
      if (el.scrollHeight <= el.clientHeight + 12) {
        setScrolledToBottom(true);
        setScrolledAt((prev) => prev ?? new Date().toISOString());
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [loadingContent, content, currentIndex]);

  useEffect(() => {
    if (!onDismiss || saving) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss?.();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDismiss, saving]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
      setScrolledToBottom(true);
      if (!scrolledAt) setScrolledAt(new Date().toISOString());
    }
  }

  const signatureValid = signature.trim().length > 0 && !signatureWarning;

  async function handleAccept() {
    if (!checked || !signatureValid) return;
    setError('');
    setSaving(true);
    try {
      await apiClient.post('/agreements/accept', {
        agreementId: current.id,
        signature: toTitleCaseTR(signature.trim()),
        scrolledAt: scrolledAt ?? new Date().toISOString(),
        checkboxConfirmedAt: checkboxConfirmedAt ?? new Date().toISOString(),
      });
      if (currentIndex + 1 < pendingAgreements.length) {
        setCurrentIndex((i) => i + 1);
      } else {
        onAllAccepted();
      }
    } catch (err: any) {
      setError(err.message ?? 'Bir hata oluştu');
    } finally {
      setSaving(false);
    }
  }

  if (!current) return null;

  const typeLabel: Record<string, string> = {
    kvkk: 'KVKK Aydınlatma Metni',
    gizlilik: 'Gizlilik Taahhütnamesi',
    is_sozlesmesi: 'İş Sözleşmesi',
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-gray-100 shrink-0">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              disabled={saving}
              aria-label="Sözleşme penceresini kapat"
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <div className="flex items-center gap-3 mb-1 pr-8">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{current.title}</h2>
              <p className="text-xs text-gray-500">
                {typeLabel[current.type] ?? current.type} — v{current.version}
                {pendingAgreements.length > 1 && (
                  <span className="ml-2 text-blue-600">({currentIndex + 1}/{pendingAgreements.length})</span>
                )}
              </p>
            </div>
          </div>
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
            Sisteme devam edebilmek için aşağıdaki belgeyi okuyup onaylamanız zorunludur. Şimdilik kapatırsanız paneli kullanabilirsiniz; veri işlemleri onay sonrası açılır.
          </p>
        </div>

        {/* İçerik scroll alanı */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-4 text-sm text-gray-700 leading-relaxed"
        >
          {loadingContent ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div
              className="prose prose-sm max-w-none agreement-document"
              dangerouslySetInnerHTML={{ __html: sanitizeDocumentHtml(content) }}
            />
          )}
        </div>

        {!scrolledToBottom && !loadingContent && (
          <p className="text-center text-xs text-gray-400 py-1.5 border-t border-gray-50 bg-gray-50/50">
            Devam etmek için belgeyi sonuna kadar okuyun
          </p>
        )}

        {/* Onay formu */}
        <div className="px-6 py-5 border-t border-gray-100 space-y-4 shrink-0">
          {/* Dijital imza */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Ad Soyad (Dijital İmza) <span className="text-red-500">*</span>
            </label>
            {expectedFullName && (
              <p className="mb-2 text-xs text-slate-500">
                Hesabınızdaki ad soyad ile birebir aynı yazın:{' '}
                <span className="font-semibold text-slate-700">{toTitleCaseTR(expectedFullName)}</span>
              </p>
            )}
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              onBlur={(e) => {
                const v = toTitleCaseTR(e.target.value.trim());
                if (v) { setSignature(v); checkSignatureMatch(v); }
              }}
              placeholder="Adınızı ve soyadınızı yazın"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {signatureWarning && (
              <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-start gap-1.5">
                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                {signatureWarning}
              </p>
            )}
          </div>

          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <button
              type="button"
              role="checkbox"
              aria-checked={checked}
              onClick={() => {
                if (!scrolledToBottom) return;
                setChecked((v) => {
                  const next = !v;
                  if (next && !checkboxConfirmedAt) {
                    setCheckboxConfirmedAt(new Date().toISOString());
                  }
                  if (!next) setCheckboxConfirmedAt(null);
                  return next;
                });
              }}
              disabled={!scrolledToBottom}
              className={`mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-all ${
                checked
                  ? 'bg-blue-600 border-blue-600'
                  : scrolledToBottom
                  ? 'bg-white border-gray-300 hover:border-blue-400'
                  : 'bg-gray-100 border-gray-200 cursor-not-allowed'
              }`}
            >
              {checked && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <span className={`text-sm leading-snug ${scrolledToBottom ? 'text-gray-700' : 'text-gray-400'}`}>
              Yukarıdaki belgeyi okudum, anladım ve kabul ediyorum.
            </span>
          </label>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="button"
            onClick={handleAccept}
            disabled={!checked || !signatureValid || saving}
            className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #1a4080 0%, #1e5aa8 100%)' }}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Kaydediliyor...
              </span>
            ) : currentIndex + 1 < pendingAgreements.length ? (
              'Kabul Et ve Devam'
            ) : (
              'Kabul Et ve Sisteme Gir'
            )}
          </button>

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              disabled={saving}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Şimdi Değil
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
