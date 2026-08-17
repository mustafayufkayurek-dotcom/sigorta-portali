import { Module } from '@nestjs/common';
import { EntityDocumentsController } from './entity-documents.controller';
import { EntityDocumentsService } from './entity-documents.service';
import { StorageModule } from '@/modules/storage/storage.module';
import { ClaimFilesModule } from '@/modules/claim-files/claim-files.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [StorageModule, ClaimFilesModule, PrismaModule],
  controllers: [EntityDocumentsController],
  providers: [EntityDocumentsService],
  exports: [EntityDocumentsService],
})
export class EntityDocumentsModule {}
