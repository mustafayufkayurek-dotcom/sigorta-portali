/** Masraf / hareket sonrası Verimlilik Analizi (kâr-zarar) hatırlatması. */

export const FINANS_VERIMLILIK_ANALIZ_UYARI_KEY = 'finans-verimlilik-analiz-uyari-v1';

export const FINANS_VERIMLILIK_ANALIZ_UYARI_METNI =
  'Konu dosya veya müşteri Verimlilik Analizi güncellenmiş olup, lütfen inceleyiniz.';

export type FinansVerimlilikAnalizUyari = {
  kind: 'dosya' | 'musteri';
  label: string;
  at: string;
};

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function pushFinansVerimlilikAnalizUyari(input: {
  kind: 'dosya' | 'musteri';
  label: string;
}): void {
  if (!canUseStorage()) return;
  const label = String(input.label ?? '').trim().slice(0, 120);
  if (!label) return;
  const payload: FinansVerimlilikAnalizUyari = {
    kind: input.kind,
    label,
    at: new Date().toISOString(),
  };
  try {
    window.sessionStorage.setItem(FINANS_VERIMLILIK_ANALIZ_UYARI_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

export function readFinansVerimlilikAnalizUyari(): FinansVerimlilikAnalizUyari | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(FINANS_VERIMLILIK_ANALIZ_UYARI_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FinansVerimlilikAnalizUyari>;
    if (parsed.kind !== 'dosya' && parsed.kind !== 'musteri') return null;
    const label = String(parsed.label ?? '').trim();
    if (!label) return null;
    return {
      kind: parsed.kind,
      label,
      at: typeof parsed.at === 'string' ? parsed.at : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function clearFinansVerimlilikAnalizUyari(): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.removeItem(FINANS_VERIMLILIK_ANALIZ_UYARI_KEY);
  } catch {
    /* ignore */
  }
}

export function formatFinansVerimlilikAnalizUyari(
  uyari: FinansVerimlilikAnalizUyari | null | undefined,
): string | null {
  if (!uyari?.label) return null;
  return `${uyari.label} · ${FINANS_VERIMLILIK_ANALIZ_UYARI_METNI}`;
}
