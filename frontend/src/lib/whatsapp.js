// WhatsApp: plantillas por defecto, variables y enlace wa.me.
// Cada vendedor puede reemplazar una plantilla por defecto o crear las suyas (backend: /templates).
import { COUNTRIES } from '../data/mock'

/** Variables que el vendedor puede usar en sus plantillas */
export const VARS = [
  { key: 'nombre', label: 'Nombre del cliente' },
  { key: 'firma', label: 'Tu firma (nombre + empresa)' },
  { key: 'asesor', label: 'Tu nombre' },
  { key: 'empresa', label: 'Tu empresa' },
  { key: 'producto', label: 'Producto' },
  { key: 'precio', label: 'Precio' },
  { key: 'monto', label: 'Monto de la cuota', kind: 'cobranza' },
  { key: 'cuota', label: 'Nombre de la cuota', kind: 'cobranza' },
  { key: 'vencimiento', label: 'Vencimiento', kind: 'cobranza' },
]

/** Plantillas por defecto. `kind` separa las de venta de las de cobranza. */
export const DEFAULT_TEMPLATES = [
  { key: 'seguimiento', kind: 'venta', label: 'Seguimiento', body: 'Hola {nombre}, buen día. Le escribe {firma}. ¿Pudo revisar la cotización de {producto} ({precio})? Quedo atento a sus dudas para avanzar.' },
  { key: 'video', kind: 'venta', label: 'Enviar video', body: 'Hola {nombre}, le escribe {asesor}. Intenté llamarlo, le dejo un video de 40 segundos de {producto} trabajando en planta. ¿Le llamo mañana a las 9 o prefiere a las 4?' },
  { key: 'separar', kind: 'venta', label: 'Separar equipo', body: 'Hola {nombre}, ¡felicitaciones por la aprobación del crédito! Puede separar {producto} con solo 30% de adelanto y asegurar la entrega antes de la campaña. ¿Le preparo la proforma?' },
  { key: 'promo', kind: 'venta', label: 'Promoción', body: 'Hola {nombre}, este mes tenemos instalación y capacitación gratis en secadoras y 10% de descuento al contado en molinos compactos. ¿Le interesa que le envíe el detalle?' },
  { key: 'cobro', kind: 'cobranza', label: 'Recordatorio amable', body: 'Hola {nombre}, buen día. Le escribe {firma}. Le recordamos que el pago de {cuota} de su {producto} por {monto} {vencimiento}. ¿Nos confirma la fecha de pago? Cualquier duda, con gusto le ayudo.' },
  { key: 'firme', kind: 'cobranza', label: 'Cobro vencido', body: 'Hola {nombre}, le escribe {firma}. Su pago de {monto} ({cuota}, {producto}) {vencimiento} y figura pendiente. Para mantener vigente su garantía y servicio técnico, le pedimos regularizarlo esta semana. ¿Qué día podemos contar con el pago?' },
  { key: 'acuerdo', kind: 'cobranza', label: 'Proponer acuerdo', body: 'Hola {nombre}, entendemos que la campaña puede retrasar los ingresos. Para su pago de {monto} podemos dividirlo en dos abonos. ¿Le parece bien la mitad esta semana y el resto en 15 días?' },
]
const DEFAULT_KEYS = new Set(DEFAULT_TEMPLATES.map((t) => t.key))
export const isDefaultKey = (key) => DEFAULT_KEYS.has(key)

/**
 * Plantillas del tipo pedido: las por defecto (o la versión del vendedor si la editó) y luego las propias.
 * `custom`: [{ key, kind, label, body }] que devuelve GET /templates.
 */
export function mergeTemplates(custom = [], kind) {
  const mine = new Map(custom.map((t) => [t.key, t]))
  const base = DEFAULT_TEMPLATES.map((t) => (mine.has(t.key) ? { ...mine.get(t.key), edited: true } : t))
  const own = custom.filter((t) => !DEFAULT_KEYS.has(t.key)).map((t) => ({ ...t, own: true }))
  return [...base, ...own].filter((t) => !kind || t.kind === kind)
}

/** Reemplaza {variable} por su valor. Las variables sin valor desaparecen y se limpian espacios/paréntesis sobrantes. */
export function renderTemplate(body, vars) {
  return body
    .replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k] ?? '') : m))
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([?.,!])/g, '$1')
    .trim()
}

/**
 * Número en formato internacional solo con dígitos (lo que pide wa.me).
 * "+51 942 318 506" → "51942318506"; "942318506" (PE) → "51942318506"; "0414-1234567" (VE) → "584141234567".
 */
export function waPhone(phone, country) {
  const raw = String(phone || '').trim()
  if (!raw) return ''
  let digits = raw.replace(/\D/g, '')
  if (raw.startsWith('+')) return digits
  if (digits.startsWith('00')) return digits.slice(2)
  const prefix = (COUNTRIES[country]?.prefix || '').replace(/\D/g, '')
  digits = digits.replace(/^0+/, '')
  if (!prefix || (digits.startsWith(prefix) && digits.length >= prefix.length + 8)) return digits
  return prefix + digits
}

/** Enlace que abre el chat con el mensaje escrito (app en el celular, WhatsApp Web en la PC) */
export const waLink = (phone, text) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
