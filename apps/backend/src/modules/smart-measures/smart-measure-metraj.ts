import type { SmartMeasureElementType } from './smart-measure-element-types';
import { SMART_MEASURE_ELEMENT_TYPE_LABELS } from './smart-measure-element-types';
import { areaMm2ToM2, computeAreaMm2, mmToM } from './smart-measure-metrics';

export type SmartMeasureMetrajLine = {
  label: string;
  quantityText: string;
  unit: string;
  note?: string;
};

type MeasureInput = {
  elementType: string;
  widthMm?: number | null;
  heightMm?: number | null;
  depthMm?: number | null;
  quantity?: number | null;
};

function fmtM2(n: number): string {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
}

function fmtM(n: number): string {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
}

/**
 * Eleman tipine göre operasyon metraj satırları.
 * Hesap yalnız mm üzerinden; UI birimi kullanılmaz.
 */
export function buildSmartMeasureMetraj(input: MeasureInput): SmartMeasureMetrajLine[] {
  const type = input.elementType as SmartMeasureElementType;
  const label = SMART_MEASURE_ELEMENT_TYPE_LABELS[type] ?? 'Yapı Elemanı';
  const qty = input.quantity != null && input.quantity > 0 ? input.quantity : 1;
  const areaMm2 = computeAreaMm2(input.widthMm, input.heightMm);
  const areaM2 = areaMm2 != null ? areaMm2ToM2(areaMm2) : null;
  const lines: SmartMeasureMetrajLine[] = [];

  switch (type) {
    case 'duvar':
    case 'tavan':
    case 'asma_tavan':
      if (areaM2 != null) {
        lines.push({
          label: `${label} · Boya / Kaplama`,
          quantityText: fmtM2(areaM2 * qty),
          unit: 'm²',
          note: 'Alan × adet',
        });
      }
      break;
    case 'seramik':
    case 'fayans':
      if (areaM2 != null) {
        lines.push({ label: `${label} Kaplama`, quantityText: fmtM2(areaM2 * qty), unit: 'm²' });
      }
      break;
    case 'parke':
      if (areaM2 != null) {
        lines.push({ label: 'Parke Alanı', quantityText: fmtM2(areaM2 * qty), unit: 'm²' });
      }
      break;
    case 'cam':
      if (areaM2 != null) {
        lines.push({ label: 'Cam Alanı', quantityText: fmtM2(areaM2 * qty), unit: 'm²' });
      }
      break;
    case 'kapi':
      lines.push({
        label: 'Kapı / Kasa Değişimi',
        quantityText: String(qty),
        unit: 'adet',
        note:
          areaM2 != null
            ? `Kanat alanı ≈ ${fmtM2(areaM2)} m²`
            : input.widthMm != null && input.heightMm != null
              ? `${input.widthMm} × ${input.heightMm} mm`
              : undefined,
      });
      break;
    case 'pencere':
    case 'pvc_dograma':
    case 'ahsap_dograma':
      lines.push({
        label: `${label} Değişimi`,
        quantityText: String(qty),
        unit: 'adet',
        note: areaM2 != null ? `Alan ≈ ${fmtM2(areaM2)} m²` : undefined,
      });
      if (areaM2 != null && (type === 'pencere' || type === 'pvc_dograma')) {
        lines.push({
          label: 'Cam / Kanat Alanı',
          quantityText: fmtM2(areaM2 * qty),
          unit: 'm²',
        });
      }
      break;
    case 'mutfak_dolabi':
    case 'banyo_dolabi':
    case 'tezgah':
      if (input.widthMm != null) {
        lines.push({
          label: `${label} Koşu`,
          quantityText: fmtM(mmToM(input.widthMm) * qty),
          unit: 'mt',
        });
      }
      if (areaM2 != null) {
        lines.push({
          label: `${label} Ön Yüz`,
          quantityText: fmtM2(areaM2 * qty),
          unit: 'm²',
        });
      }
      break;
    case 'lavabo':
    case 'klozet':
    case 'dusakabin':
    case 'klima':
    case 'radyator':
      lines.push({
        label: `${label} Değişimi / Montaj`,
        quantityText: String(qty),
        unit: 'adet',
      });
      break;
    case 'kolon':
    case 'kiris':
    case 'merdiven':
      if (areaM2 != null) {
        lines.push({ label: `${label} Yüzey`, quantityText: fmtM2(areaM2 * qty), unit: 'm²' });
      } else {
        lines.push({ label, quantityText: String(qty), unit: 'adet' });
      }
      break;
    default:
      if (areaM2 != null) {
        lines.push({ label: `${label} Alan`, quantityText: fmtM2(areaM2 * qty), unit: 'm²' });
      } else {
        lines.push({ label, quantityText: String(qty), unit: 'adet' });
      }
  }

  return lines;
}
