export type LegalNoteTemplate = { id: string; label: string; text: string };

export const LEGAL_NOTE_TEMPLATES: LegalNoteTemplate[] = [
  {
    id: 'price-validity',
    label: 'Kdv ve Fiyat Geçerlilik',
    text: 'Rapor kapsamındaki birim fiyatlar ve toplam tutarlar KDV hariç olup, teklif tarihinden itibaren 15 gün geçerlidir.',
  },
  {
    id: 'warranty',
    label: 'Garanti Süresi',
    text: 'Onarım işlemleri için garanti süresi, işin teslim tarihinden itibaren 2 yıl olarak uygulanır.',
  },
  {
    id: 'coverage-limit',
    label: 'Muafiyet ve Teminat',
    text: 'Tespit ve onarım tutarları poliçe teminat limitleri ve muafiyet hükümleri çerçevesinde değerlendirilmiştir.',
  },
  {
    id: 'preliminary',
    label: 'Ön Tespit Bildirimi',
    text: 'Bu rapor ön tespit niteliğindedir; nihai kapsam ve tutarlar onay sürecinde güncellenebilir.',
  },
];

export function buildSuggestedLegalNotesText(): string {
  return LEGAL_NOTE_TEMPLATES.map((tpl) => tpl.text).join('\n\n');
}
