import { existsSync } from 'node:fs'
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

// Las pruebas e2e modifican datos: usan SOLO .env.test (nunca .env), para no tocar la base de desarrollo por error
if (existsSync('.env.test')) process.loadEnvFile('.env.test')

export default defineConfig({
  // SWC compila los decoradores con metadatos (emitDecoratorMetadata), necesarios para la inyección de Nest
  plugins: [swc.vite()],
  test: {
    include: ['test/**/*.e2e-spec.ts', 'test/unit/**/*.spec.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    env: { NODE_ENV: 'test' },
  },
})
