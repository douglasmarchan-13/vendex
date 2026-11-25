import { at, monthOffset } from '../lib/dates'
import { DEFAULT_RATES } from '../lib/money'

// Datos de demostración: nombres, empresas, teléfonos y documentos son ficticios.

export const COUNTRIES = {
  PE: { code: 'PE', name: 'Perú', local: 'PEN', display: 'PEN', prefix: '+51', doc: 'RUC / DNI' },
  BO: { code: 'BO', name: 'Bolivia', local: 'BOB', display: 'BOB', prefix: '+591', doc: 'NIT / CI' },
  VE: { code: 'VE', name: 'Venezuela', local: 'VES', display: 'USD', prefix: '+58', doc: 'RIF / CI' },
}

export const GOAL_SHARE = { PE: 0.6, BO: 0.25, VE: 0.15 }

export const SELLERS = {
  andres: { id: 'andres', name: 'Andrés Ramírez', short: 'Andrés', country: 'PE' },
  daniela: { id: 'daniela', name: 'Daniela Ríos', short: 'Daniela', country: 'PE' },
  rodrigo: { id: 'rodrigo', name: 'Rodrigo Mamani', short: 'Rodrigo', country: 'BO' },
  andreina: { id: 'andreina', name: 'Andreína Pérez', short: 'Andreína', country: 'VE' },
}

export const CHANNELS = ['WhatsApp', 'Facebook', 'TikTok', 'Visita de campo', 'Referido', 'Feria agrícola', 'Llamada entrante']

export const STAGES = [
  { id: 'nuevo', name: 'Prospecto nuevo', dot: 'bg-slate-400' },
  { id: 'contactado', name: 'Contactado', dot: 'bg-sky-500' },
  { id: 'cotizacion', name: 'Cotización enviada', dot: 'bg-indigo-500' },
  { id: 'negociacion', name: 'En negociación', dot: 'bg-amber-500' },
  { id: 'cerrado', name: 'Venta cerrada', dot: 'bg-emerald-500' },
]

export const PRODUCTS = [
  { name: 'Molino de arroz compacto 1 TN/h', price: 9745 },
  { name: 'Molino de arroz 3 TN/h', price: 38500 },
  { name: 'Pulidora de arroz MN-25', price: 6350 },
  { name: 'Descascaradora 10x10', price: 7800 },
  { name: 'Pre-limpia / clasificadora', price: 14200 },
  { name: 'Selectora óptica de granos', price: 48000 },
  { name: 'Secadora de maíz 18 TN', price: 52000 },
  { name: 'Secadora de arroz 30 TN', price: 117000 },
  { name: 'Secadora de maíz 35 TN', price: 166000 },
  { name: 'Cosechadora de quinua 350', price: 33000 },
  { name: 'Elevador de cangilones 6 m', price: 3900 },
  { name: 'Horno industrial 80', price: 12500 },
  { name: 'Motocultor 15 HP', price: 1610 },
  { name: 'Tractor agrícola 90 HP', price: 42000 },
  { name: 'Cargador frontal 3 m³', price: 68000 },
]

const C = (id, name, company, country, city, region, phone, doc, channel, owner, temp, timeline, email) => ({
  id, name, company, country, city, region, phone, doc, channel, owner, temp,
  email: email || `${name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@correo-demo.com`,
  timeline: timeline.map(([d, type, text, by = owner], i) => ({ id: `${id}-t${i}`, at: at(-d, 10 + (i % 6), 15), type, text, by })),
})

const contacts = [
  // ---------- PERÚ ----------
  C('c1', 'Rosa Huamán Tello', 'Molinera Santa Rosa S.A.C.', 'PE', 'Nueva Cajamarca', 'San Martín', '+51 942 318 506', '20604815237', 'Facebook', 'andres', 'caliente', [
    [0, 'vista', 'Abrió tu cotización 3 veces hoy', 'sistema'],
    [2, 'llamada', 'Le parece elevado el precio. Pide financiamiento a 12 meses y 30% de inicial.'],
    [8, 'cotizacion', 'Se envió cotización formal + ficha técnica de la secadora 30 TN.'],
    [13, 'visita', 'Visita a su planta. Hoy seca al sol, pierde calidad en temporada de lluvias.'],
  ]),
  C('c2', 'Jorge Villanueva Ruiz', 'Grupo Agroindustrial Alfa S.A.C.', 'PE', 'Chiclayo', 'Lambayeque', '+51 979 651 961', '20395379233', 'Referido', 'andres', 'tibio', [
    [4, 'cotizacion', 'Se envió cotización de selectora óptica. Quedó en revisarla con su gerente.'],
    [9, 'llamada', 'Interesado en mejorar la calidad del arroz para exportación.'],
  ]),
  C('c3', 'Segundo Neyra Paredes', 'Molino Neyra E.I.R.L.', 'PE', 'San José de Sisa', 'San Martín', '+51 990 769 783', '10457213361', 'Visita de campo', 'daniela', 'frio', [
    [1, 'llamada', 'No contesta (3er intento).'],
    [3, 'llamada', 'No contesta.'],
    [6, 'llamada', 'No contesta.'],
    [12, 'visita', 'Conversamos en su molino. Pidió precio del molino compacto.'],
  ]),
  C('c4', 'Wilmer Inga Mendoza', 'Molino Carr. Ferreñafe', 'PE', 'Ferreñafe', 'Lambayeque', '+51 902 528 813', '46790785', 'Llamada entrante', 'andres', 'caliente', [
    [1, 'whatsapp', 'Pidió foto del tablero eléctrico y tiempo de entrega.'],
    [5, 'cotizacion', 'Se envió cotización del molino 3 TN/h.'],
  ]),
  C('c5', 'Gabriel Sandoval Cajusol', 'Molino Puente El Pavo', 'PE', 'Chiclayo', 'Lambayeque', '+51 980 134 602', '41805045', 'Referido', 'andres', 'caliente', [
    [3, 'venta', '¡Compró! Pulidora MN-25. Pagó 100% por transferencia.'],
    [10, 'cotizacion', 'Se envió cotización.'],
  ]),
  C('c6', 'Milagros Valle Llacsahuanga', '', 'PE', 'Bagua Grande', 'Amazonas', '+51 957 450 003', '72815530', 'TikTok', 'daniela', 'caliente', [
    [0, 'venta', '¡Compró! Motocultor 15 HP. Pago en soles.'],
    [4, 'whatsapp', 'Vio el video en TikTok y pidió precio en soles.'],
  ]),
  C('c7', 'Hugo Carrazco Díaz', 'Agro Carrazco', 'PE', 'Juanjuí', 'San Martín', '+51 939 132 719', '4181675', 'Visita de campo', 'andres', 'tibio', [
    [6, 'llamada', 'Sigue en proceso de mudanza del molino a Bellavista. Solicitó la trifásica; arranca campaña en junio. Pidió que lo llame a fin de mes.'],
    [40, 'cotizacion', 'Se envió cotización de la secadora 18 TN.'],
  ]),
  C('c8', 'Darwin Cruz Castillo', 'Agro Bajo Biavo', 'PE', 'Bajo Biavo', 'San Martín', '+51 935 634 824', '20611185520', 'Referido', 'daniela', 'tibio', [
    [1, 'llamada', 'El banco le otorgó el crédito. Lo invertirá primero en acopio de maíz; retoma la secadora en abril.'],
    [15, 'cotizacion', 'Le parece elevado el precio. Tiene amistad con otro proveedor.'],
  ]),
  C('c9', 'Martín Torres Ríos', 'Titanes del Oriente S.A.C.', 'PE', 'Nueva Cajamarca', 'San Martín', '+51 975 731 801', '20604824517', 'Facebook', 'andres', 'caliente', [
    [0, 'nota', 'Llegó por anuncio de Facebook. Quiere pulidora + descascaradora para ampliar su línea.'],
  ]),
  C('c10', 'Pedro Izuza Rengifo', '', 'PE', 'Juanjuí', 'San Martín', '+51 934 642 836', '45123987', 'Feria agrícola', 'daniela', 'tibio', [
    [2, 'nota', 'Se registró en la feria de Juanjuí. Pidió que lo llamen.'],
  ]),
  C('c11', 'Lucía Fernández Ojeda', 'Agroexportadora Piura Norte', 'PE', 'Piura', 'Piura', '+51 951 220 418', '20612233441', 'Visita de campo', 'andres', 'caliente', [
    [2, 'visita', '3ra visita: sigue interesada. Su limitante es que recién aperturó RUC y espera mejorar su historial crediticio.'],
    [7, 'llamada', 'Aún no cuenta con la liquidez, pero sigue interesada.'],
    [20, 'visita', 'Muy interesada. Enviar cotización.'],
  ]),
  C('c12', 'Kiara Saavedra Vílchez', 'Fundo Olmos Verde', 'PE', 'Olmos', 'Lambayeque', '+51 968 410 227', '20609981234', 'Visita de campo', 'daniela', 'tibio', [
    [3, 'llamada', 'Pidió más información y un video de la máquina. Llamar el miércoles pasadas las 4 pm.'],
  ]),
  C('c13', 'Jesús Delgado Ruiz', 'Molino Jhimar', 'PE', 'Chiclayo', 'Lambayeque', '+51 977 268 825', '20608047957', 'Facebook', 'andres', 'tibio', [
    [3, 'cotizacion', 'Se envió cotización de pre-limpia / clasificadora.'],
  ]),
  C('c14', 'Edith Torres Huamán', 'Molinos del Marañón', 'PE', 'Pomahuaca', 'Cajamarca', '+51 935 517 054', '20601144887', 'WhatsApp', 'andres', 'caliente', [
    [9, 'venta', '¡Compró! Molino 3 TN/h. Pago en soles, 50% adelanto.'],
    [18, 'cotizacion', 'Se envió cotización.'],
  ]),
  C('c15', 'Iván Cruz Paredes', '', 'PE', 'Pucallpa', 'Ucayali', '+51 919 053 251', '47788123', 'TikTok', 'daniela', 'frio', [
    [9, 'whatsapp', 'Está evaluando opciones de fabricación local.'],
  ]),

  // ---------- BOLIVIA ----------
  C('c16', 'Gilberto Chambi Copa', 'Quinua Real Challapata', 'BO', 'Challapata', 'Oruro', '+591 672 104 69', '4244125', 'Facebook', 'rodrigo', 'caliente', [
    [1, 'llamada', 'Quiere abonar la mitad en dólares y la mitad en bolivianos. Entrega en Desaguadero, lado boliviano.'],
    [6, 'cotizacion', 'Se envió cotización de la cosechadora de quinua 350.'],
  ]),
  C('c17', 'Juan Carlos Sambrana', 'Hacienda San Ignacio', 'BO', 'Riberalta', 'Beni', '+591 600 165 65', '5871203', 'TikTok', 'rodrigo', 'frio', [
    [11, 'llamada', 'Interesado en secadora, pero no cuenta con el monto completo. Quizás el próximo año.'],
  ]),
  C('c18', 'Kenji Higa Rojas', 'Panificadora Okinawa', 'BO', 'Montero', 'Santa Cruz', '+591 761 054 535', '3201390', 'Visita de campo', 'rodrigo', 'tibio', [
    [4, 'cotizacion', 'Desea cotizar horno, balanza y clasificadora de cilindro.'],
  ]),
  C('c19', 'Alberto Gutiérrez Vaca', 'Arrocera Trinidad S.R.L.', 'BO', 'Trinidad', 'Beni', '+591 713 171 40', '1028447025', 'Visita de campo', 'rodrigo', 'caliente', [
    [1, 'llamada', 'Confirmó que la asociación aprueba la compra en asamblea del viernes.'],
    [8, 'visita', 'Interesado en secadora y molino de arroz.'],
  ]),
  C('c20', 'Edgar Quispe Mamani', '', 'BO', 'Potosí', 'Potosí', '+591 676 372 49', '6612078', 'Facebook', 'rodrigo', 'caliente', [
    [0, 'nota', 'Escribió por Facebook: interesado en cosechadora de quinua 350.'],
  ]),
  C('c21', 'David Pérez Suárez', 'Asoc. de Productores Arroceros del Beni', 'BO', 'Trinidad', 'Beni', '+591 770 585 92', '1015577023', 'Visita de campo', 'rodrigo', 'caliente', [
    [6, 'venta', '¡Compró! Molino 3 TN/h. Pagó en bolivianos.'],
    [20, 'visita', 'Pertenece a la asociación. Presentación a la directiva.'],
  ]),

  // ---------- VENEZUELA ----------
  C('c22', 'Ricardo Bracho Lugo', 'Agropecuaria Los Llanos C.A.', 'VE', 'Calabozo', 'Guárico', '+58 414 512 3380', 'J-40518732-6', 'WhatsApp', 'andreina', 'caliente', [
    [1, 'whatsapp', 'Pidió videollamada con su socio para revisar la cotización.'],
    [4, 'cotizacion', 'Se envió cotización en USD de la secadora 30 TN.'],
  ]),
  C('c23', 'María Gabriela Linares', 'Arrocera Portuguesa C.A.', 'VE', 'Acarigua', 'Portuguesa', '+58 424 557 1902', 'J-31187459-0', 'Feria agrícola', 'andreina', 'tibio', [
    [3, 'llamada', 'Compara con otro proveedor. Pide garantía de 2 años y repuestos en stock.'],
    [10, 'cotizacion', 'Se envió cotización del molino 3 TN/h.'],
  ]),
  C('c24', 'José Rafael Mendoza', 'Finca El Samán', 'VE', 'Barinas', 'Barinas', '+58 416 873 2214', 'V-14552876', 'Feria agrícola', 'andreina', 'tibio', [
    [2, 'nota', 'Lo conocimos en Agroexpo. Quiere tractor para la próxima siembra.'],
  ]),
  C('c25', 'Yusmary Colmenares', 'Granos Cojedes', 'VE', 'San Carlos', 'Cojedes', '+58 412 330 9087', 'J-29874310-2', 'Referido', 'andreina', 'caliente', [
    [12, 'venta', '¡Compró! Pulidora MN-25. Pago en USD.'],
  ]),
  C('c26', 'Héctor Urdaneta', '', 'VE', 'Machiques', 'Zulia', '+58 414 690 4471', 'V-17220984', 'Facebook', 'andreina', 'frio', [
    [7, 'whatsapp', 'Preguntó precio en bolívares. Dijo que lo pensará.'],
  ]),
]

const D = (id, contactId, product, amount, currency, stage, temp, nextDays, nextAction, extra = {}) => ({
  id, contactId, product, amount, currency, stage, temp, nextAction,
  nextAt: at(nextDays, 9, 0),
  createdAt: at(-20, 9),
  ...extra,
})

const deals = [
  D('d1', 'c1', 'Secadora de arroz 30 TN', 117000, 'USD', 'negociacion', 'caliente', 0, 'Cerrar forma de pago (12 meses)'),
  D('d2', 'c2', 'Selectora óptica de granos', 45000, 'USD', 'cotizacion', 'tibio', -1, 'Seguimiento a cotización'),
  D('d3', 'c3', 'Molino de arroz compacto 1 TN/h', 36250, 'PEN', 'contactado', 'frio', 0, 'Enviar video por WhatsApp'),
  D('d4', 'c4', 'Molino de arroz 3 TN/h', 38500, 'USD', 'cotizacion', 'caliente', 1, 'Enviar foto del tablero eléctrico'),
  D('d5', 'c5', 'Pulidora de arroz MN-25', 6350, 'USD', 'cerrado', 'caliente', 0, 'Coordinar instalación', { closedAt: at(monthOffset(3), 16) }),
  D('d6', 'c6', 'Motocultor 15 HP', 6000, 'PEN', 'cerrado', 'caliente', 0, 'Entrega en Bagua Grande', { closedAt: at(0, 8, 40) }),
  D('d7', 'c7', 'Secadora de maíz 18 TN', 52000, 'USD', 'negociacion', 'tibio', 0, 'Llamar: ¿ya tiene la trifásica?'),
  D('d8', 'c8', 'Secadora de maíz 18 TN', 52000, 'USD', 'contactado', 'tibio', 3, 'Proponer separar con 30%'),
  D('d9', 'c9', 'Pulidora + descascaradora', 14150, 'USD', 'nuevo', 'caliente', 0, 'Visita a planta'),
  D('d10', 'c10', 'Molino de arroz compacto 1 TN/h', 9745, 'USD', 'nuevo', 'tibio', 1, 'Primera llamada'),
  D('d11', 'c11', 'Cargador frontal 3 m³', 68000, 'USD', 'contactado', 'caliente', 2, 'Revisar opciones de leasing'),
  D('d12', 'c12', 'Secadora de maíz 18 TN', 52000, 'USD', 'nuevo', 'tibio', 0, 'Llamar después de las 4 pm'),
  D('d13', 'c13', 'Pre-limpia / clasificadora', 52800, 'PEN', 'cotizacion', 'tibio', -2, 'Seguimiento a cotización'),
  D('d14', 'c14', 'Molino de arroz 3 TN/h', 143220, 'PEN', 'cerrado', 'caliente', 0, 'Cobrar saldo 50%', { closedAt: at(monthOffset(9), 12) }),
  D('d15', 'c15', 'Descascaradora 10x10', 7800, 'USD', 'contactado', 'frio', 6, 'Reenviar comparativo'),
  D('d16', 'c16', 'Cosechadora de quinua 350', 33000, 'USD', 'negociacion', 'caliente', 0, 'Confirmar pago mixto USD / Bs'),
  D('d17', 'c17', 'Secadora de maíz 35 TN', 166000, 'USD', 'contactado', 'frio', 30, 'Retomar contacto'),
  D('d18', 'c18', 'Horno industrial 80 + balanza', 94600, 'BOB', 'cotizacion', 'tibio', 1, 'Seguimiento a cotización'),
  D('d19', 'c19', 'Secadora + molino de arroz', 155500, 'USD', 'negociacion', 'caliente', 2, 'Asamblea de la asociación'),
  D('d20', 'c20', 'Cosechadora de quinua 350', 33000, 'USD', 'nuevo', 'caliente', 0, 'Primera llamada'),
  D('d21', 'c21', 'Molino de arroz 3 TN/h', 268000, 'BOB', 'cerrado', 'caliente', 0, 'Programar capacitación', { closedAt: at(monthOffset(6), 11) }),
  D('d22', 'c22', 'Secadora de arroz 30 TN', 117000, 'USD', 'cotizacion', 'caliente', 0, 'Videollamada con el socio'),
  D('d23', 'c23', 'Molino de arroz 3 TN/h', 38500, 'USD', 'negociacion', 'tibio', 1, 'Enviar condiciones de garantía'),
  D('d24', 'c24', 'Tractor agrícola 90 HP', 42000, 'USD', 'nuevo', 'tibio', 2, 'Enviar ficha técnica'),
  D('d25', 'c25', 'Pulidora de arroz MN-25', 6350, 'USD', 'cerrado', 'caliente', 0, 'Postventa', { closedAt: at(monthOffset(12), 15) }),
  D('d26', 'c26', 'Motocultor 15 HP', 394450, 'VES', 'contactado', 'frio', 4, 'Enviar precio actualizado'),
]

const T = (id, h, m, type, contactId, title, done = false, day = 0) => ({ id, at: at(day, h, m), type, contactId, title, done })

const tasks = [
  T('t0', 8, 0, 'visita', 'c6', 'Entrega del motocultor', true),
  T('t1', 8, 30, 'llamada', 'c1', 'Cerrar forma de pago (financiamiento 12 meses)', true),
  T('t2', 9, 30, 'whatsapp', 'c3', 'Enviar video del molino compacto (no contesta llamadas)'),
  T('t3', 10, 0, 'reunion', 'c16', 'Videollamada: pago mixto USD / Bs y entrega en Desaguadero'),
  T('t4', 11, 30, 'llamada', 'c2', 'Seguimiento a cotización de selectora óptica'),
  T('t5', 15, 0, 'visita', 'c9', 'Visita a planta en Nueva Cajamarca'),
  T('t6', 16, 15, 'llamada', 'c12', 'Llamar pasadas las 4 pm'),
  T('t7', 17, 30, 'reunion', 'c22', 'Videollamada con el socio (Calabozo)'),
  T('t8', 10, 0, 'llamada', 'c13', 'Seguimiento a cotización de pre-limpia', false, -2),
]

const alerts = [
  { id: 'a1', kind: 'hot', contactId: 'c1', title: 'Rosa Huamán abrió tu cotización 3 veces hoy', body: 'Secadora de arroz 30 TN · es el mejor momento para llamar.', actions: ['call', 'whatsapp'] },
  { id: 'a2', kind: 'stale', contactId: 'c2', title: 'Llevas 4 días sin contactar a Grupo Agroindustrial Alfa', body: 'Cotización de US$ 45,000 en espera. Un mensaje corto lo mantiene activo.', actions: ['whatsapp', 'snooze'] },
  { id: 'a3', kind: 'fx', contactId: 'c16', title: 'Gilberto quiere pagar mitad en USD y mitad en Bs', body: 'Prepara el desglose con el tipo de cambio del día antes de la videollamada.', actions: ['split', 'snooze'] },
  { id: 'a4', kind: 'noanswer', contactId: 'c3', title: 'Segundo Neyra no contesta (3 intentos)', body: 'Cambia de canal: un video de la máquina por WhatsApp suele tener respuesta.', actions: ['whatsapp', 'snooze'] },
  { id: 'a5', kind: 'promise', contactId: 'c7', title: 'Hugo Carrazco te pidió que lo llames a fin de mes', body: 'Ya solicitó la instalación trifásica. Confirma si mantiene la campaña de junio.', actions: ['call', 'snooze'] },
  { id: 'a6', kind: 'credit', contactId: 'c8', title: 'A Darwin Cruz le aprobaron el crédito bancario', body: 'Propón separar la secadora con 30% antes de que lo invierta todo en acopio.', actions: ['whatsapp', 'snooze'] },
  { id: 'a7', kind: 'stale', contactId: 'c23', title: 'María Gabriela pide garantía de 2 años', body: 'Envía condiciones de garantía y stock de repuestos en Acarigua hoy.', actions: ['whatsapp', 'snooze'] },
]

const strategy = [
  { id: 's1', kind: 'enfoque', title: 'Enfoque de la semana', body: 'Cerrar las 3 secadoras en negociación antes de la campaña de arroz.\nPrioridad: San Martín (Perú) y Beni (Bolivia).\nMeta: 2 visitas de campo por día en Nueva Cajamarca.' },
  { id: 's2', kind: 'promo', title: 'Promociones vigentes', body: 'Secadoras: instalación y capacitación gratis hasta el 15 del próximo mes.\nMolino compacto: 10% de descuento pagando al contado.\nBolivia: entrega sin costo hasta Desaguadero.' },
  { id: 's3', kind: 'guion', title: 'Guion: cliente que dice "está caro"', body: 'Entiendo, don ___. Comparemos lo que pierde hoy secando al sol: merma, precio castigado y días de espera. Con la secadora recupera la inversión en ___ campañas. ¿Le preparo una simulación con financiamiento a 12 meses?' },
  { id: 's4', kind: 'guion', title: 'Guion: cliente que no contesta', body: 'Buenas tardes ___, le escribe Andrés de Vendex. Le dejo un video de 40 segundos del molino trabajando en Juanjuí. Si le interesa, ¿le llamo mañana a las 9 o prefiere a las 4?' },
]

export function seed() {
  return {
    contacts,
    deals,
    tasks,
    alerts,
    strategy,
    goalUSD: 250000,
    rates: { ...DEFAULT_RATES },
    plan: { ticketUSD: 45000, closeRate: 25, quoteRate: 40, callsPerLead: 4, workDays: 22 },
  }
}
