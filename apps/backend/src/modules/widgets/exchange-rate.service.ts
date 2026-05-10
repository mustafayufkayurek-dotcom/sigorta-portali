import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as xml2js from 'xml2js';

export interface ExchangeRate {
  code: string;
  name: string;
  buyingRate: number;
  sellingRate: number;
  effectiveBuying: number;
  effectiveSelling: number;
}

export interface ExchangeRatesData {
  date: string;
  rates: ExchangeRate[];
  usd: ExchangeRate | null;
  eur: ExchangeRate | null;
  gbp: ExchangeRate | null;
}

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private cache: { data: ExchangeRatesData; expiresAt: number } | null = null;
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  async getExchangeRates(): Promise<ExchangeRatesData> {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.data;
    }

    try {
      const url = 'https://www.tcmb.gov.tr/kurlar/today.xml';
      const response = await axios.get(url, {
        timeout: 10000,
        responseType: 'text',
        headers: {
          'Accept': 'application/xml, text/xml, */*',
          'User-Agent': 'Mozilla/5.0',
        },
      });

      const parsed = await xml2js.parseStringPromise(response.data, {
        explicitArray: true,
        ignoreAttrs: false,
        mergeAttrs: true,
      });

      const root = parsed['Tarih_Date'] || parsed['tarih_date'];
      const dateAttr: string = root?.Date?.[0] ?? root?.Tarih?.[0] ?? new Date().toLocaleDateString('tr-TR');
      const currencies: any[] = root?.Currency ?? root?.currency ?? [];

      const rates: ExchangeRate[] = currencies.map((c: any) => ({
        code: c.Kod?.[0] ?? c.kod?.[0] ?? c.CurrencyCode?.[0] ?? '',
        name: c.Isim?.[0] ?? c.isim?.[0] ?? c.CurrencyName?.[0] ?? '',
        buyingRate: parseFloat(c.ForexBuying?.[0] ?? c.forexbuying?.[0] ?? '0') || 0,
        sellingRate: parseFloat(c.ForexSelling?.[0] ?? c.forexselling?.[0] ?? '0') || 0,
        effectiveBuying: parseFloat(c.BanknoteBuying?.[0] ?? c.banknotebuying?.[0] ?? '0') || 0,
        effectiveSelling: parseFloat(c.BanknoteSelling?.[0] ?? c.banknoteselling?.[0] ?? '0') || 0,
      }));

      const findRate = (code: string) => rates.find((r) => r.code === code) ?? null;

      const data: ExchangeRatesData = {
        date: dateAttr,
        rates,
        usd: findRate('USD'),
        eur: findRate('EUR'),
        gbp: findRate('GBP'),
      };

      this.cache = { data, expiresAt: Date.now() + this.CACHE_TTL_MS };
      return data;
    } catch (err) {
      this.logger.warn(`TCMB kur verisi alınamadı: ${(err as Error).message}`);
      return this.getMockRates();
    }
  }

  private getMockRates(): ExchangeRatesData {
    const usd: ExchangeRate = {
      code: 'USD',
      name: 'ABD DOLARI',
      buyingRate: 32.5,
      sellingRate: 32.6,
      effectiveBuying: 32.45,
      effectiveSelling: 32.65,
    };
    const eur: ExchangeRate = {
      code: 'EUR',
      name: 'EURO',
      buyingRate: 35.2,
      sellingRate: 35.35,
      effectiveBuying: 35.15,
      effectiveSelling: 35.4,
    };
    const gbp: ExchangeRate = {
      code: 'GBP',
      name: 'İNGİLİZ STERLİNİ',
      buyingRate: 41.5,
      sellingRate: 41.7,
      effectiveBuying: 41.45,
      effectiveSelling: 41.75,
    };
    return {
      date: new Date().toLocaleDateString('tr-TR'),
      rates: [usd, eur, gbp],
      usd,
      eur,
      gbp,
    };
  }
}
