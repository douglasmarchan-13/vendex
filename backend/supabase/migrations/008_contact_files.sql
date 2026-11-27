-- =============================================================================
-- 008 · Cotizaciones (PDF) adjuntas a la ficha del cliente
--  · El PDF se guarda en Supabase Storage, bucket privado `contact-files`,
--    en la ruta {company_id}/{contact_id}/{uuid}.pdf. Solo el backend (service_role) lo lee
--    y el navegador lo abre con un enlace firmado que vence en pocos minutos.
--  · contact_files: datos de cada archivo (nombre original, tamaño, trato al que corresponde, quién lo subió).
--  · Al borrar el contacto se borran sus filas (cascade); el backend borra además los PDF del bucket.
-- Re-ejecutable.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contact-files', 'contact-files', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.contact_files (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  contact_id    text not null references public.contacts(id) on delete cascade,
  deal_id       text references public.deals(id) on delete set null,
  kind          text not null default 'cotizacion' check (kind in ('cotizacion', 'otro')),
  file_name     text not null,
  storage_path  text not null unique,
  size_bytes    integer not null check (size_bytes > 0),
  note          text not null default '',
  uploaded_by   text references public.sellers(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists contact_files_contact_idx on public.contact_files (contact_id, created_at desc);
create index if not exists contact_files_company_idx on public.contact_files (company_id);

alter table public.contact_files enable row level security;  -- sin políticas: solo el backend (service_role)

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.contact_files to service_role;
  end if;
end $$;
