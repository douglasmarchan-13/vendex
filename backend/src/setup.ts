import type { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js'
import { AppConfig } from './core/app-config.js'

/** Configuración HTTP común al servidor (main.ts) y a las pruebas e2e */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  const config = app.get(AppConfig)

  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.setGlobalPrefix('api')
  app.enableCors({ origin: config.corsOrigin, allowedHeaders: ['Content-Type', 'Authorization', 'X-Seller-Id'] })
  app.useBodyParser('json', { limit: '1mb' })
  app.useGlobalFilters(new AllExceptionsFilter(config.isProduction))

  // Documentación interactiva en /api/docs (JSON en /api/docs-json)
  const doc = new DocumentBuilder()
    .setTitle('Vendex API')
    .setDescription('API REST de Vendex sobre Supabase. Las respuestas usan las mismas claves que el frontend.')
    .setVersion('0.2.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', description: 'JWT de POST /api/auth/login (obligatorio con REQUIRE_AUTH=true)' })
    .addGlobalParameters({ name: 'X-Seller-Id', in: 'header', required: false, description: 'Vendedor en modo demo' })
    .build()
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, doc), { jsonDocumentUrl: 'api/docs-json' })

  return app
}
