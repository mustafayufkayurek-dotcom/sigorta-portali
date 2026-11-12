'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Info, Mail, Phone } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

interface PageProps {
  params: { token: string };
}

function phoneParts(raw?: string | null): { label: string; tel: string } | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  const local = digits.startsWith('90') ? digits.slice(2) : digits.replace(/^0/, '');
  if (local.length !== 10) return null;
  return {
    label: `0${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 8)} ${local.slice(8)}`,
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
    expertOffice: 'Meridyen Ekspertiz Ltd.',
    reportFee: 185000,
  };
}

function expertOfficeName(report: any): string {
  const office = report?.expertOffice;
  const named = String(office?.companyName || office?.fullName || office?.shortName || '').trim();
  if (named) return named;
  const customer = report?.claimFile?.customer;
  const sub = String(customer?.subType || '').trim().toLowerCase();
  const blocked = new Set([
    'insured',
    'private_customer',
    'asistan_firmasi',
    'asistans_firmasi',
    'sigorta_sirketi',
    'broker_firmasi',
  ]);
  if (blocked.has(sub)) return '';
  const expert = sub === 'eksper' || sub === 'eksper_firmasi';
  const corporate = !sub && String(customer?.entityType || customer?.type || '').toLowerCase() === 'corporate';
  if (!expert && !corporate) return '';
  return String(customer?.companyName || customer?.fullName || customer?.shortName || '').trim();
}

function formatReportFee(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  return `${Math.round(amount).toLocaleString('tr-TR')} TL`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('tr-TR');
}

function Frame({ children, preview }: { children: React.ReactNode; preview?: boolean }) {
  return (
    <div className="min-h-screen bg-[#f3f6fa] text-[#182c45]">
      <main className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-[30px] sm:py-[34px]">
        <img
          src="/meridyen-logo-orijinal.jpg"
          alt="Meridyen Asistans"
          width={184}
          height={71}
          className="mb-6 block h-[71px] w-[184px] max-w-full object-cover object-center"
        />
        {children}
      </main>
      {preview ? (
        <p className="pb-8 text-center text-[11px] text-[#64748b]">
          Tasarım önizlemesi · Bu ekrandaki işlemler gerçek dosyaya kaydedilmez.
        </p>
      ) : null}
    </div>
  );
}

function ApprovalPageInner({ token }: { token: string }) {
  const sample = previewFacts();
  const preview = token === 'gorunum' && sample != null;

  const [state, setState] = useState<'loading' | 'ready' | 'already_responded' | 'expired' | 'error'>(
    preview ? 'ready' : 'loading',
  );
  const [data, setData] = useState<any>(null);
  const [opinion, setOpinion] = useState('');
  const [reason, setReason] = useState('');
  const [askingReason, setAskingReason] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<'approved' | 'rejected' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [opinionNote, setOpinionNote] = useState('');
  const [emailNote, setEmailNote] = useState('');

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

  const handleApprove = useCallback(async () => {
    setDecisionNote('');
    if (preview) {
      setSubmitted('approved');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/external-approvals/${token}/respond`, { action: 'approved' });
      setSubmitted('approved');
    } catch (e: any) {
      setDecisionNote(e.response?.data?.message ?? 'İşlem tamamlanamadı');
    } finally {
      setSubmitting(false);
    }
  }, [token, preview]);

  const handleSendReject = useCallback(async () => {
    const text = reason.trim();
    if (!text) {
      setDecisionNote('Lütfen ret gerekçesini yazın.');
      return;
    }
    setDecisionNote('');
    if (preview) {
      setSubmitted('rejected');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/external-approvals/${token}/respond`, {
        action: 'rejected',
        comments: text,
      });
      setSubmitted('rejected');
    } catch (e: any) {
      setDecisionNote(e.response?.data?.message ?? 'İşlem tamamlanamadı');
    } finally {
      setSubmitting(false);
    }
  }, [token, reason, preview]);

  const shareNote = useCallback(async () => {
    const text = opinion.trim();
    if (!text) {
      setOpinionNote('Lütfen görüşünüzü yazın.');
      return;
    }
    if (preview) {
      setOpinionNote('Görüşünüz alındı. Dosyanın onay durumu değişmedi.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/external-approvals/${token}/opinion`, { comments: text });
      setOpinionNote(res.data?.message ?? 'Görüşünüz alındı. Dosyanın onay durumu değişmedi.');
    } catch (e: any) {
      setOpinionNote(e.response?.data?.message ?? 'Görüş kayda geçmedi');
    } finally {
      setSubmitting(false);
    }
  }, [opinion, preview, token]);

  if (state === 'loading') {
    return (
      <Frame>
        <p className="py-16 text-center text-sm text-[#64748b]">Yükleniyor</p>
      </Frame>
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
      <Frame preview={preview}>
        <p className="text-[11px] font-[650] tracking-[1.5px] text-[#64748b]">
          Hasar Onarım Ve Restorasyon Departmanı
        </p>
        <h1 className="mt-2 text-[25px] font-[650] leading-tight tracking-[-0.7px] text-[#182c45] sm:text-[28px]">{title}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#64748b]">{body}</p>
      </Frame>
    );
  }

  const claimFile = data?.report?.claimFile;
  const district = preview ? sample.district : (claimFile?.propertyAddress?.district || '');
  const city = preview ? sample.city : (claimFile?.propertyAddress?.city || '');
  const owner = preview
    ? sample.owner
    : [data?.sentBy?.firstName, data?.sentBy?.lastName].filter(Boolean).join(' ');
  const phone = phoneParts(preview ? sample.phone : data?.sentBy?.phone);
  const ownerEmail = String(preview ? '' : (data?.sentBy?.email ?? '')).trim();
  const fileNo = preview ? sample.fileNo : (claimFile?.fileNo || '—');
  const insurance = preview ? sample.insurance : (claimFile?.insuranceCompany?.name || '—');
  const insured = preview ? sample.insured : (claimFile?.insuredName || '—');
  const expertOffice = preview ? sample.expertOffice : expertOfficeName(data?.report);
  const reportFee = formatReportFee(preview ? sample.reportFee : data?.report?.totalSalesAmount);
  const network = [city, district].filter(Boolean).join('-');

  return (
    <Frame preview={preview}>
      <div className="mb-[26px]">
        <p className="text-[11px] font-[650] tracking-[1.5px] text-[#64748b]">
          Hasar Onarım Ve Restorasyon Departmanı
        </p>
        <h1 className="mb-2 mt-[9px] text-[25px] font-[650] leading-[1.2] tracking-[-0.7px] text-[#182c45] sm:text-[28px]">
          Dosya Değerlendirmeniz Bekleniyor
        </h1>
        <p className="text-sm text-[#64748b]">
          Dosya bilgilerini inceleyerek kararınızı iletebilirsiniz.
        </p>
      </div>

      <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(230px,1fr)]">
        <div className="space-y-5">
          <section className="rounded-[24px] border border-[#e4eaf1] bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-[650] text-[#182c45]">Dosya Özeti</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff4da] px-2.5 py-[5px] text-[11px] text-[#8a570c]">
                ● Onay Bekliyor
              </span>
            </div>
            <p className="mt-4 text-[23px] font-[650] tracking-[0.2px] text-[#182c45]">{fileNo}</p>
            <p className="text-xs text-[#64748b]">Hasar Dosya Numarası</p>
            <div className="mt-[22px] grid grid-cols-1 gap-x-4 gap-y-5 border-t border-[#e4eaf1] pt-[22px] min-[370px]:grid-cols-2">
              <div>
                <p className="text-xs text-[#64748b]">Eksper Ofisi</p>
                <p className="mt-1 font-medium text-[#182c45]">{expertOffice || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748b]">Rapor Bedeli</p>
                <p className="mt-1 font-medium text-[#182c45]">{reportFee}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748b]">Sigortalı</p>
                <p className="mt-1 font-medium text-[#182c45]">{insured}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748b]">Sigorta Şirketi</p>
                <p className="mt-1 font-medium text-[#182c45]">{insurance}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748b]">İlçe</p>
                <p className="mt-1 font-medium text-[#182c45]">{district || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748b]">İl</p>
                <p className="mt-1 font-medium text-[#182c45]">{city || '—'}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-[#e4eaf1] bg-white px-5 py-[18px]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f3f6fa] text-sm font-[650] text-[#185bc4]">
                {initials(owner || 'Meridyen')}
              </div>
              <div>
                <h2 className="text-xs font-medium text-[#64748b]">Dosya Sorumlusu</h2>
                <p className="mt-px font-medium text-[#182c45]">{owner || '—'}</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-[18px] gap-y-2">
              {phone ? (
                <a href={`tel:${phone.tel}`} className="inline-flex min-h-[44px] items-center gap-2 text-[13px] font-medium text-[#185bc4]">
                  <Phone className="h-4 w-4" strokeWidth={1.75} />
                  {phone.label}
                </a>
              ) : null}
              {ownerEmail ? (
                <a href={`mailto:${ownerEmail}`} className="inline-flex min-h-[44px] items-center gap-2 text-[13px] font-medium text-[#185bc4]">
                  <Mail className="h-4 w-4" strokeWidth={1.75} />
                  E-posta Gönder
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setEmailNote('Dosya sorumlusunun e-posta adresi henüz tanımlanmadı.')}
                  className="inline-flex min-h-[44px] items-center gap-2 text-[13px] font-medium text-[#185bc4]"
                >
                  <Mail className="h-4 w-4" strokeWidth={1.75} />
                  E-posta Gönder
                </button>
              )}
            </div>
            {emailNote ? <p className="mt-2 text-xs text-[#64748b]">{emailNote}</p> : null}
            {network ? (
              <p className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-t border-[#e4eaf1] pt-2.5 text-xs text-[#64748b]">
                <span>Operasyon Bölgesi</span>
                <span className="font-medium text-[#182c45]">{network} Network</span>
              </p>
            ) : null}
          </section>
        </div>

        <section className="flex h-full min-w-0 flex-col rounded-[24px] border border-[#e4eaf1] bg-white px-5 pb-5 pt-5">
          <h2 className="text-base font-[650] leading-[1.45] text-[#182c45]">Lütfen Dosya Durumunu Bildirin</h2>
          <p className="mb-3 mt-2 text-[13px] leading-5 text-[#64748b]">
            Dosya bilgilerini inceleyip uygun seçeneği seçebilirsiniz.
          </p>
          {askingReason ? (
            <div>
              <label htmlFor="ret-gerekcesi" className="text-sm font-medium text-[#182c45]">
                Ret Gerekçesi <span className="font-normal text-[#64748b]">(zorunlu)</span>
              </label>
              <textarea
                id="ret-gerekcesi"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Lütfen ret nedeninizi açıklayın."
                className="my-2 min-h-[90px] w-full resize-y rounded-lg border border-[#e4eaf1] bg-white px-2.5 py-2.5 text-base text-[#182c45] outline-none placeholder:text-[#64748b]"
              />
              <button
                type="button"
                onClick={handleSendReject}
                disabled={submitting}
                className="w-full rounded-lg border border-[#185bc4] bg-[#185bc4] px-4 py-[11px] text-sm font-semibold text-white disabled:opacity-50"
              >
                Ret Kararını İlet
              </button>
              <button
                type="button"
                onClick={() => { setAskingReason(false); setDecisionNote(''); }}
                className="mt-1 w-full bg-transparent px-2 py-2 text-sm font-semibold text-[#64748b]"
              >
                Vazgeç
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={handleApprove}
                disabled={submitting}
                className="w-full rounded-lg border border-[#185bc4] bg-[#185bc4] px-4 py-[11px] text-sm font-semibold text-white disabled:opacity-50"
              >
                Dosyayı Onayla
              </button>
              <button
                type="button"
                onClick={() => { setAskingReason(true); setDecisionNote(''); }}
                disabled={submitting}
                className="mt-2.5 w-full rounded-lg border border-[#e4eaf1] bg-white px-4 py-[11px] text-sm font-semibold text-[#182c45] disabled:opacity-50"
              >
                Reddet
              </button>
            </div>
          )}
          {decisionNote ? <p className="mt-3 text-xs text-[#185bc4]">{decisionNote}</p> : null}

          <div className="mt-3 border-t border-[#e4eaf1] pt-3">
            <label htmlFor="gorus" className="text-[13px] font-medium text-[#182c45]">
              Görüşünüz <span className="font-normal text-[#64748b]">(isteğe bağlı)</span>
            </label>
            <p className="mt-1 text-xs leading-5 text-[#64748b]">
              Kararınızdan bağımsız olarak görüş paylaşabilirsiniz.
            </p>
            <textarea
              id="gorus"
              value={opinion}
              onChange={(e) => setOpinion(e.target.value)}
              placeholder="Eklemek istediğiniz bir görüş varsa yazabilirsiniz."
              className="my-1.5 max-h-72 min-h-[44px] w-full resize-y rounded-lg border border-[#e4eaf1] bg-white px-2.5 py-2 text-xs leading-5 text-[#182c45] outline-none placeholder:text-[#64748b]"
            />
            <button
              type="button"
              onClick={shareNote}
              disabled={submitting}
              className="rounded-lg border border-[#e4eaf1] bg-white px-3 py-2 text-xs font-medium text-[#64748b] disabled:opacity-50"
            >
              Görüş Bildir
            </button>
            {opinionNote ? <p className="mt-3 text-xs text-[#185bc4]">{opinionNote}</p> : null}
          </div>

          <p className="mt-auto flex min-w-0 items-start gap-1.5 border-t border-[#e4eaf1] pt-3 text-[11px] leading-4 text-[#64748b]">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0">Giriş yapmanız gerekmez. İlettiğiniz bilgiler dosyanıza kaydedilir.</span>
          </p>
        </section>
      </div>
    </Frame>
  );
}

export default function ExternalApprovalPage({ params }: PageProps) {
  const { token } = params;
  return <ApprovalPageInner token={token} />;
}
