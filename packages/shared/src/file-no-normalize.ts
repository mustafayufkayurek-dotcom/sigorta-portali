/**
 * Dosya numarası karşılaştırması: boşluklar yok sayılır, büyük/küçük harf duyarsız.
 * Örn. "2026 YB 13237" ≡ "2026YB13237" ≡ "2026yb13237"
 */
export function compactFileNo(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/\s+/g, '');
}

export function fileNosMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = compactFileNo(a);
  const right = compactFileNo(b);
  return Boolean(left && right && left === right);
}
