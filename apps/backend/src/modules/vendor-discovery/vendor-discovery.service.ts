import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { toTitleCaseTR } from '@/common/utils/text-helpers';
import { PrismaService } from '@/prisma/prisma.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import type { ImportVendorDiscoveryDto } from './dto/import-vendor-discovery.dto';
import type { LinkImportVendorDiscoveryDto } from './dto/link-import-vendor-discovery.dto';
import type {
  ExternalVendorCandidate,
  ExternalVendorSource,
  SearchExternalVendorsQuery,
  VendorDiscoveryImportPrefill,
  VendorDiscoveryQuota,
  VendorDiscoverySearchResult,
} from './dto/search-external-vendors.dto';

const DAILY_SEARCH_LIMIT = 30;
/** Çoklu ilçe aramasında en fazla kaç ilçe için ayrı Google sorgusu atılır */
const MAX_DISTRICTS_PER_SEARCH = 5;

const MOCK_SUFFIXES = ['Usta', 'Ticaret', 'Servis', 'Yapı', 'Grup'];
const MOCK_SOURCES: ExternalVendorCandidate['source'][] = [
  'google_mock',
  'google_mock',
  'google_mock',
  'instagram_mock',
  'facebook_mock',
];

/** İl merkezi koordinatları — mock sonuçlar için yaklaşık konum */
const MOCK_CITY_CENTERS: Record<string, [number, number]> = {
  muğla: [37.2153, 28.3636],
  istanbul: [41.0082, 28.9784],
  izmir: [38.4237, 27.1428],
  ankara: [39.9334, 32.8597],
  antalya: [36.8969, 30.7133],
  bursa: [40.1885, 29.061],
  adana: [37.0, 35.3213],
  konya: [37.8746, 32.4932],
  gaziantep: [37.0662, 37.3833],
  mersin: [36.8121, 34.6415],
};

const SOURCE_LABELS: Record<ExternalVendorSource, string> = {
  google_places: 'Google',
  google_mock: 'Google (Mock)',
  instagram_mock: 'Instagram (Mock)',
  facebook_mock: 'Facebook (Mock)',
};

const GOOGLE_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.rating',
  'places.userRatingCount',
  'places.location',
  'places.googleMapsUri',
].join(',');

@Injectable()
export class VendorDiscoveryService {
  private readonly logger = new Logger(VendorDiscoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettings: SystemSettingsService,
    private readonly http: HttpService,
  ) {}

  async searchExternal(
    query: SearchExternalVendorsQuery,
    userId: string,
  ): Promise<VendorDiscoverySearchResult> {
    await this.assertSearchQuota(userId);

    const city = query.city.trim();
    const districts = this.normalizeDistricts(query);
    const districtLabel = this.formatDistrictsLabel(districts);
    const serviceType = toTitleCaseTR(query.serviceType.trim());
    const minRating = query.minRating ?? 4.0;

    const apiKey = await this.resolveGooglePlacesApiKey();
    let candidates: ExternalVendorCandidate[];
    let source: 'google_places' | 'mock';

    if (apiKey) {
      try {
        candidates = await this.searchGooglePlacesMerged(apiKey, city, districts, serviceType, minRating);
        source = 'google_places';
      } catch (err) {
        this.logger.warn(
          `Google Places araması başarısız, mock'a düşülüyor: ${err instanceof Error ? err.message : String(err)}`,
        );
        candidates = this.buildMockResults(city, districts?.[0], serviceType, minRating);
        source = 'mock';
      }
    } else {
      candidates = this.buildMockResults(city, districts?.[0], serviceType, minRating);
      source = 'mock';
    }

    const session = await this.prisma.vendorDiscoverySession.create({
      data: {
        userId,
        city: toTitleCaseTR(city),
        district: districtLabel,
        serviceType,
        minRating,
        source,
        resultCount: candidates.length,
        candidates: {
          create: candidates.map((c) => ({
            externalId: c.externalId,
            name: c.name,
            address: c.address,
            phone: c.phone ?? null,
            rating: c.rating,
            reviewCount: c.reviewCount,
            latitude: c.latitude ?? null,
            longitude: c.longitude ?? null,
            source: c.source,
            rawPayload: c as unknown as object,
          })),
        },
      },
    });

    return { candidates, source, sessionId: session.id };
  }

  async importCandidate(dto: ImportVendorDiscoveryDto): Promise<{ prefill: VendorDiscoveryImportPrefill }> {
    if (!dto.externalId?.trim()) {
      throw new BadRequestException('externalId zorunludur');
    }

    let candidate: ExternalVendorCandidate | null = dto.candidate ?? null;
    let storedLat: number | null | undefined;
    let storedLng: number | null | undefined;

    if (dto.sessionId) {
      const stored = await this.prisma.vendorDiscoveryCandidate.findFirst({
        where: { sessionId: dto.sessionId, externalId: dto.externalId },
      });
      if (stored) {
        storedLat = stored.latitude;
        storedLng = stored.longitude;
        candidate = {
          externalId: stored.externalId,
          name: stored.name,
          address: stored.address ?? '',
          city: dto.city?.trim() ? toTitleCaseTR(dto.city.trim()) : '',
          district: dto.district?.trim() ? toTitleCaseTR(dto.district.trim()) : undefined,
          phone: stored.phone ?? undefined,
          rating: stored.rating ?? 0,
          reviewCount: stored.reviewCount ?? 0,
          source: stored.source as ExternalVendorSource,
          mapsUrl: this.buildMapsUrl(stored.name, dto.city, dto.district),
          serviceTypes: dto.serviceType ? [toTitleCaseTR(dto.serviceType.trim())] : [],
          latitude: stored.latitude ?? undefined,
          longitude: stored.longitude ?? undefined,
        };
      }
    }

    if (!candidate) {
      throw new NotFoundException('Aday bulunamadı. Lütfen aramayı tekrarlayın.');
    }

    const city = candidate.city || (dto.city ? toTitleCaseTR(dto.city.trim()) : '');
    const district = candidate.district || (dto.district ? toTitleCaseTR(dto.district.trim()) : undefined);
    const sourceLabel = SOURCE_LABELS[candidate.source] ?? candidate.source;
    const ratingPart = candidate.rating
      ? `Puan: ${candidate.rating.toFixed(1)}${candidate.reviewCount ? ` (${candidate.reviewCount} yorum)` : ''}`
      : null;

    const latitude = candidate.latitude ?? storedLat ?? undefined;
    const longitude = candidate.longitude ?? storedLng ?? undefined;

    const prefill: VendorDiscoveryImportPrefill = {
      name: candidate.name,
      city,
      district,
      address: candidate.address,
      phone: candidate.phone,
      notes: [
        'Dış kaynak aramasından içe aktarıldı.',
        `Kaynak: ${sourceLabel}`,
        ratingPart,
        candidate.mapsUrl ? `Harita: ${candidate.mapsUrl}` : null,
      ]
        .filter(Boolean)
        .join(' '),
      mapsUrl: candidate.mapsUrl,
      rating: candidate.rating,
      reviewCount: candidate.reviewCount,
      source: candidate.source,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
    };

    return { prefill };
  }

  async linkImport(dto: LinkImportVendorDiscoveryDto): Promise<void> {
    if (!dto.sessionId?.trim() || !dto.externalId?.trim() || !dto.vendorId?.trim()) {
      throw new BadRequestException('sessionId, externalId ve vendorId zorunludur');
    }

    const result = await this.prisma.vendorDiscoveryCandidate.updateMany({
      where: { sessionId: dto.sessionId, externalId: dto.externalId },
      data: { importedVendorId: dto.vendorId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Bağlanacak aday bulunamadı.');
    }
  }

  async getQuota(userId: string): Promise<VendorDiscoveryQuota> {
    const used = await this.countTodaySearches(userId);
    return {
      used,
      limit: DAILY_SEARCH_LIMIT,
      remaining: Math.max(0, DAILY_SEARCH_LIMIT - used),
    };
  }

  async testGoogleConnection(): Promise<{ ok: boolean; message: string; resultCount?: number }> {
    const apiKey = await this.resolveGooglePlacesApiKey();
    if (!apiKey) {
      return {
        ok: false,
        message: 'Google Places API key tanımlı değil veya entegrasyon pasif.',
      };
    }

    try {
      const candidates = await this.searchGooglePlaces(apiKey, 'Muğla', undefined, 'camcı', 3.0);
      return {
        ok: true,
        message: `Bağlantı başarılı — ${candidates.length} test sonucu alındı (Muğla camcı).`,
        resultCount: candidates.length,
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return { ok: false, message: `Google Places bağlantısı başarısız: ${detail}` };
    }
  }

  private async assertSearchQuota(userId: string): Promise<void> {
    const used = await this.countTodaySearches(userId);
    if (used >= DAILY_SEARCH_LIMIT) {
      throw new HttpException(
        `Günlük dış kaynak arama limitine ulaştınız (${DAILY_SEARCH_LIMIT} arama). Yarın tekrar deneyin.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async countTodaySearches(userId: string): Promise<number> {
    return this.prisma.vendorDiscoverySession.count({
      where: {
        userId,
        createdAt: { gte: this.startOfTodayUtc() },
      },
    });
  }

  private startOfTodayUtc(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private async resolveGooglePlacesApiKey(): Promise<string | null> {
    try {
      const config = await this.systemSettings.getIntegrationConfig();
      const settingsKey = config.googlePlaces?.active ? config.googlePlaces.apiKey?.trim() : '';
      if (settingsKey) return settingsKey;
    } catch {
      /* env fallback */
    }
    const envKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
    if (envKey) return envKey;
    return null;
  }

  private buildMockResults(
    city: string,
    district: string | undefined,
    serviceType: string,
    minRating: number,
  ): ExternalVendorCandidate[] {
    const locationLabel = district ? `${district}, ${city}` : city;

    const baseNames = [
      `${city} ${serviceType}`,
      `${serviceType} ${district ?? city}`,
      `Merkez ${serviceType}`,
      `${serviceType} Atölyesi`,
      `Profesyonel ${serviceType}`,
    ];

    return baseNames.map((base, index) => {
      const suffix = MOCK_SUFFIXES[index % MOCK_SUFFIXES.length];
      const name = toTitleCaseTR(`${base} ${suffix}`);
      const rating = Math.max(minRating, 4.2 + (4 - index) * 0.15);
      const reviewCount = 120 - index * 18 + city.length;
      const source = MOCK_SOURCES[index];
      const mockCoords = this.mockCoordsForCity(city, index);

      return {
        externalId: `mock-${city.toLowerCase().replace(/\s+/g, '-')}-${index}`,
        name,
        address: toTitleCaseTR(`${locationLabel} Merkez Mah. ${index + 12}. Sok. No: ${index + 3}`),
        city: toTitleCaseTR(city),
        district: district ? toTitleCaseTR(district) : undefined,
        phone: index < 3 ? `0${532 + index}${100 + index}${20 + index}${30 + index}` : undefined,
        rating: Math.round(rating * 10) / 10,
        reviewCount,
        source,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${locationLabel}`)}`,
        serviceTypes: [serviceType],
        ...mockCoords,
      };
    });
  }

  /** İl merkezi civarı yaklaşık koordinat (mock); bilinmeyen illerde null. */
  private mockCoordsForCity(
    city: string,
    index: number,
  ): { latitude: number; longitude: number } | Record<string, never> {
    const center = MOCK_CITY_CENTERS[city.toLocaleLowerCase('tr-TR')];
    if (!center) return {};
    return {
      latitude: Math.round((center[0] + index * 0.008) * 10000) / 10000,
      longitude: Math.round((center[1] + index * 0.012) * 10000) / 10000,
    };
  }

  private normalizeDistricts(query: SearchExternalVendorsQuery): string[] | undefined {
    if (query.districts?.length) {
      return query.districts.map((d) => d.trim()).filter(Boolean);
    }
    if (query.district?.trim()) {
      return [query.district.trim()];
    }
    return undefined;
  }

  private formatDistrictsLabel(districts?: string[]): string | null {
    if (!districts?.length) return null;
    return districts.map((d) => toTitleCaseTR(d)).join(', ');
  }

  private async searchGooglePlacesMerged(
    apiKey: string,
    city: string,
    districts: string[] | undefined,
    serviceType: string,
    minRating: number,
  ): Promise<ExternalVendorCandidate[]> {
    const targets = !districts?.length
      ? [undefined as string | undefined]
      : districts.slice(0, MAX_DISTRICTS_PER_SEARCH);

    const merged = new Map<string, ExternalVendorCandidate>();

    for (const district of targets) {
      const batch = await this.searchGooglePlaces(apiKey, city, district, serviceType, minRating, 10);
      for (const candidate of batch) {
        const existing = merged.get(candidate.externalId);
        if (!existing || candidate.rating > existing.rating) {
          merged.set(candidate.externalId, candidate);
        }
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);
  }

  private async searchGooglePlaces(
    apiKey: string,
    city: string,
    district: string | undefined,
    serviceType: string,
    minRating: number,
    maxResults = 5,
  ): Promise<ExternalVendorCandidate[]> {
    const queryParts = [serviceType, district, city].filter(Boolean);
    const textQuery = queryParts.join(' ');

    const response = await firstValueFrom(
      this.http.post<{ places?: GooglePlaceResult[] }>(
        'https://places.googleapis.com/v1/places:searchText',
        {
          textQuery,
          languageCode: 'tr',
          regionCode: 'TR',
          maxResultCount: 10,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': GOOGLE_FIELD_MASK,
          },
          timeout: 15_000,
        },
      ),
    );

    const places = response.data?.places ?? [];
    const filtered = places
      .filter((p) => (p.rating ?? 0) >= minRating)
      .slice(0, maxResults);

    return filtered.map((place) => {
      const externalId = place.id?.replace(/^places\//, '') ?? place.id ?? '';
      const name = toTitleCaseTR(place.displayName?.text ?? 'İsimsiz İşletme');
      const address = place.formattedAddress ?? '';
      const mapsUrl =
        place.googleMapsUri ??
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${city}`)}&query_place_id=${externalId}`;

      return {
        externalId,
        name,
        address,
        city: toTitleCaseTR(city),
        district: district ? toTitleCaseTR(district) : undefined,
        phone: place.nationalPhoneNumber ?? undefined,
        rating: place.rating ?? 0,
        reviewCount: place.userRatingCount ?? 0,
        source: 'google_places' as const,
        mapsUrl,
        serviceTypes: [serviceType],
        latitude: place.location?.latitude,
        longitude: place.location?.longitude,
      };
    });
  }

  private buildMapsUrl(name: string, city?: string, district?: string): string {
    const locationLabel = [district, city].filter(Boolean).join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${locationLabel}`.trim())}`;
  }
}

interface GooglePlaceResult {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
}
