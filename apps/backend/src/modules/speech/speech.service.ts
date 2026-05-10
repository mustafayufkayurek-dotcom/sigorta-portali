import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';

@Injectable()
export class SpeechService {
  private readonly logger = new Logger(SpeechService.name);

  constructor(private config: ConfigService) {}

  async transcribe(file: Express.Multer.File): Promise<string> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY eksik — mock STT yanıtı dönülüyor');
      this.cleanupFile(file.path);
      return '[STT servisi yapılandırılmamış — gerçek transkripsiyon için OPENAI_API_KEY gereklidir]';
    }

    try {
      // Dynamic import to avoid build-time dependency
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const OpenAI = require('openai');
      const client = new OpenAI({ apiKey });

      const transcription = await client.audio.transcriptions.create({
        file: fs.createReadStream(file.path),
        model: 'whisper-1',
        language: 'tr',
      });

      this.cleanupFile(file.path);
      return transcription.text as string;
    } catch (err) {
      this.logger.error('STT hatası', err);
      this.cleanupFile(file.path);
      throw err;
    }
  }

  private cleanupFile(filePath: string) {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}
  }
}
