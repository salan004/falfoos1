import winston from 'winston';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'meme-bot' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length > 1 ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      ),
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880,
      maxFiles: 10,
    }),
  ],
});

export function logCommand(userId: string, command: string, guildId: string, options?: Record<string, any>): void {
  logger.info(`Command executed: ${command}`, { userId, guildId, options });
}

export function logError(context: string, error: Error | unknown, meta?: Record<string, any>): void {
  logger.error(`Error in ${context}`, {
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    ...meta,
  });
}

export function logAutoPost(guildId: string, memeUrl: string): void {
  logger.info(`Auto-posted meme`, { guildId, memeUrl });
}

export default logger;
