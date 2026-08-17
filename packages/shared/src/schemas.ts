import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi giriniz'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır'),
});

export const registerSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi giriniz'),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalıdır'),
  firstName: z.string().min(2, 'Ad en az 2 karakter olmalıdır'),
  lastName: z.string().min(2, 'Soyad en az 2 karakter olmalıdır'),
  phone: z.string().optional(),
  roleId: z.string().uuid('Geçerli bir rol seçiniz'),
  branchId: z.string().uuid().optional(),
});

export const createClaimFileSchema = z.object({
  insuranceCompanyId: z.string().uuid('Geçerli bir sigorta şirketi seçiniz'),
  policyNo: z.string().min(1, 'Poliçe numarası giriniz'),
  claimNo: z.string().min(1, 'Hasar numarası giriniz'),
  productBranch: z.string().min(1, 'Ürün branşı giriniz'),
  lossType: z.string().min(1, 'Hasar türü giriniz'),
  incidentDate: z.string(),
  notificationDate: z.string(),
  priority: z.string().optional(),
  sourceChannel: z.string().optional(),
  customerId: z.string().uuid().optional(),
  propertyType: z.string().optional(),
  propertyAddressId: z.string().uuid().optional(),
  description: z.string().optional(),
});

export const createNoteSchema = z.object({
  claimFileId: z.string().uuid(),
  noteType: z.string(),
  content: z.string().min(1, 'Not içeriği giriniz'),
  isPrivate: z.boolean().optional(),
});

export const createTaskSchema = z.object({
  claimFileId: z.string().uuid(),
  taskType: z.string(),
  title: z.string().min(1, 'Görev başlığı giriniz'),
  description: z.string().optional(),
  priority: z.string(),
  assignedUserId: z.string().uuid().optional(),
  dueAt: z.string().optional(),
});
