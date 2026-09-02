import { buildSurveyReportHtml } from './survey-report.template';

describe('buildSurveyReportHtml', () => {
  it('uses live welcome logo scale 120px', () => {
    const html = buildSurveyReportHtml({
      period: 'Ağustos 2026',
      year: 2026,
      month: 8,
      insuranceCompanyName: 'Ray Sigorta',
      insuranceCompanyEmail: 'ornek@ray.com',
      totalSent: 10,
      totalCompleted: 8,
      responseRate: 80,
      averages: { q1: 4, q2: 4, q3: 4, q4: 4, q5: 4, overall: 4 },
      recommendRate: 80,
      trend: [],
      highlights: [],
      lowScoreComments: [],
    });
    expect(html).toContain('width="120"');
    expect(html).toContain('width:120px');
    expect(html).toContain('meridyen-logo-original.png');
    expect(html).not.toContain('196px');
    expect(html).toContain('Ağustos 2026 Müşteri Memnuniyet Raporu');
    expect(html).toContain('Müdahale hızı');
    expect(html).toContain('Süreç boyunca bilgilendirme');
    expect(html).not.toContain('(Meridyen Assistance)');
    expect(html).not.toContain('Meridyen Assistance)');
  });
});
