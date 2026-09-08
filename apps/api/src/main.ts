// Load env from the repo root .env first thing — NestJS doesn't do this on its own
// and process.env needs SUPABASE_JWT_SECRET, DATABASE_URL, etc. before any module loads.
// Tiny inline parser so we don't need a dotenv dependency.
import * as fs from 'fs';
import * as path from 'path';
function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvFile(path.resolve(__dirname, '..', '..', '..', '.env')); // repo root
loadEnvFile(path.resolve(__dirname, '..', '.env'));              // apps/api/.env (prod)

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  const isProd = process.env.NODE_ENV === 'production';
  const localhostOrigins = isProd ? [] : [
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  const corsOriginEnv = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const allowedOrigins = [
    ...localhostOrigins,
    ...corsOriginEnv,
    'https://africanyouthobservatory.org',
    'https://www.africanyouthobservatory.org',
    'https://african-youth-observatory.pages.dev',
  ];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Graceful shutdown
  app.enableShutdownHooks();

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger — only mounted outside production. In prod we don't want to
  // advertise the full admin/auth/upload API surface at /api/docs.
  const enableSwagger = !isProd || process.env.ENABLE_SWAGGER === 'true';
  const config = new DocumentBuilder()
    .setTitle('African Youth Observatory API')
    .setDescription(
      `The AYO API provides access to youth-disaggregated data across all 54 African countries.

## Authentication
Most GET endpoints are public. Protected endpoints require a Bearer token obtained via \`POST /api/auth/signin\`.

## Rate Limiting
- Public: 100 requests/minute
- Authenticated: 500 requests/minute

## Data Coverage
- 54 African countries
- 9 thematic areas
- 59+ indicators
- Data from 2000–2024

## Sources
World Bank, ILO, UNESCO, national statistics bureaus`,
    )
    .setVersion('1.0.0')
    .setContact('AYO Team', 'https://africanyouthobservatory.org', 'info@africanyouthobservatory.org')
    .setLicense('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/')
    .addBearerAuth()
    .addTag('countries', 'Country data and profiles')
    .addTag('themes', 'Thematic areas')
    .addTag('indicators', 'Youth indicators')
    .addTag('data', 'Indicator values and data queries')
    .addTag('youth-index', 'Youth Empowerment & Development Index')
    .addTag('compare', 'Country, regional, and thematic comparisons')
    .addTag('policy-monitor', 'AYC compliance and youth policy tracking')
    .addTag('insights', 'AI-powered data insights and analysis')
    .addTag('nlq', 'Natural language data queries')
    .addTag('experts', 'Youth expert directory')
    .addTag('dashboards', 'Custom dashboard management')
    .addTag('export', 'Data export (CSV, JSON, Excel, PDF)')
    .addTag('embed', 'Embeddable charts and widgets')
    .addTag('search', 'Global search across all entities')
    .addTag('data-upload', 'Data contributor upload and management')
    .addTag('documents', 'Reports & document uploads (PKPB, policy, research)')
    .addTag('live-feed', 'Real-time data feed')
    .addTag('auth', 'Authentication and user management')
    .addTag('admin', 'Platform administration')
    .addTag('platform', 'Platform stats and health checks')
    .addTag('ops', 'Operator status and headline numbers (service-token auth, read-only)')
    .build();

  if (enableSwagger) {
    const document = SwaggerModule.createDocument(app as any, config);
    SwaggerModule.setup('api/docs', app as any, document);
  }

  // Route aliases for frontend compatibility
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.post('/api/query/natural-language', (req: any, res: any, next: any) => {
    req.url = '/api/nlq/query';
    next();
  });

  // Render injects $PORT automatically; fall back to API_PORT, then 3001 for local dev.
  const port = process.env.PORT || process.env.API_PORT || 3001;
  await app.listen(port);
  console.log(`🌍 AYO API running on http://localhost:${port}/api`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
  console.log(`📊 19 modules loaded | 18 Swagger tags`);
}

bootstrap();
