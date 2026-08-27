import { Logger } from '@nestjs/common';

const logger = new Logger('AuthorizedPersonAi');

const AI_DIRTY_CONFIDENCE = 0.7;

export type AuthorizedPersonAiName = {
  firstName: string;
  lastName: string;
  combined: string;
};

export type AuthorizedPersonAiResult = {
  configured: boolean;
  dirtyIndexes: number[];
};

const SYSTEM_PROMPT = `Sen müşteri kartındaki yetkili adı denetlersin.
Görevin: verilen ad-soyad bir insan adı mı, yoksa şirket unvanı / unvan parçası mı.
Yalnızca JSON döndür:
{"verdicts":[{"dirty":boolean,"confidence":number}]}
Kurallar:
- dirty=true: firma adı, unvan parçası, departman, marka; kişi adı değil
- dirty=false: gerçek kişi adı
- confidence 0-1
- Düzeltilmiş ad, önerilen isim veya başka metin YAZMA
- verdicts uzunluğu names uzunluğu ile aynı olsun`;

export function parseAuthorizedPersonAiJson(
  text: string,
  nameCount: number,
): { dirtyIndexes: number[] } {
  const dirtyIndexes: number[] = [];
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { dirtyIndexes };
    const raw = JSON.parse(match[0]) as { verdicts?: unknown };
    if (!Array.isArray(raw.verdicts) || raw.verdicts.length !== nameCount) {
      return { dirtyIndexes };
    }
    raw.verdicts.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      const row = item as { dirty?: unknown; isPersonName?: unknown; confidence?: unknown };
      const dirty =
        row.dirty === true || row.isPersonName === false;
      const confidence =
        typeof row.confidence === 'number' && Number.isFinite(row.confidence)
          ? row.confidence
          : 0;
      if (dirty && confidence >= AI_DIRTY_CONFIDENCE) dirtyIndexes.push(index);
    });
  } catch {
    return { dirtyIndexes: [] };
  }
  return { dirtyIndexes };
}

export async function classifyAuthorizedPersonNamesWithAi(input: {
  companyName: string;
  shortName: string;
  names: AuthorizedPersonAiName[];
  apiKey: string | undefined;
}): Promise<AuthorizedPersonAiResult> {
  if (!input.names.length) {
    return { configured: Boolean(input.apiKey), dirtyIndexes: [] };
  }
  if (!input.apiKey) {
    return { configured: false, dirtyIndexes: [] };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: input.apiKey, timeout: 20_000 });
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 220,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            companyName: input.companyName,
            shortName: input.shortName,
            names: input.names.map((n) => ({
              firstName: n.firstName,
              lastName: n.lastName,
            })),
          }),
        },
      ],
    });
    const content = response.choices?.[0]?.message?.content ?? '';
    if (/suggestedName|replacement|corrected/i.test(content)) {
      logger.warn('Yetkili adı denetimi isim önerisi üretti; yok sayıldı');
    }
    return {
      configured: true,
      dirtyIndexes: parseAuthorizedPersonAiJson(content, input.names.length).dirtyIndexes,
    };
  } catch (err) {
    logger.warn(`Yetkili adı denetimi atlandı: ${err instanceof Error ? err.message : 'hata'}`);
    return { configured: true, dirtyIndexes: [] };
  }
}
