import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { AppModule } from './app.module';

/**
 * Bootstrap the NestJS application
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug'],
    });

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // CORS configuration
    app.enableCors({
      origin:
        process.env.NODE_ENV === 'production'
          ? process.env.ALLOWED_ORIGINS?.split(',') || false
          : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Recaptcha-Token'],
    });

    // Serve static files
    app.use('/public', express.static(join(__dirname, '..', 'public')));

    // Get port from environment
    const port = process.env.PORT || 3000;

    await app.listen(port);

    // Log startup information
    logger.log(`
    ╔════════════════════════════════════════════════════════╗
    ║                                                        ║
    ║        Anti-Scraping Server Started Successfully       ║
    ║                                                        ║
    ╠════════════════════════════════════════════════════════╣
    ║  🚀 Application:  http://localhost:${port}                ║
    ║  📄 Test UI:      http://localhost:${port}/public         ║
    ║  📊 Health:       http://localhost:${port}/health         ║
    ║  🔒 Environment:  ${process.env.NODE_ENV || 'development'}                          ║
    ╚════════════════════════════════════════════════════════╝
    `);

    // Check Redis connection
    const redisHost = process.env.REDIS_HOST;
    if (redisHost) {
      logger.log(`📦 Redis: Configured at ${redisHost}:${process.env.REDIS_PORT || 6379}`);
    } else {
      logger.warn('📦 Redis: Not configured - using in-memory cache');
    }

    // Security configuration status
    const strictMode = process.env.SECURITY_STRICT_MODE === 'true';
    logger.log(`🛡️  Security: Strict mode ${strictMode ? 'ENABLED' : 'DISABLED'}`);

    // reCAPTCHA status
    const recaptchaConfigured = !!process.env.RECAPTCHA_SECRET_KEY;
    logger.log(`🤖 reCAPTCHA: ${recaptchaConfigured ? 'Configured' : 'Not configured'}`);

  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

// Start the application
void bootstrap();
