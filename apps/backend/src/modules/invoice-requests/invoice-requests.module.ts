import { Module, forwardRef } from '@nestjs/common';
import { InvoiceRequestsService } from './invoice-requests.service';
import { InvoiceRequestsController } from './invoice-requests.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { FileDocumentsModule } from '@/modules/file-documents/file-documents.module';
import { SurveysModule } from '@/modules/surveys/surveys.module';
import { InvoicesModule } from '@/modules/invoices/invoices.module';

@Module({
  imports: [PrismaModule, FileDocumentsModule, InvoicesModule, forwardRef(() => SurveysModule)],
  controllers: [InvoiceRequestsController],
  providers: [InvoiceRequestsService],
  exports: [InvoiceRequestsService],
})
export class InvoiceRequestsModule {}
