'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Info, Mail, Phone } from 'lucide-react';
import { ToastProvider, useToast } from '@/contexts/ToastContext';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

interface PageProps {
  params: { token: string };
}

function phoneParts(raw?: string | null): { label: string; tel: string } | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  const local = digits.startsWith('90') ? digits.slice(2) : digits.replace(/^0/, '');
  if (local.length !== 10) return null;
  return {
    label: `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 8)} ${local.slice(8)}`,
    tel: `+90${local}`,
  };
}

function previewFacts() {
  if (process.env.NODE_ENV === 'production') return null;
  return {
    fileNo: '20902600042',
    insurance: 'Ray Sigorta',
    insured: 'Ayşe Aycan Totkanlı',
    district: 'Üsküdar',
    city: 'İstanbul',
    owner: 'Aslı Güngör',
    phone: '+905336330713',
  };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('tr-TR');
}

function Shell({ children, preview }: { children: React.ReactNode; preview?: boolean }) {
  return (
    <div className="min-h-screen bg-[#eef2f7] px-4 py-8 text-slate-800 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200/80 bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
        {children}
      </div>
      {preview ? (
        <p className="mx-auto mt-6 max-w-5xl text-center text-xs text-slate-400">
          Tasarım önizlemesi · Bu ekrandaki işlemler gerçek dosyaya kaydedilmez.
        </p>
      ) : null}
    </div>
  );
}

function ApprovalPageInner({ token }: { token: string }) {
  const { showToast } = useToast();
  const sample = previewFacts();
  const preview = token === 'gorunum' && sample != null;

  const [state, setState] = useState<'loading' | 'ready' | 'already_responded' | 'expired' | 'error'>(
    preview ? 'ready' : 'loading',
  );
  const [data, setData] = useState<any>(null);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<'approved' | 'rejected' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (preview) return;
    axios
      .get(`${API}/external-approvals/token/${token}`)
      .then((res) => {
        setData(res.data.data);
        setState(res.data.alreadyResponded ? 'already_responded' : 'ready');
      })
      .catch((e) => {
        const msg: string = e.response?.data?.message ?? 'Bilinmeyen hata';
        if (msg.includes('süre') || msg.includes('expir')) {
          setState('expired');
        } else {
          setErrorMsg(msg);
          setState('error');
        }
      });
  }, [token, preview]);

  const handleRespond = useCallback(async (action: 'approved' | 'rejected') => {
    if (preview) {
      setSubmitted(action);
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/external-approvals/${token}/respond`, { action, comments });
      setSubmitted(action);
    } catch (e: any) {
      showToast('error', e.response?.data?.message ?? 'İşlem tamamlanamadı');
    } finally {
      setSubmitting(false);
    }
  }, [token, comments, showToast, preview]);

  const shareNote = useCallback(() => {
    const text = comments.trim();
    if (!text) {
      showToast('warning', 'Görüşünüzü yazın');
      return;
    }
    showToast('success', preview
      ? 'Görüşünüz not edildi. Bu önizlemede dosyaya yazılmaz.'
      : 'Görüşünüz kararınıza eklendi. Onayla veya Reddet ile gider.');
  }, [comments, preview, showToast]);

  if (state === 'loading') {
    return (
      <Shell>
        <p className="py-16 text-center text-sm text-slate-500">Yükleniyor</p>
      </Shell>
    );
  }

  if (state === 'error' || state === 'expired' || state === 'already_responded' || submitted) {
    const approved = (submitted ?? data?.status) === 'approved';
    const title = state === 'error'
      ? 'Bağlantı Açılmadı'
      : state === 'expired'
        ? 'Bağlantı Kapandı'
        : approved
          ? 'Onayınız Alındı'
          : 'Reddiniz Kayda Geçti';
    const body = state === 'error'
      ? (errorMsg || 'Bu onay bağlantısı geçersiz.')
      : state === 'expired'
        ? 'Bu yazının süresi doldu. Dosya sorumlusu yeni bir yazı gönderir.'
        : approved
          ? 'Dosya işleme alındı. Başka bir işlem gerekmez.'
          : 'Notunuz dosyada durur. Dosya sorumlusu bakar.';
    return (
      <Shell preview={preview}>
        <p className="text-[11px] font-medium tracking-[0.16em] text-slate-400">
          Hasar Onarım Ve Restorasyon Departmanı
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">{body}</p>
      </Shell>
    );
  }

  const claimFile = data?.report?.claimFile;
  const district = preview ? sample.district : (claimFile?.propertyAddress?.district || '');
  const city = preview ? sample.city : (claimFile?.propertyAddress?.city || '');
  const owner = preview
    ? sample.owner
    : [data?.sentBy?.firstName, data?.sentBy?.lastName].filter(Boolean).join(' ');
  const phone = phoneParts(preview ? sample.phone : data?.sentBy?.phone);
  const ownerEmail = String(data?.sentBy?.email ?? '').trim();
  const fileNo = preview ? sample.fileNo : (claimFile?.fileNo || '—');
  const insurance = preview ? sample.insurance : (claimFile?.insuranceCompany?.name || '—');
  const insured = preview ? sample.insured : (claimFile?.insuredName || '—');
  const network = [city, district].filter(Boolean).join('-');

  return (
    <Shell preview={preview}>
      <p className="text-[11px] font-medium tracking-[0.16em] text-slate-400">
        Hasar Onarım Ve Restorasyon Departmanı
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-[2rem]">
        Dosya Değerlendirmeniz Bekleniyor
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Dosya bilgilerini inceleyerek kararınızı iletebilirsiniz.
      </p>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Dosya Özeti</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Onay Bekliyor
              </span>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{fileNo}</p>
            <p className="mt-1 text-sm text-slate-400">Hasar Dosya Numarası</p>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              <div>
                <p className="text-sm text-slate-400">Sigortalı</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{insured}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Sigorta Şirketi</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{insurance}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">İlçe</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{district || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">İl</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{city || '—'}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                {initials(owner || 'Meridyen')}
              </div>
              <div>
                <p className="text-xs text-slate-400">Dosya Sorumlusu</p>
                <p className="text-sm font-semibold text-slate-900">{owner || '—'}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-blue-600">
              {phone ? (
                <a href={`tel:${phone.tel}`} className="inline-flex items-center gap-2 hover:text-blue-700">
                  <Phone className="h-4 w-4" strokeWidth={1.75} />
                  {phone.label}
                </a>
              ) : null}
              {ownerEmail ? (
                <a href={`mailto:${ownerEmail}`} className="inline-flex items-center gap-2 hover:text-blue-700">
                  <Mail className="h-4 w-4" strokeWidth={1.75} />
                  E-posta Gönder
                </a>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4" strokeWidth={1.75} />
                  E-posta Gönder
                </span>
              )}
            </div>
            {network ? (
              <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-500">
                Operasyon Bölgesi
                <span className="ml-2 font-semibold text-slate-800">{network} Network</span>
              </p>
            ) : null}
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="text-base font-semibold text-slate-900">Lütfen Dosya Durumunu Bildirin</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Dosya bilgilerini inceleyip uygun seçeneği seçebilirsiniz.
          </p>
          <button
            type="button"
            onClick={() => handleRespond('approved')}
            disabled={submitting}
            className="mt-4 h-11 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Dosyayı Onayla
          </button>
          <button
            type="button"
            onClick={() => handleRespond('rejected')}
            disabled={submitting}
            className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Reddet
          </button>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Görüşünüz <span className="font-normal text-slate-400">(isteğe bağlı)</span>
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Kararınızdan bağımsız olarak görüş paylaşabilirsiniz.
            </p>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              placeholder="Eklemek istediğiniz bir görüş varsa yazabilirsiniz."
              className="mt-3 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={shareNote}
              className="mt-3 h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Görüş Bildir
            </button>
          </div>
          <p className="mt-4 flex items-start gap-2 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Giriş yapmanız gerekmez. İlettiğiniz karar dosyanıza kaydedilir.
          </p>
        </section>
      </div>
    </Shell>
  );
}

export default function ExternalApprovalPage({ params }: PageProps) {
  const { token } = params;
  return (
    <ToastProvider>
      <ApprovalPageInner token={token} />
    </ToastProvider>
  );
}
