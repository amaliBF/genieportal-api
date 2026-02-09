import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // ─── Security Headers (Helmet.js) ─────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: false, // CSP wird von Next.js Frontends selbst gesetzt
      crossOriginEmbedderPolicy: false, // Erlaubt externe Bilder/Videos
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  app.setGlobalPrefix('v1');

  const WHITELIST = [
    // Genieportal (Hauptdomains)
    'https://genieportal.de',
    'https://www.genieportal.de',
    'https://dashboard.genieportal.de',
    'https://admin.genieportal.de',
    'https://cdn.genieportal.de',
    // Portal-Landings (SEO-Seiten)
    'https://ausbildungsgenie.de',
    'https://www.ausbildungsgenie.de',
    'https://praktikumsgenie.de',
    'https://www.praktikumsgenie.de',
    'https://berufsgenie.de',
    'https://www.berufsgenie.de',
    'https://minijobgenie.de',
    'https://www.minijobgenie.de',
    'https://werkstudentengenie.de',
    'https://www.werkstudentengenie.de',
    // Backward-compat (alte Subdomains)
    'https://dashboard.ausbildungsgenie.de',
    'https://admin.ausbildungsgenie.de',
    'https://cdn.ausbildungsgenie.de',
    // Development
    ...(process.env.NODE_ENV === 'development'
      ? ['http://localhost:3000', 'http://localhost:3079', 'http://localhost:3111', 'http://localhost:3112', 'http://localhost:3114', 'http://localhost:8081', 'http://localhost:19006']
      : []),
  ];

  app.enableCors({
    origin: (requestOrigin, callback) => {
      // Server-to-server (no origin) or whitelisted origins
      if (!requestOrigin || WHITELIST.includes(requestOrigin)) {
        return callback(null, true);
      }
      // Allow all origins for API/Embed routes (API-Key provides auth)
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Genie-Signature'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Genieportal API')
    .setDescription('Zentrale API für alle Genie-Portale')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3113;
  await app.listen(port);
  console.log(`Genieportal API running on port ${port}`);
}
bootstrap();
