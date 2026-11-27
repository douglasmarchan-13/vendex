-- =============================================================================
--  VENDEX · Migración 002 — Tipo de cambio y medios de pago por empresa + RPC de autenticación
-- =============================================================================
--  Requisito: 001_auth_multitenant.sql. Re-ejecutable y no borra datos.
--
--  · currencies queda como catálogo global (símbolo, nombre, locale). Su rate_per_usd pasa a
--    ser solo el valor inicial para empresas nuevas; el tipo de cambio de cada empresa vive en
--    company_currency_rates (el backend actual sigue leyendo currencies hasta el Paso 4).
--  · pay_methods pasa a ser por empresa: llave (company_id, country_code, name).
--  · invitations.seller_id: permite invitar a un vendedor que YA existe (p. ej. Andrés, Daniela)
--    para que al aceptar su usuario quede enlazado a sus clientes actuales.
--  · Funciones atómicas para el backend: accept_invitation y complete_password_reset.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. TIPO DE CAMBIO POR EMPRESA
-- -----------------------------------------------------------------------------
create table if not exists public.company_currency_rates (
  company_id    uuid not null references public.companies(id) on delete cascade,
  code          text not null references public.currencies(code),
  rate_per_usd  numeric(18,6) not null check (rate_per_usd > 0),
  updated_at    timestamptz not null default now(),
  primary key (company_id, code)
);

insert into public.company_currency_rates (company_id, code, rate_per_usd)
select co.id, cu.code, cu.rate_per_usd
  from public.companies co cross join public.currencies cu
on conflict (company_id, code) do nothing;

drop trigger if exists company_currency_rates_touch on public.company_currency_rates;
create trigger company_currency_rates_touch before update on public.company_currency_rates
  for each row execute function public.vx_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 2. MEDIOS DE PAGO POR EMPRESA
-- -----------------------------------------------------------------------------
alter table public.pay_methods add column if not exists company_id uuid;
-- DEFAULT temporal (igual que en 001): el backend actual aún no envía company_id
alter table public.pay_methods alter column company_id set default '00000000-0000-4000-8000-000000000001'::uuid;
update public.pay_methods set company_id = '00000000-0000-4000-8000-000000000001' where company_id is null;
alter table public.pay_methods alter column company_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pay_methods_company_id_fkey') then
    alter table public.pay_methods add constraint pay_methods_company_id_fkey
      foreign key (company_id) references public.companies(id) on delete cascade;
  end if;
  -- La llave primaria pasa de (country_code, name) a (company_id, country_code, name)
  if exists (select 1 from pg_constraint
              where conname = 'pay_methods_pkey'
                and pg_get_constraintdef(oid) not like '%company_id%') then
    alter table public.pay_methods drop constraint pay_methods_pkey;
    alter table public.pay_methods add constraint pay_methods_pkey primary key (company_id, country_code, name);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3. VALORES INICIALES DE UNA EMPRESA NUEVA (reemplaza la función de 001)
--    configuración + tipo de cambio actual + medios de pago habituales por país
-- -----------------------------------------------------------------------------
create or replace function public.vx_company_defaults()
returns trigger language plpgsql as $$
begin
  insert into public.company_settings (company_id) values (new.id) on conflict do nothing;

  insert into public.company_currency_rates (company_id, code, rate_per_usd)
  select new.id, code, rate_per_usd from public.currencies
  on conflict do nothing;

  insert into public.pay_methods (company_id, country_code, name, position)
  select new.id, v.country, v.name, v.pos
    from (values
      ('PE', 'Transferencia', 1), ('PE', 'Depósito', 2), ('PE', 'Yape / Plin', 3), ('PE', 'Efectivo', 4), ('PE', 'Cheque', 5),
      ('BO', 'Transferencia', 1), ('BO', 'Depósito', 2), ('BO', 'QR Simple', 3), ('BO', 'Efectivo', 4),
      ('VE', 'Zelle', 1), ('VE', 'Transferencia', 2), ('VE', 'Pago móvil', 3), ('VE', 'Efectivo (USD)', 4)
    ) as v(country, name, pos)
    where exists (select 1 from public.countries c where c.code = v.country)
  on conflict do nothing;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 4. INVITAR A UN VENDEDOR EXISTENTE
-- -----------------------------------------------------------------------------
alter table public.invitations add column if not exists seller_id text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'invitations_seller_id_fkey') then
    alter table public.invitations add constraint invitations_seller_id_fkey
      foreign key (seller_id) references public.sellers(id) on delete set null;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 5. ACEPTAR INVITACIÓN (atómico)
--    p_token_hash    = sha256(token) en hex
--    p_password_hash = hash bcrypt calculado en el backend
--    Crea el usuario, crea o enlaza su fila en sellers y marca la invitación como aceptada.
-- -----------------------------------------------------------------------------
create or replace function public.accept_invitation(p_token_hash text, p_name text, p_password_hash text)
returns jsonb language plpgsql as $$
declare
  inv        public.invitations;
  co         public.companies;
  v_user     public.users;
  v_name     text := trim(coalesce(p_name, ''));
  v_seller   text;
  v_active   int;
begin
  select * into inv from public.invitations where token_hash = p_token_hash for update;
  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;
  if inv.revoked_at is not null then
    raise exception 'invitation_revoked' using errcode = '22023';
  end if;
  if inv.accepted_at is not null then
    raise exception 'invitation_used' using errcode = '22023';
  end if;
  if inv.expires_at < now() then
    raise exception 'invitation_expired' using errcode = '22023';
  end if;
  if v_name = '' then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if coalesce(p_password_hash, '') !~ '^\$2[aby]\$\d\d\$' then
    raise exception 'invalid_password_hash' using errcode = '22023';
  end if;

  -- Bloquea la empresa para que dos aceptaciones simultáneas no excedan los cupos
  select * into co from public.companies where id = inv.company_id for update;
  if co.status = 'suspendida' then
    raise exception 'company_suspended' using errcode = '22023';
  end if;
  if exists (select 1 from public.users where email = inv.email) then
    raise exception 'email_in_use' using errcode = '22023';
  end if;
  select count(*) into v_active from public.users where company_id = co.id and status = 'activo';
  if v_active >= co.seats then
    raise exception 'no_seats' using errcode = '22023';
  end if;

  insert into public.users (company_id, email, password_hash, name, role)
  values (co.id, inv.email, p_password_hash, v_name, inv.role)
  returning * into v_user;

  if inv.seller_id is not null then
    -- Vendedor existente: se enlaza (debe ser de la misma empresa y no tener usuario)
    update public.sellers
       set user_id = v_user.id, email = inv.email, active = true
     where id = inv.seller_id and company_id = co.id and user_id is null
    returning id into v_seller;
    if v_seller is null then
      raise exception 'seller_unavailable' using errcode = '22023';
    end if;
  else
    v_seller := gen_random_uuid()::text;
    insert into public.sellers (id, name, short_name, country_code, email, user_id, company_id)
    values (v_seller, v_name, split_part(v_name, ' ', 1),
            coalesce(inv.country_code, co.country_code, 'PE'), inv.email, v_user.id, co.id);
  end if;

  update public.invitations set accepted_at = now(), accepted_user_id = v_user.id where id = inv.id;

  return jsonb_build_object('user_id', v_user.id, 'seller_id', v_seller, 'company_id', co.id);
end $$;

-- -----------------------------------------------------------------------------
-- 6. COMPLETAR RECUPERACIÓN DE CONTRASEÑA (atómico, un solo uso)
--    Invalida todos los enlaces pendientes del usuario y los JWT emitidos antes.
-- -----------------------------------------------------------------------------
create or replace function public.complete_password_reset(p_token_hash text, p_password_hash text)
returns uuid language plpgsql as $$
declare
  r public.password_resets;
begin
  select * into r from public.password_resets where token_hash = p_token_hash for update;
  if not found or r.used_at is not null or r.expires_at < now() then
    raise exception 'reset_invalid' using errcode = '22023';
  end if;
  if coalesce(p_password_hash, '') !~ '^\$2[aby]\$\d\d\$' then
    raise exception 'invalid_password_hash' using errcode = '22023';
  end if;

  update public.users
     set password_hash = p_password_hash, password_changed_at = now(),
         failed_login_attempts = 0, locked_until = null
   where id = r.user_id and status = 'activo';
  if not found then
    raise exception 'reset_invalid' using errcode = '22023';
  end if;

  update public.password_resets set used_at = now() where user_id = r.user_id and used_at is null;
  return r.user_id;
end $$;

-- -----------------------------------------------------------------------------
-- 7. SEGURIDAD
-- -----------------------------------------------------------------------------
alter table public.company_currency_rates enable row level security;

do $$
declare f text;
begin
  foreach f in array array[
    'public.accept_invitation(text, text, text)',
    'public.complete_password_reset(text, text)'
  ] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on all tables in schema public to service_role;
  end if;
end $$;

commit;

-- PASO 4 (NO ejecutar todavía):
--  alter table public.pay_methods alter column company_id drop default;
