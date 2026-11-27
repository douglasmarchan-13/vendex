// Crea el Superadministrador o restablece su contraseña (equivale a la función SQL create_super_admin).
//
//   npm run superadmin -- --list                         ← correos de los super admin que existen
//   npm run superadmin -- --email tu@correo.com          ← pide la clave sin mostrarla (dos veces)
//   npm run superadmin -- --email tu@correo.com --generate [--name "Tu Nombre"]
//                                                        ← genera una clave segura y la muestra UNA vez
//
// Usa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de backend/.env (o --env-file otro.env).
// La clave nunca se pasa como argumento (quedaría en el historial de la terminal) ni se guarda en claro:
// solo su hash bcrypt (cost 12, igual que el backend). Restablecer cierra las sesiones abiertas del usuario.
import { randomInt } from 'node:crypto'
import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const BCRYPT_COST = 12
const MIN_LENGTH = 12

const { values: args } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    generate: { type: 'boolean', default: false },
    list: { type: 'boolean', default: false },
    'env-file': { type: 'string', default: '.env' },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

const fail = (msg) => {
  console.error(`✖ ${msg}`)
  process.exit(1)
}

if (args.help || (!args.list && !args.email)) {
  console.log(`Uso:
  npm run superadmin -- --list
  npm run superadmin -- --email tu@correo.com [--name "Tu Nombre"] [--generate] [--env-file .env]`)
  process.exit(args.help ? 0 : 1)
}

if (existsSync(args['env-file'])) process.loadEnvFile(args['env-file'])
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) fail(`Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en ${args['env-file']}`)
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

if (args.list) {
  const { data, error } = await db.from('users').select('email, name, status, last_login_at').eq('role', 'super_admin').order('email')
  if (error) fail(error.message)
  if (!data.length) console.log('No hay ningún super admin. Crea uno con --email.')
  for (const u of data) console.log(`• ${u.email}  (${u.name}, ${u.status}, último acceso: ${u.last_login_at ?? 'nunca'})`)
  process.exit(0)
}

const email = args.email.trim().toLowerCase()
if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fail('Correo no válido')

function passwordProblem(p) {
  if (p.length < MIN_LENGTH) return `Mínimo ${MIN_LENGTH} caracteres`
  if (Buffer.byteLength(p, 'utf8') > 72) return 'Máximo 72 caracteres'
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(p) || !/\d/.test(p)) return 'Usa al menos una letra y un número'
  return null
}

/** 20 caracteres sin los que se confunden (0/O, 1/l/I), con mayúscula, minúscula, número y símbolo */
function generatePassword(length = 20) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%*-_+?']
  const all = sets.join('')
  const chars = sets.map((s) => s[randomInt(s.length)])
  while (chars.length < length) chars.push(all[randomInt(all.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/** Pregunta sin mostrar lo que se escribe */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = (s) => {
      if (s.includes(question)) process.stdout.write(s)
    }
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
  })
}

const { data: existing, error: readErr } = await db.from('users').select('id, role, name').eq('email', email).maybeSingle()
if (readErr) fail(readErr.message)
if (existing && existing.role !== 'super_admin') fail('Ese correo ya pertenece a un usuario de una empresa')

let password
if (args.generate) {
  password = generatePassword()
} else {
  if (!process.stdin.isTTY) fail('Ejecútalo en una terminal interactiva o usa --generate')
  password = await askHidden(`Nueva contraseña para ${email}: `)
  const problem = passwordProblem(password)
  if (problem) fail(problem)
  if ((await askHidden('Repítela: ')) !== password) fail('Las contraseñas no coinciden')
}

const fields = {
  password_hash: await bcrypt.hash(password, BCRYPT_COST),
  password_changed_at: new Date().toISOString(),
  status: 'activo',
  failed_login_attempts: 0,
  locked_until: null,
  must_change_password: false,
}
const name = args.name?.trim() || existing?.name || 'Super Admin'

const { error } = existing
  ? await db.from('users').update({ ...fields, name }).eq('id', existing.id)
  : await db.from('users').insert({ ...fields, email, name, role: 'super_admin', company_id: null })
if (error) {
  if (/must_change_password/.test(error.message)) fail('Falta la migración 004 (supabase/migrations/004_direct_user_creation.sql)')
  fail(error.message)
}

console.log(`✓ Super admin ${existing ? 'actualizado (sesiones anteriores cerradas)' : 'creado'}: ${email}`)
if (args.generate) {
  console.log(`  Contraseña: ${password}`)
  console.log('  Guárdala ahora en tu gestor de contraseñas: no se vuelve a mostrar.')
}
