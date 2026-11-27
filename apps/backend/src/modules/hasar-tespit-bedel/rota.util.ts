import { Logger } from '@nestjs/common';

const logger = new Logger('HasarTespitRota');

export interface RotaNokta {
  lat: number;
  lng: number;
}

export interface RotaOtoyolParca {
  ref: string;
  ad?: string;
  /** tek yön km */
  km: number;
}

export interface RotaSonuc {
  /** tek yön km */
  km: number;
  dakika: number;
  koordinatlar: Array<[number, number]>;
  otoyollar: RotaOtoyolParca[];
  /** Ücretli yol içeriyor mu (Yandex bayrağı). */
  ucretliYol?: boolean;
  /** Seçim: kısa / ücretsiz tercih. */
  secim?: 'ucretsiz_kisa' | 'kisa' | 'tek';
  kaynak?: 'yandex';
}

const OTOYOL_REF = /^O-\d+[A-Z]?$/i;

/** Yol parçalarından ücretli otoyol kesimlerini ref bazında toplar. */
export function rotaOtoyolParcalari(
  steps: Array<{ ref?: string | null; name?: string | null; distance?: number }>,
): RotaOtoyolParca[] {
  const byRef = new Map<string, { km: number; ad?: string }>();
  for (const step of steps) {
    const refs = String(step.ref ?? '')
      .split(/[;,]/)
      .map((r) => r.trim().toUpperCase())
      .filter((r) => OTOYOL_REF.test(r));
    if (!refs.length) continue;
    const ref = refs[0];
    const cur = byRef.get(ref) ?? { km: 0 };
    cur.km += (step.distance ?? 0) / 1000;
    if (!cur.ad && step.name && /otoyol/i.test(step.name)) cur.ad = step.name.trim();
    byRef.set(ref, cur);
  }
  return [...byRef.entries()]
    .map(([ref, v]) => ({ ref, ad: v.ad, km: Math.round(v.km * 10) / 10 }))
    .filter((p) => p.km >= 1)
    .sort((a, b) => b.km - a.km);
}

type YandexRouteCandidate = {
  km: number;
  dakika: number;
  koordinatlar: Array<[number, number]>;
  ucretliYol: boolean;
};

function yandexApiKey(): string {
  return String(process.env.YANDEX_ROUTING_API_KEY || process.env.YANDEX_MAPS_API_KEY || '').trim();
}

/**
 * Kısa ve uygun maliyetli güzergah önceliği:
 * ücretsiz alternatif, ücretliye göre en fazla %15 veya 25 km uzunsa tercih edilir;
 * aksi halde en kısa seçilir.
 */
export function secKisaUygunMaliyetliRota(
  adaylar: YandexRouteCandidate[],
): { secilen: YandexRouteCandidate; secim: RotaSonuc['secim'] } | null {
  if (!adaylar.length) return null;
  const kisa = [...adaylar].sort((a, b) => a.km - b.km || a.dakika - b.dakika)[0];
  const ucretsiz = adaylar
    .filter((a) => !a.ucretliYol)
    .sort((a, b) => a.km - b.km || a.dakika - b.dakika)[0];
  if (!ucretsiz) return { secilen: kisa, secim: adaylar.length === 1 ? 'tek' : 'kisa' };
  if (ucretsiz === kisa || (!kisa.ucretliYol && ucretsiz.km <= kisa.km)) {
    return { secilen: ucretsiz, secim: 'ucretsiz_kisa' };
  }
  const farkKm = ucretsiz.km - kisa.km;
  const farkOran = kisa.km > 0 ? farkKm / kisa.km : 1;
  if (farkKm <= 25 && farkOran <= 0.15) {
    return { secilen: ucretsiz, secim: 'ucretsiz_kisa' };
  }
  return { secilen: kisa, secim: 'kisa' };
}

async function yandexRouteOnce(
  from: RotaNokta,
  to: RotaNokta,
  opts: { avoidTolls: boolean; apiKey: string },
  fetchImpl: typeof fetch,
): Promise<YandexRouteCandidate | null> {
  const params = new URLSearchParams({
    apikey: opts.apiKey,
    waypoints: `${from.lat},${from.lng}|${to.lat},${to.lng}`,
    mode: 'driving',
    avoid_tolls: opts.avoidTolls ? 'true' : 'false',
  });
  const url = `https://api.routing.yandex.net/v2/route?${params.toString()}`;
  const res = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    logger.warn(`Yandex rota HTTP ${res.status} (avoid_tolls=${opts.avoidTolls})`);
    return null;
  }
  const data = (await res.json()) as {
    route?: {
      legs?: Array<{
        status?: string;
        steps?: Array<{
          length?: number;
          duration?: number;
          polyline?: { points?: Array<[number, number]> };
        }>;
      }>;
      flags?: { hasTolls?: boolean };
    };
  };
  const legs = data.route?.legs ?? [];
  if (!legs.length || legs.some((l) => l.status && l.status !== 'OK')) return null;
  const steps = legs.flatMap((l) => l.steps ?? []);
  if (!steps.length) return null;
  let metre = 0;
  let saniye = 0;
  const points: Array<[number, number]> = [];
  for (const step of steps) {
    metre += Number(step.length) || 0;
    saniye += Number(step.duration) || 0;
    const pts = step.polyline?.points ?? [];
    for (const p of pts) {
      // Yandex: [lon, lat] veya [lat, lon] — dokümantasyon örnekleri lat,lon sırası karışık;
      // polyline points genelde [lon, lat] (GeoJSON). Geo tespiti için lng,lat tutuyoruz.
      if (Array.isArray(p) && p.length >= 2) points.push([Number(p[0]), Number(p[1])]);
    }
  }
  if (metre <= 0) return null;
  return {
    km: Math.round((metre / 1000) * 10) / 10,
    dakika: Math.max(1, Math.round(saniye / 60)),
    koordinatlar: points,
    ucretliYol: Boolean(data.route?.flags?.hasTolls) && !opts.avoidTolls,
  };
}

/**
 * Rota yalnız Yandex ile hesaplanır (tek tedarikçi).
 * Önce ücretsiz + kısa güzergah tercih edilir.
 */
export async function rotaHesapla(
  from: RotaNokta,
  to: RotaNokta,
  fetchImpl: typeof fetch = fetch,
): Promise<RotaSonuc | null> {
  const apiKey = yandexApiKey();
  if (!apiKey) {
    logger.warn('Yandex rota anahtarı yok (YANDEX_ROUTING_API_KEY). Rota hesaplanamadı.');
    return null;
  }
  try {
    const [ucretsiz, normal] = await Promise.all([
      yandexRouteOnce(from, to, { avoidTolls: true, apiKey }, fetchImpl),
      yandexRouteOnce(from, to, { avoidTolls: false, apiKey }, fetchImpl),
    ]);
    const adaylar = [ucretsiz, normal].filter(Boolean) as YandexRouteCandidate[];
    // avoid_tolls=true başarılıysa bayrağı ücretsiz say
    if (ucretsiz) ucretsiz.ucretliYol = false;
    const secim = secKisaUygunMaliyetliRota(adaylar);
    if (!secim) return null;
    return {
      km: secim.secilen.km,
      dakika: secim.secilen.dakika,
      koordinatlar: secim.secilen.koordinatlar,
      otoyollar: [],
      ucretliYol: secim.secilen.ucretliYol,
      secim: secim.secim,
      kaynak: 'yandex',
    };
  } catch (err) {
    logger.warn(`Yandex rota hesaplanamadı: ${err}`);
    return null;
  }
}
