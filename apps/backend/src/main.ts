import * as Sentry from "@sentry/node";
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ThrottlerExceptionFilter } from './common/filters/throttler-exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { logger } from './common/logger/winston.logger';
import { getUploadsRootDir } from './modules/repair-reports/report-image-paths';
import { TokenBlacklistService } from './modules/auth/token-blacklist.service';
import { createUploadsAuthMiddleware } from './common/middleware/uploads-auth.middleware';

// Sentry initialization (disabled if SENTRY_DSN is empty)
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || "production" });
}


async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
    bodyParser: true,
  });

  // Logo (base64) gibi ayar kayıtları için varsayılan 100kb limitini yükselt
  app.useBodyParser('json', { limit: '5mb' });
  app.useBodyParser('urlencoded', { limit: '5mb', extended: true });

  const jwt = app.get(JwtService);
  const tokenBlacklist = app.get(TokenBlacklistService);
  const webOrigin = process.env.WEB_URL || 'http://localhost:3001';

  app.use(
    '/uploads',
    createUploadsAuthMiddleware({
      verify: (token) => jwt.verifyAsync(token, { secret: process.env.JWT_SECRET }),
      isBlacklisted: (token) => tokenBlacklist.isBlacklisted(token),
    }),
  );

  // Static file serving for uploads — report-images ile aynı kalıcı kök
  app.useStaticAssets(getUploadsRootDir(), {
    prefix: '/uploads',
    setHeaders: (res: any) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', webOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Cache-Control', 'private, max-age=604800');
    },
  });

  // Trust proxy — Nginx arkasında gerçek client IP'sini al (X-Forwarded-For)
  // Bu olmadan throttler tüm kullanıcıları aynı IP olarak görür
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // Security
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.enableCors({
    origin: process.env.WEB_URL || 'http://localhost:3001',
    credentials: true,
  });

  // Global filters
  app.useGlobalFilters(
    new ThrottlerExceptionFilter(),
    new GlobalExceptionFilter(),
  );

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger documentation must stay closed in production unless explicitly enabled.
  if (process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Sigorta Hasar Yönetim Sistemi API')
      .setDescription('API documentation for insurance claim management system')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  const port = process.env.BACKEND_PORT || 3000;
  await app.listen(port);
  logger.info(`Backend is running on port ${port}`);
  if (process.env.ENABLE_SWAGGER === 'true') {
    logger.info(`API Documentation: http://localhost:${port}/api/docs`);
  }

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    logger.info('Application closed.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  logger.error('Failed to start application', error);
  process.exit(1);
});
