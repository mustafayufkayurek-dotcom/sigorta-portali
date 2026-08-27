'use client';

import { Star } from 'lucide-react';
import { SlidePanel } from '@/components/SlidePanel';
import type { SurveyCampaign } from '@/utils/surveyApi';
import { SURVEY_Q6_LABEL, SURVEY_Q7_LABEL, surveyStarQuestionsForCampaign } from '@/utils/survey-form';
import {
  averageScore,
  campaignDisplayName,
  formatTrDateTime,
  formatTrNumber,
} from '../_lib/survey-results-adapters';

export function ResponseDetailDrawer({
  open,
  onClose,
  campaign,
}: {
  open: boolean;
  onClose: () => void;
  campaign: SurveyCampaign | null;
}) {
  if (!campaign) return null;
  const response = campaign.response;
  const avg = averageScore(campaign);

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={campaign.insuredName?.trim() || 'Sigortalı'}
      subtitle={campaignDisplayName(campaign)}
      width={480}
    >
      {!response ? (
        <p className="text-sm text-slate-400">Yanıt bulunamadı</p>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <span className="text-slate-500">Ortalama Puan</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
              {avg == null ? '—' : formatTrNumber(avg, 2)}
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            </span>
          </div>

          <dl className="space-y-2">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Gönderim</dt>
              <dd className="text-slate-800">
                {formatTrDateTime(response.submittedAt || campaign.completedAt)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">{SURVEY_Q6_LABEL}</dt>
              <dd className="text-slate-800">{response.q6Recommend ? 'Memnunum' : 'Memnun Değilim'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">NPS</dt>
              <dd className="text-right text-slate-500">
                —<div className="text-[11px] text-slate-400">NPS sorusu tanımlı değil</div>
              </dd>
            </div>
          </dl>

          <ul className="space-y-2">
            {surveyStarQuestionsForCampaign(campaign).map((q) => {
              const value =
                q.key === 'q1'
                  ? response.q1Rating
                  : q.key === 'q2'
                    ? response.q2Rating
                    : q.key === 'q3'
                      ? response.q3Rating
                      : q.key === 'q4'
                        ? response.q4Rating
                        : response.q5Rating;
              return (
              <li
                key={q.key}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
              >
                <span className="text-slate-700">{q.label}</span>
                <span className="font-semibold text-slate-900">{value} / 5</span>
              </li>
              );
            })}
          </ul>

          {response.q7Comment?.trim() ? (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">{SURVEY_Q7_LABEL}</p>
              <p className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-slate-700 whitespace-pre-wrap">
                {response.q7Comment}
              </p>
            </div>
          ) : null}

          {campaign.ownerExplanation?.trim() ? (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Dosya sorumlusu açıklaması</p>
              <p className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-slate-700 whitespace-pre-wrap">
                {campaign.ownerExplanation}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </SlidePanel>
  );
}
