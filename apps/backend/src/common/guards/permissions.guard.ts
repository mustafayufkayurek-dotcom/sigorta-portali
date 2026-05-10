import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

// Default permissions per role until permission table is populated
const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ['*'], // Admin has all permissions
  OFFICE_STAFF: [
    'customer.view', 'customer.create', 'customer.update',
    'file.view', 'file.create', 'file.update', 'file.assign',
    'supplier.view', 'supplier.create', 'supplier.update',
    'expert.view',
    'report.view', 'report.create', 'report.update',
    'expense.view', 'expense.create',
    'notification.view',
    'task.view', 'task.create', 'task.update',
  ],
  FIELD_STAFF: [
    'customer.view',
    'file.view', 'file.update',
    'report.view', 'report.create', 'report.update',
    'expense.view', 'expense.create',
    'notification.view',
    'task.view', 'task.update',
  ],
  FINANS: [
    'customer.view',
    'file.view',
    'finance.view', 'finance.create', 'finance.update',
    'invoice.view', 'invoice.create', 'invoice.update',
    'expense.view', 'expense.create', 'expense.approve',
    'payment.view', 'payment.create', 'payment.update',
    'report.view',
  ],
  ACCOUNTANT: [
    'customer.view', 'file.view',
    'finance.view', 'finance.create', 'finance.update',
    'invoice.view', 'invoice.create',
    'expense.view', 'expense.approve',
    'report.view',
  ],
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Kullanıcı bilgisi bulunamadı');
    }

    // Admin role has all permissions
    const roleCode = user.roleCode?.toUpperCase();
    if (roleCode === 'ADMIN') {
      return true;
    }

    // Use DB permissions if available, otherwise fall back to role defaults
    const effectivePermissions = user.permissions?.length > 0
      ? user.permissions
      : (ROLE_DEFAULT_PERMISSIONS[roleCode] || []);

    const hasPermission = requiredPermissions.some((permission) =>
      effectivePermissions.includes(permission) || effectivePermissions.includes('*'),
    );

    if (!hasPermission) {
      throw new ForbiddenException('Bu işlem için yetkiniz yok');
    }

    return true;
  }
}
