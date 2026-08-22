/** Kamu anket formu ve panel sonuç ekranı aynı soru metinlerini kullanır. */

export type SurveyChannel = 'hasar' | 'acil';

export const SURVEY_STAR_QUESTIONS = [
  {
    key: 'q1' as const,
    label: 'Telefonda Size Yardımcı Olan Personelimizin Hizmet Kalitesi',
  },
  {
    key: 'q2' as const,
    label: 'Hasar Onarım Ekibinin Randevu Ve İş Programı Zamanlaması',
  },
  {
    key: 'q3' as const,
    label: 'Hasar Onarım Ekibinin Davranışları',
  },
  {
    key: 'q4' as const,
    label: 'Hasar Onarım Ekibinin Dış Görünümü',
  },
  {
    key: 'q5' as const,
    label: 'Hasar Onarım Ekibinin İş Kalitesi',
  },
] as const;

export const SURVEY_ACIL_STAR_QUESTIONS = [
  {
    key: 'q1' as const,
    label: 'Telefonda Size Yardımcı Olan Personelimizin Hizmet Kalitesi',
  },
  {
    key: 'q2' as const,
    label: 'Acil Yardım Ekibinin Randevu Ve Ulaşma Süresi',
  },
  {
    key: 'q3' as const,
    label: 'Acil Yardım Ekibinin Davranışları',
  },
  {
    key: 'q4' as const,
    label: 'Acil Yardım Ekibinin Dış Görünümü',
  },
  {
    key: 'q5' as const,
    label: 'Acil Yardım Ekibinin İş Kalitesi',
  },
] as const;

export const SURVEY_STAR_QUESTION_LABELS = SURVEY_STAR_QUESTIONS.map((q) => q.label);

export function surveyStarQuestionsForChannel(channel: SurveyChannel) {
  return channel === 'acil' ? SURVEY_ACIL_STAR_QUESTIONS : SURVEY_STAR_QUESTIONS;
}

export function surveyStarQuestionsForCampaign(campaign: {
  emergencyCaseId?: string | null;
} | null | undefined) {
  return surveyStarQuestionsForChannel(campaign?.emergencyCaseId ? 'acil' : 'hasar');
}

export const SURVEY_STAR_SCALE = [
  { value: 1, label: 'Çok kötü' },
  { value: 2, label: 'Kötü' },
  { value: 3, label: 'Orta' },
  { value: 4, label: 'İyi' },
  { value: 5, label: 'Çok iyi' },
] as const;

export const SURVEY_STAR_SCALE_LINE = SURVEY_STAR_SCALE.map((s) => `${s.value} ${s.label}`).join(' · ');

export const SURVEY_Q6_LABEL = 'Genel Olarak Memnuniyet Derecesi';
export const SURVEY_Q7_LABEL = 'Teşekkür, Şikayet Ve Önerileriniz';

export const SURVEY_DISSATISFIED_COMMENT_MESSAGE =
  'Memnun Değilim Cevabında Açıklama Zorunludur';

export const SURVEY_OWNER_EXPLANATION_MESSAGE =
  'Olumsuz ankette dosya sorumlusu açıklaması zorunludur.';

export const SURVEY_MONTH_END_CUSTOMER_NOTICE =
  'Anket sonuçları ay sonunda müşteriye gönderilir. Olumsuz sonuçlar ayrıca raporlanır.';

export function surveyDissatisfiedCommentMissing(
  q6Recommend: boolean | null,
  q7Comment?: string | null,
): boolean {
  if (q6Recommend !== false) return false;
  return !String(q7Comment ?? '').trim();
}

export type SurveyScoreInput = {
  q1Rating?: number | null;
  q2Rating?: number | null;
  q3Rating?: number | null;
  q4Rating?: number | null;
  q5Rating?: number | null;
  q6Recommend?: boolean | null;
};

export function surveyResponseIsNegative(response: SurveyScoreInput | null | undefined): boolean {
  if (!response) return false;
  if (response.q6Recommend === false) return true;
  const ratings = [
    response.q1Rating,
    response.q2Rating,
    response.q3Rating,
    response.q4Rating,
    response.q5Rating,
  ].filter((n): n is number => typeof n === 'number' && n > 0);
  if (ratings.some((n) => n <= 2)) return true;
  if (ratings.length === 5) {
    const avg = ratings.reduce((a, b) => a + b, 0) / 5;
    if (avg < 3) return true;
  }
  return false;
}

export function surveyOwnerExplanationMissing(
  response: SurveyScoreInput | null | undefined,
  ownerExplanation?: string | null,
): boolean {
  if (!surveyResponseIsNegative(response)) return false;
  return !String(ownerExplanation ?? '').trim();
}

export function surveyLinkSent(campaign: {
  status?: string | null;
  whatsappSentAt?: string | null;
} | null | undefined): boolean {
  if (!campaign) return false;
  if (campaign.whatsappSentAt) return true;
  return campaign.status === 'sent' || campaign.status === 'completed';
}
