-- =============================================================================
-- 007 · Importación de deudas por cobrar (requiere 006)
--  · import_batches.kind: 'clientes' (Excel de clientes) o 'deudas' (Excel de cobranza).
--  · import_contacts() acepta cuotas por trato: deals[].payments = [{ n, of, label, amount, due_at, paid_at, method, ref }]
--    Las cuotas se borran junto con el trato al deshacer la importación (payments.deal_id on delete cascade).
-- Re-ejecutable.
-- =============================================================================

alter table public.import_batches add column if not exists kind text not null default 'clientes';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'import_batches_kind_chk') then
    alter table public.import_batches add constraint import_batches_kind_chk check (kind in ('clientes', 'deudas'));
  end if;
end $$;

-- Firma nueva (p_kind): se borra la anterior para no dejar dos versiones
drop function if exists public.import_contacts(uuid, text, text, jsonb, jsonb);

create or replace function public.import_contacts(
  p_company  uuid,
  p_seller   text,
  p_file     text,
  p_summary  jsonb,
  p_items    jsonb,
  p_kind     text default 'clientes'
) returns jsonb language plpgsql as $$
declare
  v_batch  uuid;
  it       jsonb;
  c        jsonb;
  d        jsonb;
  a        jsonb;
  p        jsonb;
  v_cid    text;
  v_did    text;
  v_cur    text;
  n_c      int := 0;
  n_d      int := 0;
  n_a      int := 0;
  n_p      int := 0;
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'items_required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.sellers where id = p_seller and company_id = p_company) then
    raise exception 'cross_tenant_reference' using errcode = '23514', detail = 'El vendedor no pertenece a la empresa';
  end if;

  insert into public.import_batches (company_id, seller_id, file_name, summary, kind)
  values (p_company, p_seller, p_file, coalesce(p_summary, '{}'::jsonb), coalesce(p_kind, 'clientes'))
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
      v_cur := coalesce(d->>'currency', 'USD');
      insert into public.deals (company_id, contact_id, product, amount, currency, stage, temp, next_at, next_action,
                                created_at, closed_at, import_batch_id)
      values (p_company, v_cid, d->>'product', coalesce((d->>'amount')::numeric, 0), v_cur,
              coalesce(d->>'stage', 'nuevo'), coalesce(d->>'temp', 'tibio'), (d->>'next_at')::timestamptz,
              coalesce(d->>'next_action', ''), coalesce((d->>'created_at')::timestamptz, now()),
              (d->>'closed_at')::timestamptz, v_batch)
      returning id into v_did;
      n_d := n_d + 1;

      for p in select * from jsonb_array_elements(coalesce(d->'payments', '[]'::jsonb)) loop
        insert into public.payments (company_id, deal_id, contact_id, currency, n, of_total, label, amount, due_at,
                                     paid_at, method, ref)
        values (p_company, v_did, v_cid, v_cur, coalesce((p->>'n')::int, 1), coalesce((p->>'of')::int, 1),
                p->>'label', (p->>'amount')::numeric, (p->>'due_at')::timestamptz, (p->>'paid_at')::timestamptz,
                nullif(p->>'method', ''), coalesce(p->>'ref', ''));
        n_p := n_p + 1;
      end loop;
    end loop;

    for a in select * from jsonb_array_elements(coalesce(it->'activities', '[]'::jsonb)) loop
      insert into public.activities (company_id, contact_id, at, type, text, author_id, import_batch_id)
      values (p_company, v_cid, coalesce((a->>'at')::timestamptz, now()), coalesce(a->>'type', 'nota'), a->>'text',
              p_seller, v_batch);
      n_a := n_a + 1;
    end loop;
  end loop;

  update public.import_batches
     set summary = summary || jsonb_build_object('contacts', n_c, 'deals', n_d, 'activities', n_a, 'payments', n_p)
   where id = v_batch;

  return jsonb_build_object('batch_id', v_batch, 'contacts', n_c, 'deals', n_d, 'activities', n_a, 'payments', n_p);
end $$;

do $$
declare f text := 'public.import_contacts(uuid, text, text, jsonb, jsonb, text)';
begin
  execute format('revoke all on function %s from public', f);
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute format('revoke all on function %s from anon, authenticated', f);
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute format('grant execute on function %s to service_role', f);
  end if;
end $$;
