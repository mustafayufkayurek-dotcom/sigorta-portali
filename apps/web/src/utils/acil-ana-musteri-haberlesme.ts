/**
 * Ana müşteri (asistans / şirket) haberleşme tercihi — dosyaya göre değil, müşteriye göre.
 * Sigortalı her zaman WhatsApp. Genel uygulama zorunluluğu yoktur.
 */

export type AnaMusteriHaberlesme = 'whatsapp' | 'email' | 'both';

const PREFIX = 'acil-ana-musteri-haberlesme:';

export function parseAnaMusteriHaberlesme(raw: unknown): AnaMusteriHaberlesme {
  if (raw === 'whatsapp' || raw === 'email' || raw === 'both') return raw;
  return 'both';
}

export function readAnaMusteriHaberlesme(customerId: string | null | undefined): AnaMusteriHaberlesme {
  if (typeof window === 'undefined' || !customerId) return 'both';
  try {
    return parseAnaMusteriHaberlesme(window.localStorage.getItem(`${PREFIX}${customerId}`));
  } catch {
    return 'both';
  }
}

export function writeAnaMusteriHaberlesme(
  customerId: string | null | undefined,
  value: AnaMusteriHaberlesme,
): void {
  if (typeof window === 'undefined' || !customerId) return;
  try {
    window.localStorage.setItem(`${PREFIX}${customerId}`, value);
  } catch {
    /* ignore */
  }
}

export function anaMusteriAllowsWhatsApp(ch: AnaMusteriHaberlesme): boolean {
  return ch === 'whatsapp' || ch === 'both';
}

export function anaMusteriAllowsEmail(ch: AnaMusteriHaberlesme): boolean {
  return ch === 'email' || ch === 'both';
}

export function anaMusteriHaberlesmeLabel(ch: AnaMusteriHaberlesme): string {
  if (ch === 'whatsapp') return 'WhatsApp';
  if (ch === 'email') return 'E-posta';
  return 'WhatsApp ve e-posta';
}

export function anaMusteriClosureLabel(ch: AnaMusteriHaberlesme): string {
  if (ch === 'whatsapp') return 'Müşteri WhatsApp';
  if (ch === 'email') return 'Kapanış e-postası';
  return 'Müşteri haberi (WhatsApp veya e-posta)';
}
