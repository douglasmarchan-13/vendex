-- =============================================================================
--  VENDEX · Migración 001 — Autenticación propia + multiempresa (multi-tenant) + roles
-- =============================================================================
--  Requisito: haber ejecutado antes backend/supabase/vendex.sql.
--  Cómo usarlo: Supabase Dashboard → SQL Editor → pegar este archivo → Run
--               (o: psql "$SUPABASE_DB_URL" -f backend/supabase/migrations/001_auth_multitenant.sql)
--
--  Es re-ejecutable y NO borra datos:
--    · Crea companies, users, invitations, password_resets y company_settings.
--    · Agrega company_id a las tablas de negocio y asigna TODO lo existente a la
--      empresa "legado" (la demo: Andina Agro Maquinarias).
--    · El "vendedor_id" ya existe con otro nombre y no se duplica:
--        contacts.owner_id · tasks.seller_id · activities.author_id  → sellers.id
--      deals, payments y activities pertenecen al vendedor dueño de su contacto (contact_id).
--    · Cada vendedor (sellers) se enlaza 1:1 con un usuario de login (sellers.user_id).
--
--  Compatibilidad durante la transición (hasta el Paso 4):
--    · contacts, sellers, products, strategy_cards y snoozes tienen DEFAULT = empresa legado,
--      así el backend actual (que todavía no envía company_id) sigue funcionando.
--    · activities, deals, payments, tasks y alerts NO tienen default: un trigger copia el
--      company_id desde su contacto (o vendedor) y rechaza referencias cruzadas entre empresas.
--    · En el Paso 4 se quitarán los DEFAULT (ver el final del archivo).
--
--  Contraseñas: bcrypt. pgcrypto genera hashes $2a$ que bcrypt/bcryptjs de Node verifican sin
--  cambios. Los tokens de invitación y de recuperación se guardan como hash SHA-256: el token
--  en claro solo viaja en el correo.
-- =============================================================================

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. EMPRESAS
-- -----------------------------------------------------------------------------
create table if not exists public.companies (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(trim(name)) > 0),
  legal_name     text not null default '',
  tax_id         text not null default '',
  country_code   text references public.countries(code),
  industry       text not null default '',
  plan           text not null default 'basico' check (plan in ('basico', 'pro', 'empresa')),
  seats          int  not null default 5 check (seats > 0),
  status         text not null default 'prueba' check (status in ('prueba', 'activa', 'suspendida')),
  trial_ends_at  timestamptz,
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Empresa "legado": recibe todos los datos que ya existen (id fijo para poder referenciarlo)
insert into public.companies (id, name, legal_name, country_code, industry, plan, seats, status)
values ('00000000-0000-4000-8000-000000000001', 'Andina Agro Maquinarias', 'Andina Agro Maquinarias S.A.C.',
        'PE', 'Maquinaria agrícola', 'pro', 15, 'activa')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 2. USUARIOS (login)
--    super_admin → company_id NULL ·  gerente / vendedor → company_id obligatorio
-- -----------------------------------------------------------------------------
create table if not exists public.users (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid references public.companies(id) on delete restrict,
  email                  text not null unique check (email = lower(trim(email)) and email like '%_@_%._%'),
  password_hash          text not null,
  name                   text not null check (length(trim(name)) > 0),
  role                   text not null check (role in ('super_admin', 'gerente', 'vendedor')),
  status                 text not null default 'activo' check (status in ('activo', 'inactivo')),
  -- Los JWT emitidos antes de esta fecha dejan de valer (cambio/recuperación de clave)
  password_changed_at    timestamptz not null default now(),
  failed_login_attempts  int not null default 0,
  locked_until           timestamptz,
  last_login_at          timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint users_role_company_chk check ((role = 'super_admin') = (company_id is null))
);
create index if not exists users_company_idx on public.users (company_id);

-- Vendedor ↔ usuario (1:1). Un gerente que también vende tiene su fila en sellers.
alter table public.sellers add column if not exists user_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sellers_user_id_fkey') then
    alter table public.sellers add constraint sellers_user_id_fkey
      foreign key (user_id) references public.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sellers_user_id_key') then
    alter table public.sellers add constraint sellers_user_id_key unique (user_id);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3. INVITACIONES
--    Link: /registro?token=<token>  ·  se guarda sha256(token) en token_hash
-- -----------------------------------------------------------------------------
create table if not exists public.invitations (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  email             text not null check (email = lower(trim(email))),
  name              text not null default '',      -- sugerido; el invitado puede cambiarlo
  role              text not null check (role in ('gerente', 'vendedor')),
  country_code      text references public.countries(code),  -- para crear su fila en sellers
  token_hash        text not null unique,
  invited_by        uuid references public.users(id) on delete set null,
  expires_at        timestamptz not null default now() + interval '7 days',
  accepted_at       timestamptz,
  accepted_user_id  uuid references public.users(id) on delete set null,
  revoked_at        timestamptz,
  created_at        timestamptz not null default now(),
  constraint invitations_state_chk check (accepted_at is null or revoked_at is null)
);
-- Una sola invitación pendiente por correo y empresa (reenviar = revocar + crear)
create unique index if not exists invitations_pending_uidx
  on public.invitations (company_id, email) where accepted_at is null and revoked_at is null;
create index if not exists invitations_company_idx on public.invitations (company_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 4. RECUPERACIÓN DE CONTRASEÑA (token de un solo uso, vence en 1 hora)
-- -----------------------------------------------------------------------------
create table if not exists public.password_resets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  token_hash    text not null unique,
  expires_at    timestamptz not null default now() + interval '1 hour',
  used_at       timestamptz,
  requested_ip  inet,
  created_at    timestamptz not null default now()
);
create index if not exists password_resets_user_idx on public.password_resets (user_id) where used_at is null;

-- -----------------------------------------------------------------------------
-- 5. CONFIGURACIÓN POR EMPRESA
--    app_settings sigue existiendo (una fila global) para no romper el backend actual;
--    en el Paso 4 settings pasa a leer/escribir esta tabla.
-- -----------------------------------------------------------------------------
create table if not exists public.company_settings (
  company_id      uuid primary key references public.companies(id) on delete cascade,
  goal_usd        numeric(14,2) not null default 250000 check (goal_usd >= 0),
  ticket_usd      numeric(14,2) not null default 45000,
  close_rate      numeric(5,2)  not null default 25,
  quote_rate      numeric(5,2)  not null default 40,
  calls_per_lead  int           not null default 4,
  work_days       int           not null default 22,
  timezone        text          not null default 'America/Lima',
  updated_at      timestamptz   not null default now()
);

insert into public.company_settings (company_id, goal_usd, ticket_usd, close_rate, quote_rate, calls_per_lead, work_days, timezone)
select '00000000-0000-4000-8000-000000000001', goal_usd, ticket_usd, close_rate, quote_rate, calls_per_lead, work_days, timezone
  from public.app_settings where id = 1
on conflict (company_id) do nothing;

-- Toda empresa nueva nace con su configuración
create or replace function public.vx_company_defaults()
returns trigger language plpgsql as $$
begin
  insert into public.company_settings (company_id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists companies_defaults on public.companies;
create trigger companies_defaults after insert on public.companies
  for each row execute function public.vx_company_defaults();

-- -----------------------------------------------------------------------------
-- 6. company_id EN LAS TABLAS EXISTENTES (sin perder datos)
-- -----------------------------------------------------------------------------

-- 6a. Tablas "raíz": columna con DEFAULT = empresa legado (rellena las filas existentes)
do $$
declare t text;
begin
  foreach t in array array['sellers', 'contacts', 'products', 'strategy_cards', 'snoozes'] loop
    execute format('alter table public.%I add column if not exists company_id uuid', t);
    execute format('alter table public.%I alter column company_id set default %L::uuid',
                   t, '00000000-0000-4000-8000-000000000001');
    execute format('update public.%I set company_id = %L where company_id is null',
                   t, '00000000-0000-4000-8000-000000000001');
  end loop;
end $$;

-- 6b. Tablas "hijas": se rellenan desde su contacto (o su vendedor), sin DEFAULT
do $$
declare t text;
begin
  foreach t in array array['activities', 'deals', 'payments', 'tasks', 'alerts'] loop
    execute format('alter table public.%I add column if not exists company_id uuid', t);
    execute format('update public.%I x set company_id = c.company_id
                      from public.contacts c
                     where x.contact_id = c.id and x.company_id is null', t);
  end loop;
end $$;
update public.tasks x set company_id = s.company_id
  from public.sellers s where x.seller_id = s.id and x.company_id is null;
-- Tareas/alertas sueltas (sin contacto ni vendedor) → empresa legado
update public.tasks  set company_id = '00000000-0000-4000-8000-000000000001' where company_id is null;
update public.alerts set company_id = '00000000-0000-4000-8000-000000000001' where company_id is null;

-- 6c. NOT NULL + llave foránea + índice en las 10 tablas
do $$
declare t text;
begin
  foreach t in array array['sellers', 'contacts', 'products', 'strategy_cards', 'snoozes',
                           'activities', 'deals', 'payments', 'tasks', 'alerts'] loop
    execute format('alter table public.%I alter column company_id set not null', t);
    if not exists (select 1 from pg_constraint where conname = t || '_company_id_fkey') then
      execute format('alter table public.%I add constraint %I foreign key (company_id)
                      references public.companies(id) on delete restrict', t, t || '_company_id_fkey');
    end if;
    execute format('create index if not exists %I on public.%I (company_id)', t || '_company_idx', t);
  end loop;
end $$;

-- Índices para los filtros más usados: empresa + vendedor / fecha
create index if not exists contacts_company_owner_idx on public.contacts (company_id, owner_id);
create index if not exists tasks_company_at_idx       on public.tasks (company_id, at);
create index if not exists deals_company_stage_idx    on public.deals (company_id, stage);
create index if not exists payments_company_due_idx   on public.payments (company_id, due_at) where paid_at is null;

-- 6d. Nombres de producto únicos POR EMPRESA (antes: únicos en toda la base)
alter table public.products drop constraint if exists products_name_key;
create unique index if not exists products_company_name_uidx on public.products (company_id, name);

-- -----------------------------------------------------------------------------
-- 7. GUARDIA DE AISLAMIENTO (trigger)
--    · Rellena company_id desde contact_id (o seller_id en tareas) si no viene.
--    · Rechaza que un registro apunte a un contacto, vendedor o usuario de OTRA empresa.
--    Así las funciones RPC actuales (move_deal, register_payment, create_payment_plan)
--    quedan dentro de la empresa correcta sin modificarlas.
-- -----------------------------------------------------------------------------
create or replace function public.vx_tenant_guard()
returns trigger language plpgsql as $$
declare
  j      jsonb := to_jsonb(new);
  v_cid  uuid;
  col    text;
begin
  -- Empresa heredada del contacto
  if tg_table_name <> 'contacts' and j->>'contact_id' is not null then
    select company_id into v_cid from public.contacts where id = j->>'contact_id';
    if new.company_id is null then
      new.company_id := v_cid;
    elsif v_cid is not null and new.company_id <> v_cid then
      raise exception 'cross_tenant_reference'
        using errcode = '23514', detail = format('%s.contact_id pertenece a otra empresa', tg_table_name);
    end if;
  end if;

  -- Tarea sin contacto → empresa del vendedor asignado
  if new.company_id is null and j->>'seller_id' is not null then
    select company_id into new.company_id from public.sellers where id = j->>'seller_id';
  end if;

  if new.company_id is null then
    raise exception 'company_required' using errcode = '23502',
      detail = format('No se pudo determinar company_id para %s', tg_table_name);
  end if;

  -- Vendedores referenciados deben ser de la misma empresa
  foreach col in array array['owner_id', 'seller_id', 'author_id'] loop
    if j->>col is not null then
      select company_id into v_cid from public.sellers where id = j->>col;
      if found and v_cid <> new.company_id then
        raise exception 'cross_tenant_reference'
          using errcode = '23514', detail = format('%s.%s pertenece a otra empresa', tg_table_name, col);
      end if;
    end if;
  end loop;

  -- sellers.user_id debe ser un usuario de la misma empresa
  if tg_table_name = 'sellers' and j->>'user_id' is not null then
    select company_id into v_cid from public.users where id = (j->>'user_id')::uuid;
    if v_cid is distinct from new.company_id then
      raise exception 'cross_tenant_reference'
        using errcode = '23514', detail = 'sellers.user_id pertenece a otra empresa';
    end if;
  end if;

  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['sellers', 'contacts', 'activities', 'deals', 'payments', 'tasks', 'alerts'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_tenant_guard', t);
    execute format('create trigger %I before insert or update on public.%I
                    for each row execute function public.vx_tenant_guard()', t || '_tenant_guard', t);
  end loop;
end $$;

-- Un contacto no puede cambiar de empresa si ya tiene tratos/cobros/actividad
create or replace function public.vx_contacts_company_lock()
returns trigger language plpgsql as $$
begin
  if new.company_id <> old.company_id then
    raise exception 'company_change_not_allowed' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists contacts_company_lock on public.contacts;
create trigger contacts_company_lock before update of company_id on public.contacts
  for each row execute function public.vx_contacts_company_lock();

-- -----------------------------------------------------------------------------
-- 8. updated_at automático en las tablas nuevas
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['companies', 'users', 'company_settings'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I
                    for each row execute function public.vx_touch_updated_at()', t, t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 9. CREAR EL SUPER ADMIN INICIAL
--    La contraseña NO se escribe en este archivo. Después de ejecutar la migración,
--    corre una sola vez (en el SQL Editor o en psql):
--
--      select public.create_super_admin('tu-correo@dominio.com', 'una-clave-larga-y-unica', 'Tu Nombre');
--
--    Al terminar, borra esa consulta del historial del SQL Editor.
-- -----------------------------------------------------------------------------
create or replace function public.create_super_admin(p_email text, p_password text, p_name text default 'Super Admin')
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email text := lower(trim(p_email));
  v_user  public.users;
begin
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if length(coalesce(p_password, '')) < 12 then
    raise exception 'password_too_short' using errcode = '22023', detail = 'Mínimo 12 caracteres';
  end if;

  select * into v_user from public.users where email = v_email;
  if found and v_user.role <> 'super_admin' then
    raise exception 'email_in_use' using errcode = '23505',
      detail = 'Ese correo ya pertenece a un usuario de una empresa';
  end if;

  insert into public.users (email, password_hash, name, role, company_id, status)
  values (v_email, crypt(p_password, gen_salt('bf', 12)), coalesce(nullif(trim(p_name), ''), 'Super Admin'),
          'super_admin', null, 'activo')
  on conflict (email) do update set
    password_hash = excluded.password_hash, name = excluded.name, status = 'activo',
    password_changed_at = now(), failed_login_attempts = 0, locked_until = null
  returning * into v_user;

  return v_user.id;
end $$;

-- -----------------------------------------------------------------------------
-- 10. SEGURIDAD: RLS sin políticas (solo el backend con service_role) + permisos
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['companies', 'users', 'invitations', 'password_resets', 'company_settings'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

revoke all on function public.create_super_admin(text, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.create_super_admin(text, text, text) from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on all tables in schema public to service_role;
    grant all on all sequences in schema public to service_role;
  end if;
end $$;

commit;

-- =============================================================================
--  VERIFICACIÓN (opcional, después de ejecutar): todo debe dar 0 en "sin_empresa"
-- =============================================================================
--  select 'contacts' t, count(*) filter (where company_id is null) sin_empresa, count(*) total from contacts
--  union all select 'deals',      count(*) filter (where company_id is null), count(*) from deals
--  union all select 'payments',   count(*) filter (where company_id is null), count(*) from payments
--  union all select 'activities', count(*) filter (where company_id is null), count(*) from activities
--  union all select 'tasks',      count(*) filter (where company_id is null), count(*) from tasks;
--
-- =============================================================================
--  PASO 4 (NO ejecutar todavía): cuando todo el backend envíe company_id explícito
-- =============================================================================
--  alter table public.sellers        alter column company_id drop default;
--  alter table public.contacts       alter column company_id drop default;
--  alter table public.products       alter column company_id drop default;
--  alter table public.strategy_cards alter column company_id drop default;
--  alter table public.snoozes        alter column company_id drop default;
