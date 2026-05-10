export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
  branchId?: string;
  insuranceCompanyScopes?: string[];
}

export interface LoginDto {
  email: string;
  password: string;
  recaptchaToken?: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roleId: string;
  branchId?: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface ChangePasswordDto {
  oldPassword: string;
  newPassword: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface CreateClaimFileDto {
  insuranceCompanyId: string;
  policyNo: string;
  claimNo: string;
  productBranch: string;
  lossType: string;
  incidentDate: string;
  notificationDate: string;
  priority?: string;
  sourceChannel?: string;
  customerId?: string;
  propertyType?: string;
  propertyAddressId?: string;
  description?: string;
}

export interface UpdateClaimFileDto {
  policyNo?: string;
  claimNo?: string;
  productBranch?: string;
  lossType?: string;
  incidentDate?: string;
  priority?: string;
  description?: string;
  estimatedCostAmount?: number;
  approvedBudgetAmount?: number;
}

export interface AssignClaimFileDto {
  assignedBranchId?: string;
  assignedTeamId?: string;
  assignedFieldUserId?: string;
  assignedOfficeUserId?: string;
  assignedAdjusterId?: string;
}

export interface ChangeClaimStatusDto {
  toStatusId: string;
  note?: string;
}

export interface CreateNoteDto {
  claimFileId: string;
  noteType: string;
  content: string;
  isPrivate?: boolean;
}

export interface CreateTaskDto {
  claimFileId: string;
  taskType: string;
  title: string;
  description?: string;
  priority: string;
  assignedUserId?: string;
  dueAt?: string;
}

export interface CompleteTaskDto {
  note?: string;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileKey: string;
  fileAssetId: string;
}

export interface CompleteUploadDto {
  fileAssetId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface CreateDocumentDto {
  claimFileId: string;
  fileAssetId: string;
  documentType: string;
  versionNo?: number;
}
