import { Logger } from '@nestjs/common';

const logger = new Logger('GecisUcretOneri');

export interface GecisUcretOneri {
  id: string;
  ad: string;
  ucret: number | null;
  kaynak: 'oneri' | 'yok';
}

/**
 * Rut üzerindeki geçiş adları için güncel tek geçiş ücreti önerir.
 * Personel detayda düzeltir; yazılım kayda kendi başına basmaz.
 */
export async function gecisUcretleriOner(
  gecisler: Array<{ id: string; ad: string }>,
  apiKey: string | null | undefined,
): Promise<GecisUcretOneri[]> {
  if (!gecisler.length) return [];
  if (!apiKey?.trim()) {
    return gecisler.map((g) => ({ id: g.id, ad: g.ad, ucret: null, kaynak: 'yok' as const }));
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey, timeout: 30_000 });
    const liste = gecisler.map((g) => `- ${g.id}: ${g.ad}`).join('\n');
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 500,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'Türkiye köprü ve tünel tek geçiş ücretlerini (otomobil, KDV dahil TL) bilinen güncel tarifeye göre öner. '
            + 'Yalnız JSON dizi döndür: [{"id":"...","ucret":number|null}]. Bilmiyorsan null. Tahmin uydurma.',
        },
        {
          role: 'user',
          content: `Aşağıdaki geçişler için tek geçiş ücreti öner:\n${liste}`,
        },
      ],
    });
    const content = String(response.choices?.[0]?.message?.content ?? '');
    const json = content.match(/\[[\s\S]*\]/)?.[0];
    if (!json) {
      return gecisler.map((g) => ({ id: g.id, ad: g.ad, ucret: null, kaynak: 'yok' as const }));
    }
    const parsed = JSON.parse(json) as Array<{ id?: string; ucret?: unknown }>;
    const byId = new Map(
      parsed
        .filter((r) => typeof r?.id === 'string')
        .map((r) => {
          const n = Number(r.ucret);
          const ucret = Number.isFinite(n) && n > 0 && n < 5000 ? n : null;
          return [String(r.id), ucret] as const;
        }),
    );
    return gecisler.map((g) => {
      const ucret = byId.has(g.id) ? (byId.get(g.id) ?? null) : null;
      return { id: g.id, ad: g.ad, ucret, kaynak: ucret != null ? ('oneri' as const) : ('yok' as const) };
    });
  } catch (err) {
    logger.warn(`Geçiş ücreti önerisi alınamadı: ${err}`);
    return gecisler.map((g) => ({ id: g.id, ad: g.ad, ucret: null, kaynak: 'yok' as const }));
  }
}

/** Otoyol km ücreti önerisi (ref listesi). */
export async function otoyolKmUcretleriOner(
  otoyollar: Array<{ ref: string; ad?: string }>,
  apiKey: string | null | undefined,
): Promise<Array<{ ref: string; kmUcreti: number | null; kaynak: 'oneri' | 'yok' }>> {
  if (!otoyollar.length) return [];
  if (!apiKey?.trim()) {
    return otoyollar.map((o) => ({ ref: o.ref, kmUcreti: null, kaynak: 'yok' as const }));
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey, timeout: 30_000 });
    const liste = otoyollar.map((o) => `- ${o.ref}${o.ad ? ` (${o.ad})` : ''}`).join('\n');
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'Türkiye ücretli otoyol km başı otomobil ücretini (KDV dahil TL) bilinen tarifeye göre öner. '
            + 'Yalnız JSON dizi: [{"ref":"O-4","kmUcreti":number|null}]. Bilmiyorsan null.',
        },
        { role: 'user', content: `Otoyollar:\n${liste}` },
      ],
    });
    const content = String(response.choices?.[0]?.message?.content ?? '');
    const json = content.match(/\[[\s\S]*\]/)?.[0];
    if (!json) {
      return otoyollar.map((o) => ({ ref: o.ref, kmUcreti: null, kaynak: 'yok' as const }));
    }
    const parsed = JSON.parse(json) as Array<{ ref?: string; kmUcreti?: unknown }>;
    const byRef = new Map(
      parsed
        .filter((r) => typeof r?.ref === 'string')
        .map((r) => {
          const n = Number(r.kmUcreti);
          const kmUcreti = Number.isFinite(n) && n > 0 && n < 50 ? n : null;
          return [String(r.ref).toUpperCase(), kmUcreti] as const;
        }),
    );
    return otoyollar.map((o) => {
      const kmUcreti = byRef.get(o.ref.toUpperCase()) ?? null;
      return { ref: o.ref, kmUcreti, kaynak: kmUcreti != null ? ('oneri' as const) : ('yok' as const) };
    });
  } catch (err) {
    logger.warn(`Otoyol ücreti önerisi alınamadı: ${err}`);
    return otoyollar.map((o) => ({ ref: o.ref, kmUcreti: null, kaynak: 'yok' as const }));
  }
}
