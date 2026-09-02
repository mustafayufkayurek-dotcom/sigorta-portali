import { resolveWelcomeEmailLogoUrl } from './email-brand.util';

export type WelcomeEmailRole =
  | 'EXPERT'
  | 'INSURANCE_COMPANY'
  | 'BROKER'
  | 'ASSISTANCE_COMPANY'
  | 'MERIDYEN_STAFF';

export interface WelcomeEmailData {
  recipientName?: string;
  organizationName?: string;
  portalUrl?: string;
  supportEmail?: string;
  guideUrl?: string;
  accountEmail?: string;
  temporaryPassword?: string;
  forcePasswordChange?: boolean;
}

export interface WelcomeEmailAttachment {
  filename: string;
  path: string;
  cid: string;
}

export interface WelcomeEmailRenderResult {
  subject: string;
  html: string;
  text: string;
  role: WelcomeEmailRole;
  guideFileName: string;
  attachments: WelcomeEmailAttachment[];
}

interface RoleTemplateContent {
  subject: string;
  welcomeTitle: string;
  valuePitch: string;
  intro: string;
  fieldHighlightLabel?: string;
  fieldHighlight?: string;
  whyPoints: string[];
  actions: Array<{
    title: string;
    description: string;
  }>;
  highlightsTitle: string;
  stepThreeTitle: string;
  stepThreeDescription: string;
  guideFileName: string;
}

const DEFAULT_PORTAL_URL = 'https://app.meridyen-tr.com/giris';
const DEFAULT_SUPPORT_EMAIL = 'destek@meridyen-tr.com';
const BRAND_NAME = 'Meridyen Asistans';
const BRAND_AFFILIATION = 'Safran Birleşik Hizmetler Yan Kuruluşudur.';
const WELCOME_SUBJECT = "Meridyen Operasyon Platformu'na Hoş Geldiniz";
const GENERIC_GREETING = 'Sayın Kullanıcımız,';

const COLORS = {
  navy: '#123A63',
  blue: '#1E5AA8',
  surface: '#F8FAFC',
  border: '#E2E8F0',
  ink: '#0F172A',
  muted: '#64748B',
  amber: '#B45309',
};

const PORTAL_WELCOME_TITLE = "Meridyen Hasar Yönetim Platformu'na Hoş Geldiniz";

const ROLE_CONTENT: Record<WelcomeEmailRole, RoleTemplateContent> = {
  EXPERT: {
    subject: PORTAL_WELCOME_TITLE,
    welcomeTitle: PORTAL_WELCOME_TITLE,
    valuePitch: 'Sahadan ihbar, sesli not ve dosya takibini eksper portalından yürütün.',
    intro:
      'Eksper portalında size bağlı dosyaları görür, sahadan ihbar açar, fotoğraf ve evrak iletirsiniz. Adres ve açıklamayı sesli notla bırakabilirsiniz.',
    fieldHighlight:
      'Sahada ihbar açarken adres ve açıklamayı konuşarak iletebilirsiniz. Konuşmanız metne dönüşür; yazım sizi bekletmez.',
    fieldHighlightLabel: 'Önemli — Sesli Not',
    whyPoints: [
      'Sahadan ihbar...',
      'Sesli not özellikleri...',
      'Fotoğraf ve evrak yükleme...',
      'Rapor ve onayları tek ekrandan izleme...',
    ],
    actions: [
      {
        title: 'Sahadan İhbar',
        description: 'Sahadan ihbar...',
      },
      {
        title: 'Sesli Not',
        description: 'Sesli not özellikleri...',
      },
      {
        title: 'Fotoğraf ve Evrak',
        description: 'Fotoğraf ve evrak yükleme...',
      },
      {
        title: 'Rapor ve Onay',
        description: 'Rapor ve onayları tek ekrandan izleme...',
      },
    ],
    highlightsTitle: 'Eksper Portalında Öne Çıkanlar',
    stepThreeTitle: 'Portale Geçin',
    stepThreeDescription: 'Eksper portalındaki dosya ve onay ekranlarını açın.',
    guideFileName: '03-eksper-portal-tanitim.pdf',
  },
  INSURANCE_COMPANY: {
    subject: PORTAL_WELCOME_TITLE,
    welcomeTitle: PORTAL_WELCOME_TITLE,
    valuePitch: 'Yetkili hasar dosyalarınızı izleyin, onaylayın ve evrakları görün.',
    intro:
      'Dosya Takip ekranında yetkili olduğunuz hasar dosyalarını izler, bekleyen onayları yanıtlar, evrakları görürsünüz.',
    fieldHighlightLabel: 'Önemli — Dosya Takip',
    fieldHighlight:
      'Günlük işiniz Dosya Takip ekranındadır. Dosyalar, bekleyen onaylar, canlı izle ve evraklar bu alandan açılır.',
    whyPoints: [
      'Yetkili hasar dosyalarının listesi ve durum takibi',
      'Bekleyen onayları yanıtlama',
      'Canlı İzle ile dosya ilerleyişi',
      'Dosyaya bağlı faturaları görüntüleme',
    ],
    actions: [
      {
        title: 'Dosya Takip',
        description: 'Yetkili dosyaların özetini ve son hareketleri görün.',
      },
      {
        title: 'Dosyalar',
        description: 'Konu, durum ve sorumlu ile dosya listesini açın.',
      },
      {
        title: 'Bekleyen Onaylar',
        description: 'Onay taleplerini görüntüleyin, onaylayın veya gerekçeli reddedin.',
      },
      {
        title: 'Canlı İzle',
        description: 'Dosyanın güncel aşamasını izleyin.',
      },
      {
        title: 'Faturalar',
        description: 'Yetkili olduğunuz dosyalara bağlı faturaları görüntüleyin.',
      },
      {
        title: 'Operasyon Ağı',
        description: 'Dosyanın operasyon görünümünü takip edin.',
      },
    ],
    highlightsTitle: 'Sayfanızda Öne Çıkanlar',
    stepThreeTitle: 'Dosya Takibe Geçin',
    stepThreeDescription: 'Dosya Takip ekranından yetkili dosyalarınızı açın.',
    guideFileName: '02-sigorta-portal-kilavuzu.pdf',
  },
  BROKER: {
    subject: PORTAL_WELCOME_TITLE,
    welcomeTitle: PORTAL_WELCOME_TITLE,
    valuePitch: 'Broker kapsamındaki hasar dosyalarını izleyin ve onayları yanıtlayın.',
    intro:
      'Yetkili olduğunuz broker kapsamındaki hasar dosyalarını listeler, onay taleplerini yanıtlar ve dosyaya bağlı faturaları görürsünüz.',
    fieldHighlightLabel: 'Önemli — Dosya Takibi',
    fieldHighlight:
      'İşiniz yetkili dosyaları izlemek ve onayları yanıtlamaktır.',
    whyPoints: [
      'Broker kapsamındaki dosyaların liste ve durum takibi',
      'Bekleyen onayları yanıtlama',
      'Dosyaya bağlı faturaları görüntüleme',
      'Dosya ilerleyişini tek ekrandan izleme',
    ],
    actions: [
      {
        title: 'Dosyalar',
        description: 'Yetkili hasar dosyalarını konu ve durumla listeleyin.',
      },
      {
        title: 'Bekleyen Onaylar',
        description: 'Onay taleplerini görüntüleyin ve yanıtlayın.',
      },
      {
        title: 'Dosya Durumu',
        description: 'Her dosyanın güncel aşamasını izleyin.',
      },
      {
        title: 'Faturalar',
        description: 'Yetkili dosyalara bağlı faturaları görüntüleyin.',
      },
    ],
    highlightsTitle: 'Sayfanızda Öne Çıkanlar',
    stepThreeTitle: 'Dosya Takibe Geçin',
    stepThreeDescription: 'Yetkili dosya ve onay ekranlarını açın.',
    guideFileName: '04-broker-portal-kilavuzu.pdf',
  },
  ASSISTANCE_COMPANY: {
    subject: PORTAL_WELCOME_TITLE,
    welcomeTitle: PORTAL_WELCOME_TITLE,
    valuePitch: 'Yetkili acil yardım dosyalarını izleyin ve onayları yanıtlayın.',
    intro:
      'Asistans portalında yetkili olduğunuz acil yardım dosyalarını izler, bekleyen onayları yanıtlar ve dosyaya bağlı faturaları görürsünüz.',
    fieldHighlightLabel: 'Önemli — Acil Dosya Takibi',
    fieldHighlight:
      'Bu ekran acil yardım dosyalarını izlemek içindir.',
    whyPoints: [
      'Yetkili acil yardım dosyalarının listesi',
      'Bekleyen onayları yanıtlama',
      'Canlı İzle ile dosya ilerleyişi',
      'Dosyaya bağlı faturaları görüntüleme',
    ],
    actions: [
      {
        title: 'Dosya Takip',
        description: 'Yetkili acil yardım dosyalarının özetini görün.',
      },
      {
        title: 'Dosyalar',
        description: 'Acil yardım dosyalarını konu ve durumla listeleyin.',
      },
      {
        title: 'Bekleyen Onaylar',
        description: 'Onay taleplerini görüntüleyin ve yanıtlayın.',
      },
      {
        title: 'Canlı İzle',
        description: 'Dosyanın güncel aşamasını izleyin.',
      },
      {
        title: 'Faturalar',
        description: 'Yetkili dosyalara bağlı faturaları görüntüleyin.',
      },
    ],
    highlightsTitle: 'Sayfanızda Öne Çıkanlar',
    stepThreeTitle: 'Dosya Takibe Geçin',
    stepThreeDescription: 'Asistans portalındaki acil dosyalarınızı açın.',
    guideFileName: '01-personel-kullanim-kilavuzu.pdf',
  },
  MERIDYEN_STAFF: {
    subject: WELCOME_SUBJECT,
    welcomeTitle: WELCOME_SUBJECT,
    valuePitch: 'Günlük operasyon önceliklerinizi tek merkezden yönetin.',
    intro:
      'Hasar ve acil yardım dosyalarını yönetebilir, Operasyon Merkezi üzerinden günlük öncelikleri görebilirsiniz. Tedarikçi ve finans ekranları yetkiniz açıksa görünür.',
    fieldHighlightLabel: 'Önemli — Operasyon Merkezi',
    fieldHighlight:
      'Operasyon Merkezi ile günün öncelikli işlerini, bekleyen aksiyonları ve darboğazları tek ekrandan okuyabilirsiniz.',
    whyPoints: [
      'Hasar ve acil yardım dosyalarını panelden yönetim',
      'Operasyon Merkezi ile günlük öncelik görünümü',
      'Dosya, evrak ve onay akışlarında sorumluluk takibi',
      'Tedarikçi ve finans ekranlarına yetkiniz varsa erişim',
    ],
    actions: [
      {
        title: 'Hasar Dosyaları',
        description: 'Yeni dosya açın, durum güncelleyin ve süreci yönetin.',
      },
      {
        title: 'Acil Yardım',
        description: 'Acil yardım dosyalarının operasyon akışını takip edin.',
      },
      {
        title: 'Operasyon Merkezi',
        description: 'Günün öncelikli işleri ve bekleyen aksiyonları görün.',
      },
      {
        title: 'Müşteri ve Tedarikçi',
        description: 'Yetkiniz açıksa müşteri ve tedarikçi kayıtlarını yönetin.',
      },
      {
        title: 'Evrak ve Dijital Onay',
        description: 'Evrak yükleyin ve onay süreçlerini başlatın.',
      },
      {
        title: 'Finans',
        description: 'Yetkiniz açıksa fatura, masraf ve tahsilat ekranlarını açın.',
      },
    ],
    highlightsTitle: 'Operasyon Alanınızda Öne Çıkanlar',
    stepThreeTitle: 'Paneli Kullanın',
    stepThreeDescription: 'Yetkinize açık operasyon ekranlarına geçin.',
    guideFileName: '01-personel-kullanim-kilavuzu.pdf',
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildGreetingLine(recipientName?: string): string {
  const name = recipientName?.trim();
  if (!name) {
    return GENERIC_GREETING;
  }
  return `Sayın ${name},`;
}

function miniActionCard(action: RoleTemplateContent['actions'][number], index: number): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COLORS.border};border-radius:10px;background:#ffffff;height:100%;">
      <tr>
        <td style="padding:14px;">
          <div style="width:26px;height:26px;border-radius:8px;background:${COLORS.blue};color:#ffffff;font-size:13px;font-weight:700;line-height:26px;text-align:center;margin-bottom:8px;">${index}</div>
          <div style="font-size:14px;font-weight:700;color:${COLORS.ink};margin-bottom:4px;line-height:1.35;">${escapeHtml(action.title)}</div>
          <div style="font-size:12px;line-height:1.45;color:${COLORS.muted};">${escapeHtml(action.description)}</div>
        </td>
      </tr>
    </table>`;
}

function actionGrid2Col(actions: RoleTemplateContent['actions']): string {
  let rows = '';
  for (let i = 0; i < actions.length; i += 2) {
    const left = miniActionCard(actions[i], i + 1);
    const right = actions[i + 1] ? miniActionCard(actions[i + 1], i + 2) : '&nbsp;';
    rows += `
      <tr>
        <td width="50%" valign="top" style="padding:0 6px 12px 0;">${left}</td>
        <td width="50%" valign="top" style="padding:0 0 12px 6px;">${actions[i + 1] ? right : ''}</td>
      </tr>`;
  }
  return rows;
}

function compactStepCell(title: string, description: string, index: number): string {
  return `
    <td width="33.33%" valign="top" style="padding:0 4px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COLORS.border};border-radius:10px;background:#ffffff;height:100%;">
        <tr>
          <td style="padding:14px 12px;">
            <div style="width:24px;height:24px;border-radius:999px;background:${COLORS.navy};color:#ffffff;font-size:12px;font-weight:700;line-height:24px;text-align:center;margin-bottom:8px;">${index}</div>
            <div style="font-size:13px;font-weight:700;color:${COLORS.ink};margin-bottom:4px;line-height:1.35;">${escapeHtml(title)}</div>
            <div style="font-size:11px;line-height:1.45;color:${COLORS.muted};">${escapeHtml(description)}</div>
          </td>
        </tr>
      </table>
    </td>`;
}

function fieldHighlightBox(label: string, highlight: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#EFF6FF;border:1px solid #93C5FD;border-left:4px solid ${COLORS.blue};border-radius:10px;">
      <tr>
        <td style="padding:14px 16px;">
          <div style="font-size:12px;font-weight:800;color:${COLORS.blue};margin-bottom:6px;">${escapeHtml(label)}</div>
          <div style="font-size:15px;font-weight:800;line-height:1.45;color:${COLORS.navy};">${escapeHtml(highlight)}</div>
        </td>
      </tr>
    </table>`;
}

function whyBox(points: string[]): string {
  const items = points
    .map(
      (point) => `
        <tr>
          <td style="padding:0 0 8px;font-size:13px;line-height:1.5;color:${COLORS.ink};">
            <span style="color:${COLORS.blue};font-weight:800;margin-right:6px;">✓</span>${escapeHtml(point)}
          </td>
        </tr>`,
    )
    .join('');
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;">
      <tr>
        <td style="padding:14px 16px;">
          <div style="font-size:14px;font-weight:800;color:${COLORS.navy};margin-bottom:8px;">Meridyen ile Neler Kazanırsınız?</div>
          <table width="100%" cellpadding="0" cellspacing="0">${items}</table>
        </td>
      </tr>
    </table>`;
}

function isLocalAppHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return true;
  }
}

/** Hoş geldin mailindeki giriş adresi canlı sitedir; lokal host yazılmaz. */
export function resolveWelcomeLoginUrl(portalUrl?: string): string {
  const raw = (portalUrl ?? DEFAULT_PORTAL_URL).trim() || DEFAULT_PORTAL_URL;
  if (isLocalAppHost(raw)) {
    return DEFAULT_PORTAL_URL;
  }
  return raw;
}

export function generateWelcomeEmail(
  role: WelcomeEmailRole,
  data: WelcomeEmailData = {},
): WelcomeEmailRenderResult {
  const content = ROLE_CONTENT[role];
  const portalUrl = resolveWelcomeLoginUrl(data.portalUrl);
  const supportEmail = data.supportEmail ?? DEFAULT_SUPPORT_EMAIL;
  const organizationName = data.organizationName?.trim();
  const greetingLine = buildGreetingLine(data.recipientName);
  const guideUrl = data.guideUrl;
  const accountEmail = data.accountEmail?.trim();
  const temporaryPassword = data.temporaryPassword?.trim();
  const escapedPortalUrl = escapeHtml(portalUrl);
  const escapedSupportEmail = escapeHtml(supportEmail);
  const escapedGuideFile = escapeHtml(content.guideFileName);
  const logoUrl = resolveWelcomeEmailLogoUrl(portalUrl);
  const escapedLogoUrl = escapeHtml(logoUrl);

  const guideButton = guideUrl
    ? `<a href="${escapeHtml(guideUrl)}" style="display:inline-block;border:1px solid ${COLORS.blue};background:#ffffff;color:${COLORS.blue};text-decoration:none;padding:12px 18px;border-radius:8px;font-size:13px;font-weight:700;" title="${escapedGuideFile}">Kullanım Kılavuzunu İndir veya İncele</a>`
    : '';

  const primaryCta = `<a href="${escapedPortalUrl}" style="display:inline-block;background:${COLORS.blue};color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:8px;font-size:14px;font-weight:800;box-shadow:0 4px 12px rgba(30,90,168,.28);">Meridyen'e Giriş Yap</a>`;

  const accountInfoBlock =
    accountEmail || temporaryPassword
      ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border:1px solid ${COLORS.border};border-radius:10px;overflow:hidden;background:#ffffff;">
                <tr>
                  <td colspan="2" style="padding:14px 16px;background:${COLORS.surface};font-size:14px;font-weight:800;color:${COLORS.navy};">Giriş Bilgileri</td>
                </tr>
                <tr>
                  <td style="width:34%;padding:12px 16px;border-top:1px solid ${COLORS.border};font-size:13px;font-weight:700;color:${COLORS.muted};background:#ffffff;">Giriş Adresi</td>
                  <td style="padding:12px 16px;border-top:1px solid ${COLORS.border};font-size:14px;color:${COLORS.ink};word-break:break-word;">
                    <a href="${escapedPortalUrl}" style="color:${COLORS.blue};text-decoration:none;word-break:break-all;">${escapedPortalUrl}</a>
                  </td>
                </tr>
                ${
                  accountEmail
                    ? `
                <tr>
                  <td style="width:34%;padding:12px 16px;border-top:1px solid ${COLORS.border};font-size:13px;font-weight:700;color:${COLORS.muted};background:#ffffff;">E-posta</td>
                  <td style="padding:12px 16px;border-top:1px solid ${COLORS.border};font-size:14px;color:${COLORS.ink};word-break:break-word;">${escapeHtml(accountEmail)}</td>
                </tr>`
                    : ''
                }
                ${
                  temporaryPassword
                    ? `
                <tr>
                  <td colspan="2" style="padding:0;border-top:1px solid ${COLORS.border};background:#0F172A;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:14px 16px;">
                          <div style="font-size:12px;font-weight:700;color:#CBD5E1;margin-bottom:6px;">Geçici Şifre</div>
                          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:18px;font-weight:800;color:#FFFFFF;letter-spacing:.04em;word-break:break-all;">${escapeHtml(temporaryPassword)}</div>
                          <div style="font-size:11px;color:#94A3B8;margin-top:6px;line-height:1.45;">İlk girişte bu şifreyi kullanın; ardından kişisel şifrenizi belirleyin.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`
                    : ''
                }
              </table>`
      : '';

  const passwordChangeNotice = data.forcePasswordChange
    ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;">
                <tr>
                  <td style="padding:16px;">
                    <div style="font-size:14px;font-weight:800;color:${COLORS.amber};margin-bottom:6px;">İlk giriş güvenlik adımı</div>
                    <div style="font-size:13px;line-height:1.6;color:#7C2D12;">Güvenliğiniz için ilk girişinizde şifrenizi değiştirmeniz zorunludur.</div>
                  </td>
                </tr>
              </table>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.surface};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${COLORS.ink};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.surface};padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${COLORS.border};box-shadow:0 8px 24px rgba(15,23,42,.06);">
          <tr>
            <td style="padding:8px 20px 8px;background:#ffffff;border-bottom:2px solid ${COLORS.blue};">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="right" style="vertical-align:top;">
                    <img src="${escapedLogoUrl}" alt="Meridyen Asistans" width="120" style="display:block;width:120px;max-width:100%;height:auto;margin:0 0 0 auto;border:0;outline:none;text-decoration:none;"/>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 20px 14px;background:linear-gradient(135deg,#0b2847 0%,#123A63 55%,#1E5AA8 100%);">
              <h1 style="margin:0;font-size:20px;line-height:1.28;font-weight:800;color:#ffffff;">${escapeHtml(content.welcomeTitle)}</h1>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 22px 26px;background:#ffffff;">
              ${
                organizationName
                  ? `<div style="font-size:13px;font-weight:800;color:${COLORS.navy};letter-spacing:.01em;margin:0 0 2px;">${escapeHtml(organizationName)}</div>`
                  : ''
              }
              <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${COLORS.ink};font-weight:700;">${escapeHtml(greetingLine)}</p>
              ${content.fieldHighlight && content.fieldHighlightLabel ? fieldHighlightBox(content.fieldHighlightLabel, content.fieldHighlight) : ''}
              <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:${COLORS.muted};">${escapeHtml(content.intro)}</p>

              ${whyBox(content.whyPoints)}

              ${accountInfoBlock}
              ${passwordChangeNotice}

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
                <tr>
                  <td align="center" style="padding:0 0 8px;">${primaryCta}</td>
                </tr>
                <tr>
                  <td align="center" style="font-size:12px;color:${COLORS.muted};">Hesabınız hazır — giriş yaparak hemen başlayabilirsiniz.</td>
                </tr>
              </table>

              <div style="font-size:15px;font-weight:800;color:${COLORS.ink};margin:0 0 12px;">3 Adımda Başlayın</div>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
                <tr>
                  ${compactStepCell('Geçici Şifre ile Giriş', 'Giriş bilgilerinizi karttan kullanın.', 1)}
                  ${compactStepCell('Şifrenizi Güncelleyin', 'İlk oturumda kişisel şifrenizi belirleyin.', 2)}
                  ${compactStepCell(content.stepThreeTitle, content.stepThreeDescription, 3)}
                </tr>
              </table>

              <div style="font-size:15px;font-weight:800;color:${COLORS.ink};margin:0 0 12px;">${escapeHtml(content.highlightsTitle)}</div>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
                ${actionGrid2Col(content.actions)}
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                <tr>
                  <td align="center">${primaryCta}</td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg,#F8FAFC 0%,#EFF6FF 100%);border:1px solid ${COLORS.border};border-radius:10px;">
                <tr>
                  <td style="padding:18px 16px;text-align:center;">
                    <div style="font-size:14px;font-weight:800;color:${COLORS.navy};margin-bottom:6px;">Kullanım Kılavuzu</div>
                    <div style="font-size:13px;line-height:1.6;color:${COLORS.muted};margin-bottom:12px;">
                      İlk kullanım adımları için kullanım kılavuzunu indirebilir veya inceleyebilirsiniz.
                    </div>
                    ${guideButton}
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;">
                <tr>
                  <td style="padding:16px;">
                    <div style="font-size:14px;font-weight:800;color:${COLORS.amber};margin-bottom:6px;">Güvenlik Notu</div>
                    <div style="font-size:13px;line-height:1.6;color:#7C2D12;">Giriş bilgilerinizi kimseyle paylaşmayın. Şüpheli bir durum görürseniz Meridyen destek ekibiyle iletişime geçin.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 28px;background:${COLORS.surface};border-top:1px solid ${COLORS.border};">
              <p style="margin:0 0 4px;font-size:12px;color:${COLORS.muted};text-align:center;">Destek: <a href="mailto:${escapedSupportEmail}" style="color:${COLORS.blue};text-decoration:none;">${escapedSupportEmail}</a></p>
              <p style="margin:0 0 4px;font-size:12px;font-weight:800;color:${COLORS.navy};text-align:center;">${BRAND_NAME}</p>
              <p style="margin:0;font-size:12px;color:${COLORS.muted};text-align:center;">${BRAND_AFFILIATION}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    content.subject,
    '',
    organizationName ? organizationName : '',
    greetingLine,
    '',
    content.intro,
    accountEmail || temporaryPassword ? '\nGiriş Bilgileri:' : '',
    `Giriş Adresi: ${portalUrl}`,
    accountEmail ? `E-posta: ${accountEmail}` : '',
    temporaryPassword ? `Geçici Şifre: ${temporaryPassword}` : '',
    data.forcePasswordChange ? 'Güvenliğiniz için ilk girişinizde şifrenizi değiştirmeniz zorunludur.' : '',
    '',
    'Meridyen ile Neler Kazanırsınız?:',
    ...content.whyPoints.map((point) => `- ${point}`),
    '',
    '3 Adımda Başlayın:',
    '1. Sisteme geçici şifrenizle giriş yapın.',
    '2. İlk girişte yeni şifrenizi belirleyin.',
    `3. ${content.stepThreeTitle} — ${content.stepThreeDescription}`,
    '',
    `${content.highlightsTitle}:`,
    ...content.actions.map((action, index) => `${index + 1}. ${action.title} - ${action.description}`),
    '',
    `Portal: ${portalUrl}`,
    '',
    'Kullanım kılavuzunu indirebilir veya inceleyebilirsiniz.',
    guideUrl ? `Kılavuz: ${guideUrl}` : `Kılavuz dosyası: ${content.guideFileName}`,
    '',
    'Güvenlik notu: Giriş bilgilerinizi kimseyle paylaşmayın. Şüpheli bir durum görürseniz Meridyen destek ekibiyle iletişime geçin.',
    '',
    `Destek: ${supportEmail}`,
    '',
    'İyi çalışmalar,',
    BRAND_NAME,
    BRAND_AFFILIATION,
  ]
    .filter((line) => line !== '')
    .join('\n');

  return {
    subject: content.subject,
    html,
    text,
    role,
    guideFileName: content.guideFileName,
    attachments: [],
  };
}
