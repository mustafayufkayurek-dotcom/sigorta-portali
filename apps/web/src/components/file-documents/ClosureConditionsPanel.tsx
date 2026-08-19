'use client';

import { useState, useEffect } from 'react';
import {
  ClaimClosureConditions,
  EmergencyClosureConditions,
  getClaimClosureConditions,
  getEmergencyClosureConditions,
} from '@/utils/fileDocumentApi';
import {
  createInvoiceRequest,
  getInvoiceRequestsByClaimFile,
  getInvoiceRequestsByEmergencyCase,
  InvoiceRequest,
} from '@/utils/invoiceRequestApi';
import {
  SurveyCampaign,
  getSurveyByClaimFile,
  getSurveyByEmergencyCase,
  sendSurveyLink,
  createAndSendSurveyForClaim,
  createAndSendSurveyForEmergency,
} from '@/utils/surveyApi';
import { formatTryAmount } from '@/utils/format-try-amount';

// ── Types ────────────────────────────────────────────────────────────────────

interface SharedProps {
  /** Kapama kontrol listesi (muvafakat, rapor, sözleşme). Evrak Özet'te zaten var; Finans'ta kapalı tutulabilir. */
  showClosureChecklist?: boolean;
  /** Fatura talebi oluşturma ve durum takibi */
  showInvoiceRequest?: boolean;
  /** Müşteri memnuniyet anketi (dosya kapanışında; zorunlu değil) */
  showSurvey?: boolean;
  /** Dosya kapalıysa anket bloğu fatura kesilmeden de görünür */
  fileClosed?: boolean;
}

interface ClaimProps extends SharedProps {
  serviceType: 'claim';
  entityId: string;
  fileNo: string;
  insuranceCompanyId?: string;
  insuranceCompanyName?: string;
  totalAmount?: number;
  workItemsSummary?: { description: string; amount: number; vatRate?: number }[];
}

interface EmergencyProps extends SharedProps {
  serviceType: 'emergency';
  entityId: string;
  fileNo: string;
  insuranceCompanyId?: string;
  insuranceCompanyName?: string;
  totalAmount?: number;
  workItemsSummary?: { description: string; amount: number; vatRate?: number }[];
}

type Props = ClaimProps | EmergencyProps;

// ── Condition Row ─────────────────────────────────────────────────────────────

function ConditionRow({
  met,
  label,
  help,
}: {
  met: boolean;
  label: string;
  help?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div
        className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
          met ? 'bg-green-500' : 'bg-gray-200'
        }`}
      >
        {met ? (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
      <div>
        <p className={`text-sm font-medium ${met ? 'text-gray-900' : 'text-gray-500'}`}>{label}</p>
        {help && !met && <p className="text-xs text-gray-400 mt-0.5">{help}</p>}
      </div>
    </div>
  );
}

// ── Request Status Badge ─────────────────────────────────────────────────────

function reqBadge(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: 'Bekliyor', color: 'bg-yellow-100 text-yellow-700' },
    approved: { label: 'Onaylandı', color: 'bg-blue-100 text-blue-700' },
    invoiced: { label: 'Faturalandi', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'İptal', color: 'bg-red-100 text-red-700' },
  };
  const s = map[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ClosureConditionsPanel(props: Props) {
  const {
    serviceType,
    entityId,
    fileNo,
    showClosureChecklist = true,
    showInvoiceRequest = true,
    showSurvey = true,
    fileClosed = false,
  } = props;

  const [conditions, setConditions] = useState<
    ClaimClosureConditions | EmergencyClosureConditions | null
  >(null);
  const [existingRequests, setExistingRequests] = useState<InvoiceRequest[]>([]);
  const [loadingConds, setLoadingConds] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Anket state
  const [survey, setSurvey] = useState<SurveyCampaign | null | undefined>(undefined);
  const [sendingSurvey, setSendingSurvey] = useState(false);
  const [surveyDeepLink, setSurveyDeepLink] = useState<string | null>(null);
  const [surveyError, setSurveyError] = useState('');

  const loadConditions = async () => {
    if (!showClosureChecklist && !showInvoiceRequest) return null;
    try {
      const conds =
        serviceType === 'claim'
          ? await getClaimClosureConditions(entityId)
          : await getEmergencyClosureConditions(entityId);
      setConditions(conds);
      return conds;
    } catch (e: unknown) {
      if (showClosureChecklist || showInvoiceRequest) {
        setError(e instanceof Error ? e.message : 'Kapanış durumu yüklenemedi');
      }
      setConditions(null);
      return null;
    }
  };

  const loadRequests = async () => {
    if (!showInvoiceRequest && !showSurvey) return [];
    try {
      const reqs =
        serviceType === 'claim'
          ? await getInvoiceRequestsByClaimFile(entityId)
          : await getInvoiceRequestsByEmergencyCase(entityId);
      setExistingRequests(reqs);
      return reqs;
    } catch (e: unknown) {
      if (showInvoiceRequest) {
        setError(e instanceof Error ? e.message : 'Fatura talepleri yüklenemedi');
      }
      setExistingRequests([]);
      return [];
    }
  };

  const loadSurvey = async () => {
    if (!showSurvey) {
      setSurvey(null);
      return;
    }
    try {
      const s =
        serviceType === 'claim'
          ? await getSurveyByClaimFile(entityId)
          : await getSurveyByEmergencyCase(entityId);
      setSurvey(s);
    } catch {
      setSurvey(null);
    }
  };

  const load = async () => {
    setLoadingConds(true);
    setError('');
    await Promise.all([loadConditions(), loadRequests(), loadSurvey()]);
    setLoadingConds(false);
  };

  useEffect(() => {
    load();
  }, [entityId, serviceType]);

  const activeRequest = existingRequests.find((r) =>
    ['pending', 'approved'].includes(r.status),
  );
  const invoicedRequest = existingRequests.find((r) => r.status === 'invoiced');

  const handleCreateRequest = async () => {
    if (!conditions?.canCreateInvoiceRequest) return;
    setCreating(true);
    setError('');
    try {
      await createInvoiceRequest({
        serviceType,
        ...(serviceType === 'claim' ? { claimFileId: entityId } : { emergencyCaseId: entityId }),
        fileNo,
        insuranceCompanyId: props.insuranceCompanyId,
        insuranceCompanyName: props.insuranceCompanyName,
        totalAmount: props.totalAmount ?? 0,
        workItemsSummary: props.workItemsSummary ?? [],
      });
      setSuccess('Fatura talebi oluşturuldu ve finans ekibine iletildi.');
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Talep oluşturma başarısız');
    } finally {
      setCreating(false);
    }
  };

  const handleSendSurvey = async () => {
    setSendingSurvey(true);
    setSurveyError('');
    try {
      let result: { deepLink: string; campaign: SurveyCampaign };
      if (survey) {
        result = await sendSurveyLink(survey.id);
      } else if (serviceType === 'claim') {
        result = await createAndSendSurveyForClaim(entityId);
      } else {
        result = await createAndSendSurveyForEmergency(entityId);
      }
      setSurveyDeepLink(result.deepLink);
      setSurvey(result.campaign);
    } catch (e: any) {
      setSurveyError(e.message ?? 'Anket gönderilemedi');
    } finally {
      setSendingSurvey(false);
    }
  };

  if (loadingConds) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        Yükleniyor…
      </div>
    );
  }

  const isClaimConds = (c: any): c is ClaimClosureConditions =>
    'muvafakatnameDigitallyApproved' in c;

  return (
    <div className="space-y-4">
      {showClosureChecklist && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Kapanış Kontrol Listesi</h3>
            {conditions?.canCreateInvoiceRequest && (
              <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Hazır
              </span>
            )}
          </div>
          <div className="px-4 divide-y divide-gray-50">
            {conditions && isClaimConds(conditions) ? (
              <>
                <ConditionRow
                  met={conditions.muvafakatnameDigitallyApproved}
                  label="Muvafakatname dijital onayı"
                  help="Muvafakatname WhatsApp ile gönderilmeli ve onaylanmalı"
                />
                <ConditionRow
                  met={conditions.repairReportApproved}
                  label="Onarım raporu onaylandı"
                  help="Onarım raporu 'Onaylı' durumunda olmalı"
                />
                <ConditionRow
                  met={conditions.vendorContractSigned}
                  label="Tedarikçi sözleşmesi imzalı"
                  help="Tedarikçi tarafından imzalanmış sözleşme olmalı"
                />
              </>
            ) : conditions ? (
              <>
                <ConditionRow
                  met={(conditions as EmergencyClosureConditions).matbuEvrakDigitallyApproved}
                  label="Matbu evrak dijital onayı"
                  help="Matbu evrak WhatsApp ile gönderilmeli ve onaylanmalı"
                />
                <ConditionRow
                  met={(conditions as EmergencyClosureConditions).caseStatusCompleted}
                  label="Dosya tamamlandı (ÇÖZÜLDÜ)"
                  help="Dosya durumu ÇÖZÜLDÜ olarak işaretlenmeli"
                />
              </>
            ) : null}
          </div>
        </div>
      )}

      {showInvoiceRequest && activeRequest && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-blue-900">Fatura Talebi</p>
            {reqBadge(activeRequest.status)}
          </div>
          <p className="text-xs text-blue-700">
            {activeRequest.requestNo} · {new Date(activeRequest.createdAt).toLocaleDateString('tr-TR')}
          </p>
          {activeRequest.totalAmount > 0 && (
            <p className="text-xs text-blue-700 mt-0.5">
              Tutar: {formatTryAmount(activeRequest.totalAmount, { fractionDigits: 0 })}
            </p>
          )}
        </div>
      )}

      {showInvoiceRequest && existingRequests.filter((r) => ['invoiced', 'cancelled'].includes(r.status)).length > 0 && (
        <div className="space-y-2">
          {existingRequests
            .filter((r) => ['invoiced', 'cancelled'].includes(r.status))
            .map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-gray-700">{r.requestNo}</p>
                  <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString('tr-TR')}</p>
                </div>
                {reqBadge(r.status)}
              </div>
            ))}
        </div>
      )}

      {/* Hata / Başarı */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
          {success}
        </div>
      )}

      {showInvoiceRequest && !activeRequest && conditions?.canCreateInvoiceRequest && (
        <button
          onClick={handleCreateRequest}
          disabled={creating}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {creating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Oluşturuluyor…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Fatura Talebi Oluştur
            </>
          )}
        </button>
      )}

      {showInvoiceRequest && !activeRequest && conditions && !conditions.canCreateInvoiceRequest && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          Fatura talebi için evrak ve onarım raporu koşulları tamamlanmalıdır. Durumu Evraklar → Özet sekmesinden kontrol edebilirsiniz.
        </div>
      )}

      {showSurvey && (fileClosed || invoicedRequest || survey) && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Müşteri Memnuniyet Anketi</h3>
            {survey === undefined ? (
              <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
            ) : survey?.status === 'completed' ? (
              <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Tamamlandı
              </span>
            ) : survey?.status === 'sent' ? (
              <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded">Gönderildi</span>
            ) : survey?.status === 'expired' ? (
              <span className="bg-red-100 text-red-600 text-xs font-medium px-2 py-0.5 rounded">Süresi Doldu</span>
            ) : (
              <span className="bg-slate-100 text-slate-500 text-xs font-medium px-2 py-0.5 rounded">Gönderilmedi</span>
            )}
          </div>

          <div className="px-4 py-3 space-y-3">
            {/* Anket yanıtı var ise özet göster */}
            {survey?.status === 'completed' && survey.response && (
              <div className="grid grid-cols-5 gap-2">
                {[survey.response.q1Rating, survey.response.q2Rating, survey.response.q3Rating, survey.response.q4Rating, survey.response.q5Rating].map((r, i) => (
                  <div key={i} className="text-center bg-slate-50 rounded-lg py-2">
                    <p className="text-xs text-slate-500 mb-0.5">S{i + 1}</p>
                    <p className="text-sm font-bold text-status-warning">{'★'.repeat(r)}{'☆'.repeat(5 - r)}</p>
                  </div>
                ))}
              </div>
            )}
            {survey?.status === 'completed' && survey.response?.q6Recommend !== undefined && (
              <p className="text-xs text-slate-600">
                Memnuniyet: <strong className={survey.response.q6Recommend ? 'text-green-600' : 'text-status-danger'}>{survey.response.q6Recommend ? 'Memnunum' : 'Memnun Değilim'}</strong>
              </p>
            )}
            {survey?.status === 'completed' && survey.response?.q7Comment && (
              <p className="text-xs text-slate-500 italic">"{survey.response.q7Comment}"</p>
            )}

            {/* Deep link göster */}
            {surveyDeepLink && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <p className="text-xs text-green-700 font-medium mb-1">WhatsApp linki hazır:</p>
                <a
                  href={surveyDeepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-800 underline break-all"
                >
                  {surveyDeepLink}
                </a>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(surveyDeepLink)}
                  className="mt-1.5 text-xs text-green-700 underline block"
                >
                  Kopyala
                </button>
              </div>
            )}

            {/* Önceki gönderim bilgisi */}
            {survey?.whatsappSentAt && !surveyDeepLink && (
              <p className="text-xs text-slate-500">
                Son gönderim: {new Date(survey.whatsappSentAt).toLocaleString('tr-TR')}
              </p>
            )}

            {/* Hata */}
            {surveyError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {surveyError}
              </p>
            )}

            {/* Gönder butonu */}
            {survey?.status !== 'completed' && (
              <button
                type="button"
                onClick={handleSendSurvey}
                disabled={sendingSurvey}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors"
              >
                {sendingSurvey ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Hazırlanıyor…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {survey?.whatsappSentAt ? 'Tekrar Gönder' : 'WhatsApp Anket Linki Oluştur'}
                  </>
                )}
              </button>
            )}
            {survey?.status !== 'completed' && !survey?.whatsappSentAt && (
              <p className="text-xs text-slate-500">
                Anket zorunlu değildir. Link sigortalıya WhatsApp ile açılır; yanıt kamu anket sayfasından geri gelir.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
