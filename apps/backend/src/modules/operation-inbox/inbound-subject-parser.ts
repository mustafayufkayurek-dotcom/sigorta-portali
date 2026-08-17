const REPLY_PREFIX_PATTERN = /^(?:(?:Ynt|Re|Fwd|İlt|Yanıt):\s*)+/i;
const RCS_CLAIM_PATTERN = /\bRCS-(\d+)\b/i;
const INSURANCE_LEADING_NUMBER = /^(\d{9,10})\b/;

export interface SubjectHints {
  claimNo?: string;
  policyNo?: string;
  isReply: boolean;
}

/** Konu satırından yanıt öneklerini (Ynt:, Re:, Fwd: vb.) temizler. */
export function stripReplyPrefixes(subject: string): string {
  return subject.replace(REPLY_PREFIX_PATTERN, '').trim();
}

/** RCS-20261795219 gibi desenlerden hasar numarasını çıkarır. */
export function extractRcsClaimNo(text: string): string | undefined {
  const match = text.match(RCS_CLAIM_PATTERN);
  return match?.[1];
}

/**
 * Sigorta formatı: baştaki 9–10 haneli sayı (ör. 446922469/BELGIN KIZILIRMAK/…).
 * claimNo ve policyNo olarak aynı değer döner; eşleştirmede claimNo önce denenir.
 */
export function extractInsuranceLeadingNumber(text: string): {
  claimNo?: string;
  policyNo?: string;
} {
  const cleaned = stripReplyPrefixes(text);
  const direct = cleaned.match(INSURANCE_LEADING_NUMBER);
  if (direct?.[1]) {
    return { claimNo: direct[1], policyNo: direct[1] };
  }

  const firstSegment = cleaned.split('/')[0]?.trim();
  if (firstSegment && /^\d{9,10}$/.test(firstSegment)) {
    return { claimNo: firstSegment, policyNo: firstSegment };
  }

  return {};
}

/** Konu satırından eşleştirme ipuçlarını toplar. */
export function extractSubjectHints(subject: string): SubjectHints {
  const trimmed = subject.trim();
  const isReply = REPLY_PREFIX_PATTERN.test(trimmed);
  const stripped = stripReplyPrefixes(trimmed);
  const hints: SubjectHints = { isReply };

  const rcs = extractRcsClaimNo(stripped);
  if (rcs) {
    hints.claimNo = rcs;
    return hints;
  }

  const insurance = extractInsuranceLeadingNumber(stripped);
  if (insurance.claimNo) hints.claimNo = insurance.claimNo;
  if (insurance.policyNo) hints.policyNo = insurance.policyNo;

  return hints;
}
