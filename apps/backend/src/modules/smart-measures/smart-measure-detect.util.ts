import { Logger } from '@nestjs/common';
import {
  SMART_MEASURE_ELEMENT_TYPES,
  SMART_MEASURE_ELEMENT_TYPE_LABELS,
  type SmartMeasureElementType,
} from './smart-measure-element-types';

const logger = new Logger('SmartMeasureDetect');

export type SmartMeasureDetectResult = {
  configured: boolean;
  elementType: SmartMeasureElementType;
  title: string;
  aiConfidence: number | null;
  /** Normalize edilmiş sınır kutusu (0–1); overlay için */
  bounds: { x: number; y: number; w: number; h: number } | null;
  lowConfidence: boolean;
  message: string;
};

const TYPE_JSON = SMART_MEASURE_ELEMENT_TYPES.map((t) => `"${t}"`).join(' | ');

const SYSTEM_PROMPT = `Sen Meridyen hasar saha fotoğraflarında yapı elemanı tanıyan bir asistansın.
Görselden YALNIZCA geçerli JSON döndür:
{
  "elementType": ${TYPE_JSON},
  "title": string,
  "aiConfidence": number,
  "bounds": { "x": number, "y": number, "w": number, "h": number } | null
}

Kurallar:
- elementType: görünen ana yapı elemanı (kapı, pencere, dolap, duvar, seramik…)
- title: kısa Türkçe ad (max 80), örn. "Giriş Kapısı"
- aiConfidence: 0–1 arası güven
- bounds: nesnenin görüntüdeki yaklaşık dikdörtgen sınırı; x,y sol-üst; w,h genişlik/yükseklik; tüm değerler 0–1 normalize
- Emin değilsen elementType="diger", aiConfidence düşük, bounds null olabilir
- Başka metin ekleme`;

function normalizeType(raw: unknown): SmartMeasureElementType {
  if (typeof raw === 'string' && (SMART_MEASURE_ELEMENT_TYPES as readonly string[]).includes(raw)) {
    return raw as SmartMeasureElementType;
  }
  return 'diger';
}

function parseBounds(raw: unknown): SmartMeasureDetectResult['bounds'] {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const nums = [b.x, b.y, b.w, b.h].map((v) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null,
  );
  if (nums.some((n) => n == null)) return null;
  const [x, y, w, h] = nums as number[];
  if (w <= 0.02 || h <= 0.02) return null;
  return { x, y, w, h };
}

function parseDetectJson(text: string): Omit<SmartMeasureDetectResult, 'configured' | 'message' | 'lowConfidence'> {
  const fallback = {
    elementType: 'diger' as SmartMeasureElementType,
    title: 'Yapı Elemanı',
    aiConfidence: null as number | null,
    bounds: null as SmartMeasureDetectResult['bounds'],
  };
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const raw = JSON.parse(match[0]) as Record<string, unknown>;
    const elementType = normalizeType(raw.elementType);
    const title =
      typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim().slice(0, 80)
        : SMART_MEASURE_ELEMENT_TYPE_LABELS[elementType];
    let aiConfidence: number | null = null;
    if (typeof raw.aiConfidence === 'number' && Number.isFinite(raw.aiConfidence)) {
      aiConfidence = Math.min(1, Math.max(0, raw.aiConfidence));
    }
    return {
      elementType,
      title,
      aiConfidence,
      bounds: parseBounds(raw.bounds),
    };
  } catch {
    return fallback;
  }
}

const LOW_CONFIDENCE_THRESHOLD = 0.7;

export async function detectSmartMeasureElementFromImage(
  buffer: Buffer,
  mimeType: string,
  apiKey: string | undefined,
): Promise<SmartMeasureDetectResult> {
  if (!apiKey) {
    return {
      configured: false,
      elementType: 'diger',
      title: 'Yapı Elemanı',
      aiConfidence: null,
      bounds: null,
      lowConfidence: true,
      message: 'Nesne önerisi şu an kullanılamıyor — tipi elle seçebilirsiniz.',
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey, timeout: 60_000 });
    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Bu fotoğraftaki ana yapı elemanını tanı; tip, başlık, güven ve sınır kutusu ver.',
            },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content ?? '';
    const parsed = parseDetectJson(content);
    const lowConfidence =
      parsed.aiConfidence == null || parsed.aiConfidence < LOW_CONFIDENCE_THRESHOLD;

    return {
      configured: true,
      ...parsed,
      lowConfidence,
      message: lowConfidence
        ? 'Güven düşük — nesne tipini kontrol edip düzeltin.'
        : `Öneri: ${SMART_MEASURE_ELEMENT_TYPE_LABELS[parsed.elementType]}`,
    };
  } catch (err) {
    logger.error('Akıllı ölçüm nesne tanıma hatası', err);
    return {
      configured: false,
      elementType: 'diger',
      title: 'Yapı Elemanı',
      aiConfidence: null,
      bounds: null,
      lowConfidence: true,
      message: 'Nesne önerisi alınamadı — tipi elle seçebilirsiniz.',
    };
  }
}
