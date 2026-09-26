import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { assertNewPassword, hashPassword, verifyPassword } from '@/common/security/password-hash';
import * as https from 'https';
import * as querystring from 'querystring';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { normalizeEmailAddress } from '@/common/utils/normalize-email';
import { buildAppPath } from '@/common/utils/app-url';
import { createHash, randomInt } from 'crypto';
import { AuthTokens, RegisterDto, mergeAcilFileOwnerPermissions, roleRequiresLoginEmailCode, formatLoginEmailCodeForMail } from '@sigorta/shared';
import { OperationalAccessGrantsService } from '../operational-access-grants/operational-access-grants.service';
import { EmailService } from '@/modules/notifications/email/email.service';
import { buildTransactionalEmailHtml, formatSnPersonGreeting, isMeridyenStaffRole, organizationLineForMail } from '@/modules/notifications/email/email.template';

function normalizeAuthEmail(email: string): string {
  return normalizeEmailAddress(email);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private operationalAccessGrants: OperationalAccessGrantsService,
    private email: EmailService,
  ) {}

  private async findActiveUserByEmail(normalizedEmail: string) {
    return this.prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
      include: { role: true },
    });
  }

  async validateUser(email: string, password: string): Promise<any> {
    const normalizedEmail = normalizeAuthEmail(email);
    if (!normalizedEmail) {
      return null;
    }

    const user = await this.findActiveUserByEmail(normalizedEmail);

    if (!user) {
      return null;
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Hesabınız aktif değil');
    }

    if (user.email !== normalizedEmail) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { email: normalizedEmail },
      });
      user.email = normalizedEmail;
    }

    const { passwordHash, ...result } = user;
    return result;
  }

  async login(loginDto: { email: string; password: string; recaptchaToken?: string }): Promise<
    | { user: any; tokens: AuthTokens }
    | { requiresEmailCode: true; challengeId: string }
  > {
    const normalizedEmail = normalizeAuthEmail(loginDto.email);
    if (normalizedEmail.endsWith('@example.com')) {
      throw new UnauthorizedException(
        'Bu email adresi ile giriş yapılamaz. Lütfen gerçek email adresinizi kullanın.',
      );
    }

    if (loginDto.recaptchaToken) {
      const captchaOk = await this.verifyCaptcha(loginDto.recaptchaToken);
      if (!captchaOk) {
        throw new UnauthorizedException('Robot doğrulaması başarısız. Lütfen tekrar deneyin.');
      }
    }

    const user = await this.validateUser(normalizedEmail, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('E-posta veya şifre hatalı');
    }

    if (roleRequiresLoginEmailCode(user.role?.code)) {
      const challenge = await this.startLoginEmailChallenge(user);
      if (challenge) {
        return challenge;
      }
    }

    return this.issueLoginSession(user.id, user.email);
  }

  async register(registerDto: RegisterDto): Promise<{ user: any; tokens: AuthTokens }> {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new BadRequestException('Bu e-posta adresi zaten kullanılıyor');
    }

    // Check if role exists
    const role = await this.prisma.role.findUnique({
      where: { id: registerDto.roleId },
    });

    if (!role) {
      throw new BadRequestException('Geçersiz rol');
    }

    // Hash password
    const hashedPassword = await hashPassword(assertNewPassword(registerDto.password));

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        passwordHash: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        phone: registerDto.phone,
        roleId: registerDto.roleId,
        branchId: registerDto.branchId,
        status: 'active',
      },
    });

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    const userData = await this.getUserWithPermissions(user.id);

    return {
      user: userData,
      tokens,
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.config.get('JWT_SECRET'),
      });

      // Check if refresh token exists and not revoked
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
      });

      if (!storedToken || storedToken.revokedAt) {
        throw new UnauthorizedException('Geçersiz refresh token');
      }

      if (new Date() > storedToken.expiresAt) {
        throw new UnauthorizedException('Refresh token süresi dolmuş');
      }

      const owner = await this.prisma.user.findUnique({
        where: { id: storedToken.userId },
        select: { id: true, email: true, status: true },
      });
      if (!owner || owner.status !== 'active') {
        await this.prisma.refreshToken.update({
          where: { id: storedToken.id },
          data: { revokedAt: new Date() },
        });
        throw new UnauthorizedException('Hesabınız aktif değil');
      }

      const tokens = await this.generateTokens(owner.id, owner.email);

      // Revoke old token and save new one
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });
      await this.saveRefreshToken(payload.sub, tokens.refreshToken);

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Geçersiz refresh token');
    }
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        token: refreshToken,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async getMe(userId: string): Promise<any> {
    return this.getUserWithPermissions(userId);
  }

  async verifyLoginEmailCode(challengeId: string, code: string): Promise<{ user: any; tokens: AuthTokens }> {
    const challenge = await this.prisma.loginEmailChallenge.findUnique({
      where: { id: challengeId },
      include: { user: { include: { role: true } } },
    });
    if (!challenge || challenge.consumedAt) {
      throw new UnauthorizedException('Kod geçersiz veya süresi doldu');
    }
    if (new Date() > challenge.expiresAt) {
      throw new UnauthorizedException('Kod geçersiz veya süresi doldu');
    }
    if (challenge.user.status !== 'active') {
      throw new UnauthorizedException('Hesabınız aktif değil');
    }
    if (challenge.attemptCount >= 5) {
      throw new UnauthorizedException('Kod çok kez denendi. Yeniden giriş yapın.');
    }

    const expected = this.hashLoginEmailCode(code);
    if (expected !== challenge.codeHash) {
      await this.prisma.loginEmailChallenge.update({
        where: { id: challenge.id },
        data: { attemptCount: { increment: 1 } },
      });
      throw new UnauthorizedException('Kod hatalı');
    }

    await this.prisma.loginEmailChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    return this.issueLoginSession(challenge.userId, challenge.user.email);
  }

  async resendLoginEmailCode(
    challengeId: string,
  ): Promise<{ requiresEmailCode: true; challengeId: string }> {
    const challenge = await this.prisma.loginEmailChallenge.findUnique({
      where: { id: challengeId },
      include: { user: { include: { role: true } } },
    });
    if (!challenge || challenge.consumedAt || challenge.user.status !== 'active') {
      throw new UnauthorizedException('Kod yeniden gönderilemedi. Şifre ile tekrar deneyin.');
    }
    const next = await this.startLoginEmailChallenge(challenge.user);
    if (!next) {
      throw new BadRequestException('Kod gönderilemedi. Biraz sonra tekrar deneyin.');
    }
    return next;
  }

  private async issueLoginSession(userId: string, email: string): Promise<{ user: any; tokens: AuthTokens }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
    const tokens = await this.generateTokens(userId, email);
    await this.saveRefreshToken(userId, tokens.refreshToken);
    const userData = await this.getUserWithPermissions(userId);
    return { user: userData, tokens };
  }

  private async startLoginEmailChallenge(user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    role?: { code?: string | null } | null;
  }): Promise<{ requiresEmailCode: true; challengeId: string } | null> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.loginEmailChallenge.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const row = await this.prisma.loginEmailChallenge.create({
      data: {
        userId: user.id,
        codeHash: this.hashLoginEmailCode(code),
        expiresAt,
      },
    });
    const mailNumber = formatLoginEmailCodeForMail(code);
    const html = buildTransactionalEmailHtml({
      title: 'Giriş Onayı',
      greeting: formatSnPersonGreeting(user.firstName, user.lastName),
      intro: 'Aşağıdaki sayıyı kopyalayıp giriş ekranında Yapıştır ile yazın. 10 dakika geçerlidir. Bu talebi siz oluşturmadıysanız yok sayın.',
      bodyHtml: `<p style="margin:0 0 12px;font-size:28px;line-height:1.2;font-weight:800;font-family:ui-monospace,Menlo,Consolas,monospace;">Sayı ${mailNumber}</p>`,
      portalUrl: buildAppPath(this.config, '/giris'),
    });
    const result = await this.email.sendEmail(
      user.email,
      'Giriş Onayı — Meridyen Assistance',
      html,
      {
        text: `Giriş sayısı (10 dakika geçerli): ${mailNumber}\nSayıyı kopyalayıp giriş ekranına dönün.`,
        mailbox: 'HASAR',
        requestReadReceipt: false,
      },
    );
    if (!result.sent) {
      await this.prisma.loginEmailChallenge.update({
        where: { id: row.id },
        data: { consumedAt: new Date() },
      });
      this.logger.error(`Giriş kodu gönderilemedi → ${user.email} | ${result.errorMsg}`);
      return null;
    }
    return { requiresEmailCode: true, challengeId: row.id };
  }

  private hashLoginEmailCode(code: string): string {
    const secret = String(this.config.get<string>('JWT_SECRET') ?? '').trim();
    if (!secret) {
      throw new Error('Giriş kodu anahtarı yok');
    }
    return createHash('sha256').update(`${String(code).trim()}|${secret}`).digest('hex');
  }

  private async generateTokens(userId: string, email: string): Promise<AuthTokens> {
    const payload = { sub: userId, email };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private async saveRefreshToken(userId: string, token: string): Promise<void> {
    const decoded: any = this.jwtService.decode(token);
    const expiresAt = new Date(decoded.exp * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  async forgotPassword(email: string): Promise<{ requested: true }> {
    const normalizedEmail = normalizeAuthEmail(email);
    const user = await this.findActiveUserByEmail(normalizedEmail);

    if (!user || user.status !== 'active') {
      return { requested: true };
    }

    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const resetUrl = buildAppPath(this.config, `/giris/sifre-sifirla?token=${encodeURIComponent(token)}`);
    const organizationName = await this.resolvePasswordResetOrganization(user);
    const html = buildTransactionalEmailHtml({
      title: 'Şifre Sıfırlama',
      organizationName,
      greeting: formatSnPersonGreeting(
        (user as { firstName?: string | null }).firstName,
        (user as { lastName?: string | null }).lastName,
      ),
      intro: 'Hesabınız için şifre sıfırlama talebi alındı. Bağlantı 1 saat geçerlidir.',
      actionUrl: resetUrl,
      actionLabel: 'Şifreyi Sıfırla',
      footerNote: 'Bu talebi siz oluşturmadıysanız bu e-postayı yok sayın.',
      portalUrl: buildAppPath(this.config, '/giris'),
    });
    const result = await this.email.sendEmail(
      user.email,
      'Şifre Sıfırlama — Meridyen Assistance',
      html,
      { text: `Şifre sıfırlama bağlantısı (1 saat geçerli): ${resetUrl}` },
    );

    if (!result.sent) {
      this.logger.error(`Şifre sıfırlama e-postası gönderilemedi → ${user.email} | ${result.errorMsg}`);
      throw new BadRequestException(
        result.errorMsg
        || 'E-posta gönderilemedi. Ayarlar → E-posta Bildirimleri mail kurulumunu kontrol edin.',
      );
    }

    return { requested: true };
  }

  private async resolvePasswordResetOrganization(user: {
    id: string;
    email: string;
    role?: { code?: string | null } | null;
  }): Promise<string | undefined> {
    const roleCode = user.role?.code;
    if (isMeridyenStaffRole(roleCode)) return undefined;

    const code = String(roleCode ?? '').trim().toLowerCase();
    if (code === 'expert') {
      const row = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { adjuster: { select: { company: true, name: true } } },
      });
      return organizationLineForMail(
        row?.adjuster?.company?.trim() || row?.adjuster?.name?.trim(),
        roleCode,
      );
    }
    if (code === 'insurance_company_user') {
      const scope = await this.prisma.userInsuranceCompanyScope.findFirst({
        where: { userId: user.id },
        select: { insuranceCompany: { select: { name: true } } },
      });
      return organizationLineForMail(scope?.insuranceCompany?.name, roleCode);
    }
    if (code === 'assistance_company_user') {
      const scope = await this.prisma.userAssistantCustomerScope.findFirst({
        where: { userId: user.id },
        select: {
          customer: { select: { companyName: true, fullName: true, shortName: true } },
        },
      });
      const customer = scope?.customer;
      return organizationLineForMail(
        customer?.companyName || customer?.fullName || customer?.shortName,
        roleCode,
      );
    }
    if (code === 'broker_user') {
      const firm = await this.prisma.customer.findFirst({
        where: {
          status: 'active',
          subType: 'broker_firmasi',
          email: { equals: user.email, mode: 'insensitive' },
        },
        select: { companyName: true, fullName: true, shortName: true },
      });
      return organizationLineForMail(
        firm?.companyName || firm?.fullName || firm?.shortName,
        roleCode,
      );
    }
    return undefined;
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken || resetToken.usedAt) {
      throw new BadRequestException('Token geçersiz veya süresi dolmuş');
    }

    if (new Date() > resetToken.expiresAt) {
      throw new BadRequestException('Token geçersiz veya süresi dolmuş');
    }

    const hashedPassword = await hashPassword(assertNewPassword(newPassword));

    await this.prisma.user.update({
      where: { id: resetToken.userId },
      data: {
        passwordHash: hashedPassword,
        mustChangePassword: false,
        temporaryPasswordIssuedAt: null,
      },
    });

    await this.prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });
  }

  private async verifyCaptcha(token: string): Promise<boolean> {
    const secretKey = this.config.get<string>('RECAPTCHA_SECRET_KEY');
    if (!secretKey) {
      return false;
    }
    return new Promise((resolve) => {
      const postData = querystring.stringify({ secret: secretKey, response: token });
      const req = https.request(
        {
          hostname: 'www.google.com',
          path: '/recaptcha/api/siteverify',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed.success === true);
            } catch {
              resolve(false);
            }
          });
        },
      );
      req.on('error', () => resolve(false));
      req.write(postData);
      req.end();
    });
  }

  private async getUserWithPermissions(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        branch: true,
        departmentMemberships: {
          where: { isActive: true },
          include: {
            department: {
              select: { id: true, code: true, name: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        userInsuranceCompanyScopes: {
          include: {
            insuranceCompany: true,
          },
        },
        userAssistantCustomerScopes: {
          include: {
            customer: {
              select: {
                id: true,
                companyName: true,
                fullName: true,
                shortName: true,
                subType: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Kullanıcı bulunamadı');
    }

    const operationalAccessGrants = await this.operationalAccessGrants.getGrantSummaryForUser(userId);
    const hasAcilFunctionDelegation = await this.operationalAccessGrants.hasFunctionDelegation(
      userId,
      'acil_yardim',
    );

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      jobTitle: user.jobTitle ?? null,
      phone: user.phone,
      status: user.status,
      adjusterId: user.adjusterId ?? null,
      role: {
        id: user.role.id,
        code: user.role.code,
        name: user.role.name,
      },
      branch: user.branch,
      permissions: mergeAcilFileOwnerPermissions(
        user.role.rolePermissions.map((rp) => rp.permission.code),
        hasAcilFunctionDelegation,
      ),
      insuranceCompanyScopes: user.userInsuranceCompanyScopes.map((s) => ({
        id: s.insuranceCompany.id,
        code: s.insuranceCompany.code,
        name: s.insuranceCompany.name,
      })),
      assistantCustomerScopes: user.userAssistantCustomerScopes.map((s) => ({
        id: s.customer.id,
        name: (s.customer.companyName ?? s.customer.fullName ?? s.customer.shortName ?? '').trim() || 'Asistans Firması',
        shortName: (s.customer.shortName ?? '').trim() || null,
        subType: s.customer.subType,
      })),
      customerShortName:
        (user.userAssistantCustomerScopes[0]?.customer.shortName ?? '').trim() || null,
      departmentMemberships: user.departmentMemberships.map((m) => ({
        departmentId: m.departmentId,
        isPrimary: m.isPrimary,
        department: m.department
          ? { id: m.department.id, code: m.department.code, name: m.department.name }
          : null,
      })),
      operationalAccessGrants,
      isMobileUser: user.isMobileUser,
      isWebUser: user.isWebUser,
      lastLoginAt: user.lastLoginAt,
      mustChangePassword: user.mustChangePassword,
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Kullanıcı bulunamadı');
    }

    const isCurrentPasswordValid = await verifyPassword(oldPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Mevcut şifre hatalı');
    }

    const passwordHash = await hashPassword(assertNewPassword(newPassword));
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        temporaryPasswordIssuedAt: null,
      },
    });
  }
}
