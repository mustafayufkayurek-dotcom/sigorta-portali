import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ChatArchiveController } from './chat-archive.controller';
import { ChatArchiveService } from './chat-archive.service';
import { WhatsappParserService } from './whatsapp-parser.service';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
    }),
  ],
  controllers: [ChatArchiveController],
  providers: [ChatArchiveService, WhatsappParserService],
  exports: [ChatArchiveService],
})
export class ChatArchiveModule {}
