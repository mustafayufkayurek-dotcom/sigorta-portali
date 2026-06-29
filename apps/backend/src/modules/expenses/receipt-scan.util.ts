import { Logger } from '@nestjs/common';
import { ParsedReceiptFields } from './receipt-scan.types';

const logger = new Logger('ReceiptScan');

const SYSTEM_PROMPT = `Sen Türkiye'deki fiş, fatura ve masraf belgelerini okuyan bir asistansın.
Görselden şu alanları çıkar ve YALNIZCA geçerli JSON döndür:
{
  "amount": number | null,
  "date": "YYYY-MM-DD" | null,
  "description": string | null,
  "merchant": string | null
}

Kurallar:
- amount: toplam ödeme tutarı (KDV dahil genel toplam). Türk formatında 1.234,56 → 1234.56
- date: belgedeki işlem/fatura tarihi ISO formatında
- description: kısa masraf açıklaması (ürün/hizmet özeti, max 120 karakter)
- merchant: satıcı/işletme adı
- Okuyamazsan ilgili alanı null bırak
- Başka metin ekleme`;

function parseJsonFromModel(text: string): ParsedReceiptFields {
  const fallback: ParsedReceiptFields = {
    amount: null,
    date: null,
    description: null,
    merchant: null,
  };
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const raw = JSON.parse(match[0]) as Record<string, unknown>;

    let amount: number | null = null;
    if (typeof raw.amount === 'number' && Number.isFinite(raw.amount)) {
      amount = raw.amount;
    } else if (typeof raw.amount === 'string') {
      const normalized = raw.amount.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
      const n = parseFloat(normalized);
      if (Number.isFinite(n) && n > 0) amount = n;
    }

    let date: string | null = null;
    if (typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
      date = raw.date;
    }

    const description =
      typeof raw.description === 'string' && raw.description.trim()
        ? raw.description.trim().slice(0, 120)
        : null;
    const merchant =
      typeof raw.merchant === 'string' && raw.merchant.trim()
        ? raw.merchant.trim().slice(0, 80)
        : null;

    return { amount, date, description, merchant };
  } catch {
    return fallback;
  }
}

export async function extractReceiptFieldsFromImage(
  buffer: Buffer,
  mimeType: string,
  apiKey: string | undefined,
): Promise<ParsedReceiptFields & { configured: boolean; message?: string }> {
  if (!apiKey) {
    return {
      configured: false,
      amount: null,
      date: null,
      description: null,
      merchant: null,
      message: 'Otomatik okuma için sistem yöneticisinin OPENAI_API_KEY tanımlaması gerekiyor. Fiş görseli kaydedildi; alanları elle doldurabilirsiniz.',
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey, timeout: 45_000 });
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Bu fiş/fatura görselindeki tutar, tarih, açıklama ve satıcı bilgisini çıkar.' },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content ?? '';
    const parsed = parseJsonFromModel(content);
    return {
      configured: true,
      ...parsed,
      message: parsed.amount || parsed.date || parsed.description
        ? 'Belge okundu — alanları kontrol edip kaydedin.'
        : 'Belge kaydedildi ancak otomatik alan çıkarımı yapılamadı. Lütfen elle girin.',
    };
  } catch (err) {
    logger.error('Fiş OCR hatası', err);
    return {
      configured: true,
      amount: null,
      date: null,
      description: null,
      merchant: null,
      message: 'Belge kaydedildi fakat otomatik okuma başarısız oldu. Alanları elle doldurun.',
    };
  }
}
