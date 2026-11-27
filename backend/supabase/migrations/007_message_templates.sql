-- =============================================================================
-- 007 · Plantillas de WhatsApp de cada vendedor
--  · Las plantillas por defecto viven en el frontend (lib/whatsapp.js).
--  · Una fila con la misma `key` que una plantilla por defecto la reemplaza para ese vendedor;
--    borrarla la restaura. Las claves 'custom-…' son plantillas propias del vendedor.
--  · `body` lleva variables como {nombre}, {producto}, {monto}; se completan al enviar.
-- Re-ejecutable.
-- =============================================================================

create table if not exists public.message_templates (
  company_id  uuid not null references public.companies(id) on delete cascade,
  seller_id   text not null references public.sellers(id) on delete cascade,
  key         text not null,
  kind        text not null default 'venta' check (kind in ('venta', 'cobranza')),
  label       text not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (company_id, seller_id, key)
);

drop trigger if exists message_templates_touch on public.message_templates;
create trigger message_templates_touch before update on public.message_templates
  for each row execute function public.vx_touch_updated_at();

alter table public.message_templates enable row level security;  -- sin políticas: solo el backend (service_role)
