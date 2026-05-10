import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface TaxQueryResult {
  title: string;
  taxOffice: string;
  address: string;
  status: string;
  found: boolean;
}

export interface TurmobQueryResult {
  title: string;
  found: boolean;
}

export interface IbanVerifyResult {
  valid: boolean;
  bankName?: string;
}

const BANK_CODES: Record<string, string> = {
  '00010': 'Ziraat Bankası',
  '00015': 'Vakıfbank',
  '00012': 'Halkbank',
  '00046': 'Akbank',
  '00064': 'İş Bankası',
  '00062': 'Garanti BBVA',
  '00067': 'Yapı Kredi',
  '00099': 'ING Bank',
  '00111': 'Finansbank',
  '00134': 'Denizbank',
  '00059': 'Şekerbank',
  '00032': 'TEB',
};

@Injectable()
export class TaxVerificationService {
  private readonly GIB_URL = 'https://ivd.gib.gov.tr/tvd_server/asynchronousHandler';

  constructor(private readonly prisma: PrismaService) {}

  async queryByTaxNumber(taxNumber: string): Promise<TaxQueryResult> {
    const trimmed = taxNumber.replace(/\s/g, '');
    if (!/^\d{10,11}$/.test(trimmed)) {
      throw new BadRequestException('Vergi numarası 10 veya 11 haneli olmalıdır');
    }

    try {
      const params = new URLSearchParams({
        cmd: 'GETVKNINTERNET',
        callid: Date.now().toString(),
        vkn: trimmed,
      });

      const response = await axios.post(this.GIB_URL, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (compatible; SigortaHasar/1.0)',
          Referer: 'https://ivd.gib.gov.tr/',
          Origin: 'https://ivd.gib.gov.tr',
        },
        timeout: 10000,
      });

      return this.parseGibResponse(response.data);
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new ServiceUnavailableException('GİB servisi şu anda yanıt vermiyor');
    }
  }

  private parseGibResponse(html: string): TaxQueryResult {
    if (!html || typeof html !== 'string') {
      return { title: '', taxOffice: '', address: '', status: 'not_found', found: false };
    }

    // Try JSON-based response first
    try {
      const json = typeof html === 'object' ? html : JSON.parse(html);
      if (json && (json.mükellefUnvani || json.mukellefUnvani || json.unvan)) {
        return {
          title: json.mükellefUnvani ?? json.mukellefUnvani ?? json.unvan ?? '',
          taxOffice: json.vergiDairesi ?? json.vd ?? '',
          address: json.adres ?? '',
          status: json.durum ?? 'active',
          found: true,
        };
      }
    } catch {
      // Not JSON, try HTML parsing
    }

    // HTML parsing with cheerio
    const $ = cheerio.load(html);
    const rows: Record<string, string> = {};
    $('tr').each((_, tr) => {
      const cells = $(tr).find('td');
      if (cells.length >= 2) {
        const key = $(cells[0]).text().trim().toLowerCase();
        const val = $(cells[1]).text().trim();
        rows[key] = val;
      }
    });

    const title =
      rows['mükellef unvanı'] ??
      rows['unvan'] ??
      rows['ad soyad / unvan'] ??
      rows['mükelleün adı soyadı / unvanı'] ??
      $('[id*="unvan"], [class*="unvan"]').first().text().trim() ??
      '';

    const taxOffice =
      rows['vergi dairesi'] ??
      rows['vd'] ??
      $('[id*="vd"], [class*="vd"]').first().text().trim() ??
      '';

    const address =
      rows['adres'] ??
      rows['iş adresi'] ??
      $('[id*="adres"], [class*="adres"]').first().text().trim() ??
      '';

    const status = rows['durum'] ?? rows['aktif/pasif'] ?? 'active';

    if (!title && !taxOffice) {
      return { title: '', taxOffice: '', address: '', status: 'not_found', found: false };
    }

    return { title, taxOffice, address, status, found: true };
  }

  /**
   * TÜRMOB entegrasyonu ile vergi no sorgulama
   */
  async queryByTaxNumberTurmob(taxNumber: string): Promise<TurmobQueryResult> {
    const trimmed = taxNumber.replace(/\s/g, '');
    if (!/^\d{10,11}$/.test(trimmed)) {
      throw new BadRequestException('Vergi numarası 10 veya 11 haneli olmalıdır');
    }

    // SystemSetting'den turmob_config'i çek
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'turmob_config' } });
    const config = setting?.value as {
      apiUrl?: string;
      apiKey?: string;
      username?: string;
      password?: string;
      active?: boolean;
    } | null;

    if (!config || !config.active) {
      throw new ServiceUnavailableException('TÜRMOB entegrasyonu yapılandırılmamış');
    }

    if (!config.apiUrl) {
      throw new ServiceUnavailableException('TÜRMOB entegrasyonu yapılandırılmamış');
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; SigortaHasar/1.0)',
      };

      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        headers['X-API-Key'] = config.apiKey;
      }

      const url = config.apiUrl.replace('{taxNumber}', trimmed);
      const response = await axios.get(url, {
        headers,
        auth: config.username && config.password
          ? { username: config.username, password: config.password }
          : undefined,
        timeout: 15000,
        params: { vkn: trimmed, taxNumber: trimmed },
      });

      return this.parseTurmobResponse(response.data);
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException('TÜRMOB servisi şu anda yanıt vermiyor');
    }
  }

  private parseTurmobResponse(data: any): TurmobQueryResult {
    if (!data) return { title: '', found: false };

    // JSON response
    if (typeof data === 'object') {
      const title =
        data.unvan ?? data.title ?? data.mukellefUnvani ?? data.mükellefUnvani ??
        data.name ?? data.companyName ?? data.firmaUnvani ?? '';
      return { title: String(title).trim(), found: !!title };
    }

    // HTML response — cheerio ile parse
    if (typeof data === 'string') {
      try {
        const $ = cheerio.load(data);
        const rows: Record<string, string> = {};
        $('tr').each((_, tr) => {
          const cells = $(tr).find('td');
          if (cells.length >= 2) {
            const key = $(cells[0]).text().trim().toLowerCase();
            const val = $(cells[1]).text().trim();
            rows[key] = val;
          }
        });
        const title =
          rows['unvan'] ?? rows['mükellef unvanı'] ?? rows['ad soyad / unvan'] ??
          $('[id*="unvan"], [class*="unvan"]').first().text().trim() ?? '';
        return { title: title.trim(), found: !!title.trim() };
      } catch {
        return { title: '', found: false };
      }
    }

    return { title: '', found: false };
  }

  /**
   * TC Kimlik No doğrulama — algoritma tabanlı (NVI servisi yerine)
   */
  verifyIdentity(tcNo: string): { verified: boolean; method: string } {
    const s = tcNo.replace(/\s/g, '');

    if (!/^\d{11}$/.test(s)) {
      throw new BadRequestException('TC kimlik numarası 11 haneli olmalıdır');
    }

    if (s[0] === '0') {
      return { verified: false, method: 'algorithm' };
    }

    const digits = s.split('').map(Number);

    // 10. hane kontrolü
    const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
    const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
    let tenth = ((oddSum * 7) - evenSum) % 10;
    if (tenth < 0) tenth += 10;
    if (tenth !== digits[9]) {
      return { verified: false, method: 'algorithm' };
    }

    // 11. hane kontrolü
    const sum10 = digits.slice(0, 10).reduce((a, b) => a + b, 0);
    if (sum10 % 10 !== digits[10]) {
      return { verified: false, method: 'algorithm' };
    }

    return { verified: true, method: 'algorithm' };
  }

  /**
   * IBAN doğrulama — Türkiye IBAN kuralları + Mod 97 (ISO 13616)
   */
  verifyIban(iban: string): IbanVerifyResult {
    const s = iban.replace(/\s/g, '').toUpperCase();

    if (!s.startsWith('TR') || s.length !== 26 || !/^TR\d{24}$/.test(s)) {
      return { valid: false };
    }

    // Mod 97 kontrolü
    const rearranged = s.slice(4) + s.slice(0, 4);
    const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));

    let remainder = BigInt(0);
    for (const ch of numeric) {
      remainder = (remainder * BigInt(10) + BigInt(parseInt(ch, 10))) % BigInt(97);
    }

    if (remainder !== BigInt(1)) {
      return { valid: false };
    }

    const bankCode = s.slice(4, 9);
    const bankName = BANK_CODES[bankCode];

    return { valid: true, ...(bankName ? { bankName } : {}) };
  }
}
