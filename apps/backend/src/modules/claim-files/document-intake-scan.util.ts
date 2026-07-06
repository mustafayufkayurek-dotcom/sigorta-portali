import { Logger } from '@nestjs/common';
import { IntakeDocumentScanResult, ParsedIntakeDocumentFields } from './document-intake-scan.types';

const logger = new Logger('DocumentIntakeScan');

const SYSTEM_PROMPT = `Sen Türkiye sigorta hasar sektöründe poliçe, ihbar formu ve hasar belgelerini okuyan bir asistansın.
Görselden şu alanları çıkar ve YALNIZCA geçerli JSON döndür:
{
  "insuredName": string | null,
  "insuredPhone": string | null,
  "policyType": "bireysel" | "ticari" | null,
  "commercialTitle": string | null,
  "taxOffice": string | null,
  "taxNumber": string | null,
  "incidentDate": "YYYY-MM-DD" | null,
  "addressDetail": string | null,
  "cityName": string | null,
  "districtName": string | null,
  "description": string | null,
  "insuranceCompanyName": string | null,
  "lossSubject": string | null
}

Kurallar:
- insuredPhone: yalnızca rakamlar (05XXXXXXXXX veya 5XXXXXXXXX)
- policyType: bireysel veya ticari; belirsizse null
- incidentDate: hasar/ihbar tarihi ISO formatında
- description: kısa hasar özeti (max 200 karakter)
- Okuyamazsan ilgili alanı null bırak
- Başka metin ekleme`;

const EMPTY: ParsedIntakeDocumentFields = {
  insuredName: null,
  insuredPhone: null,
  policyType: null,
  commercialTitle: null,
  taxOffice: null,
  taxNumber: null,
  incidentDate: null,
  addressDetail: null,
  cityName: null,
  districtName: null,
  description: null,
  insuranceCompanyName: null,
  lossSubject: null,
};

function parseJsonFromModel(text: string): ParsedIntakeDocumentFields {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { ...EMPTY };
    const raw = JSON.parse(match[0]) as Record<string, unknown>;

    const str = (key: string, max = 200) => {
      const v = raw[key];
      return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
    };

    let policyType: 'bireysel' | 'ticari' | null = null;
    const pt = str('policyType', 20)?.toLowerCase();
    if (pt === 'bireysel' || pt === 'ticari') policyType = pt;

    let insuredPhone: string | null = null;
    const phoneRaw = str('insuredPhone', 20);
    if (phoneRaw) {
      const digits = phoneRaw.replace(/\D/g, '');
      if (digits.length >= 10) insuredPhone = digits.slice(-11);
    }

    let incidentDate: string | null = null;
    const dateStr = str('incidentDate', 10);
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) incidentDate = dateStr;

    return {
      insuredName: str('insuredName', 120),
      insuredPhone,
      policyType,
      commercialTitle: str('commercialTitle', 120),
      taxOffice: str('taxOffice', 80),
      taxNumber: str('taxNumber', 20),
      incidentDate,
      addressDetail: str('addressDetail', 200),
      cityName: str('cityName', 60),
      districtName: str('districtName', 60),
      description: str('description', 200),
      insuranceCompanyName: str('insuranceCompanyName', 120),
      lossSubject: str('lossSubject', 120),
    };
  } catch {
    return { ...EMPTY };
  }
}

export async function extractIntakeDocumentFieldsFromImage(
  buffer: Buffer,
  mimeType: string,
  apiKey: string | undefined,
): Promise<IntakeDocumentScanResult> {
  if (!apiKey) {
    return {
      configured: false,
      ...EMPTY,
      message:
        'Otomatik okuma için OPENAI_API_KEY tanımlı değil. Belgeyi kaydedip alanları elle doldurabilirsiniz.',
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey, timeout: 60_000 });
    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 600,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Bu hasar/poliçe/ihbar belgesindeki sigortalı, adres, tarih ve sigorta şirketi bilgilerini çıkar.',
            },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content ?? '';
    const parsed = parseJsonFromModel(content);
    const hasData = Object.values(parsed).some((v) => v != null && v !== '');
    return {
      configured: true,
      ...parsed,
      message: hasData
        ? 'Belge okundu — alanları kontrol edip gönderin.'
        : 'Belge yüklendi ancak otomatik alan çıkarımı yapılamadı. Lütfen elle girin.',
    };
  } catch (err) {
    logger.error('Belge OCR hatası', err);
    return {
      configured: true,
      ...EMPTY,
      message: 'Belge yüklendi fakat otomatik okuma başarısız oldu. Alanları elle doldurun.',
    };
  }
}
