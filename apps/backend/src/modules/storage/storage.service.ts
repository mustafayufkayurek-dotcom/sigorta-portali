import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import {
  STORAGE_S3_USER_MESSAGES,
  classifyS3Error,
} from './storage-s3-errors';
import { resolveSafeLocalPath } from './storage-path';

export interface UploadResult {
  key: string;
  url: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly provider: string;
  private readonly s3Client: S3Client | null = null;
  private readonly bucket: string;
  private readonly localUploadsDir: string;

  constructor(private readonly configService: ConfigService) {
    this.provider = this.configService.get<string>('STORAGE_PROVIDER', 'local');
    this.bucket = this.configService.get<string>('S3_BUCKET', 'sigorta-hasar');
    this.localUploadsDir = path.join(process.cwd(), 'uploads');

    if (this.provider === 's3') {
      const endpoint = this.configService.get<string>('S3_ENDPOINT');
      const region = this.configService.get<string>('S3_REGION', 'us-east-1');
      const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY', '');
      const secretAccessKey = this.configService.get<string>('S3_SECRET_KEY', '');

      this.s3Client = new S3Client({
        endpoint,
        region,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true, // MinIO / DigitalOcean Spaces için gerekli
      });

      this.logger.log(`StorageService: S3 provider initialized (endpoint=${endpoint}, bucket=${this.bucket})`);
    } else {
      this.logger.log(`StorageService: local provider (dir=${this.localUploadsDir})`);
    }
  }

  async onModuleInit(): Promise<void> {
    if (this.provider !== 's3') return;
    try {
      await this.ensureBucketReady();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`S3 bucket hazırlığı başarısız (${this.bucket}): ${message}`);
    }
  }

  private isMissingBucketError(err: unknown): boolean {
    return classifyS3Error(err) === 'missing_bucket';
  }

  /** Bilinen S3/MinIO hatalarını kullanıcıya Türkçe 503 olarak döndür (500 Internal server error yok). */
  private throwMappedS3Error(err: unknown): never {
    const kind = classifyS3Error(err);
    if (kind !== 'unknown') {
      this.logger.error(`S3 upload mapped (${kind}): ${err instanceof Error ? err.message : String(err)}`);
      throw new ServiceUnavailableException(STORAGE_S3_USER_MESSAGES[kind]);
    }
    throw err;
  }

  /** MinIO/S3: bucket yoksa oluştur (production NoSuchBucket upload 500 önlemi). */
  private async ensureBucketReady(): Promise<void> {
    if (!this.s3Client) return;

    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return;
    } catch (err) {
      if (!this.isMissingBucketError(err)) throw err;
    }

    await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    this.logger.warn(`S3 bucket otomatik oluşturuldu: ${this.bucket}`);
  }

  private async putObjectToS3(
    file: Buffer,
    key: string,
    contentType: string,
  ): Promise<void> {
    if (!this.s3Client) throw new Error('S3 client not initialized');

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file,
          ContentType: contentType,
        }),
      );
    } catch (err) {
      if (!this.isMissingBucketError(err)) throw err;
      await this.ensureBucketReady();
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file,
          ContentType: contentType,
        }),
      );
    }
  }

  async upload(
    file: Buffer,
    key: string,
    contentType: string,
  ): Promise<UploadResult> {
    if (this.provider === 's3') {
      return this.uploadToS3(file, key, contentType);
    }
    return this.uploadToLocal(file, key, contentType);
  }

  async download(key: string): Promise<Buffer> {
    if (this.provider === 's3') {
      return this.downloadFromS3(key);
    }
    return this.downloadFromLocal(key);
  }

  async getSignedUrl(key: string, expiresIn = 900): Promise<string> {
    if (this.provider === 's3') {
      return this.getS3SignedUrl(key, expiresIn);
    }
    return this.getLocalSignedUrl(key, expiresIn);
  }

  async delete(key: string): Promise<void> {
    if (this.provider === 's3') {
      return this.deleteFromS3(key);
    }
    return this.deleteFromLocal(key);
  }

  async exists(key: string): Promise<boolean> {
    if (this.provider === 's3') {
      return this.existsInS3(key);
    }
    return this.existsInLocal(key);
  }

  // S3 implementations

  private async uploadToS3(
    file: Buffer,
    key: string,
    contentType: string,
  ): Promise<UploadResult> {
    try {
      await this.putObjectToS3(file, key, contentType);
    } catch (err) {
      this.throwMappedS3Error(err);
    }

    const endpoint = this.configService.get<string>('S3_ENDPOINT', '');
    const url = `${endpoint}/${this.bucket}/${key}`;
    return { key, url };
  }

  private async downloadFromS3(key: string): Promise<Buffer> {
    if (!this.s3Client) throw new Error('S3 client not initialized');

    const response = await this.s3Client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    const stream = response.Body as Readable;
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  private async getS3SignedUrl(key: string, expiresIn: number): Promise<string> {
    if (!this.s3Client) throw new Error('S3 client not initialized');

    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  private async deleteFromS3(key: string): Promise<void> {
    if (!this.s3Client) throw new Error('S3 client not initialized');

    await this.s3Client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  private async existsInS3(key: string): Promise<boolean> {
    if (!this.s3Client) throw new Error('S3 client not initialized');

    try {
      await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  // Local implementations

  private async uploadToLocal(
    file: Buffer,
    key: string,
    _contentType: string,
  ): Promise<UploadResult> {
    const filePath = resolveSafeLocalPath(this.localUploadsDir, key);
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, file);
    const url = `/uploads/${key}`;
    return { key, url };
  }

  private async downloadFromLocal(key: string): Promise<Buffer> {
    const filePath = resolveSafeLocalPath(this.localUploadsDir, key);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Dosya bulunamadı: ${key}`);
    }
    return fs.readFileSync(filePath);
  }

  private async getLocalSignedUrl(key: string, _expiresIn: number): Promise<string> {
    // Development'ta basit path döndür — production'da her zaman S3 olacak
    return `/uploads/${key}`;
  }

  private async deleteFromLocal(key: string): Promise<void> {
    const filePath = resolveSafeLocalPath(this.localUploadsDir, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  private async existsInLocal(key: string): Promise<boolean> {
    const filePath = resolveSafeLocalPath(this.localUploadsDir, key);
    return fs.existsSync(filePath);
  }

  /**
   * Yardımcı: dosya path'i oluştur
   * Örnek: entity-documents/uuid/2026/04/filename.webp
   */
  buildKey(entityType: string, entityId: string, filename: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${entityType}/${entityId}/${year}/${month}/${filename}`;
  }

  isLocalProvider(): boolean {
    return this.provider === 'local';
  }
}
