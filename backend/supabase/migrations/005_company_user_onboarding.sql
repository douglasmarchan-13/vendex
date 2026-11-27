-- =============================================================================
--  VENDEX · Migración 005 — Método de alta de usuarios por empresa
-- =============================================================================
--  Requisito: 004. Re-ejecutable y no borra datos.
--
--  · companies.user_onboarding: cómo se crean las cuentas de la empresa (lo decide el super admin).
--      invitacion → enlace por correo; el usuario elige su contraseña (flujo original).
--      directa    → se crea activa con contraseña temporal; el usuario la cambia al entrar.
--    Aplica al gerente que crea el super admin y a los usuarios que agrega el gerente.
--    Las empresas existentes quedan en 'invitacion' (sin cambios de comportamiento).
--  · Las invitaciones pendientes siguen valiendo aunque la empresa pase a 'directa'.
-- =============================================================================

begin;

alter table public.companies
  add column if not exists user_onboarding text not null default 'invitacion';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'companies_user_onboarding_chk') then
    alter table public.companies add constraint companies_user_onboarding_chk
      check (user_onboarding in ('invitacion', 'directa'));
  end if;
end $$;

commit;
