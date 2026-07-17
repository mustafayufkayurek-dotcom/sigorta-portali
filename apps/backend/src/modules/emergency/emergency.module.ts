import { Module } from '@nestjs/common';
import { EmergencyCasesController } from './emergency-cases.controller';
import { EmergencyFinanceController } from './emergency-finance.controller';
import { EmergencyCasesService } from './emergency-cases.service';
import { EmergencyFinanceService } from './emergency-finance.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClaimFilesModule } from '@/modules/claim-files/claim-files.module';
import { OperationalAccessGrantsModule } from '@/modules/operational-access-grants/operational-access-grants.module';
import { FileDocumentsModule } from '@/modules/file-documents/file-documents.module';
import { InvoiceRequestsModule } from '@/modules/invoice-requests/invoice-requests.module';
import { VendorsModule } from '@/modules/vendors/vendors.module';

import { VendorIntelligenceProfileModule } from '@/modules/vendor-intelligence-profile/vendor-intelligence-profile.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { StorageModule } from '@/modules/storage/storage.module';

@Module({
  imports: [
    PrismaModule,
    ClaimFilesModule,
    OperationalAccessGrantsModule,
    FileDocumentsModule,
    InvoiceRequestsModule,
    VendorsModule,
    VendorIntelligenceProfileModule,
    NotificationsModule,
    StorageModule,
  ],
  controllers: [EmergencyCasesController, EmergencyFinanceController],
  providers: [EmergencyCasesService, EmergencyFinanceService],
  exports: [EmergencyCasesService, EmergencyFinanceService],
})
export class EmergencyModule {}
