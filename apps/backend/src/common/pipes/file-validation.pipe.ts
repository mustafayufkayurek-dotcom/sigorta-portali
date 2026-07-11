import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

export interface FileValidationOptions {
  maxSize?: number;
  allowedMime?: Set<string>;
  blockedExt?: Set<string>;
}

@Injectable()
export class FileValidationPipe implements PipeTransform {
  private readonly maxSize: number;
  private readonly allowedMime: Set<string>;
  private readonly blockedExt: Set<string>;

  private static readonly DEFAULT_MIME = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]);

  private static readonly DEFAULT_BLOCKED_EXT = new Set([
    'exe', 'bat', 'sh', 'php', 'js', 'cmd', 'msi', 'dll',
  ]);

  constructor(options?: FileValidationOptions) {
    this.maxSize = options?.maxSize ?? 10 * 1024 * 1024;
    this.allowedMime = options?.allowedMime ?? FileValidationPipe.DEFAULT_MIME;
    this.blockedExt = options?.blockedExt ?? FileValidationPipe.DEFAULT_BLOCKED_EXT;
  }

  transform(file: Express.Multer.File) {
    if (process.env.UPLOAD_VALIDATION_ENABLED === 'false') return file;
    if (!file) return file;

    const lower = (file.originalname || '').toLowerCase().trim();
    const parts = lower.split('.').filter(Boolean);
    const lastExt = parts.length ? parts[parts.length - 1] : '';

    // Blocked extension check
    if (lastExt && this.blockedExt.has(lastExt)) {
      throw new BadRequestException('Dosya uzantısı izinli değil');
    }

    // Double extension check
    if (parts.length >= 2) {
      const secondLast = parts[parts.length - 2];
      if (this.blockedExt.has(secondLast) || this.blockedExt.has(lastExt)) {
        throw new BadRequestException('Riskli çift uzantılı dosya');
      }
    }

    // Size check
    if (file.size > this.maxSize) {
      throw new BadRequestException(`Dosya boyutu limiti aşıldı (maks ${Math.round(this.maxSize / 1024 / 1024)}MB)`);
    }

    // MIME check
    if (!this.allowedMime.has(file.mimetype)) {
      throw new BadRequestException('Dosya tipi desteklenmiyor');
    }

    return file;
  }
}

// Pre-configured instances for special cases
export const AUDIO_VALIDATION_PIPE = new FileValidationPipe({
  maxSize: 25 * 1024 * 1024,
  allowedMime: new Set(['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg']),
});

export const EXCEL_VALIDATION_PIPE = new FileValidationPipe({
  maxSize: 5 * 1024 * 1024,
  allowedMime: new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
});

export const RECEIPT_IMAGE_VALIDATION_PIPE = new FileValidationPipe({
  maxSize: 8 * 1024 * 1024,
  allowedMime: new Set(['image/jpeg', 'image/png', 'image/webp']),
});
