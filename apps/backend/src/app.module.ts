import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { TokenBlacklistService } from './modules/auth/token-blacklist.service';
import { TokenBlacklistModule } from './common/modules/token-blacklist.module';
import { UsersModule } from './modules/users/users.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { InsuranceCompaniesModule } from './modules/insurance-companies/insurance-companies.module';
import { ClaimFilesModule } from './modules/claim-files/claim-files.module';
import { ClaimStatusModule } from './modules/claim-status/claim-status.module';
import { CustomersModule } from './modules/customers/customers.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { NotesModule } from './modules/notes/notes.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AdjustersModule } from './modules/adjusters/adjusters.module';
import { BudgetModule } from './modules/budget/budget.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { VendorDiscoveryModule } from './modules/vendor-discovery/vendor-discovery.module';
import { WorkGroupsModule } from './modules/work-groups/work-groups.module';
import { RepairReportsModule } from './modules/repair-reports/repair-reports.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { ClaimSubjectsModule } from './modules/claim-subjects/claim-subjects.module';
import { ClaimResponsibilitiesModule } from './modules/claim-responsibilities/claim-responsibilities.module';
import { SpeechModule } from './modules/speech/speech.module';
import { LocationsModule } from './modules/locations/locations.module';
import { DocumentTypesModule } from './modules/document-types/document-types.module';
import { VendorDocumentsModule } from './modules/vendor-documents/vendor-documents.module';
import { ExternalApprovalsModule } from './modules/external-approvals/external-approvals.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { CollectionLinksModule } from './modules/collection-links/collection-links.module';
import { BankAccountsModule } from './modules/bank-accounts/bank-accounts.module';
import { LogoIntegrationModule } from './modules/logo-integration/logo-integration.module';
import { ExpenseCategoriesModule } from './modules/expense-categories/expense-categories.module';
import { UserLocationsModule } from './modules/user-locations/user-locations.module';
import { CustomerAccessLogModule } from './modules/customer-access-log/customer-access-log.module';
import { SlaModule } from './modules/sla/sla.module';
import { SystemSettingsModule } from './modules/system-settings/system-settings.module';
import { EntityDocumentsModule } from './modules/entity-documents/entity-documents.module';
import { ChatArchiveModule } from './modules/chat-archive/chat-archive.module';
import { ClaimLocationsModule } from './modules/claim-locations/claim-locations.module';
import { WorkSubGroupsModule } from './modules/work-sub-groups/work-sub-groups.module';
import { TaxVerificationModule } from './modules/tax-verification/tax-verification.module';
import { WidgetsModule } from './modules/widgets/widgets.module';
import { StorageModule } from './modules/storage/storage.module';
import { TaskAssignmentsModule } from './modules/task-assignments/task-assignments.module';
import { RevisionRequestsModule } from './modules/revision-requests/revision-requests.module';
import { ServiceBranchesModule } from './modules/service-branches/service-branches.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthModule } from './modules/health/health.module';
import { AgreementsModule } from './modules/agreements/agreements.module';
import { PlatformModulesModule } from './modules/platform-modules/platform-modules.module';
import { HrModule } from './modules/hr/hr.module';
import { FixedAssetsModule } from './modules/fixed-assets/fixed-assets.module';
import { VendorStatementsModule } from './modules/vendor-statements/vendor-statements.module';
import { MarketPricesModule } from './modules/market-prices/market-prices.module';
import { VendorRiskModule } from './modules/vendor-risk/vendor-risk.module';
import { FinanceModule } from './modules/finance/finance.module';
import { ReportTemplatesModule } from './modules/report-templates/report-templates.module';
import { EmergencyModule } from './modules/emergency/emergency.module';
import { VendorContractsModule } from './modules/vendor-contracts/vendor-contracts.module';
import { FileDocumentsModule } from './modules/file-documents/file-documents.module';
import { InvoiceRequestsModule } from './modules/invoice-requests/invoice-requests.module';
import { SurveysModule } from './modules/surveys/surveys.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { RegionsModule } from './modules/regions/regions.module';
import { SearchModule } from './modules/search/search.module';
import { ServiceTypesModule } from './modules/service-types/service-types.module';
import { DamageRepairTemplatesModule } from './modules/damage-repair-templates/damage-repair-templates.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { TimelineModule } from './modules/timeline/timeline.module';
import { TestNotesModule } from './modules/test-notes/test-notes.module';
import { CrmModule } from './modules/crm/crm.module';
import { OperationInboxModule } from './modules/operation-inbox/operation-inbox.module';
import { CacheModule } from './cache/cache.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AgreementGuard } from './common/guards/agreement.guard';
import { ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '.env',
        join(process.cwd(), '.env'),
        join(process.cwd(), '..', '..', '.env'),
      ],
    }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
        },
      }),
    }),
    ...(process.env.RATE_LIMIT_ENABLED === 'false'
      ? []
      : [
          ThrottlerModule.forRoot([
            {
              ttl: 60000,
              limit: 100,
            },
          ]),
        ]),
    ScheduleModule.forRoot(),
    TokenBlacklistModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL', 'redis://localhost:6379');
        const url = new URL(redisUrl);
        return {
          redis: {
            host: url.hostname,
            port: parseInt(url.port || '6379', 10),
            password: url.password || undefined,
          },
        };
      },
      inject: [ConfigService],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RbacModule,
    InsuranceCompaniesModule,
    ClaimFilesModule,
    ClaimStatusModule,
    CustomersModule,
    AddressesModule,
    TasksModule,
    NotesModule,
    DocumentsModule,
    UploadsModule,
    NotificationsModule,
    DashboardModule,
    AdjustersModule,
    BudgetModule,
    VendorsModule,
    VendorDiscoveryModule,
    WorkGroupsModule,
    RepairReportsModule,
    DepartmentsModule,
    ClaimSubjectsModule,
    ClaimResponsibilitiesModule,
    SpeechModule,
    LocationsModule,
    DocumentTypesModule,
    VendorDocumentsModule,
    ExternalApprovalsModule,
    InvoicesModule,
    PaymentsModule,
    CollectionLinksModule,
    BankAccountsModule,
    LogoIntegrationModule,
    ExpenseCategoriesModule,
    UserLocationsModule,
    CustomerAccessLogModule,
    SlaModule,
    SystemSettingsModule,
    EntityDocumentsModule,
    ChatArchiveModule,
    ClaimLocationsModule,
    WorkSubGroupsModule,
    TaxVerificationModule,
    WidgetsModule,
    StorageModule,
    TaskAssignmentsModule,
    RevisionRequestsModule,
    ServiceBranchesModule,
    AnalyticsModule,
    HealthModule,
    AgreementsModule,
    PlatformModulesModule,
    HrModule,
    FixedAssetsModule,
    VendorStatementsModule,
    MarketPricesModule,
    VendorRiskModule,
    FinanceModule,
    ReportTemplatesModule,
    EmergencyModule,
    VendorContractsModule,
    FileDocumentsModule,
    InvoiceRequestsModule,
    SurveysModule,
    ExpensesModule,
    RegionsModule,
    SearchModule,
    ServiceTypesModule,
    DamageRepairTemplatesModule,
    AuditLogsModule,
    TimelineModule,
    TestNotesModule,
    CrmModule,
    OperationInboxModule,
    CacheModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AgreementGuard,
    },
    ...(process.env.RATE_LIMIT_ENABLED === 'false'
      ? []
      : [
          {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
          },
        ]),
    TokenBlacklistService,
  ],
  exports: [TokenBlacklistService],
})
export class AppModule {}
