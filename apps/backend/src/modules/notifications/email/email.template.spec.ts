import { buildWelcomeInviteEmailHtml } from './email.template';

describe('buildWelcomeInviteEmailHtml', () => {
  it('renders copy-friendly temporary password block and production login URL', () => {
    const html = buildWelcomeInviteEmailHtml({
      fullName: 'Ayşe Yılmaz',
      email: 'ayse@ornek.com',
      temporaryPassword: 'fPNt#T6n%th5',
      loginUrl: 'https://app.meridyen-tr.com/giris',
    });

    expect(html).toContain('fPNt#T6n%th5');
    expect(html).toContain('Kopyala');
    expect(html).toContain('user-select:all');
    expect(html).toContain('https://app.meridyen-tr.com/giris');
    expect(html).not.toContain('localhost');
  });
});
