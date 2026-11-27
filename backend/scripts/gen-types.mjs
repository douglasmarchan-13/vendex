// Regenera src/database/database.types.ts desde la base (tipos de tablas y funciones RPC).
// Ejecútalo cada vez que cambies supabase/vendex.sql:  npm run gen:types
// Necesita SUPABASE_DB_URL en .env (Supabase Dashboard → Connect → Connection string).
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'

if (existsSync('.env')) process.loadEnvFile('.env')
const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error('✖ Falta SUPABASE_DB_URL en .env (Supabase Dashboard → Connect → Connection string)')
  process.exit(1)
}

const types = execSync(`npx -y supabase gen types typescript --db-url "${url}" --schema public`, {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
  maxBuffer: 16 * 1024 * 1024,
})
writeFileSync('src/database/database.types.ts', types)
// El CLI genera el archivo sin formato
execSync('npx -y oxfmt src/database/database.types.ts', { stdio: 'ignore' })
console.log('✓ src/database/database.types.ts actualizado. Revisa con: npm run typecheck')
