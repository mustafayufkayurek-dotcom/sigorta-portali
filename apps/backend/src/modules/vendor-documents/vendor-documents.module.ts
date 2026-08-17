import { Module } from '@nestjs/common';
import { VendorDocumentsController } from './vendor-documents.controller';
import { VendorDocumentsService } from './vendor-documents.service';
import { StorageModule } from '@/modules/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [VendorDocumentsController],
  providers: [VendorDocumentsService],
})
export class VendorDocumentsModule {}
