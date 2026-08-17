import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { buildAppPath } from './app-url';

export interface DocumentBranding {
  logoUrl: string;
  companyName: string;
  companyAddress: string;
  servisVeren: string;
  servisVerenAdres: string;
  musteriHizmetleri: string;
  whatsappHatti: string;
}

const str = (v: unknown): string => (typeof v === 'string' && v.trim() ? v.trim() : '');

/**
 * Sistem ayarlarındaki `company_info`'dan evrak/form şablonlarında kullanılan
 * kurumsal kimlik bilgilerini (logo, şirket adı/adres, iletişim) tek noktadan üretir.
 * Muvafakatname, matbu evrak ve tedarikçi sözleşmesi gibi tüm form şablonları
 * bu yardımcıyı kullanarak tutarlı bir kurumsal başlık bandı oluşturur.
 */
export async function getDocumentBranding(
  prisma: PrismaService,
  config: ConfigService,
): Promise<DocumentBranding> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'company_info' },
  });
  const info = (setting?.value ?? {}) as Record<string, string | boolean | undefined>;

  const servisVeren =
    str(info.payrollEmployerName) ||
    str(info.name) ||
    'Safran Birleşik Hizmetler Tic. Ltd. Şti.';

  const servisVerenAdres =
    str(info.payrollEmployerAddress) ||
    str(info.address) ||
    '—';

  const musteriHizmetleri =
    str(info.phone) ||
    str(info.payrollEmployerPhone) ||
    '0 850 885 25 55';

  const whatsappHatti =
    str(info.payrollEmployerPhone) ||
    '0533 633 07 13';

  const companyName = str(info.name) || 'Meridyen Assistance';
  const companyAddress = str(info.address) || '—';

  const customLogo = str(info.logoUrl);
  // Müşteriye dönük evrak: kırık relative/upload yolları yerine resmi marka PNG (absolute).
  // Özel logo yalnızca geçerli http(s) ise kullanılır.
  const officialLogoPath = '/meridyen-logo-original.png';
  let logoUrl: string;
  if (/^https?:\/\//i.test(customLogo)) {
    logoUrl = customLogo;
  } else {
    logoUrl = buildAppPath(config, officialLogoPath);
  }

  return {
    logoUrl,
    companyName,
    companyAddress,
    servisVeren,
    servisVerenAdres,
    musteriHizmetleri,
    whatsappHatti,
  };
}

/** Ortak kurumsal başlık bandı — logo (sol) + şirket adı (sağ). Adres matbu/müşteri formunda yok. */
export function renderDocumentHeaderHtml(
  branding: Pick<DocumentBranding, 'logoUrl' | 'companyName' | 'companyAddress'>,
  opts?: { includeAddress?: boolean },
): string {
  const address =
    opts?.includeAddress && branding.companyAddress.trim() && branding.companyAddress !== '—'
      ? `\n      ${branding.companyAddress}`
      : '';
  return `<div class="doc-header">
    <div class="doc-header-logo">
      <img src="${branding.logoUrl}" alt="Meridyen Assistance" />
    </div>
    <div class="doc-header-meta">
      <strong>${branding.companyName}</strong>${address}
    </div>
  </div>`;
}

/** Tüm form şablonlarında paylaşılan kurumsal başlık bandı CSS'i. */
export const DOCUMENT_HEADER_STYLES = `
    .doc-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 2px solid #1a4080; padding-bottom: 14px; margin-bottom: 18px; }
    .doc-header-logo img { height: 64px; width: auto; max-width: 220px; object-fit: contain; display: block; }
    .doc-header-meta { text-align: right; font-size: 10px; color: #64748b; line-height: 1.5; }
    .doc-header-meta strong { display: block; font-size: 13px; color: #1a4080; margin-bottom: 2px; }
`;
