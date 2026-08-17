import { createLogger, format, transports, Logger } from 'winston';
import { join } from 'path';
import * as fs from 'fs';

const logDir = join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, errors, json, colorize, simple } = format;

const isProduction = process.env.NODE_ENV === 'production';

export const logger: Logger = createLogger({
  level: isProduction ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    json(),
  ),
  defaultMeta: { service: 'sigorta-backend' },
  transports: [
    new transports.File({
      filename: join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    new transports.File({
      filename: join(logDir, 'combined.log'),
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 10,
    }),
  ],
});

if (!isProduction) {
  logger.add(
    new transports.Console({
      format: combine(colorize(), simple()),
    }),
  );
} else {
  logger.add(
    new transports.Console({
      format: combine(timestamp(), json()),
    }),
  );
}
