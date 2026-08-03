/** FSB_PHASE_1_2_LOCK — docs/project-governance/canli-kabul/FIELD_SURVEY_BRIEFS_PHASE_1_2_KILIT.md */
import { Logger } from '@nestjs/common';
import {
  FIELD_SURVEY_ITEM_TYPES,
  type FieldSurveyItemType,
} from './field-survey-item-types';
import {
  FieldSurveyDimensionModule,
  FieldSurveyMaterial,
  ParsedFieldSurveyFields,
} from './field-survey-scan.types';

const logger = new Logger('FieldSurveyScan');

const ITEM_TYPE_JSON = FIELD_SURVEY_ITEM_TYPES.map((t) => `"${t}"`).join(' | ');

const SYSTEM_PROMPT = `Sen Türkiye'deki hasar/onarım saha keşif fotoğraflarını analiz eden bir asistansın.
Marangoz, boya, seramik/fayans, parke, alçı, mutfak/banyo dolabı, kapı vb. işler için tahmini ölçü ve malzeme çıkar.
Görselden YALNIZCA geçerli JSON döndür:
{
  "itemType": ${ITEM_TYPE_JSON},
  "title": string,
  "summaryText": string,
  "dimensions": [
    { "label": string, "genislikCm": number | null, "yukseklikCm": number | null, "derinlikCm": number | null }
  ],
  "materials": [
    { "name": string, "quantity": string | null, "note": string | null }
  ],
  "aiConfidence": number | null
}

Kurallar:
- Tüm ölçüler tahminidir; cm cinsinden (boya/seramik duvarlarında genişlik×yükseklik; parke odasında zemin alanı)
- summaryText: tedarikçiye/ustaya yönelik kısa Türkçe keşif özeti (max 400 karakter); malzeme ve iş kapsamı belirt
- title: kısa parça/alan adı (max 80 karakter)
- dimensions: en az 1 satır; L form dolap, oda duvarları, seramik alanları ayrı satır olabilir
- materials: boya rengi/kat, seramik ebat, mermerit, ayna, süpürgelik vb.
- Dolap/kapak malzemelerinde cam ve ahşap (veya lake) kapakları AYRI say; görünen her kapak tipini doğru malzeme adıyla yaz (ör. 1 cam + 1 ahşap kapak → Cam x 1 adet, Ahşap x 1 adet)
- Görselde cam olmayan solid/lake kapakları Cam olarak sayma; yalnızca gerçekten cam/glass görünen kapakları Cam olarak yaz
- aiConfidence: 0-1 arası güven skoru
- Okuyamazsan boş diziler ve null ölçüler kullan
- Başka metin ekleme`;

function normalizeItemType(raw: unknown): FieldSurveyItemType {
  if (typeof raw === 'string' && FIELD_SURVEY_ITEM_TYPES.includes(raw as FieldSurveyItemType)) {
    return raw as FieldSurveyItemType;
  }
  return 'diger';
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function parseDimensions(raw: unknown): FieldSurveyDimensionModule[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const label = typeof row.label === 'string' && row.label.trim() ? row.label.trim().slice(0, 60) : 'Alan';
      return {
        label,
        genislikCm: parseNumber(row.genislikCm),
        yukseklikCm: parseNumber(row.yukseklikCm),
        derinlikCm: parseNumber(row.derinlikCm),
      };
    })
    .filter((x): x is FieldSurveyDimensionModule => x !== null)
    .slice(0, 12);
}

function parseMaterials(raw: unknown): FieldSurveyMaterial[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const name = typeof row.name === 'string' && row.name.trim() ? row.name.trim().slice(0, 80) : null;
      if (!name) return null;
      const quantity =
        typeof row.quantity === 'string' && row.quantity.trim() ? row.quantity.trim().slice(0, 40) : null;
      const note =
        typeof row.note === 'string' && row.note.trim() ? row.note.trim().slice(0, 120) : null;
      return { name, quantity, note };
    })
    .filter((x): x is FieldSurveyMaterial => x !== null)
    .slice(0, 20);
}

function parseJsonFromModel(text: string): ParsedFieldSurveyFields {
  const fallback: ParsedFieldSurveyFields = {
    itemType: 'diger',
    title: 'Keşif Ölçüsü',
    summaryText: '',
    dimensions: [{ label: 'Alan 1', genislikCm: null, yukseklikCm: null, derinlikCm: null }],
    materials: [],
    aiConfidence: null,
  };
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const raw = JSON.parse(match[0]) as Record<string, unknown>;
    const dimensions = parseDimensions(raw.dimensions);
    const title =
      typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 80) : fallback.title;
    const summaryText =
      typeof raw.summaryText === 'string' && raw.summaryText.trim()
        ? raw.summaryText.trim().slice(0, 400)
        : '';
    let aiConfidence: number | null = null;
    if (typeof raw.aiConfidence === 'number' && Number.isFinite(raw.aiConfidence)) {
      aiConfidence = Math.min(1, Math.max(0, raw.aiConfidence));
    }
    return {
      itemType: normalizeItemType(raw.itemType),
      title,
      summaryText,
      dimensions: dimensions.length > 0 ? dimensions : fallback.dimensions,
      materials: parseMaterials(raw.materials),
      aiConfidence,
    };
  } catch {
    return fallback;
  }
}

export async function extractFieldSurveyFieldsFromImage(
  buffer: Buffer,
  mimeType: string,
  apiKey: string | undefined,
): Promise<ParsedFieldSurveyFields & { configured: boolean; message?: string }> {
  if (!apiKey) {
    return {
      configured: false,
      itemType: 'diger',
      title: 'Keşif Ölçüsü',
      summaryText: '',
      dimensions: [{ label: 'Alan 1', genislikCm: null, yukseklikCm: null, derinlikCm: null }],
      materials: [],
      aiConfidence: null,
      message:
        'Fotoğraf kaydedildi — ölçüleri kontrol edin. (Otomatik özet önerisi şu an kullanılamıyor.)',
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey, timeout: 60_000 });
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 900,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Bu saha keşif fotoğrafından (marangoz, boya, seramik, parke vb.) tahmini ölçü alanları, malzeme listesi ve tedarikçi özeti çıkar.',
            },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content ?? '';
    const parsed = parseJsonFromModel(content);
    const hasData =
      parsed.summaryText ||
      parsed.dimensions.some((d) => d.genislikCm || d.yukseklikCm || d.derinlikCm) ||
      parsed.materials.length > 0;

    return {
      configured: true,
      ...parsed,
      message: hasData
        ? 'Fotoğraf kaydedildi — ölçü ve özeti kontrol edip kaydedin.'
        : 'Fotoğraf kaydedildi — ölçüleri kontrol edin.',
    };
  } catch (err) {
    logger.error('Keşif ölçüsü vision hatası', err);
    return {
      configured: false,
      itemType: 'diger',
      title: 'Keşif Ölçüsü',
      summaryText: '',
      dimensions: [{ label: 'Alan 1', genislikCm: null, yukseklikCm: null, derinlikCm: null }],
      materials: [],
      aiConfidence: null,
      message: 'Fotoğraf kaydedildi — ölçüleri kontrol edin.',
    };
  }
}
