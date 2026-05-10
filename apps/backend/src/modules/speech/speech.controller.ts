import { Controller, Post, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { SpeechService } from './speech.service';
import { AUDIO_VALIDATION_PIPE } from '@/common/pipes/file-validation.pipe';

@Controller('speech')
export class SpeechController {
  constructor(private readonly service: SpeechService) {}

  @Post('transcribe')
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: diskStorage({
        destination: (_req: Express.Request, _file: Express.Multer.File, cb: (error: Error | null, dest: string) => void) => {
          const dir = require('path').join(process.cwd(), 'uploads', 'audio-temp');
          require('fs').mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 25 * 1024 * 1024 },
      fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
        const allowed = ['audio/m4a', 'audio/mpeg', 'audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg'];
        cb(null, allowed.includes(file.mimetype) || file.originalname.match(/\.(m4a|mp3|webm|wav|ogg)$/) !== null);
      },
    }),
  )
  async transcribe(@UploadedFile(AUDIO_VALIDATION_PIPE) file: Express.Multer.File) {
    const text = await this.service.transcribe(file);
    return { text };
  }
}
