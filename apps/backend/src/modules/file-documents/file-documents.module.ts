import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileDocumentsService } from './file-documents.service';
import { FileDocumentsController } from './file-documents.controller';
import { PublicFileDocumentController } from './public-file-document.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { StorageModule } from '@/modules/storage/storage.module';

@Module({
  imports: [PrismaModule, ConfigModule, StorageModule],
  controllers: [FileDocumentsController, PublicFileDocumentController],
  providers: [FileDocumentsService],
  exports: [FileDocumentsService],
})
export class FileDocumentsModule {}
