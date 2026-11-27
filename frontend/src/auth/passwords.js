// Reglas de contraseña (las mismas que backend/src/modules/auth/auth.schemas.ts) y mensajes de error

export const PASSWORD_HINT = 'Mínimo 10 caracteres, con al menos una letra y un número.'

/** Mismas reglas que el backend (auth.schemas.ts) */
export function passwordProblem(p, confirm) {
  if (p.length < 10) return 'La contraseña debe tener al menos 10 caracteres.'
  if (new TextEncoder().encode(p).length > 72) return 'La contraseña es demasiado larga (máximo 72 caracteres).'
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(p) || !/\d/.test(p)) return 'Usa al menos una letra y un número.'
  if (confirm !== undefined && p !== confirm) return 'Las contraseñas no coinciden.'
  return null
}

/** Primer mensaje útil de un ApiError (los 400 de validación traen detalles por campo) */
export const errorText = (e) => e?.details?.[0]?.message || e?.message || 'Algo salió mal. Inténtalo de nuevo.'

/**
 * Contraseña aleatoria segura (crypto.getRandomValues, sin sesgo de módulo) para el alta directa.
 * Sin caracteres que se confunden al dictarla (0/O, 1/l/I) y con mayúscula, minúscula, número y símbolo,
 * así siempre cumple passwordProblem().
 */
export function generatePassword(length = 16) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%*-_+?']
  const all = sets.join('')
  const rand = (n) => {
    const max = Math.floor(2 ** 32 / n) * n
    const buf = new Uint32Array(1)
    do crypto.getRandomValues(buf)
    while (buf[0] >= max)
    return buf[0] % n
  }
  const chars = sets.map((s) => s[rand(s.length)])
  while (chars.length < length) chars.push(all[rand(all.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/** Copia al portapapeles. Devuelve false si el navegador no lo permite (el texto queda visible para copiarlo a mano). */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
