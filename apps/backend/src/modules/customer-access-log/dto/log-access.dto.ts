export interface LogAccessDto {
  userId: string;
  customerId: string;
  claimFileId?: string;
  accessType: 'view' | 'call' | 'export';
  ipAddress?: string;
  userAgent?: string;
}
