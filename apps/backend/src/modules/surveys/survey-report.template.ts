import { resolveWelcomeEmailLogoUrl } from '../notifications/email/email-brand.util';

export interface SurveyReportData {
  period: string; // "Nisan 2026"
  year: number;
  month: number;
  /** Alıcı ünvanı — sigorta, asistans, eksper veya broker */
  insuranceCompanyName: string;
  insuranceCompanyEmail: string;
  totalSent: number;
  totalCompleted: number;
  responseRate: number; // yüzde
  averages: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
    q5: number;
    overall: number;
  };
  recommendRate: number; // yüzde
  trend: Array<{ period: string; overall: number; count: number }>;
  highlights: string[]; // olumlu yorumlar (q7)
  lowScoreComments: string[]; // puan < 3 olan yorumlar
}

function starBar(score: number): string {
  const full = Math.round(score);
  return '★'.repeat(full) + '☆'.repeat(5 - full) + ` (${score.toFixed(1)}/5)`;
}

function scoreColor(score: number): string {
  if (score >= 4.5) return '#16a34a';
  if (score >= 3.5) return '#ca8a04';
  return '#dc2626';
}

export function buildSurveyReportHtml(data: SurveyReportData): string {
  const trendRows = data.trend
    .map(
      (t) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${t.period}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:${scoreColor(t.overall)};font-weight:600;">${t.overall.toFixed(2)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${t.count}</td>
      </tr>`,
    )
    .join('');

  const highlightItems = data.highlights
    .map((h) => `<li style="margin-bottom:8px;color:#374151;">"${h}"</li>`)
    .join('');

  const lowScoreItems = data.lowScoreComments
    .map((h) => `<li style="margin-bottom:8px;color:#374151;">"${h}"</li>`)
    .join('');

  const questionLabels = [
    'Genel hizmet memnuniyeti',
    'Müdahale hızı',
    'Süreç boyunca bilgilendirme',
    'Yapılan işin kalitesi',
    'Ekip profesyonelliği',
  ];

  const questionRows = [
    data.averages.q1,
    data.averages.q2,
    data.averages.q3,
    data.averages.q4,
    data.averages.q5,
  ]
    .map(
      (avg, i) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${questionLabels[i]}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:${scoreColor(avg)};font-weight:600;">${starBar(avg)}</td>
      </tr>`,
    )
    .join('');

  const logoUrl = resolveWelcomeEmailLogoUrl();

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Meridyen Assistance – ${data.period} Müşteri Memnuniyet Raporu</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0F172A;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 8px 24px rgba(15,23,42,.06);">

          <tr>
            <td style="padding:8px 20px;background:#ffffff;border-bottom:2px solid #1E5AA8;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="right" style="vertical-align:top;">
                    <img src="${logoUrl}" alt="Meridyen Asistans" width="120" style="display:block;width:120px;max-width:100%;height:auto;margin:0 0 0 auto;border:0;outline:none;text-decoration:none;"/>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 20px;background:linear-gradient(135deg,#0b2847 0%,#123A63 55%,#1E5AA8 100%);">
              <h1 style="margin:0;font-size:20px;line-height:1.28;font-weight:800;color:#ffffff;">${data.period} Müşteri Memnuniyet Raporu</h1>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.88);">${data.insuranceCompanyName} için hazırlanmıştır</p>
            </td>
          </tr>

          <!-- Özet kartlar -->
          <tr>
            <td style="padding:28px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="25%" align="center" style="padding:0 6px;">
                    <div style="background:#f0f9ff;border-radius:8px;padding:16px 8px;border:1px solid #bae6fd;">
                      <p style="margin:0;font-size:28px;font-weight:700;color:#0369a1;">${data.averages.overall.toFixed(2)}</p>
                      <p style="margin:4px 0 0;font-size:11px;color:#64748b;">Genel Ort. (/ 5)</p>
                    </div>
                  </td>
                  <td width="25%" align="center" style="padding:0 6px;">
                    <div style="background:#f0fdf4;border-radius:8px;padding:16px 8px;border:1px solid #bbf7d0;">
                      <p style="margin:0;font-size:28px;font-weight:700;color:#15803d;">${data.recommendRate.toFixed(0)}%</p>
                      <p style="margin:4px 0 0;font-size:11px;color:#64748b;">Tavsiye Oranı</p>
                    </div>
                  </td>
                  <td width="25%" align="center" style="padding:0 6px;">
                    <div style="background:#faf5ff;border-radius:8px;padding:16px 8px;border:1px solid #e9d5ff;">
                      <p style="margin:0;font-size:28px;font-weight:700;color:#7e22ce;">${data.totalCompleted}</p>
                      <p style="margin:4px 0 0;font-size:11px;color:#64748b;">Yanıt Sayısı</p>
                    </div>
                  </td>
                  <td width="25%" align="center" style="padding:0 6px;">
                    <div style="background:#fff7ed;border-radius:8px;padding:16px 8px;border:1px solid #fed7aa;">
                      <p style="margin:0;font-size:28px;font-weight:700;color:#c2410c;">${data.responseRate.toFixed(0)}%</p>
                      <p style="margin:4px 0 0;font-size:11px;color:#64748b;">Yanıt Oranı</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Soru bazlı puanlar -->
          <tr>
            <td style="padding:28px 32px 0;">
              <h2 style="margin:0 0 14px;font-size:16px;color:#1e3a5f;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Soru Bazlı Ortalamalar</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th style="text-align:left;padding:10px 12px;font-size:13px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Soru</th>
                    <th style="text-align:left;padding:10px 12px;font-size:13px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Puan</th>
                  </tr>
                </thead>
                <tbody>${questionRows}</tbody>
              </table>
            </td>
          </tr>

          <!-- Trend -->
          <tr>
            <td style="padding:28px 32px 0;">
              <h2 style="margin:0 0 14px;font-size:16px;color:#1e3a5f;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Son 6 Ay Trendi</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th style="text-align:left;padding:8px 12px;font-size:13px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Dönem</th>
                    <th style="text-align:left;padding:8px 12px;font-size:13px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Ort. Puan</th>
                    <th style="text-align:left;padding:8px 12px;font-size:13px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Yanıt</th>
                  </tr>
                </thead>
                <tbody>${trendRows || '<tr><td colspan="3" style="padding:12px;color:#9ca3af;text-align:center;">Henüz yeterli veri yok</td></tr>'}</tbody>
              </table>
            </td>
          </tr>

          ${
            data.highlights.length > 0
              ? `<!-- Öne çıkan yorumlar -->
          <tr>
            <td style="padding:28px 32px 0;">
              <h2 style="margin:0 0 14px;font-size:16px;color:#1e3a5f;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Öne Çıkan Olumlu Yorumlar</h2>
              <ul style="margin:0;padding-left:18px;">${highlightItems}</ul>
            </td>
          </tr>`
              : ''
          }

          ${
            data.lowScoreComments.length > 0
              ? `<!-- Dikkat gerektiren yorumlar -->
          <tr>
            <td style="padding:28px 32px 0;">
              <h2 style="margin:0 0 14px;font-size:16px;color:#7f1d1d;border-bottom:2px solid #fecaca;padding-bottom:8px;">Dikkat Gerektiren Yorumlar</h2>
              <ul style="margin:0;padding-left:18px;">${lowScoreItems}</ul>
            </td>
          </tr>`
              : ''
          }

          <!-- Footer -->
          <tr>
            <td style="padding:28px 32px;margin-top:28px;border-top:1px solid #e5e7eb;background:#f9fafb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                Bu rapor Meridyen Assistance tarafından otomatik olarak oluşturulmuştur.<br />
                ${data.period} dönemi — Toplam ${data.totalSent} anket gönderildi, ${data.totalCompleted} yanıt alındı.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
