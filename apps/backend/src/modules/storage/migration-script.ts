/**
 * Migration Script: Mevcut ./uploads/ klasöründeki dosyaları S3'e taşır.
 *
 * Kullanım:
 *   STORAGE_PROVIDER=s3 S3_ENDPOINT=... S3_BUCKET=... S3_ACCESS_KEY=... S3_SECRET_KEY=... \
 *   ts-node -r tsconfig-paths/register src/modules/storage/migration-script.ts
 *
 * Bu script production'a geçerken bir kez çalıştırılır.
 */

import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { lookup as mimeLookup } from 'mime-types';

const S3_ENDPOINT = process.env.S3_ENDPOINT || '';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET || 'sigorta-hasar';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || '';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || '';
const LOCAL_UPLOADS_DIR = process.env.LOCAL_UPLOADS_DIR || path.join(process.cwd(), 'uploads');
const DRY_RUN = process.env.DRY_RUN === 'true';

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
  forcePathStyle: true,
});

async function existsInS3(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadFile(localPath: string, s3Key: string): Promise<void> {
  const buffer = fs.readFileSync(localPath);
  const contentType = mimeLookup(localPath) || 'application/octet-stream';

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
}

function walkDir(dir: string, baseDir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath, baseDir));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  console.log('=== Storage Migration Script ===');
  console.log(`Source: ${LOCAL_UPLOADS_DIR}`);
  console.log(`Target: s3://${S3_BUCKET} @ ${S3_ENDPOINT}`);
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log('');

  if (!S3_ENDPOINT || !S3_ACCESS_KEY || !S3_SECRET_KEY) {
    console.error('ERROR: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY environment variables are required');
    process.exit(1);
  }

  const allFiles = walkDir(LOCAL_UPLOADS_DIR, LOCAL_UPLOADS_DIR);
  console.log(`Found ${allFiles.length} files to migrate`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const localPath of allFiles) {
    // local path'i S3 key'e çevir (uploads/ prefix'ini kaldır)
    const relativePath = path.relative(LOCAL_UPLOADS_DIR, localPath);
    const s3Key = relativePath.replace(/\\/g, '/'); // Windows uyumluluğu

    try {
      const alreadyExists = await existsInS3(s3Key);
      if (alreadyExists) {
        console.log(`  SKIP (already exists): ${s3Key}`);
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  DRY_RUN upload: ${s3Key}`);
        uploaded++;
        continue;
      }

      await uploadFile(localPath, s3Key);
      console.log(`  OK: ${s3Key}`);
      uploaded++;
    } catch (err) {
      console.error(`  FAIL: ${s3Key} — ${(err as Error).message}`);
      failed++;
    }
  }

  console.log('');
  console.log('=== Migration Complete ===');
  console.log(`Uploaded: ${uploaded}, Skipped: ${skipped}, Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
