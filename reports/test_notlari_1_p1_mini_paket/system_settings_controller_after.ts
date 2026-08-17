import { Controller, Get, Put, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemSettingsService, MailConfig, TurmobConfig, FieldRequirementsConfig, CustomerSubType, RelationshipType, IhbarKonulari, DocumentReportTemplate, ContractTemplate, NotificationSettings, CompanyInfo, SystemConfig, SmsConfig, IntegrationConfig } from './system-settings.service';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('system-settings')
@ApiBearerAuth()
@Controller('system-settings')
@UseGuards(PermissionsGuard)
export class SystemSettingsController {
  constructor(private readonly service: SystemSettingsService) {}

  @Get('customer-fields')
  @RequirePermissions('settings.view')
  @ApiOperation({ summary: 'Müşteri alan yapılandırmasını getir' })
  async getCustomerFields() {
    const data = await this.service.getCustomerFields();
    return { success: true, data };
  }

  @Put('customer-fields')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Müşteri alan yapılandırmasını güncelle' })
  async setCustomerFields(@Body() body: { fields: any[] }) {
    const data = await this.service.setCustomerFields(body.fields);
    return { success: true, data };
  }

  @Get('vendor-types')
  @RequirePermissions('settings.view')
  @ApiOperation({ summary: 'Tedarikçi türlerini getir' })
  async getVendorTypes() {
    const data = await this.service.getVendorTypes();
    return { success: true, data };
  }

  @Put('vendor-types')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Tedarikçi türlerini güncelle' })
  async setVendorTypes(@Body() body: { types: string[] }) {
    const data = await this.service.setVendorTypes(body.types);
    return { success: true, data };
  }

  @Get('mail-config')
  @RequirePermissions('settings.view')
  @ApiOperation({ summary: 'Mail yapılandırmasını getir' })
  async getMailConfig() {
    const data = await this.service.getMailConfig();
    return { success: true, data };
  }

  @Put('mail-config')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Mail yapılandırmasını güncelle' })
  async setMailConfig(@Body() body: MailConfig) {
    const data = await this.service.setMailConfig(body);
    return { success: true, data };
  }

  @Post('mail-config/test')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Test maili gönder' })
  async sendTestMail(@Body() body: { to: string }) {
    try {
      await this.service.sendTestMail(body.to);
      return { success: true, message: `Test maili ${body.to} adresine gönderildi.` };
    } catch (err: any) {
      return { success: false, message: err?.message ?? 'SMTP yapılandırması henüz tamamlanmamış' };
    }
  }

  @Get('turmob-config')
  @RequirePermissions('settings.view')
  @ApiOperation({ summary: 'TÜRMOB entegrasyon yapılandırmasını getir' })
  async getTurmobConfig() {
    const data = await this.service.getTurmobConfig();
    // Şifreli alanları response'dan maskele
    if (data) {
      return {
        success: true,
        data: {
          ...data,
          apiKey: data.apiKey ? '***' : '',
          password: data.password ? '***' : '',
        },
      };
    }
    return { success: true, data: null };
  }

  @Put('turmob-config')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'TÜRMOB entegrasyon yapılandırmasını güncelle' })
  async setTurmobConfig(@Body() body: TurmobConfig) {
    // Eğer maskelenmiş değerler gelirse mevcut değerleri koru
    const existing = await this.service.getTurmobConfig();
    const config: TurmobConfig = {
      apiUrl: body.apiUrl ?? '',
      apiKey: body.apiKey === '***' ? (existing?.apiKey ?? '') : (body.apiKey ?? ''),
      username: body.username ?? '',
      password: body.password === '***' ? (existing?.password ?? '') : (body.password ?? ''),
      active: body.active ?? false,
    };
    const data = await this.service.setTurmobConfig(config);
    return { success: true, data: { ...data, apiKey: data.apiKey ? '***' : '', password: data.password ? '***' : '' } };
  }

  @Get('location-fields')
  @RequirePermissions('settings.view')
  @ApiOperation({ summary: 'Mahal alan zorunluluklarını getir' })
  async getLocationFields() {
    const data = await this.service.getLocationFields();
    return { success: true, data };
  }

  @Put('location-fields')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Mahal alan zorunluluklarını güncelle' })
  async setLocationFields(@Body() body: { fields: Record<string, { required: boolean }> }) {
    const data = await this.service.setLocationFields(body.fields);
    return { success: true, data };
  }

  @Get('work-group-fields')
  @RequirePermissions('settings.view')
  @ApiOperation({ summary: 'İş grubu alan zorunluluklarını getir' })
  async getWorkGroupFields() {
    const data = await this.service.getWorkGroupFields();
    return { success: true, data };
  }

  @Put('work-group-fields')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'İş grubu alan zorunluluklarını güncelle' })
  async setWorkGroupFields(@Body() body: { fields: Record<string, { required: boolean }> }) {
    const data = await this.service.setWorkGroupFields(body.fields);
    return { success: true, data };
  }

  @Get('work-sub-group-fields')
  @RequirePermissions('settings.view')
  @ApiOperation({ summary: 'İş alt grubu alan zorunluluklarını getir' })
  async getWorkSubGroupFields() {
    const data = await this.service.getWorkSubGroupFields();
    return { success: true, data };
  }

  @Put('work-sub-group-fields')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'İş alt grubu alan zorunluluklarını güncelle' })
  async setWorkSubGroupFields(@Body() body: { fields: Record<string, { required: boolean }> }) {
    const data = await this.service.setWorkSubGroupFields(body.fields);
    return { success: true, data };
  }

  @Get('unit-options')
  @RequirePermissions('settings.view')
  @ApiOperation({ summary: 'Birim seçeneklerini getir' })
  async getUnitOptions() {
    const data = await this.service.getUnitOptions();
    return { success: true, data };
  }

  @Put('unit-options')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Birim seçeneklerini güncelle' })
  async setUnitOptions(@Body() body: { options: string[] }) {
    const data = await this.service.setUnitOptions(body.options);
    return { success: true, data };
  }

  @Get('customer-sources')
  @RequirePermissions('settings.view', 'customer.view', 'customer.create')
  @ApiOperation({ summary: 'Müşteri kaynak seçeneklerini getir' })
  async getCustomerSources() {
    const data = await this.service.getCustomerSources();
    return { success: true, data };
  }

  @Put('customer-sources')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Müşteri kaynak seçeneklerini güncelle' })
  async setCustomerSources(@Body() body: { values: string[] }) {
    const data = await this.service.setCustomerSources(body.values);
    return { success: true, data };
  }

  @Get('relationship-types')
  @RequirePermissions('settings.view', 'customer.view', 'customer.create', 'adjuster.view', 'adjuster.create', 'vendor.view', 'vendor.create')
  @ApiOperation({ summary: 'İlgili kişi ilişki türlerini getir' })
  async getRelationshipTypes() {
    const data = await this.service.getRelationshipTypes();
    return { success: true, data };
  }

  @Put('relationship-types')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'İlgili kişi ilişki türlerini güncelle' })
  async setRelationshipTypes(@Body() body: { values: RelationshipType[] }) {
    const data = await this.service.setRelationshipTypes(body.values);
    return { success: true, data };
  }

  @Get('service-types')
  @RequirePermissions('settings.view', 'customer.view', 'customer.create')
  @ApiOperation({ summary: 'Özel Müşteri hizmet türlerini getir' })
  async getServiceTypes() {
    const data = await this.service.getServiceTypes();
    return { success: true, data };
  }

  @Put('service-types')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Özel Müşteri hizmet türlerini güncelle' })
  async setServiceTypes(@Body() body: { values: string[] }) {
    const data = await this.service.setServiceTypes(body.values);
    return { success: true, data };
  }

  @Get('customer-types')
  @RequirePermissions('settings.view', 'customer.view', 'customer.create')
  @ApiOperation({ summary: 'Müşteri tiplerini getir' })
  async getCustomerTypes() {
    const data = await this.service.getCustomerTypes();
    return { success: true, data };
  }

  @Put('customer-types')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Müşteri tiplerini güncelle' })
  async setCustomerTypes(@Body() body: { values: any[] }) {
    const data = await this.service.setCustomerTypes(body.values);
    return { success: true, data };
  }

  @Get('customer-sub-types')
  @RequirePermissions('settings.view', 'customer.view', 'customer.create')
  @ApiOperation({ summary: 'Müşteri alt tiplerini getir' })
  async getCustomerSubTypes() {
    const data = await this.service.getCustomerSubTypes();
    return { success: true, data };
  }

  @Put('customer-sub-types')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Müşteri alt tiplerini güncelle' })
  async setCustomerSubTypes(@Body() body: { values: CustomerSubType[] }) {
    const data = await this.service.setCustomerSubTypes(body.values);
    return { success: true, data };
  }

  @Get('field-requirements')
  @RequirePermissions('settings.view')
  @ApiOperation({ summary: 'Alan zorunluluk ayarlarını getir' })
  async getFieldRequirements() {
    const data = await this.service.getFieldRequirements();
    return { success: true, data };
  }

  @Patch('field-requirements')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Alan zorunluluk ayarlarını güncelle' })
  async setFieldRequirements(@Body() body: Partial<FieldRequirementsConfig>) {
    const data = await this.service.setFieldRequirements(body);
    return { success: true, data };
  }

  @Get('ihbar-konulari')
  @Public()
  @ApiOperation({ summary: 'İhbar konularını getir (hasar ve acil kategorileri)' })
  async getIhbarKonulari() {
    const data = await this.service.getIhbarKonulari();
    return { success: true, data };
  }

  @Put('ihbar-konulari')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'İhbar konularını güncelle' })
  async setIhbarKonulari(@Body() body: IhbarKonulari) {
    const data = await this.service.setIhbarKonulari(body);
    return { success: true, data };
  }

  // ── Document Report Templates ────────────────────────────────────────────

  @Get('document-report-templates')
  @RequirePermissions('settings.view')
  @ApiOperation({ summary: 'Belge rapor şablonlarını getir' })
  async getDocumentReportTemplates() {
    const data = await this.service.getDocumentReportTemplates();
    return { success: true, data };
  }

  @Post('document-report-templates')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Belge rapor şablonu oluştur' })
  async createDocumentReportTemplate(@Body() body: Omit<DocumentReportTemplate, 'id' | 'createdAt' | 'updatedAt'>) {
    const data = await this.service.createDocumentReportTemplate(body);
    return { success: true, data };
  }

  @Put('document-report-templates/:id')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Belge rapor şablonu güncelle' })
  async updateDocumentReportTemplate(@Param('id') id: string, @Body() body: Partial<DocumentReportTemplate>) {
    const data = await this.service.updateDocumentReportTemplate(id, body);
    return { success: true, data };
  }

  @Delete('document-report-templates/:id')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Belge rapor şablonu sil' })
  async deleteDocumentReportTemplate(@Param('id') id: string) {
    await this.service.deleteDocumentReportTemplate(id);
    return { success: true };
  }

  // ── Contract Templates ───────────────────────────────────────────────────

  @Get('contract-templates')
  @RequirePermissions('settings.view')
  @ApiOperation({ summary: 'Sözleşme şablonlarını getir' })
  async getContractTemplates() {
    const data = await this.service.getContractTemplates();
    return { success: true, data };
  }

  @Post('contract-templates')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Sözleşme şablonu oluştur' })
  async createContractTemplate(@Body() body: Omit<ContractTemplate, 'id' | 'createdAt' | 'updatedAt'>) {
    const data = await this.service.createContractTemplate(body);
    return { success: true, data };
  }

  @Put('contract-templates/:id')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Sözleşme şablonu güncelle' })
  async updateContractTemplate(@Param('id') id: string, @Body() body: Partial<ContractTemplate>) {
    const data = await this.service.updateContractTemplate(id, body);
    return { success: true, data };
  }

  @Delete('contract-templates/:id')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Sözleşme şablonu sil' })
  async deleteContractTemplate(@Param('id') id: string) {
    await this.service.deleteContractTemplate(id);
    return { success: true };
  }

  // ── Notification Settings ────────────────────────────────────────────────

  @Get('notification-settings')
  @RequirePermissions('settings.view')
  @ApiOperation({ summary: 'Bildirim ayarlarını getir' })
  async getNotificationSettings() {
    const data = await this.service.getNotificationSettings();
    return { success: true, data };
  }

  @Put('notification-settings')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Bildirim ayarlarını güncelle' })
  async setNotificationSettings(@Body() body: NotificationSettings) {
    const data = await this.service.setNotificationSettings(body);
    return { success: true, data };
  }

  // ── Company Info ─────────────────────────────────────────────────────────

  @Get('company-info')
  @Public()
  @ApiOperation({ summary: 'Şirket bilgilerini getir (public)' })
  async getCompanyInfo() {
    const data = await this.service.getCompanyInfo();
    return { success: true, data };
  }

  @Put('company-info')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Şirket bilgilerini güncelle' })
  async setCompanyInfo(@Body() body: CompanyInfo) {
    const data = await this.service.setCompanyInfo(body);
    return { success: true, data };
  }

  // ── System Config ─────────────────────────────────────────────────────────

  @Get('system-config')
  @RequirePermissions('settings.view')
  @ApiOperation({ summary: 'Sistem yapılandırmasını getir' })
  async getSystemConfig() {
    const data = await this.service.getSystemConfig();
    return { success: true, data };
  }

  @Put('system-config')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Sistem yapılandırmasını güncelle' })
  async setSystemConfig(@Body() body: Partial<SystemConfig>) {
    const data = await this.service.setSystemConfig(body);
    return { success: true, data };
  }

  // ── SMS Config ─────────────────────────────────────────────────────────

  @Get('sms-config')
  @RequirePermissions('settings.view')
  @ApiOperation({ summary: 'SMS yapılandırmasını getir' })
  async getSmsConfig() {
    const data = await this.service.getSmsConfig();
    if (data) {
      return { success: true, data: { ...data, apiKey: data.apiKey ? '***' : '', apiSecret: data.apiSecret ? '***' : '' } };
    }
    return { success: true, data: null };
  }

  @Put('sms-config')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'SMS yapılandırmasını güncelle' })
  async setSmsConfig(@Body() body: SmsConfig) {
    const existing = await this.service.getSmsConfig();
    const config: SmsConfig = {
      ...body,
      apiKey: body.apiKey === '***' ? (existing?.apiKey ?? '') : (body.apiKey ?? ''),
      apiSecret: body.apiSecret === '***' ? (existing?.apiSecret ?? '') : (body.apiSecret ?? ''),
    };
    const data = await this.service.setSmsConfig(config);
    return { success: true, data: { ...data, apiKey: data.apiKey ? '***' : '', apiSecret: data.apiSecret ? '***' : '' } };
  }

  // ── Integration Config ─────────────────────────────────────────────────

  @Get('integration-config')
  @RequirePermissions('settings.view')
  @ApiOperation({ summary: 'Entegrasyon yapılandırmasını getir' })
  async getIntegrationConfig() {
    const data = await this.service.getIntegrationConfig();
    return {
      success: true,
      data: {
        ...data,
        logoWings: {
          ...data.logoWings,
          apiKey: data.logoWings.apiKey ? '***' : '',
          password: data.logoWings.password ? '***' : '',
        },
      },
    };
  }

  @Put('integration-config')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Entegrasyon yapılandırmasını güncelle' })
  async setIntegrationConfig(@Body() body: IntegrationConfig) {
    const existing = await this.service.getIntegrationConfig();
    const config: IntegrationConfig = {
      logoWings: {
        apiUrl: body.logoWings?.apiUrl ?? '',
        apiKey: body.logoWings?.apiKey === '***' ? (existing.logoWings.apiKey ?? '') : (body.logoWings?.apiKey ?? ''),
        username: body.logoWings?.username ?? '',
        password: body.logoWings?.password === '***' ? (existing.logoWings.password ?? '') : (body.logoWings?.password ?? ''),
        active: body.logoWings?.active ?? false,
      },
    };
    const data = await this.service.setIntegrationConfig(config);
    return { success: true, data: { ...data, logoWings: { ...data.logoWings, apiKey: data.logoWings.apiKey ? '***' : '', password: data.logoWings.password ? '***' : '' } } };
  }

  // ── Theme Config ─────────────────────────────────────────────────────────

  @Get('theme-config')
  @RequirePermissions('settings.view')
  @ApiOperation({ summary: 'Tema yapılandırmasını getir' })
  async getThemeConfig() {
    const data = await this.service.getThemeConfig();
    return { success: true, data };
  }

  @Put('theme-config')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Tema yapılandırmasını güncelle' })
  async setThemeConfig(@Body() body: { mode: 'light' | 'dark'; colorScheme: string }) {
    const data = await this.service.setThemeConfig(body);
    return { success: true, data };
  }
}
