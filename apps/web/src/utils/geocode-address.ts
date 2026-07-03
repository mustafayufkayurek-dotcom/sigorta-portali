/** OpenStreetMap Nominatim ile kademeli adres → koordinat arama. */

export interface GeocodeAddressInput {
  city?: string;
  district?: string;
  neighborhood?: string;
  streetName?: string;
  /** Plaza, iş merkezi, site adı */
  siteName?: string;
  buildingNo?: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  approximate: boolean;
}

const NOMINATIM_HEADERS = { 'User-Agent': 'MeridyenAssistance/1.0 (contact@meridyenassistance.com)' };

function normalizeStreet(value: string): string {
  return value
    .replace(/\bCad\.\b/gi, 'Caddesi')
    .replace(/\bSok\.\b/gi, 'Sokak')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cadde alanından plaza/site adını ayırır — geocoder için sade cadde kalır. */
export function stripSiteFromStreet(streetName: string, siteName?: string): string {
  let street = streetName.trim();
  if (siteName?.trim()) {
    const escaped = siteName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    street = street.replace(new RegExp(escaped, 'gi'), '').trim();
  }
  return normalizeStreet(street);
}

/** Kademeli arama sorguları — en spesifikten genele. */
export function buildGeocodeQueries(input: GeocodeAddressInput): string[] {
  const city = input.city?.trim() ?? '';
  const district = input.district?.trim() ?? '';
  const neighborhood = input.neighborhood?.trim() ?? '';
  const buildingNo = input.buildingNo?.trim() ?? '';
  const siteName = input.siteName?.trim() ?? '';
  const street = stripSiteFromStreet(input.streetName ?? '', siteName);

  const queries: string[] = [];
  const push = (parts: Array<string | undefined>) => {
    const q = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (q && !queries.includes(q)) queries.push(q);
  };

  if (street && buildingNo) {
    push([street, buildingNo, neighborhood, district, city]);
  }
  if (street) {
    push([street, neighborhood, district, city]);
  }
  if (siteName) {
    push([siteName, neighborhood, district, city]);
  }
  if (neighborhood && district && city) {
    push([neighborhood, district, city]);
  }
  if (input.streetName?.trim()) {
    push([
      neighborhood,
      input.streetName,
      buildingNo ? `No: ${buildingNo}` : undefined,
      district,
      city,
    ]);
  }

  return queries;
}

async function nominatimSearch(query: string): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=tr&limit=1`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: (data[0].display_name as string) ?? query,
    approximate: false,
  };
}

/** Sırayla sorgu dener; ilk eşleşmeyi döndürür. */
export async function geocodeAddressCascade(
  input: GeocodeAddressInput,
): Promise<GeocodeResult | null> {
  const queries = buildGeocodeQueries(input);
  for (let i = 0; i < queries.length; i += 1) {
    const result = await nominatimSearch(queries[i]);
    if (result) {
      return { ...result, approximate: i > 0 };
    }
    if (i < queries.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }
  return null;
}
