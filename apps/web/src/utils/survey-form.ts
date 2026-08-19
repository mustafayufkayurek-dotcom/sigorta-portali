/** Kamu anket formu ve panel sonuç ekranı aynı soru metinlerini kullanır. */

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

export const SURVEY_STAR_QUESTION_LABELS = SURVEY_STAR_QUESTIONS.map((q) => q.label);

export const SURVEY_Q6_LABEL = 'Genel Olarak Memnuniyet Derecesi';
export const SURVEY_Q7_LABEL = 'Teşekkür, Şikayet Ve Önerileriniz';

export const SURVEY_DISSATISFIED_COMMENT_MESSAGE =
  'Memnun Değilim Cevabında Açıklama Zorunludur';

export function surveyDissatisfiedCommentMissing(
  q6Recommend: boolean | null,
  q7Comment?: string | null,
): boolean {
  if (q6Recommend !== false) return false;
  return !String(q7Comment ?? '').trim();
}

export function surveyLinkSent(campaign: {
  status?: string | null;
  whatsappSentAt?: string | null;
} | null | undefined): boolean {
  if (!campaign) return false;
  if (campaign.whatsappSentAt) return true;
  return campaign.status === 'sent' || campaign.status === 'completed';
}
