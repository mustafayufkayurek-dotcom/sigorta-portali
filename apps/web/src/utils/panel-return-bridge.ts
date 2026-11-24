/**
 * Açık formdan başka panele gidip dönünce yazılanlar düşmesin.
 * Yeni Dosya → Müşteri kartı ile aynı yöntem: taslak + returnTo.
 */

export type PanelReturnBridge = {
  returnTo: string;
  returnLabel: string;
};

export function isSafePanelReturnTo(url: string): boolean {
  const value = String(url ?? '').trim();
  return value.startsWith('/panel/');
}

export function parsePanelReturnBridge(params: URLSearchParams): PanelReturnBridge | null {
  const returnTo = params.get('returnTo')?.trim() ?? '';
  const returnLabel = params.get('returnLabel')?.trim() ?? '';
  if (!returnTo || !returnLabel || !isSafePanelReturnTo(returnTo)) return null;
  return { returnTo, returnLabel };
}

/** Tedarikçi ekleme — açık masraf / dosya formuna dönüş. */
export function buildTedarikciAddFromHref(input: {
  returnTo: string;
  returnLabel: string;
  /** Ofis / sabit hizmet varsayılanı */
  scope?: 'ofis' | 'operasyon';
}): string {
  if (!isSafePanelReturnTo(input.returnTo)) {
    throw new Error('returnTo yalnız /panel yolu olabilir');
  }
  const params = new URLSearchParams({
    openAdd: '1',
    returnTo: input.returnTo,
    returnLabel: input.returnLabel,
  });
  if (input.scope === 'ofis' || input.scope === 'operasyon') {
    params.set('scope', input.scope);
  }
  return `/panel/tedarikciler?${params.toString()}`;
}

/** Kayıt bitince dönüş adresine yeni tedarikçi kimliğini ekler. */
export function appendSelectVendorToReturn(returnTo: string, vendorId: string): string {
  if (!isSafePanelReturnTo(returnTo) || !vendorId.trim()) return returnTo;
  const url = new URL(returnTo, 'http://yerel.panel');
  url.searchParams.set('yeni', '1');
  url.searchParams.set('selectVendorId', vendorId.trim());
  return `${url.pathname}${url.search}${url.hash}`;
}

export function readSelectVendorId(params: URLSearchParams): string | null {
  const id = params.get('selectVendorId')?.trim() ?? '';
  return id || null;
}
