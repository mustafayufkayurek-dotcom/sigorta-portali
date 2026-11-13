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

export async function rotaHesapla(
  from: RotaNokta,
  to: RotaNokta,
  fetchImpl: typeof fetch = fetch,
): Promise<RotaSonuc | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}`
    + '?overview=full&geometries=geojson&steps=true';
  try {
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': 'MeridyenAssistance/1.0 (hasar-tespit-rota)', Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: { coordinates?: Array<[number, number]> };
        legs?: Array<{ steps?: Array<{ ref?: string; name?: string; distance?: number }> }>;
      }>;
    };
    const route = data.routes?.[0];
    if (!route) return null;
    const steps = (route.legs ?? []).flatMap((leg) => leg.steps ?? []);
    return {
      km: Math.round((route.distance / 1000) * 10) / 10,
      dakika: Math.round(route.duration / 60),
      koordinatlar: route.geometry?.coordinates ?? [],
      otoyollar: rotaOtoyolParcalari(steps),
    };
  } catch (err) {
    logger.warn(`Rota hesaplanamadı: ${err}`);
    return null;
  }
}
