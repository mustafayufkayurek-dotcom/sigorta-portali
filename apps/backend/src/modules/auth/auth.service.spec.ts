import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new AuthService(
      prisma,
      { signAsync: jest.fn(), decode: jest.fn() } as any,
      { get: jest.fn() } as any,
    );
  });

  it('validateUser matches email case-insensitively and normalizes stored email', async () => {
    const password = 'vQ##FXXirx7';
    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: 'user-1',
      email: 'Hasar@Safranbh.com',
      passwordHash,
      status: 'active',
      role: { id: 'role-1', code: 'field_staff', name: 'Saha Operasyon' },
    };

    prisma.user.findFirst.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue({ ...user, email: 'hasar@safranbh.com' });

    const result = await service.validateUser('hasar@safranbh.com', password);

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: { equals: 'hasar@safranbh.com', mode: 'insensitive' },
      },
      include: { role: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { email: 'hasar@safranbh.com' },
    });
    expect(result.email).toBe('hasar@safranbh.com');
    expect((result as any).passwordHash).toBeUndefined();
  });

  it('validateUser rejects inactive accounts after password check', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'hasar@safranbh.com',
      passwordHash,
      status: 'inactive',
      role: { id: 'role-1', code: 'field_staff', name: 'Saha Operasyon' },
    });

    await expect(service.validateUser('hasar@safranbh.com', 'secret123')).rejects.toThrow(
      new UnauthorizedException('Hesabınız aktif değil'),
    );
  });
});
