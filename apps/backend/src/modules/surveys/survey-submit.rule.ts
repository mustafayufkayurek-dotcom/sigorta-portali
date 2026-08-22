/** Memnun Değilim (q6Recommend === false) yanıtında serbest metin zorunlu. */

export const SURVEY_DISSATISFIED_COMMENT_MESSAGE =
  'Memnun Değilim Cevabında Açıklama Zorunludur';

export const SURVEY_OWNER_EXPLANATION_MESSAGE =
  'Olumsuz ankette dosya sorumlusu açıklaması zorunludur.';

export function surveyDissatisfiedCommentMissing(
  q6Recommend: boolean,
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
