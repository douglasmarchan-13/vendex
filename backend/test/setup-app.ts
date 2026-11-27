import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import { AppModule } from '../src/app.module.js'
import { AppConfig } from '../src/core/app-config.js'
import { configureApp } from '../src/setup.js'

/**
 * Levanta la app completa en memoria. Las pruebas usan SOLO las variables de .env.test (ver vitest.config.ts):
 * ¡modifican datos y restauran la semilla de demo! Nunca las apuntes a la base de producción.
 */
export async function createTestApp(env: Record<string, string> = {}): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AppConfig)
    .useValue(AppConfig.fromEnv({ ...process.env, ...env }))
    .compile()
  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>({ logger: ['error', 'warn'] }))
  await app.init()
  return app
}
