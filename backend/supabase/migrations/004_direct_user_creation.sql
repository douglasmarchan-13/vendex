-- =============================================================================
--  VENDEX · Migración 004 — Alta directa de usuarios con contraseña temporal
-- =============================================================================
--  Requisito: 001, 002 y 003. Re-ejecutable y no borra datos.
--
--  · users.must_change_password: el usuario debe elegir su propia clave antes de usar la app.
--    Por defecto false: los usuarios existentes y los que entran por invitación no cambian.
--  · create_member_direct(): el gerente crea la cuenta (activa) con una clave temporal, sin correo.
--    Misma lógica que accept_invitation (cupos con bloqueo, fila en sellers) en una transacción.
--  · complete_password_reset(): recuperar la clave por correo también apaga la bandera.
-- =============================================================================

begin;

alter table public.users add column if not exists must_change_password boolean not null default false;

-- -----------------------------------------------------------------------------
-- 1. ALTA DIRECTA (atómica)
--    p_password_hash = hash bcrypt calculado en el backend (la clave nunca llega a la base)
--    Cupos = usuarios activos + invitaciones pendientes y vigentes (igual que el backend).
--    Una invitación pendiente para el mismo correo en la empresa se anula: la reemplaza esta cuenta.
-- -----------------------------------------------------------------------------
create or replace function public.create_member_direct(
  p_company_id    uuid,
  p_email         text,
  p_name          text,
  p_role          text,
  p_country_code  text,
  p_seller_id     text,
  p_password_hash text
)
returns jsonb language plpgsql as $$
declare
  co        public.companies;
  v_user    public.users;
  v_email   text := lower(trim(coalesce(p_email, '')));
  v_name    text := trim(coalesce(p_name, ''));
  v_seller  text;
  v_used    int;
begin
  if p_role not in ('gerente', 'vendedor') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  if v_name = '' then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if coalesce(p_password_hash, '') !~ '^\$2[aby]\$\d\d\$' then
    raise exception 'invalid_password_hash' using errcode = '22023';
  end if;

  -- Bloquea la empresa: dos altas simultáneas no pueden exceder los cupos
  select * into co from public.companies where id = p_company_id for update;
  if not found then
    raise exception 'company_not_found' using errcode = 'P0002';
  end if;
  if co.status = 'suspendida' then
    raise exception 'company_suspended' using errcode = '22023';
  end if;
  if exists (select 1 from public.users where email = v_email) then
    raise exception 'email_in_use' using errcode = '22023';
  end if;

  update public.invitations set revoked_at = now()
   where company_id = co.id and email = v_email and accepted_at is null and revoked_at is null;

  select (select count(*) from public.users where company_id = co.id and status = 'activo')
       + (select count(*) from public.invitations
           where company_id = co.id and accepted_at is null and revoked_at is null and expires_at > now())
    into v_used;
  if v_used >= co.seats then
    raise exception 'no_seats' using errcode = '22023';
  end if;

  insert into public.users (company_id, email, password_hash, name, role, status, must_change_password)
  values (co.id, v_email, p_password_hash, v_name, p_role, 'activo', true)
  returning * into v_user;

  if p_seller_id is not null then
    -- Vendedor existente: se enlaza (debe ser de la misma empresa y no tener usuario)
    update public.sellers
       set user_id = v_user.id, email = v_email, active = true
     where id = p_seller_id and company_id = co.id and user_id is null
    returning id into v_seller;
    if v_seller is null then
      raise exception 'seller_unavailable' using errcode = '22023';
    end if;
  else
    v_seller := gen_random_uuid()::text;
    insert into public.sellers (id, name, short_name, country_code, email, user_id, company_id)
    values (v_seller, v_name, split_part(v_name, ' ', 1),
            coalesce(p_country_code, co.country_code, 'PE'), v_email, v_user.id, co.id);
  end if;

  return jsonb_build_object('user_id', v_user.id, 'seller_id', v_seller, 'company_id', co.id);
end $$;

-- -----------------------------------------------------------------------------
-- 2. RECUPERAR LA CLAVE TAMBIÉN CUENTA COMO "CAMBIO EN EL PRIMER INICIO"
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
         failed_login_attempts = 0, locked_until = null, must_change_password = false
   where id = r.user_id and status = 'activo';
  if not found then
    raise exception 'reset_invalid' using errcode = '22023';
  end if;

  update public.password_resets set used_at = now() where user_id = r.user_id and used_at is null;
  return r.user_id;
end $$;

-- -----------------------------------------------------------------------------
-- 3. SEGURIDAD: solo el backend (service_role) ejecuta la función
-- -----------------------------------------------------------------------------
do $$
declare f text := 'public.create_member_direct(uuid, text, text, text, text, text, text)';
begin
  execute format('revoke all on function %s from public', f);
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute format('revoke all on function %s from anon, authenticated', f);
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute format('grant execute on function %s to service_role', f);
  end if;
end $$;

commit;
