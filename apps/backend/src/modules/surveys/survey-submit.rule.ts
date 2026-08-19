/** Memnun Değilim (q6Recommend === false) yanıtında serbest metin zorunlu. */

export const SURVEY_DISSATISFIED_COMMENT_MESSAGE =
  'Memnun Değilim Cevabında Açıklama Zorunludur';

export function surveyDissatisfiedCommentMissing(
  q6Recommend: boolean,
  q7Comment?: string | null,
): boolean {
  if (q6Recommend !== false) return false;
  return !String(q7Comment ?? '').trim();
}
