import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp') as (input: Buffer) => import('sharp').Sharp;

export interface OptimizeOptions {
  maxWidth?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
}

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
}

const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/heic',
  'image/heif',
];
const IMAGE_NAME = /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i;

@Injectable()
export class ImageOptimizerService {
  private readonly logger = new Logger(ImageOptimizerService.name);

  isImage(mimeType: string, fileName?: string): boolean {
    if (mimeType && IMAGE_MIME_TYPES.includes(mimeType.toLowerCase())) return true;
    if (fileName && IMAGE_NAME.test(fileName)) return true;
    return false;
  }

  /**
   * Resmi optimize et: JPEG/PNG → WebP, maks genişlik 1920px, %80 kalite
   */
  async optimizeImage(
    buffer: Buffer,
    options: OptimizeOptions = {},
  ): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
    const {
      maxWidth = 1920,
      quality = 80,
      format = 'webp',
    } = options;

    const sharpInstance = sharp(buffer);
    const metadata = await sharpInstance.metadata();

    let pipeline = sharpInstance;

    // Genişlik kısıtlaması (orantılı)
    if (metadata.width && metadata.width > maxWidth) {
      pipeline = pipeline.resize(maxWidth, undefined, { fit: 'inside', withoutEnlargement: true });
    }

    let outputBuffer: Buffer;
    let mimeType: string;
    let extension: string;

    switch (format) {
      case 'webp':
        outputBuffer = await pipeline.webp({ quality }).toBuffer();
        mimeType = 'image/webp';
        extension = '.webp';
        break;
      case 'jpeg':
        outputBuffer = await pipeline.jpeg({ quality }).toBuffer();
        mimeType = 'image/jpeg';
        extension = '.jpg';
        break;
      case 'png':
        outputBuffer = await pipeline.png({ quality }).toBuffer();
        mimeType = 'image/png';
        extension = '.png';
        break;
      default:
        outputBuffer = await pipeline.webp({ quality }).toBuffer();
        mimeType = 'image/webp';
        extension = '.webp';
    }

    const originalSize = buffer.length;
    const optimizedSize = outputBuffer.length;
    this.logger.debug(
      `Image optimized: ${(originalSize / 1024).toFixed(0)}KB → ${(optimizedSize / 1024).toFixed(0)}KB (${Math.round((1 - optimizedSize / originalSize) * 100)}% reduction)`,
    );

    return { buffer: outputBuffer, mimeType, extension };
  }

  /**
   * Thumbnail oluştur: 300x300, crop fit, %70 kalite, WebP
   */
  async generateThumbnail(
    buffer: Buffer,
    options: ThumbnailOptions = {},
  ): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
    const { width = 300, height = 300, quality = 70 } = options;

    const outputBuffer = await sharp(buffer)
      .resize(width, height, { fit: 'cover', position: 'centre' })
      .webp({ quality })
      .toBuffer();

    return {
      buffer: outputBuffer,
      mimeType: 'image/webp',
      extension: '.webp',
    };
  }
}
