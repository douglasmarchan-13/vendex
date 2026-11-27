import { at } from '../lib/dates'

// Datos de demostración: empresas, personas, correos y documentos son ficticios.

const U = (id, companyId, name, role, country, status, opts = {}) => ({
  id,
  companyId,
  name,
  email: opts.email || `${name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@${opts.domain || 'empresa-demo.com'}`,
  phone: opts.phone || '',
  country,
  role,
  status,
  invitedAt: at(opts.invited ?? -90, 10),
  invitedBy: opts.by || 'Super admin',
  ...(status === 'activo' || status === 'inactivo'
    ? { joinedAt: at((opts.invited ?? -90) + 1, 11), lastSeenAt: at(opts.seen ?? 0, 8 + (id.length % 9), 20) }
    : { expiresAt: at((opts.invited ?? -1) + 7, 23, 59), token: opts.token || `demo${id}` }),
})

export function seedPlatform() {
  const d1 = 'andina-demo.com'
  const members = [
    // Andina Agro Maquinarias — la empresa de la app de ventas
    U('u-andres', 'co1', 'Andrés Ramírez', 'gerente', 'PE', 'activo', { domain: d1, invited: -210, phone: '+51 987 654 321' }),
    U('u-daniela', 'co1', 'Daniela Ríos', 'vendedor', 'PE', 'activo', { domain: d1, invited: -200, by: 'Andrés Ramírez' }),
    U('u-rodrigo', 'co1', 'Rodrigo Mamani', 'supervisor', 'BO', 'activo', { domain: d1, invited: -180, by: 'Andrés Ramírez', seen: -1 }),
    U('u-andreina', 'co1', 'Andreína Pérez', 'vendedor', 'VE', 'activo', { domain: d1, invited: -120, by: 'Andrés Ramírez', seen: -3 }),
    U('u-luis', 'co1', 'Luis Quispe', 'vendedor', 'PE', 'invitado', { domain: d1, invited: -2, by: 'Andrés Ramírez' }),
    U('u-carla', 'co1', 'Carla Suárez', 'vendedor', 'BO', 'inactivo', { domain: d1, invited: -160, by: 'Andrés Ramírez', seen: -40 }),

    // Ferretería El Progreso — en prueba
    U('u-mario', 'co2', 'Mario Choque', 'gerente', 'BO', 'activo', { domain: 'elprogreso-demo.com', invited: -6 }),
    U('u-ines', 'co2', 'Inés Vargas', 'vendedor', 'BO', 'activo', { domain: 'elprogreso-demo.com', invited: -5, by: 'Mario Choque' }),
    U('u-pablo', 'co2', 'Pablo Rojas', 'vendedor', 'BO', 'invitado', { domain: 'elprogreso-demo.com', invited: -3, by: 'Mario Choque' }),

    // Distribuidora Llanos del Sur — esperando que el gerente acepte
    U('u-yelitza', 'co3', 'Yelitza Montilla', 'gerente', 'VE', 'invitado', { domain: 'llanosdelsur-demo.com', invited: -2 }),

    // Agroinsumos Pacífico — plan Empresa
    U('u-patricia', 'co4', 'Patricia Salazar', 'gerente', 'PE', 'activo', { domain: 'agropacifico-demo.com', invited: -300 }),
    ...['Jorge Castillo', 'Milagros Torres', 'Kevin Paredes', 'Lucía Flores', 'Renzo Gutiérrez', 'Sofía Medina', 'Hugo Ccori'].map((name, i) =>
      U(`u-ap${i}`, 'co4', name, i === 0 ? 'supervisor' : 'vendedor', 'PE', 'activo', { domain: 'agropacifico-demo.com', invited: -280 + i * 20, by: 'Patricia Salazar', seen: -(i % 3) })
    ),

    // Comercial Altiplano — suspendida
    U('u-teresa', 'co5', 'Teresa Condori', 'gerente', 'BO', 'activo', { domain: 'altiplano-demo.com', invited: -150, seen: -35 }),
    U('u-ruben', 'co5', 'Rubén Apaza', 'vendedor', 'BO', 'activo', { domain: 'altiplano-demo.com', invited: -140, by: 'Teresa Condori', seen: -36 }),

    // Importadora Oriente — la invitación al gerente venció
    U('u-gabriel', 'co6', 'Gabriel Justiniano', 'gerente', 'BO', 'invitado', { domain: 'oriente-demo.com', invited: -12 }),
  ]

  const companies = [
    { id: 'co1', name: 'Andina Agro Maquinarias', legalName: 'Andina Agro Maquinarias S.A.C.', taxId: '20601234567', country: 'PE', countries: ['PE', 'BO', 'VE'], industry: 'Maquinaria agrícola', plan: 'pro', seats: 15, status: 'activa', trialEndsAt: null, managerId: 'u-andres', createdAt: at(-210, 9), notes: '' },
    { id: 'co2', name: 'Ferretería El Progreso', legalName: 'Ferretería El Progreso S.R.L.', taxId: '1023456029', country: 'BO', countries: ['BO'], industry: 'Ferretería y construcción', plan: 'basico', seats: 5, status: 'prueba', trialEndsAt: at(8, 23, 59), managerId: 'u-mario', createdAt: at(-6, 15), notes: 'Llegó por referido de Andina.' },
    { id: 'co3', name: 'Distribuidora Llanos del Sur', legalName: 'Distribuidora Llanos del Sur, C.A.', taxId: 'J-40123456-7', country: 'VE', countries: ['VE'], industry: 'Distribución y consumo masivo', plan: 'pro', seats: 15, status: 'activa', trialEndsAt: null, managerId: 'u-yelitza', createdAt: at(-2, 11), notes: '' },
    { id: 'co4', name: 'Agroinsumos Pacífico', legalName: 'Agroinsumos del Pacífico S.A.', taxId: '20559871234', country: 'PE', countries: ['PE'], industry: 'Agroinsumos', plan: 'empresa', seats: 50, status: 'activa', trialEndsAt: null, managerId: 'u-patricia', createdAt: at(-300, 10), notes: '' },
    { id: 'co5', name: 'Comercial Altiplano', legalName: 'Comercial Altiplano Ltda.', taxId: '3012457018', country: 'BO', countries: ['BO', 'PE'], industry: 'Maquinaria agrícola', plan: 'basico', seats: 5, status: 'suspendida', suspendedReason: 'Dos meses de pago pendiente', trialEndsAt: null, managerId: 'u-teresa', createdAt: at(-150, 10), notes: '' },
    { id: 'co6', name: 'Importadora Oriente', legalName: 'Importadora Oriente S.A.', taxId: '1028877016', country: 'BO', countries: ['BO', 'PE'], industry: 'Tecnología', plan: 'pro', seats: 15, status: 'prueba', trialEndsAt: at(2, 23, 59), managerId: 'u-gabriel', createdAt: at(-12, 16), notes: 'El gerente no ha abierto la invitación.' },
  ]

  const L = (d, companyId, text, actor = 'Super admin', kind = 'info') => ({ id: `l${companyId}${d}${text.length}`, at: at(d, 10 + (text.length % 8), text.length % 60), companyId, actor, text, kind })
  const log = [
    L(-1, 'co1', 'Andrés Ramírez invitó a Luis Quispe como vendedor', 'Andrés Ramírez'),
    L(-2, 'co3', 'Invitación de gerente enviada a yelitza@llanosdelsur-demo.com'),
    L(-2, 'co3', 'Empresa creada con plan Profesional', 'Super admin', 'success'),
    L(-3, 'co2', 'Mario Choque invitó a Pablo Rojas como vendedor', 'Mario Choque'),
    L(-5, 'co2', 'Inés Vargas aceptó la invitación y activó su cuenta', 'Inés Vargas', 'success'),
    L(-5, 'co2', 'Mario Choque aceptó la invitación y activó su cuenta', 'Mario Choque', 'success'),
    L(-6, 'co2', 'Empresa creada con plan Básico (prueba de 14 días)', 'Super admin', 'success'),
    L(-12, 'co6', 'Empresa creada con plan Profesional (prueba de 14 días)', 'Super admin', 'success'),
    L(-20, 'co5', 'Acceso suspendido: Dos meses de pago pendiente', 'Super admin', 'danger'),
    L(-40, 'co1', 'Carla Suárez fue desactivado', 'Andrés Ramírez', 'danger'),
  ]

  return { companies, members, log }
}
