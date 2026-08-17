function compactFileNo(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/\s+/g, '');
}

function foldTR(value: string): string {
  return value.trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ');
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

export function inboundFileNoRecoveredWarning(fileNo: string): string {
  return `Maildeki Dosya No alanına sigorta şirketi adı yazılmış. Konu satırından dosya numarası alındı: ${fileNo}. Lütfen kontrol edin.`;
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
  const bodyRejected = Boolean(body && isInsuranceBrandFileNo(body, insurer || body));

  if (body && !bodyRejected) {
    return { fileNo: body, warning: null, bodyRejected: false };
  }

  if (!bodyRejected) {
    return { fileNo: body || null, warning: null, bodyRejected: false };
  }

  const haystack = [input.subject, input.extraText].filter(Boolean).join(' ');
  const candidates = extractDigitFileNoCandidates(haystack, input.policyNo);
  if (candidates[0]) {
    return {
      fileNo: candidates[0],
      warning: inboundFileNoRecoveredWarning(candidates[0]),
      bodyRejected: true,
    };
  }
  return { fileNo: null, warning: INBOUND_FILE_NO_BRAND_WARNING, bodyRejected: true };
}
