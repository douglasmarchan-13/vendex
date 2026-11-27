import type { PostgrestError } from '@supabase/supabase-js'
import { ApiError } from './api-error.js'

// Mensajes lanzados con RAISE EXCEPTION desde las funciones SQL de supabase/vendex.sql
const KNOWN: Record<string, [number, string]> = {
  deal_not_found: [404, 'Trato no encontrado'],
  payment_not_found: [404, 'Cuota no encontrada'],
  contact_not_found: [404, 'Contacto no encontrado'],
  invalid_stage: [400, 'Etapa no válida'],
  items_required: [400, 'El plan de cobro necesita al menos una cuota'],
  payment_already_paid: [409, 'Esta cuota ya está pagada'],
  invalid_amount: [400, 'El monto debe ser mayor a cero'],
  method_required: [400, 'Indica el medio de pago'],
  // Multiempresa y autenticación (migraciones 001 y 002)
  cross_tenant_reference: [400, 'El registro pertenece a otra empresa'],
  company_required: [400, 'No se pudo determinar la empresa del registro'],
  company_change_not_allowed: [400, 'Un contacto no puede cambiar de empresa'],
  invitation_not_found: [404, 'Invitación no encontrada'],
  invitation_revoked: [410, 'Esta invitación fue anulada. Pide una nueva.'],
  invitation_used: [410, 'Esta invitación ya fue usada. Inicia sesión.'],
  invitation_expired: [410, 'La invitación venció. Pide que te la reenvíen.'],
  name_required: [400, 'Indica tu nombre'],
  company_suspended: [403, 'La cuenta de la empresa está suspendida'],
  email_in_use: [409, 'Ese correo ya tiene una cuenta en Vendex'],
  no_seats: [409, 'La empresa no tiene cupos disponibles'],
  seller_unavailable: [409, 'Ese vendedor ya tiene un usuario'],
  reset_invalid: [400, 'El enlace no es válido o ya venció. Solicita uno nuevo.'],
  // Alta directa (migración 004)
  invalid_role: [400, 'Rol no válido'],
  company_not_found: [404, 'Empresa no encontrada'],
}

/** Traduce un error de PostgREST / Postgres a ApiError */
export function fromDbError(err: PostgrestError): ApiError {
  const known = KNOWN[err.message]
  if (known) return new ApiError(known[0], known[1])
  switch (err.code) {
    case 'PGRST116':
    case 'P0002':
      return new ApiError(404, 'Registro no encontrado')
    case '23505':
      return new ApiError(409, 'Ya existe un registro con esos datos', err.details)
    case '23503':
      return new ApiError(409, 'Referencia inválida o registro en uso', err.details)
    case '23514':
    case '23502':
    case '22P02':
    case '22023':
    case '22007':
      return new ApiError(400, 'Datos no válidos', err.message)
    default: {
      const e = new ApiError(500, 'Error de base de datos', err.message)
      e.cause = err
      return e
    }
  }
}
