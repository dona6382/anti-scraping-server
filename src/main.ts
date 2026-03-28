import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

/**
 * Application Configuration Interface
 */
interface AppConfiguration {
  port: number;
  nodeEnv: string;
  allowedOrigins: string[];
  corsEnabled: boolean;
  swaggerEnabled: boolean;
  staticFilesEnabled: boolean;
}

/**
 * Startup Information Interface
 */
interface StartupInfo {
  port: number;
  environment: string;
  docsEnabled: boolean;
  redisConfigured: boolean;
  strictMode: boolean;

}

/**
 * Bootstrap the NestJS application
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  try {
    // Create NestJS application
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error', 'warn', 'log', 'debug'],
      cors: false, // We'll configure CORS manually
    });

    // Get configuration
    const config = getApplicationConfiguration();

    // Trust proxy (loopback only — Docker/Nginx 환경에서는 프록시 IP 추가)
    app.set('trust proxy', 'loopback');

    // Security headers
    app.use(helmet({ contentSecurityPolicy: config.nodeEnv === 'production' }));

    // Body size limit
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ limit: '1mb', extended: true }));

    // Setup global pipes
    setupGlobalPipes(app);

    // Setup CORS
    setupCors(app, config);

    // Setup static files
    if (config.staticFilesEnabled) {
      setupStaticFiles(app);
    }

    // Setup Swagger documentation
    if (config.swaggerEnabled) {
      setupSwagger(app);
    }

    // Enable shutdown hooks (NestJS lifecycle)
    app.enableShutdownHooks();

    // Start the application
    await app.listen(config.port);

    // Setup error handlers (shutdown handled by enableShutdownHooks)
    setupProcessErrorHandlers();

    // Log startup information
    const startupInfo = createStartupInfo(config);
    logStartupMessage(logger, startupInfo);

  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

/**
 * Get application configuration from environment
 */
function getApplicationConfiguration(): AppConfiguration {
  const port = parseInt(process.env.PORT || '3000', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [];

  return {
    port,
    nodeEnv,
    allowedOrigins,
    corsEnabled: true,
    swaggerEnabled: nodeEnv !== 'production' || process.env.ENABLE_SWAGGER === 'true',
    staticFilesEnabled: true,
  };
}

/**
 * Setup global validation pipes
 */
function setupGlobalPipes(app: NestExpressApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: process.env.NODE_ENV === 'production',
      validationError: {
        target: false,
        value: false,
      },
    }),
  );
}

/**
 * Setup CORS configuration
 */
function setupCors(app: NestExpressApplication, config: AppConfiguration): void {
  if (!config.corsEnabled) {
    return;
  }

  const corsOptions: Parameters<typeof app.enableCors>[0] = {
    origin: config.nodeEnv === 'production' 
      ? config.allowedOrigins.length > 0 ? config.allowedOrigins : false
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With', 

      'Accept',
      'Origin',
      'User-Agent',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    maxAge: 86400, // 24 hours
  };

  app.enableCors(corsOptions);
}

/**
 * Setup static file serving
 */
function setupStaticFiles(app: NestExpressApplication): void {
  const staticPath = join(__dirname, '..', 'public');
  
  app.use('/public', express.static(staticPath, {
    maxAge: '1d', // Cache for 1 day
    etag: true,
    lastModified: true,
    index: ['index.html'],
  }));
}

/**
 * Setup Swagger documentation
 */
function setupSwagger(app: NestExpressApplication): void {
  // Swagger Basic Auth 보호 (공격자가 API 스키마를 열람하지 못하도록)
  const swaggerUser = process.env.SWAGGER_USER || 'admin';
  const swaggerPass = process.env.SWAGGER_PASSWORD || 'changeme';
  const swaggerAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const auth = req.headers.authorization;
    if (auth) {
      const [, encoded] = auth.split(' ');
      const decoded = Buffer.from(encoded || '', 'base64').toString();
      const [user, pass] = decoded.split(':');
      if (user === swaggerUser && pass === swaggerPass) {
        return next();
      }
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="API Documentation"');
    res.status(401).send('Authentication required');
  };
  app.use('/api-docs', swaggerAuth);
  app.use('/api-docs-json', swaggerAuth);
  const config = new DocumentBuilder()
    .setTitle('Anti-Scraping Server API')
    .setDescription(getSwaggerDescription())
    .setVersion('1.0.0')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer(`http://localhost:${process.env.PORT || 3000}`, 'Development server')
    .addTag('Application', 'Core application endpoints')
    .addTag('Admin', 'Administrative functions')
    .addTag('Testing', 'Security testing endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth'
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => 
      `${controllerKey}_${methodKey}`,
    ignoreGlobalPrefix: false,
  });

  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showRequestHeaders: true,
      tryItOutEnabled: true,
      syntaxHighlight: {
        activated: true,
        theme: 'agate'
      },
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
    },
    customSiteTitle: 'Anti-Scraping Server API Documentation',
    customfavIcon: '/public/favicon.ico',
    customCss: getSwaggerCustomCss(),
    customJs: [
      '/public/swagger-custom.js'
    ],
  });
}

/**
 * Get Swagger description
 */
function getSwaggerDescription(): string {
  return `
Production-ready anti-scraping solution with multiple protection layers.

🛡️ **Security Features:**
- IP Blacklisting with Redis persistence
- User-Agent filtering and bot detection
- Rate limiting per IP and endpoint
- Headless browser detection
- Honeypot fields for bot trapping

- Request fingerprinting

🔐 **Protection Levels:**
- **Public APIs**: Basic rate limiting
- **Protected APIs**: User-Agent + Headless detection
- **Secure APIs**: Full protection stack

📊 **Rate Limits:**
- Public Data: Default throttling
- Protected Data: 10 requests/minute
- Contact Form: 5 requests/5 minutes
- Critical Actions: 3 requests/10 minutes
- Search: 20 requests/30 seconds

⚠️ **Note**: All endpoints include IP blacklist protection where applicable.

🧪 **Testing**: Use the testing endpoints to verify each security layer individually.
  `.trim();
}

/**
 * Get Swagger custom CSS
 */
function getSwaggerCustomCss(): string {
  return `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { 
      color: #3b82f6; 
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }
    .swagger-ui .info .description { 
      font-size: 1rem;
      line-height: 1.6;
    }
    .swagger-ui .scheme-container { 
      background: #f8fafc; 
      border-radius: 8px;
      padding: 1rem;
      margin: 1rem 0;
    }
    .swagger-ui .opblock .opblock-summary-description {
      font-weight: 500;
    }
    .swagger-ui .btn.authorize {
      background-color: #10b981;
      border-color: #10b981;
    }
    .swagger-ui .btn.authorize:hover {
      background-color: #059669;
      border-color: #059669;
    }
    .swagger-ui .opblock.opblock-post {
      background: rgba(73, 204, 144, .1);
      border-color: #49cc90;
    }
    .swagger-ui .opblock.opblock-get {
      background: rgba(97, 175, 254, .1);
      border-color: #61affe;
    }
    .swagger-ui .opblock.opblock-delete {
      background: rgba(249, 62, 62, .1);
      border-color: #f93e3e;
    }
  `;
}

/**
 * Create startup information
 */
function createStartupInfo(config: AppConfiguration): StartupInfo {
  return {
    port: config.port,
    environment: config.nodeEnv,
    docsEnabled: config.swaggerEnabled,
    redisConfigured: !!process.env.REDIS_HOST,
    strictMode: process.env.SECURITY_STRICT_MODE === 'true',

  };
}

/**
 * Log startup message with ASCII art and configuration
 */
function logStartupMessage(logger: Logger, info: StartupInfo): void {
  const isProduction = info.environment === 'production';
  
  logger.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║        🛡️  Anti-Scraping Server Started Successfully         ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║  🚀 Application:  http://localhost:${info.port.toString().padEnd(30)} ║
║  📄 Test UI:      http://localhost:${info.port}/public${' '.repeat(19)} ║
║  📊 Health:       http://localhost:${info.port}/health${' '.repeat(19)} ║
${info.docsEnabled ? `║  📚 API Docs:     http://localhost:${info.port}/api-docs${' '.repeat(16)} ║` : ''}
║  🔒 Environment:  ${info.environment.padEnd(43)} ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║  📦 Redis:        ${(info.redisConfigured ? 'Configured' : 'Not configured').padEnd(43)} ║
║  🛡️  Security:     Strict mode ${(info.strictMode ? 'ENABLED' : 'DISABLED').padEnd(32)} ║

║  📖 Docs:         ${(info.docsEnabled ? 'Enabled' : 'Disabled').padEnd(43)} ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║  ⚡ Status:       All systems operational                     ║
║  🎯 Mode:         ${(isProduction ? 'Production' : 'Development').padEnd(43)} ║
║  📅 Started:      ${new Date().toLocaleString().padEnd(43)} ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  // 환경별 추가 로그
  if (isProduction) {
    logger.warn('🚨 Running in PRODUCTION mode - ensure all security configurations are properly set!');
  } else {
    logger.log('🔧 Running in DEVELOPMENT mode - additional debugging enabled');
  }

  // 보안 설정 확인
  if (!info.redisConfigured) {
    logger.warn('⚠️  Redis not configured - using in-memory cache (not recommended for production)');
  }

  // 성능 팁
  logger.log('💡 Performance tip: Enable Redis for better caching and IP blacklist persistence');
  
  if (info.docsEnabled) {
    logger.log('📚 API documentation available at /api-docs');
  }
}

/**
 * Process error handlers (uncaught exceptions only)
 * SIGTERM/SIGINT는 app.enableShutdownHooks()가 처리
 */
function setupProcessErrorHandlers(): void {
  const logger = new Logger('Process');

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
    process.exit(1);
  });
}

void bootstrap();
