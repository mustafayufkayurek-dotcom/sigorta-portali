import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  let auditLogsService: any;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      department: {
        findMany: jest.fn(),
      },
      refreshToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(),
    };

    auditLogsService = {
      log: jest.fn(),
    };

    const emailService = {
      sendTemplateEmail: jest.fn().mockResolvedValue({ sent: true }),
    };

    const config = {
      get: jest.fn((_key: string, defaultValue?: string) => defaultValue),
    };

    service = new UsersService(prisma, auditLogsService, emailService as any, config as any);
  });

  describe('validateNestedUserRelations', () => {
    it('rejects department memberships with zero primary entries', async () => {
      prisma.department.findMany.mockResolvedValue([{ id: 'dep-1' }]);

      await expect(
        (service as any).validateNestedUserRelations([{ departmentId: 'dep-1', isPrimary: false }], undefined),
      ).rejects.toThrow(new BadRequestException('En az 1 adet birincil departman üyeliği zorunludur'));
    });

    it('accepts department memberships with one primary entry', async () => {
      prisma.department.findMany.mockResolvedValue([{ id: 'dep-1' }]);

      await expect(
        (service as any).validateNestedUserRelations([{ departmentId: 'dep-1', isPrimary: true }], undefined),
      ).resolves.toBeUndefined();
    });
  });

  describe('update', () => {
    it('cleans stale state and writes audit log on role switch', async () => {
      const user = { id: 'user-1', roleId: 'role-old', status: 'active', email: 'user@test.com' };
      const updatedUser = { ...user, roleId: 'role-new', passwordHash: 'hash' };
      const tx = {
        screenPermission: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
        userServiceArea: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        userDepartmentMembership: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        claimResponsibilityAssignment: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        userInsuranceCompanyScope: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        user: {
          update: jest.fn().mockResolvedValue(updatedUser),
          findUnique: jest.fn().mockResolvedValue(updatedUser),
          findUniqueOrThrow: jest.fn().mockResolvedValue(updatedUser),
        },
      };

      prisma.user.findUnique.mockResolvedValue(user);
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx));

      const result = await service.update('user-1', { roleId: 'role-new' });

      expect(tx.screenPermission.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(tx.userServiceArea.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(tx.userDepartmentMembership.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(tx.claimResponsibilityAssignment.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(auditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ROLE_SWITCH_CLEANUP',
          entityId: 'user-1',
        }),
      );
      expect(auditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TEMPORARY_PASSWORD_ISSUED',
          entityId: 'user-1',
        }),
      );
      expect(result.roleId).toBe('role-new');
      expect((result as any).passwordHash).toBeUndefined();
      expect(typeof (result as any).temporaryPassword).toBe('string');
      expect((result as any).temporaryPassword.length).toBeGreaterThanOrEqual(12);
    });

    it('does not run cleanup when role stays the same', async () => {
      const user = { id: 'user-1', roleId: 'role-old', status: 'active', email: 'user@test.com' };
      const updatedUser = { ...user, firstName: 'Ali', passwordHash: 'hash' };
      const tx = {
        screenPermission: { deleteMany: jest.fn() },
        userServiceArea: { deleteMany: jest.fn() },
        userDepartmentMembership: { deleteMany: jest.fn() },
        claimResponsibilityAssignment: { deleteMany: jest.fn() },
        user: {
          update: jest.fn().mockResolvedValue(updatedUser),
          findUniqueOrThrow: jest.fn().mockResolvedValue(updatedUser),
        },
      };

      prisma.user.findUnique.mockResolvedValue(user);
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx));

      await service.update('user-1', { firstName: 'ali' });

      expect(tx.screenPermission.deleteMany).not.toHaveBeenCalled();
      expect(auditLogsService.log).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'ROLE_SWITCH_CLEANUP' }));
    });

    it('throws when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.update('missing', { roleId: 'role-new' })).rejects.toThrow(
        new NotFoundException('Kullanıcı bulunamadı'),
      );
    });
  });
});