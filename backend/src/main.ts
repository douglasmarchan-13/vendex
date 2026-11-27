import 'reflect-metadata'
import { existsSync } from 'node:fs'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module.js'
import { AppConfig } from './core/app-config.js'
import { configureApp } from './setup.js'

// Variables de entorno desde .env (las del sistema tienen prioridad)
if (existsSync('.env')) process.loadEnvFile('.env')

async function bootstrap() {
  const logger = new Logger('Vendex')
  let config: AppConfig
  try {
    config = AppConfig.fromEnv()
  } catch (e) {
    console.error(`✖ ${(e as Error).message}`)
    process.exit(1)
  }

  const app = configureApp(await NestFactory.create<NestExpressApplication>(AppModule))
  app.enableShutdownHooks()
  await app.listen(config.port)

  logger.log(`API escuchando en http://localhost:${config.port}/api  ·  docs: /api/docs`)
  logger.log(`Supabase: ${config.supabaseUrl}`)
  logger.log(
    `Zona horaria: ${config.timezone} · Auth: ${config.requireAuth ? 'JWT obligatorio' : `demo sin token (vendedor por defecto: ${config.defaultSellerId})`} · Correo: ${config.mailDriver}`,
  )
  if (config.jwtSecretEphemeral) logger.warn('JWT_SECRET no está configurado: se usa uno temporal y las sesiones se pierden al reiniciar')
}

void bootstrap()
