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
  whyTitle?: string;
  whyPoints: string[];
  actions: Array<{
    title: string;
    description: string;
  }>;
  highlightsTitle: string;
  stepThreeTitle: string;
  stepThreeDescription: string;
  guideFileName: string;
  hideBanner?: boolean;
  storyTitle?: string;
  storyBody?: string;
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

/** Panoya alma ipucu — HTML e-postada clipboard API yok; şifre `user-select:all`. */
const WELCOME_PASSWORD_COPY_ICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
)}`;

const PORTAL_WELCOME_TITLE = "Meridyen Hasar Yönetim Platformu'na Hoş Geldiniz";
const INSURANCE_BROKER_SUBJECT =
  'Meridyen Hasar Yönetim Platformu -> Dosya İzleme Erişiminiz Hazır';
const INSURANCE_BROKER_HIGHLIGHT =
  'Meridyen Hasar Yönetim Platformu;\nKonut, Endüstriyel Ve Denizcilik hasar dosyaları asistans hizmetlerimizde hızlı, şeffaf ve değer katarak operasyonel verimliliğinizi artırmak için yenilendik.';
const INSURANCE_BROKER_STORY =
  'Meridyen Hasar Yönetim Platformu ile eksper kanalı ile şirketiniz adına yürütülen tüm hasar onarım süreçlerini dijital ortamdan, anlık olarak izleyebilirsiniz. Telefon ve e-posta trafiğine gerek kalmadan dosyalarınızın güncel durumuna her an erişebilirsiniz.';
const INSURANCE_BROKER_WHY = [
  'Dosya Durumu Takibi : Şirketinize ait tüm hasar dosyalarını tek panelden görüntüleyin. Hangi aşamada, ne zaman tamamlanacak?',
  'Onarım Sürecini Canlı İzleme : Dosyalarınızın onarım aşamalarını, saha fotoğraflarını ve durum güncellemelerini adım adım takip edin.',
  'Evrak ve Rapor Erişimi : Onarım raporları, onarım faturaları, hasar fotoğrafları ve tüm dosya evrakları dijital ortamda, 7/24 erişilebilir.',
  'Her Cihazdan Güvenli Erişim : Masaüstü, tablet veya mobil - ofiste ya da sahada, güvenli giriş ile her yerden erişim.',
];
const ASSISTANCE_SUBJECT = "Meridyen Dosya Yönetim Platformu'na Hoş Geldiniz";
const ASSISTANCE_HIGHLIGHT =
  'Acil yardım dosyalarınızı artık ihbardan kapanışa kadar tek platformdan yönetebilirsiniz.\nSaha operasyon hizmetlerimizde; Hızlı, Şeffaf Ve Değer Katarak operasyon verimliliğinizi arttırmak için yenilendik.';
const ASSISTANCE_STORY =
  'Saha operasyonlarımızı; izleyip "tedarikçi nerede?" sorularına son verin, dosyanın hangi aşamada olduğunu, sahada ne olduğunu ve ne beklediğini her an görebilirsiniz.';
const ASSISTANCE_WHY = [
  'Dosya Yönetimi : İhbar alımından dosya kapanışına kadar tüm dosyaları aşama bazında takip edin. Her dosyanın durumunu tek panelden görün.',
  'Dijital Evrak ve Onay : Dijital onay sistemi ile zaman tasarrufu,',
  'Otomatik Kapanış Raporu : Dosya tamamlandığında kapanış raporu PDF olarak iletilir.',
  'Anket Sonuçları : Her dosya kapanışında yapılan anket sonuçları dönem bazlı toplu olarak raporlanır.',
];

const ROLE_CONTENT: Record<WelcomeEmailRole, RoleTemplateContent> = {
  EXPERT: {
    subject: PORTAL_WELCOME_TITLE,
    welcomeTitle: PORTAL_WELCOME_TITLE,
    valuePitch: 'Konut, endüstriyel ve denizcilik hasar dosyalarında asistans.',
    intro: '',
    fieldHighlight:
      'Meridyen Hasar Yönetim Platformu;\nKonut, Endüstriyel Ve Denizcilik hasar dosyaları asistans hizmetlerimizde hızlı, şeffaf ve değer katarak operasyonel verimliliğinizi artırmak için yenilendik.',
    whyTitle: 'Platformla neler yapabilirsiniz?',
    whyPoints: [
      'Mobil Uyumlu Tasarım — Masaüstü, tablet veya telefondan tam erişim,',
      'Sahadan Anlık İhbar ve Dosya Açma — Saha ekibiniz mobil cihazdan ihbar oluşturabilir, lokasyon ve detay girebilir,',
      'Fotoğraf ve Evrak Yönetimi — Hasar fotoğrafları ve hasar ihbarına konu evrakları dijital ortamda yükleme,',
      'Tek Ekrandan Dosya Takibi — Onarım raporlarınızın durumunu tek panelden izleyin.',
      'Ve daha bir çok özellik... — ',
    ],
    actions: [],
    highlightsTitle: '',
    stepThreeTitle: 'Portale Geçin',
    stepThreeDescription: 'Eksper portalındaki dosya ve onay ekranlarını açın.',
    guideFileName: '03-eksper-portal-tanitim.pdf',
  },
  INSURANCE_COMPANY: {
    subject: INSURANCE_BROKER_SUBJECT,
    welcomeTitle: PORTAL_WELCOME_TITLE,
    valuePitch: 'Hasar onarım süreçlerini dijital ortamdan anlık izleyin.',
    intro: INSURANCE_BROKER_STORY,
    fieldHighlight: INSURANCE_BROKER_HIGHLIGHT,
    storyTitle: 'Sizin İçin Ne Değişiyor?',
    whyTitle: 'Platform ile Neler Yapabilirsiniz?',
    whyPoints: INSURANCE_BROKER_WHY,
    actions: [],
    highlightsTitle: '',
    stepThreeTitle: 'Dosya Takibe Geçin',
    stepThreeDescription: 'Dosya Takip ekranından yetkili dosyalarınızı açın.',
    guideFileName: '02-sigorta-portal-kilavuzu.pdf',
  },
  BROKER: {
    subject: INSURANCE_BROKER_SUBJECT,
    welcomeTitle: PORTAL_WELCOME_TITLE,
    valuePitch: 'Hasar onarım süreçlerini dijital ortamdan anlık izleyin.',
    intro: INSURANCE_BROKER_STORY,
    fieldHighlight: INSURANCE_BROKER_HIGHLIGHT,
    storyTitle: 'Sizin İçin Ne Değişiyor?',
    whyTitle: 'Platform ile Neler Yapabilirsiniz?',
    whyPoints: INSURANCE_BROKER_WHY,
    actions: [],
    highlightsTitle: '',
    stepThreeTitle: 'Dosya Takibe Geçin',
    stepThreeDescription: 'Yetkili dosya ve onay ekranlarını açın.',
    guideFileName: '04-broker-portal-kilavuzu.pdf',
  },
  ASSISTANCE_COMPANY: {
    subject: ASSISTANCE_SUBJECT,
    welcomeTitle: ASSISTANCE_SUBJECT,
    valuePitch: 'Acil yardım dosyalarını ihbardan kapanışa kadar tek platformdan yönetin.',
    intro: ASSISTANCE_STORY,
    fieldHighlight: ASSISTANCE_HIGHLIGHT,
    storyTitle: 'Sizin İçin Ne Değişiyor?',
    whyTitle: 'Platform ile Neler Yapabilirsiniz?',
    whyPoints: ASSISTANCE_WHY,
    actions: [],
    highlightsTitle: '',
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

function buildGreetingLine(role: WelcomeEmailRole, recipientName?: string): string {
  if (role === 'EXPERT') {
    return 'Değerli Eksperimiz ve Ekibi;';
  }
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
  const labelHtml = label
    ? `<div style="font-size:12px;font-weight:800;color:${COLORS.blue};margin-bottom:6px;">${escapeHtml(label)}</div>`
    : '';
  const lines = highlight.split('\n').map((line) => line.trim()).filter(Boolean);
  const highlightHtml =
    lines.length > 1
      ? `<div style="font-size:15px;font-weight:800;line-height:1.45;color:${COLORS.navy};margin:0 0 8px;">${escapeHtml(lines[0])}</div>
          <div style="font-size:15px;font-weight:800;line-height:1.55;color:${COLORS.navy};">${escapeHtml(lines.slice(1).join(' '))}</div>`
      : `<div style="font-size:15px;font-weight:800;line-height:1.45;color:${COLORS.navy};">${escapeHtml(highlight)}</div>`;
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#EFF6FF;border:1px solid #93C5FD;border-left:4px solid ${COLORS.blue};border-radius:10px;">
      <tr>
        <td style="padding:14px 16px;">
          ${labelHtml}
          ${highlightHtml}
        </td>
      </tr>
    </table>`;
}

function whyBox(points: string[], title = 'Meridyen ile Neler Kazanırsınız?'): string {
  const items = points
    .map((point) => {
      const sep = ' — ';
      const splitAt = point.indexOf(sep);
      if (splitAt === -1) {
        const colonSep = ' : ';
        const colonAt = point.indexOf(colonSep);
        if (colonAt !== -1) {
          const itemTitle = escapeHtml(point.slice(0, colonAt));
          const itemBody = escapeHtml(point.slice(colonAt + colonSep.length).trim());
          return `
        <tr>
          <td style="padding:0 0 8px;font-size:13px;line-height:1.5;color:${COLORS.ink};">
            <span style="color:${COLORS.blue};font-weight:800;margin-right:6px;">✓</span><b style="font-weight:700;color:${COLORS.navy};">${itemTitle} :</b><span> ${itemBody}</span>
          </td>
        </tr>`;
        }
        return `
        <tr>
          <td style="padding:0 0 8px;font-size:13px;line-height:1.5;color:${COLORS.ink};">
            <span style="color:${COLORS.blue};font-weight:800;margin-right:6px;">✓</span>${escapeHtml(point)}
          </td>
        </tr>`;
      }
      const itemTitle = escapeHtml(point.slice(0, splitAt));
      const itemBody = escapeHtml(point.slice(splitAt + sep.length).trim());
      const square = `<span style="display:inline-block;width:6px;height:6px;background:${COLORS.navy};margin:0 8px 1px 0;vertical-align:middle;"></span>`;
      if (!itemBody) {
        return `
        <tr>
          <td style="padding:0 0 10px;font-size:14px;line-height:1.55;color:#0F172A;">
            ${square}<span style="font-weight:800;color:${COLORS.navy};">${itemTitle}</span>
          </td>
        </tr>`;
      }
      return `
        <tr>
          <td style="padding:0 0 10px;font-size:14px;line-height:1.55;color:#0F172A;">
            ${square}<span style="font-weight:800;color:${COLORS.navy};">${itemTitle}:</span><span style="font-weight:400;color:#0F172A;"> ${itemBody}</span>
          </td>
        </tr>`;
    })
    .join('');
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;">
      <tr>
        <td style="padding:16px 18px;">
          <div style="font-size:14px;font-weight:800;color:${COLORS.navy};margin-bottom:4px;">${escapeHtml(title)}</div>
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
  const greetingLine = buildGreetingLine(role, data.recipientName);
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
                  <td colspan="2" style="padding:0;border-top:1px solid ${COLORS.border};background:${COLORS.blue};">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:14px 16px;">
                          <div style="font-size:13px;font-weight:800;color:#FFFFFF;margin-bottom:8px;">Geçici Şifre</div>
                          <span class="welcome-temp-pwd" tabindex="0" data-pwd="${escapeHtml(temporaryPassword)}" onclick="try{navigator.clipboard.writeText(this.getAttribute('data-pwd'))}catch(e){}" style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:18px;font-weight:800;color:#FFFFFF;letter-spacing:.04em;word-break:break-all;-webkit-user-select:all;user-select:all;">${escapeHtml(temporaryPassword)}<span class="welcome-temp-pwd-copy" aria-hidden="true"><img src="${WELCOME_PASSWORD_COPY_ICON}" width="16" height="16" alt="" style="display:block;border:0;outline:none;" /></span></span>
                          <div style="font-size:13px;font-weight:600;color:#FFFFFF;margin-top:10px;line-height:1.5;">İlk girişte bu şifreyi kullanın; ardından kişisel şifrenizi belirleyin.</div>
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

  const bannerTitleStyle =
    content.welcomeTitle.length > 70
      ? 'font-size:18px;line-height:1.4;'
      : 'font-size:20px;line-height:1.28;';

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(content.subject)}</title>
  <style>
    .welcome-temp-pwd { position: relative; display: inline-block; cursor: pointer; }
    .welcome-temp-pwd-copy {
      position: absolute;
      left: 100%;
      bottom: 2px;
      margin-left: 8px;
      width: 16px;
      height: 16px;
      opacity: 0;
      pointer-events: none;
      user-select: none;
      transition: opacity .16s ease;
    }
    .welcome-temp-pwd:hover .welcome-temp-pwd-copy,
    .welcome-temp-pwd:focus .welcome-temp-pwd-copy {
      opacity: 1;
    }
  </style>
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

          ${
            content.hideBanner
              ? ''
              : `<tr>
            <td style="padding:16px 20px;background:linear-gradient(135deg,#0b2847 0%,#123A63 55%,#1E5AA8 100%);">
              <h1 style="margin:0;${bannerTitleStyle}font-weight:800;color:#ffffff;">${escapeHtml(content.welcomeTitle)}</h1>
            </td>
          </tr>`
          }

          <tr>
            <td style="padding:24px 22px 26px;background:#ffffff;">
              ${
                organizationName
                  ? `<div style="font-size:13px;font-weight:800;color:${COLORS.navy};letter-spacing:.01em;margin:0 0 2px;">${escapeHtml(organizationName)}</div>`
                  : ''
              }
              <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${COLORS.ink};font-weight:700;">${escapeHtml(greetingLine)}</p>
              ${content.fieldHighlight ? fieldHighlightBox(content.fieldHighlightLabel ?? content.storyTitle ?? '', content.fieldHighlight) : ''}
              ${
                content.intro
                  ? `<p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:${COLORS.muted};">${escapeHtml(content.intro)}</p>`
                  : ''
              }
              ${whyBox(content.whyPoints, content.whyTitle)}

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

              ${
                content.actions.length
                  ? `<div style="font-size:15px;font-weight:800;color:${COLORS.ink};margin:0 0 12px;">${escapeHtml(content.highlightsTitle)}</div>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                ${actionGrid2Col(content.actions)}
              </table>`
                  : ''
              }

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
    content.fieldHighlight || '',
    content.storyTitle || '',
    content.storyBody || '',
    content.intro,
    accountEmail || temporaryPassword ? '\nGiriş Bilgileri:' : '',
    `Giriş Adresi: ${portalUrl}`,
    accountEmail ? `E-posta: ${accountEmail}` : '',
    temporaryPassword ? `Geçici Şifre: ${temporaryPassword}` : '',
    data.forcePasswordChange ? 'Güvenliğiniz için ilk girişinizde şifrenizi değiştirmeniz zorunludur.' : '',
    '',
    `${content.whyTitle ?? 'Meridyen ile Neler Kazanırsınız?'}:`,
    ...content.whyPoints.map((point) => `- ${point}`),
    '',
    '3 Adımda Başlayın:',
    '1. Sisteme geçici şifrenizle giriş yapın.',
    '2. İlk girişte yeni şifrenizi belirleyin.',
    `3. ${content.stepThreeTitle} — ${content.stepThreeDescription}`,
    '',
    ...(content.actions.length
      ? [content.highlightsTitle ? `${content.highlightsTitle}:` : '', ...content.actions.map((action, index) => `${index + 1}. ${action.title} - ${action.description}`), '']
      : []),
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
