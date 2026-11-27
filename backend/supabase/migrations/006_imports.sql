-- =============================================================================
-- 006 · Importación del Excel de clientes
--  · import_batches: cada importación (quién, qué archivo, resumen) para verla en el historial y deshacerla.
--  · contacts / deals / activities.import_batch_id: qué registros creó cada importación.
--  · import_contacts(): inserta contactos, tratos y actividades en UNA transacción (o todo o nada).
--  · import_undo(): borra lo que creó una importación.
-- Re-ejecutable.
-- =============================================================================

create table if not exists public.import_batches (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  seller_id   text references public.sellers(id) on delete set null,
  file_name   text not null,
  summary     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  undone_at   timestamptz
);
create index if not exists import_batches_company_idx on public.import_batches (company_id, created_at desc);
alter table public.import_batches enable row level security;  -- sin políticas: solo el backend (service_role)

alter table public.contacts   add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null;
alter table public.deals      add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null;
alter table public.activities add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null;
create index if not exists contacts_import_idx   on public.contacts (import_batch_id)   where import_batch_id is not null;
create index if not exists deals_import_idx      on public.deals (import_batch_id)      where import_batch_id is not null;
create index if not exists activities_import_idx on public.activities (import_batch_id) where import_batch_id is not null;

-- -----------------------------------------------------------------------------
-- import_contacts(company, seller, file, summary, items)
-- items: [{ existing_id, contact: {...}, deals: [{...}], activities: [{...}] }]
--   existing_id null → crea el contacto (dueño = p_seller). Si no, agrega tratos y actividades a ese contacto.
-- El backend ya validó y normalizó todo; aquí se insertan y se revisa que nada salga de la empresa.
-- -----------------------------------------------------------------------------
create or replace function public.import_contacts(
  p_company  uuid,
  p_seller   text,
  p_file     text,
  p_summary  jsonb,
  p_items    jsonb
) returns jsonb language plpgsql as $$
declare
  v_batch  uuid;
  it       jsonb;
  c        jsonb;
  d        jsonb;
  a        jsonb;
  v_cid    text;
  n_c      int := 0;
  n_d      int := 0;
  n_a      int := 0;
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'items_required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.sellers where id = p_seller and company_id = p_company) then
    raise exception 'cross_tenant_reference' using errcode = '23514', detail = 'El vendedor no pertenece a la empresa';
  end if;

  insert into public.import_batches (company_id, seller_id, file_name, summary)
  values (p_company, p_seller, p_file, coalesce(p_summary, '{}'::jsonb))
  returning id into v_batch;

  for it in select * from jsonb_array_elements(p_items) loop
    v_cid := it->>'existing_id';
    if v_cid is null then
      c := it->'contact';
      insert into public.contacts (company_id, name, company, country_code, city, region, phone, doc, email,
                                   channel, owner_id, temp, created_at, import_batch_id)
      values (p_company, c->>'name', coalesce(c->>'company', ''), c->>'country_code', coalesce(c->>'city', ''),
              coalesce(c->>'region', ''), coalesce(c->>'phone', ''), coalesce(c->>'doc', ''), coalesce(c->>'email', ''),
              nullif(c->>'channel', ''), p_seller, coalesce(c->>'temp', 'tibio'),
              coalesce((c->>'created_at')::timestamptz, now()), v_batch)
      returning id into v_cid;
      n_c := n_c + 1;
    elsif not exists (select 1 from public.contacts where id = v_cid and company_id = p_company) then
      raise exception 'cross_tenant_reference' using errcode = '23514', detail = 'El contacto existente no pertenece a la empresa';
    end if;

    for d in select * from jsonb_array_elements(coalesce(it->'deals', '[]'::jsonb)) loop
      insert into public.deals (company_id, contact_id, product, amount, currency, stage, temp, next_at, next_action,
                                created_at, closed_at, import_batch_id)
      values (p_company, v_cid, d->>'product', coalesce((d->>'amount')::numeric, 0), coalesce(d->>'currency', 'USD'),
              coalesce(d->>'stage', 'nuevo'), coalesce(d->>'temp', 'tibio'), (d->>'next_at')::timestamptz,
              coalesce(d->>'next_action', ''), coalesce((d->>'created_at')::timestamptz, now()),
              (d->>'closed_at')::timestamptz, v_batch);
      n_d := n_d + 1;
    end loop;

    for a in select * from jsonb_array_elements(coalesce(it->'activities', '[]'::jsonb)) loop
      insert into public.activities (company_id, contact_id, at, type, text, author_id, import_batch_id)
      values (p_company, v_cid, coalesce((a->>'at')::timestamptz, now()), coalesce(a->>'type', 'nota'), a->>'text',
              p_seller, v_batch);
      n_a := n_a + 1;
    end loop;
  end loop;

  update public.import_batches
     set summary = summary || jsonb_build_object('contacts', n_c, 'deals', n_d, 'activities', n_a)
   where id = v_batch;

  return jsonb_build_object('batch_id', v_batch, 'contacts', n_c, 'deals', n_d, 'activities', n_a);
end $$;

-- -----------------------------------------------------------------------------
-- import_undo(company, batch): borra lo creado por la importación.
-- Los contactos creados se borran con todo lo suyo (incluido lo agregado después a mano);
-- en contactos que ya existían solo se quitan los tratos y actividades que agregó la importación.
-- -----------------------------------------------------------------------------
create or replace function public.import_undo(p_company uuid, p_batch uuid)
returns jsonb language plpgsql as $$
declare
  n_a int; n_d int; n_c int;
begin
  perform 1 from public.import_batches where id = p_batch and company_id = p_company and undone_at is null for update;
  if not found then
    raise exception 'import_not_found' using errcode = 'P0002';
  end if;
  delete from public.activities where import_batch_id = p_batch and company_id = p_company;
  get diagnostics n_a = row_count;
  delete from public.deals where import_batch_id = p_batch and company_id = p_company;
  get diagnostics n_d = row_count;
  delete from public.contacts where import_batch_id = p_batch and company_id = p_company;
  get diagnostics n_c = row_count;
  update public.import_batches set undone_at = now() where id = p_batch;
  return jsonb_build_object('contacts', n_c, 'deals', n_d, 'activities', n_a);
end $$;

-- Solo el backend (service_role) puede llamarlas
do $$
declare f text;
begin
  foreach f in array array[
    'public.import_contacts(uuid, text, text, jsonb, jsonb)',
    'public.import_undo(uuid, uuid)'
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
