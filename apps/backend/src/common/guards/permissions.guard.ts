import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ['*'], // Admin has all permissions
  OFFICE_STAFF: [
    'customer.view', 'customer.create', 'customer.update',
    'claim_file.view', 'claim_file.create', 'claim_file.update', 'claim_file.assign',
    'vendor.view', 'vendor.create', 'vendor.update',
    'adjuster.view',
    'report.view', 'report.create',
    'document.view', 'document.upload',
    'budget.view', 'budget.create',
    'task.view', 'task.create', 'task.update',
    'dashboard.view',
    'operation_inbox.view', 'operation_inbox.manage',
    'role.view', 'role.manage',
  ],
  FIELD_STAFF: [
    'customer.view',
    'claim_file.view', 'claim_file.update',
    'report.view', 'report.create',
    'budget.view', 'budget.create',
    'task.view', 'task.update',
  ],
  FINANS: [
    'customer.view',
    'vendor.view', 'vendor.create', 'vendor.update', 'vendor.delete',
    'claim_file.view',
    'invoice.view', 'invoice.create', 'invoice.update',
    'budget.view', 'budget.create', 'budget.review',
    'payment.view', 'payment.create', 'payment.update',
    'report.view',
    'operation_inbox.view', 'operation_inbox.manage',
  ],
  ACCOUNTANT: [
    'customer.view', 'claim_file.view',
    'invoice.view', 'invoice.create', 'invoice.update',
    'payment.view',
    'budget.view', 'budget.review',
    'report.view',
    'operation_inbox.view',
  ],
  MANAGER: [
    'claim_file.view', 'claim_file.create', 'claim_file.update', 'claim_file.assign', 'claim_file.status_change',
    'customer.view', 'customer.create', 'customer.update',
    'dashboard.view',
    'document.upload', 'document.view',
    'insurance_company.view',
    'invoice.create', 'invoice.delete', 'invoice.update', 'invoice.view',
    'location.view',
    'note.create', 'note.update', 'note.view',
    'payment.create', 'payment.update', 'payment.view',
    'report.view',
    'task.complete', 'task.create', 'task.update', 'task.view',
    'user.create', 'user.update', 'user.view',
    'bank_account.create', 'bank_account.delete', 'bank_account.update', 'bank_account.view',
    'operation_inbox.view', 'operation_inbox.manage',
  ],
  ADJUSTER: [
    'claim_file.view', 'claim_file.update', 'claim_file.status_change',
    'document.upload', 'document.view',
    'note.create', 'note.view',
    'task.complete', 'task.view',
  ],
  EXPERT: [
    'claim_file.view', 'claim_file.create', 'claim_file.update',
    'document.upload', 'document.view',
    'note.create', 'note.view',
    'report.view',
  ],
  INSURANCE_COMPANY_USER: [
    'claim_file.view',
    'document.view',
    'invoice.view',
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
    const rawRoleCode = user.roleCode?.toUpperCase() ?? '';
    const roleCode = rawRoleCode === 'FINANCE' || rawRoleCode === 'FINANS' ? 'FINANS' : rawRoleCode;
    if (roleCode === 'ADMIN') {
      return true;
    }

    const dbPermissions = user.permissions || [];
    const roleDefaults = ROLE_DEFAULT_PERMISSIONS[roleCode] || [];

    let effectivePermissions = dbPermissions;
    if (process.env.PERMISSION_FALLBACK_ENABLED === 'true') {
      if (dbPermissions.length === 0) {
        console.warn('FALLBACK_PERMISSION_USED', { userId: user.userId, roleCode });
        effectivePermissions = roleDefaults;
      } else {
        effectivePermissions = [...new Set([...dbPermissions, ...roleDefaults])];
      }
    }

    const hasPermission = requiredPermissions.some((permission) =>
      effectivePermissions.includes(permission)
      || effectivePermissions.includes('*')
      || roleDefaults.includes(permission)
      || roleDefaults.includes('*'),
    );

    if (!hasPermission) {
      throw new ForbiddenException('Bu işlem için yetkiniz yok');
    }

    return true;
  }
}
