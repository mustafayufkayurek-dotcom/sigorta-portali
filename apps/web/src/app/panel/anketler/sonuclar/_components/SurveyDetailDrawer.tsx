'use client';

import { useState } from 'react';
import { SlidePanel } from '@/components/SlidePanel';
import type { SurveyCampaign } from '@/utils/surveyApi';
import { SURVEY_STAR_QUESTION_LABELS, SURVEY_Q6_LABEL } from '@/utils/survey-form';
import {
  averageScore,
  campaignDisplayName,
  formatTrDate,
  formatTrDateTime,
  formatTrNumber,
  mapUiStatus,
} from '../_lib/survey-results-adapters';

type Tab = 'genel' | 'sorular' | 'yanitlar' | 'yorumlar';

const TABS: { id: Tab; label: string }[] = [
  { id: 'genel', label: 'Genel Bakış' },
  { id: 'sorular', label: 'Sorular' },
  { id: 'yanitlar', label: 'Yanıtlar' },
  { id: 'yorumlar', label: 'Yorumlar' },
];

export function SurveyDetailDrawer({
  open,
  onClose,
  campaign,
}: {
  open: boolean;
  onClose: () => void;
  campaign: SurveyCampaign | null;
}) {
  const [tab, setTab] = useState<Tab>('genel');
  if (!campaign) return null;

  const avg = averageScore(campaign);
  const response = campaign.response;

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={campaignDisplayName(campaign)}
      subtitle={`Durum: ${mapUiStatus(campaign.status)}`}
      width={520}
      scrollContent={false}
    >
      <div className="flex h-full flex-col">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium ${
                tab === t.id
                  ? 'border-brand-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 text-sm">
          {tab === 'genel' ? (
            <dl className="space-y-3">
              <Row label="Anket Adı" value={campaignDisplayName(campaign)} />
              <Row label="Durum" value={mapUiStatus(campaign.status)} />
              <Row label="Gönderim" value={formatTrDate(campaign.whatsappSentAt || campaign.createdAt)} />
              <Row label="Tamamlanma" value={formatTrDateTime(campaign.completedAt)} />
              <Row label="Sigortalı" value={campaign.insuredName || '—'} />
              <Row label="Şirket" value={campaign.insuranceCompany?.name || '—'} />
              <Row label="Ortalama Puan" value={avg == null ? '—' : `${formatTrNumber(avg, 2)} / 5`} />
              <Row label="NPS" value="—" hint="NPS sorusu tanımlı değil" />
              <Row
                label={SURVEY_Q6_LABEL}
                value={
                  response
                    ? response.q6Recommend
                      ? 'Memnunum'
                      : 'Memnun Değilim'
                    : '—'
                }
              />
            </dl>
          ) : null}

          {tab === 'sorular' ? (
            response ? (
              <ul className="space-y-3">
                {[
                  { label: SURVEY_STAR_QUESTION_LABELS[0], value: response.q1Rating },
                  { label: SURVEY_STAR_QUESTION_LABELS[1], value: response.q2Rating },
                  { label: SURVEY_STAR_QUESTION_LABELS[2], value: response.q3Rating },
                  { label: SURVEY_STAR_QUESTION_LABELS[3], value: response.q4Rating },
                  { label: SURVEY_STAR_QUESTION_LABELS[4], value: response.q5Rating },
                ].map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                  >
                    <span className="text-slate-700">{item.label}</span>
                    <span className="font-semibold text-slate-900">{item.value} / 5</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400">Yanıt bulunamadı</p>
            )
          ) : null}

          {tab === 'yanitlar' ? (
            response ? (
              <dl className="space-y-3">
                <Row label="Gönderim Zamanı" value={formatTrDateTime(response.submittedAt || campaign.completedAt)} />
                <Row label="Ortalama" value={avg == null ? '—' : formatTrNumber(avg, 2)} />
                <Row label="Telefon" value={campaign.insuredPhone || '—'} />
              </dl>
            ) : (
              <p className="text-slate-400">Yanıt bulunamadı</p>
            )
          ) : null}

          {tab === 'yorumlar' ? (
            response?.q7Comment?.trim() ? (
              <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-slate-700 whitespace-pre-wrap">
                {response.q7Comment}
              </p>
            ) : (
              <p className="text-slate-400">Yorum yok</p>
            )
          ) : null}
        </div>
      </div>
    </SlidePanel>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-50 pb-2">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-right">
        <div className="font-medium text-slate-800">{value}</div>
        {hint ? <div className="mt-0.5 text-[11px] text-slate-400">{hint}</div> : null}
      </dd>
    </div>
  );
}
