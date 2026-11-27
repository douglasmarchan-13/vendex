import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'

const BCRYPT_COST = 12

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_COST)
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash)

// Hash de relleno: al intentar entrar con un correo inexistente se compara igual contra algo,
// para que el tiempo de respuesta no revele qué correos están registrados.
let dummy: Promise<string> | undefined
export const burnPasswordCheck = async (plain: string) => {
  dummy ??= bcrypt.hash('vendex-dummy-password', BCRYPT_COST)
  await bcrypt.compare(plain, await dummy)
}

/** Token para enlaces de un solo uso (invitación, recuperación): 256 bits, apto para URL */
export const newLinkToken = () => randomBytes(32).toString('base64url')

/** En la base solo se guarda el SHA-256 del token: si se filtra la tabla, los enlaces no sirven */
export const hashLinkToken = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex')
