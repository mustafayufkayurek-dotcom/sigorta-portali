function compactFileNo(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/\s+/g, '');
}

function foldTR(value: string): string {
  return value.trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ');
}

const RCS_FILE_NO = /\bRCS-(\d{6,})\b/i;

/** Remed dosya no: RCS-20261854032. Konu veya gövdeden alır. */
export function extractRcsFileNo(text?: string | null): string | null {
  if (!text?.trim()) return null;
  const match = text.match(RCS_FILE_NO);
  return match?.[1] ? `RCS-${match[1]}` : null;
}

export function isBareDigitFileNo(value: string): boolean {
  return /^\d{6,12}$/.test(value.trim());
}

/** "EUREKO" / "Eureko Sigorta" aynı markadır; rakamsız metin dosya no değildir. */
export function isInsuranceBrandFileNo(value: string, insuranceName?: string | null): boolean {
  const text = value.trim();
  if (!text) return false;
  if (!/\d/.test(text)) return true;
  const company = foldTR(insuranceName ?? '');
  if (!company) return false;
  const file = foldTR(text);
  if (file === company) return true;
  const first = company.split(' ')[0] ?? '';
  return first.length >= 4 && file === first;
}

export const INBOUND_FILE_NO_BRAND_WARNING =
  'Maildeki Dosya No alanına sigorta şirketi adı yazılmış. Gerçek dosya numarasını girin.';

export const INBOUND_FILE_NO_POLICY_WARNING =
  'Maildeki Dosya No alanına poliçe numarası yazılmış. Gerçek dosya numarasını girin.';

export function inboundFileNoRecoveredWarning(fileNo: string): string {
  return `Maildeki Dosya No alanına sigorta şirketi adı yazılmış. Konu satırından dosya numarası alındı: ${fileNo}. Lütfen kontrol edin.`;
}

export function inboundFileNoPolicyRecoveredWarning(fileNo: string): string {
  return `Maildeki Dosya No alanına poliçe numarası yazılmış. Konu satırından dosya numarası alındı: ${fileNo}. Lütfen kontrol edin.`;
}

export function isSameInboundNumber(a?: string | null, b?: string | null): boolean {
  const left = compactFileNo(a);
  const right = compactFileNo(b);
  return Boolean(left && right && left === right);
}

const DIGIT_FILE_NO = /\b\d{6,12}\b/g;

export function extractDigitFileNoCandidates(text: string, exclude?: string | null): string[] {
  const skip = compactFileNo(exclude ?? '');
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of text.matchAll(DIGIT_FILE_NO)) {
    const n = match[0];
    if (skip && compactFileNo(n) === skip) continue;
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

export interface InboundFileNoResolution {
  fileNo: string | null;
  warning: string | null;
  bodyRejected: boolean;
}

/**
 * Eksper ofisi mailinde «Dosya No: EUREKO» yazılırsa konu satırındaki gerçek numarayı alır.
 * Sigorta markasını dosya no olarak yazmaz.
 */
export function resolveInboundFileNo(input: {
  bodyFileNo?: string | null;
  insurer?: string | null;
  subject?: string | null;
  policyNo?: string | null;
  extraText?: string | null;
}): InboundFileNoResolution {
  const body = input.bodyFileNo?.trim() || '';
  const insurer = input.insurer?.trim() || '';
  const haystack = [input.subject, input.extraText, body].filter(Boolean).join(' ');
  const rcs = extractRcsFileNo(haystack);
  const brandRejected = Boolean(body && isInsuranceBrandFileNo(body, insurer || body));
  const policyRejected =
    isSameInboundNumber(body, input.policyNo)
    || extractDigitFileNoCandidates(body).some((n) => isSameInboundNumber(n, input.policyNo));
  const rcsOverridesBareDigit = Boolean(
    rcs && body && isBareDigitFileNo(body) && !isSameInboundNumber(body, rcs),
  );
  const bodyRejected = brandRejected || policyRejected || rcsOverridesBareDigit;

  if (body && !bodyRejected) {
    return { fileNo: body, warning: null, bodyRejected: false };
  }

  if (rcs && (bodyRejected || !body)) {
    const warning = !body
      ? null
      : policyRejected || rcsOverridesBareDigit
        ? inboundFileNoPolicyRecoveredWarning(rcs)
        : inboundFileNoRecoveredWarning(rcs);
    return { fileNo: rcs, warning, bodyRejected: Boolean(body) && bodyRejected };
  }

  if (!bodyRejected) {
    return { fileNo: body || null, warning: null, bodyRejected: false };
  }

  const candidateHaystack = [input.subject, input.extraText].filter(Boolean).join(' ');
  const candidates = extractDigitFileNoCandidates(candidateHaystack, input.policyNo);
  if (candidates[0]) {
    return {
      fileNo: candidates[0],
      warning: policyRejected
        ? inboundFileNoPolicyRecoveredWarning(candidates[0])
        : inboundFileNoRecoveredWarning(candidates[0]),
      bodyRejected: true,
    };
  }
  return {
    fileNo: null,
    warning: policyRejected || rcsOverridesBareDigit
      ? INBOUND_FILE_NO_POLICY_WARNING
      : INBOUND_FILE_NO_BRAND_WARNING,
    bodyRejected: true,
  };
}
