-- =============================================================================
--  VENDEX · Migración 003 — Cierre del aislamiento multiempresa
-- =============================================================================
--  Requisito: 001 y 002. Re-ejecutable y no borra datos.
--
--  · Quita el DEFAULT "empresa legado" de company_id: ahora el backend envía company_id
--    explícito. El nuevo DEFAULT vx_session_company() solo vale dentro de una transacción que
--    fijó vx.company_id (lo usa seed_demo_data); en cualquier otro caso queda NULL y la
--    inserción falla por NOT NULL, en vez de caer en otra empresa en silencio.
--  · snoozes: llave (company_id, item_id), así una empresa no puede pisar los pospuestos de otra.
--  · seed_demo_data() ya no vacía TODAS las empresas: solo recarga la empresa demo (legado).
-- =============================================================================

begin;

create or replace function public.vx_session_company()
returns uuid language sql stable as $$
  select nullif(current_setting('vx.company_id', true), '')::uuid
$$;

do $$
declare t text;
begin
  foreach t in array array['sellers', 'contacts', 'products', 'strategy_cards', 'snoozes', 'pay_methods'] loop
    execute format('alter table public.%I alter column company_id set default public.vx_session_company()', t);
  end loop;

  if exists (select 1 from pg_constraint
              where conname = 'snoozes_pkey' and pg_get_constraintdef(oid) not like '%company_id%') then
    alter table public.snoozes drop constraint snoozes_pkey;
    alter table public.snoozes add constraint snoozes_pkey primary key (company_id, item_id);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Semilla de demostración, limitada a la empresa legado
-- (misma data que backend/supabase/vendex.sql; cambian el borrado y la configuración)
-- -----------------------------------------------------------------------------
create or replace function public.seed_demo_data()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cid constant uuid := '00000000-0000-4000-8000-000000000001';  -- empresa legado (demo)
begin
  -- Las filas sin company_id explícito toman la empresa legado (DEFAULT vx_session_company())
  perform set_config('vx.company_id', v_cid::text, true);

  -- Solo se borran los datos de la empresa demo: las demás empresas no se tocan
  delete from public.payments       where company_id = v_cid;
  delete from public.activities     where company_id = v_cid;
  delete from public.tasks          where company_id = v_cid;
  delete from public.alerts         where company_id = v_cid;
  delete from public.deals          where company_id = v_cid;
  delete from public.contacts       where company_id = v_cid;
  delete from public.strategy_cards where company_id = v_cid;
  delete from public.snoozes        where company_id = v_cid;
  delete from public.products       where company_id = v_cid;

  -- ---------- Configuración ----------
  insert into app_settings (id, goal_usd, ticket_usd, close_rate, quote_rate, calls_per_lead, work_days)
  values (1, 250000, 45000, 25, 40, 4, 22)
  on conflict (id) do update set
    goal_usd = excluded.goal_usd, ticket_usd = excluded.ticket_usd, close_rate = excluded.close_rate,
    quote_rate = excluded.quote_rate, calls_per_lead = excluded.calls_per_lead, work_days = excluded.work_days;

  insert into company_settings (company_id, goal_usd, ticket_usd, close_rate, quote_rate, calls_per_lead, work_days)
  values (v_cid, 250000, 45000, 25, 40, 4, 22)
  on conflict (company_id) do update set
    goal_usd = excluded.goal_usd, ticket_usd = excluded.ticket_usd, close_rate = excluded.close_rate,
    quote_rate = excluded.quote_rate, calls_per_lead = excluded.calls_per_lead, work_days = excluded.work_days;

  -- ---------- Monedas y tipo de cambio ----------
  insert into currencies (code, symbol, name, locale, rate_per_usd) values
    ('USD', 'US$', 'Dólar americano', 'en-US', 1),
    ('PEN', 'S/',  'Sol peruano',     'es-PE', 3.72),
    ('BOB', 'Bs',  'Boliviano',       'es-BO', 6.96),
    ('VES', 'Bs.', 'Bolívar digital', 'es-VE', 245)
  on conflict (code) do update set
    symbol = excluded.symbol, name = excluded.name, locale = excluded.locale, rate_per_usd = excluded.rate_per_usd;

  insert into company_currency_rates (company_id, code, rate_per_usd)
  select v_cid, code, rate_per_usd from currencies
  on conflict (company_id, code) do update set rate_per_usd = excluded.rate_per_usd;

  -- ---------- Países ----------
  insert into countries (code, name, local_currency, display_currency, phone_prefix, doc_label, goal_share) values
    ('PE', 'Perú',      'PEN', 'PEN', '+51',  'RUC / DNI', 0.60),
    ('BO', 'Bolivia',   'BOB', 'BOB', '+591', 'NIT / CI',  0.25),
    ('VE', 'Venezuela', 'VES', 'USD', '+58',  'RIF / CI',  0.15)
  on conflict (code) do update set
    name = excluded.name, local_currency = excluded.local_currency, display_currency = excluded.display_currency,
    phone_prefix = excluded.phone_prefix, doc_label = excluded.doc_label, goal_share = excluded.goal_share;

  -- ---------- Vendedores ----------
  insert into sellers (id, name, short_name, country_code) values
    ('andres',   'Andrés Ramírez', 'Andrés',   'PE'),
    ('daniela',  'Daniela Ríos',   'Daniela',  'PE'),
    ('rodrigo',  'Rodrigo Mamani', 'Rodrigo',  'BO'),
    ('andreina', 'Andreína Pérez', 'Andreína', 'VE')
  on conflict (id) do update set
    name = excluded.name, short_name = excluded.short_name, country_code = excluded.country_code;

  -- ---------- Canales ----------
  insert into channels (name, position) values
    ('WhatsApp', 1), ('Facebook', 2), ('TikTok', 3), ('Visita de campo', 4),
    ('Referido', 5), ('Feria agrícola', 6), ('Llamada entrante', 7)
  on conflict (name) do update set position = excluded.position;

  -- ---------- Etapas ----------
  insert into stages (id, name, position, dot, is_pipeline) values
    ('nuevo',       'Prospecto nuevo',    1, 'bg-slate-400',   true),
    ('contactado',  'Contactado',         2, 'bg-sky-500',     true),
    ('cotizacion',  'Cotización enviada', 3, 'bg-indigo-500',  true),
    ('negociacion', 'En negociación',     4, 'bg-amber-500',   true),
    ('cerrado',     'Venta cerrada',      5, 'bg-emerald-500', true),
    ('pausa',       'Por ahora no',       6, 'bg-slate-300',   false)
  on conflict (id) do update set
    name = excluded.name, position = excluded.position, dot = excluded.dot, is_pipeline = excluded.is_pipeline;

  -- ---------- Medios de pago ----------
  delete from pay_methods where company_id = v_cid;
  insert into pay_methods (country_code, name, position) values
    ('PE', 'Transferencia', 1), ('PE', 'Depósito', 2), ('PE', 'Yape / Plin', 3), ('PE', 'Efectivo', 4), ('PE', 'Cheque', 5),
    ('BO', 'Transferencia', 1), ('BO', 'Depósito', 2), ('BO', 'QR Simple', 3), ('BO', 'Efectivo', 4),
    ('VE', 'Zelle', 1), ('VE', 'Transferencia', 2), ('VE', 'Pago móvil', 3), ('VE', 'Efectivo (USD)', 4);

  -- ---------- Productos (precios en USD) ----------
  insert into products (id, name, price_usd, position) values
    ('prd-01', 'Molino de arroz compacto 1 TN/h', 9745,   1),
    ('prd-02', 'Molino de arroz 3 TN/h',          38500,  2),
    ('prd-03', 'Pulidora de arroz MN-25',         6350,   3),
    ('prd-04', 'Descascaradora 10x10',            7800,   4),
    ('prd-05', 'Pre-limpia / clasificadora',      14200,  5),
    ('prd-06', 'Selectora óptica de granos',      48000,  6),
    ('prd-07', 'Secadora de maíz 18 TN',          52000,  7),
    ('prd-08', 'Secadora de arroz 30 TN',         117000, 8),
    ('prd-09', 'Secadora de maíz 35 TN',          166000, 9),
    ('prd-10', 'Cosechadora de quinua 350',       33000,  10),
    ('prd-11', 'Elevador de cangilones 6 m',      3900,   11),
    ('prd-12', 'Horno industrial 80',             12500,  12),
    ('prd-13', 'Motocultor 15 HP',                1610,   13),
    ('prd-14', 'Tractor agrícola 90 HP',          42000,  14),
    ('prd-15', 'Cargador frontal 3 m³',           68000,  15);

  -- ---------- Contactos ----------
  insert into contacts (id, name, company, country_code, city, region, phone, doc, channel, owner_id, temp, email) values
    -- Perú
    ('c1',  'Rosa Huamán Tello',          'Molinera Santa Rosa S.A.C.',             'PE', 'Nueva Cajamarca',  'San Martín', '+51 942 318 506',  '20604815237',  'Facebook',         'andres',   'caliente', 'rosa@correo-demo.com'),
    ('c2',  'Jorge Villanueva Ruiz',      'Grupo Agroindustrial Alfa S.A.C.',       'PE', 'Chiclayo',         'Lambayeque', '+51 979 651 961',  '20395379233',  'Referido',         'andres',   'tibio',    'jorge@correo-demo.com'),
    ('c3',  'Segundo Neyra Paredes',      'Molino Neyra E.I.R.L.',                  'PE', 'San José de Sisa', 'San Martín', '+51 990 769 783',  '10457213361',  'Visita de campo',  'daniela',  'frio',     'segundo@correo-demo.com'),
    ('c4',  'Wilmer Inga Mendoza',        'Molino Carr. Ferreñafe',                 'PE', 'Ferreñafe',        'Lambayeque', '+51 902 528 813',  '46790785',     'Llamada entrante', 'andres',   'caliente', 'wilmer@correo-demo.com'),
    ('c5',  'Gabriel Sandoval Cajusol',   'Molino Puente El Pavo',                  'PE', 'Chiclayo',         'Lambayeque', '+51 980 134 602',  '41805045',     'Referido',         'andres',   'caliente', 'gabriel@correo-demo.com'),
    ('c6',  'Milagros Valle Llacsahuanga', '',                                      'PE', 'Bagua Grande',     'Amazonas',   '+51 957 450 003',  '72815530',     'TikTok',           'daniela',  'caliente', 'milagros@correo-demo.com'),
    ('c7',  'Hugo Carrazco Díaz',         'Agro Carrazco',                          'PE', 'Juanjuí',          'San Martín', '+51 939 132 719',  '4181675',      'Visita de campo',  'andres',   'tibio',    'hugo@correo-demo.com'),
    ('c8',  'Darwin Cruz Castillo',       'Agro Bajo Biavo',                        'PE', 'Bajo Biavo',       'San Martín', '+51 935 634 824',  '20611185520',  'Referido',         'daniela',  'tibio',    'darwin@correo-demo.com'),
    ('c9',  'Martín Torres Ríos',         'Titanes del Oriente S.A.C.',             'PE', 'Nueva Cajamarca',  'San Martín', '+51 975 731 801',  '20604824517',  'Facebook',         'andres',   'caliente', 'martin@correo-demo.com'),
    ('c10', 'Pedro Izuza Rengifo',        '',                                       'PE', 'Juanjuí',          'San Martín', '+51 934 642 836',  '45123987',     'Feria agrícola',   'daniela',  'tibio',    'pedro@correo-demo.com'),
    ('c11', 'Lucía Fernández Ojeda',      'Agroexportadora Piura Norte',            'PE', 'Piura',            'Piura',      '+51 951 220 418',  '20612233441',  'Visita de campo',  'andres',   'caliente', 'lucia@correo-demo.com'),
    ('c12', 'Kiara Saavedra Vílchez',     'Fundo Olmos Verde',                      'PE', 'Olmos',            'Lambayeque', '+51 968 410 227',  '20609981234',  'Visita de campo',  'daniela',  'tibio',    'kiara@correo-demo.com'),
    ('c13', 'Jesús Delgado Ruiz',         'Molino Jhimar',                          'PE', 'Chiclayo',         'Lambayeque', '+51 977 268 825',  '20608047957',  'Facebook',         'andres',   'tibio',    'jesus@correo-demo.com'),
    ('c14', 'Edith Torres Huamán',        'Molinos del Marañón',                    'PE', 'Pomahuaca',        'Cajamarca',  '+51 935 517 054',  '20601144887',  'WhatsApp',         'andres',   'caliente', 'edith@correo-demo.com'),
    ('c15', 'Iván Cruz Paredes',          '',                                       'PE', 'Pucallpa',         'Ucayali',    '+51 919 053 251',  '47788123',     'TikTok',           'daniela',  'frio',     'ivan@correo-demo.com'),
    -- Bolivia
    ('c16', 'Gilberto Chambi Copa',       'Quinua Real Challapata',                 'BO', 'Challapata',       'Oruro',      '+591 672 104 69',  '4244125',      'Facebook',         'rodrigo',  'caliente', 'gilberto@correo-demo.com'),
    ('c17', 'Juan Carlos Sambrana',       'Hacienda San Ignacio',                   'BO', 'Riberalta',        'Beni',       '+591 600 165 65',  '5871203',      'TikTok',           'rodrigo',  'frio',     'juan@correo-demo.com'),
    ('c18', 'Kenji Higa Rojas',           'Panificadora Okinawa',                   'BO', 'Montero',          'Santa Cruz', '+591 761 054 535', '3201390',      'Visita de campo',  'rodrigo',  'tibio',    'kenji@correo-demo.com'),
    ('c19', 'Alberto Gutiérrez Vaca',     'Arrocera Trinidad S.R.L.',               'BO', 'Trinidad',         'Beni',       '+591 713 171 40',  '1028447025',   'Visita de campo',  'rodrigo',  'caliente', 'alberto@correo-demo.com'),
    ('c20', 'Edgar Quispe Mamani',        '',                                       'BO', 'Potosí',           'Potosí',     '+591 676 372 49',  '6612078',      'Facebook',         'rodrigo',  'caliente', 'edgar@correo-demo.com'),
    ('c21', 'David Pérez Suárez',         'Asoc. de Productores Arroceros del Beni', 'BO', 'Trinidad',        'Beni',       '+591 770 585 92',  '1015577023',   'Visita de campo',  'rodrigo',  'caliente', 'david@correo-demo.com'),
    -- Venezuela
    ('c22', 'Ricardo Bracho Lugo',        'Agropecuaria Los Llanos C.A.',           'VE', 'Calabozo',         'Guárico',    '+58 414 512 3380', 'J-40518732-6', 'WhatsApp',         'andreina', 'caliente', 'ricardo@correo-demo.com'),
    ('c23', 'María Gabriela Linares',     'Arrocera Portuguesa C.A.',               'VE', 'Acarigua',         'Portuguesa', '+58 424 557 1902', 'J-31187459-0', 'Feria agrícola',   'andreina', 'tibio',    'maria@correo-demo.com'),
    ('c24', 'José Rafael Mendoza',        'Finca El Samán',                         'VE', 'Barinas',          'Barinas',    '+58 416 873 2214', 'V-14552876',   'Feria agrícola',   'andreina', 'tibio',    'jose@correo-demo.com'),
    ('c25', 'Yusmary Colmenares',         'Granos Cojedes',                         'VE', 'San Carlos',       'Cojedes',    '+58 412 330 9087', 'J-29874310-2', 'Referido',         'andreina', 'caliente', 'yusmary@correo-demo.com'),
    ('c26', 'Héctor Urdaneta',            '',                                       'VE', 'Machiques',        'Zulia',      '+58 414 690 4471', 'V-17220984',   'Facebook',         'andreina', 'frio',     'hector@correo-demo.com'),
    -- Clientes con ventas de meses anteriores (cartera por cobrar)
    ('c27', 'Fernando Requejo Tafur',     'Molino Requejo E.I.R.L.',                'PE', 'Bellavista',       'San Martín', '+51 942 607 315',  '20603318842',  'Referido',         'andres',   'caliente', 'fernando@correo-demo.com'),
    ('c28', 'Rosa Mamani Condori',        'Coop. Agraria Quinua Andina',            'BO', 'Salinas de Garci Mendoza', 'Oruro', '+591 724 985 21', '1029384017', 'Feria agrícola', 'rodrigo',  'caliente', 'rosa@correo-demo.com'),
    ('c29', 'Luis Alberto Rangel',        'Inversiones Arroceras del Guárico C.A.', 'VE', 'Calabozo',         'Guárico',    '+58 424 301 7765', 'J-41022963-8', 'WhatsApp',         'andreina', 'tibio',    'luis@correo-demo.com'),
    ('c30', 'Pablo Jiménez Vela',         'Molino San Pablo',                       'PE', 'Nueva Cajamarca',  'San Martín', '+51 942 915 147',  '20572110088',  'Visita de campo',  'daniela',  'tibio',    'pablo@correo-demo.com');

  -- ---------- Línea de tiempo ----------
  -- (contacto, hace_días, índice, tipo, texto, autor) · autor null = dueño del contacto, 'sistema' = automático
  -- La hora replica el mock: 10 + (índice % 6) : 15
  insert into activities (id, contact_id, at, type, text, author_id)
  select v.cid || '-t' || v.i, v.cid, vx_at(-v.d, 10 + (v.i % 6), 15), v.type, v.text,
         case when v.by = 'sistema' then null else coalesce(v.by, c.owner_id) end
    from (values
      ('c1', 0, 0, 'vista',      'Abrió tu cotización 3 veces hoy', 'sistema'),
      ('c1', 2, 1, 'llamada',    'Le parece elevado el precio. Pide financiamiento a 12 meses y 30% de inicial.', null),
      ('c1', 8, 2, 'cotizacion', 'Se envió cotización formal + ficha técnica de la secadora 30 TN.', null),
      ('c1', 13, 3, 'visita',    'Visita a su planta. Hoy seca al sol, pierde calidad en temporada de lluvias.', null),
      ('c2', 4, 0, 'cotizacion', 'Se envió cotización de selectora óptica. Quedó en revisarla con su gerente.', null),
      ('c2', 9, 1, 'llamada',    'Interesado en mejorar la calidad del arroz para exportación.', null),
      ('c3', 1, 0, 'llamada',    'No contesta (3er intento).', null),
      ('c3', 3, 1, 'llamada',    'No contesta.', null),
      ('c3', 6, 2, 'llamada',    'No contesta.', null),
      ('c3', 12, 3, 'visita',    'Conversamos en su molino. Pidió precio del molino compacto.', null),
      ('c4', 1, 0, 'whatsapp',   'Pidió foto del tablero eléctrico y tiempo de entrega.', null),
      ('c4', 5, 1, 'cotizacion', 'Se envió cotización del molino 3 TN/h.', null),
      ('c5', 3, 0, 'venta',      '¡Compró! Pulidora MN-25. Pagó 100% por transferencia.', null),
      ('c5', 10, 1, 'cotizacion', 'Se envió cotización.', null),
      ('c6', 0, 0, 'venta',      '¡Compró! Motocultor 15 HP. Pago en soles.', null),
      ('c6', 4, 1, 'whatsapp',   'Vio el video en TikTok y pidió precio en soles.', null),
      ('c7', 6, 0, 'llamada',    'Sigue en proceso de mudanza del molino a Bellavista. Solicitó la trifásica; arranca campaña en junio. Pidió que lo llame a fin de mes.', null),
      ('c7', 40, 1, 'cotizacion', 'Se envió cotización de la secadora 18 TN.', null),
      ('c8', 1, 0, 'llamada',    'El banco le otorgó el crédito. Lo invertirá primero en acopio de maíz; retoma la secadora en abril.', null),
      ('c8', 15, 1, 'cotizacion', 'Le parece elevado el precio. Tiene amistad con otro proveedor.', null),
      ('c9', 0, 0, 'nota',       'Llegó por anuncio de Facebook. Quiere pulidora + descascaradora para ampliar su línea.', null),
      ('c10', 2, 0, 'nota',      'Se registró en la feria de Juanjuí. Pidió que lo llamen.', null),
      ('c11', 2, 0, 'visita',    '3ra visita: sigue interesada. Su limitante es que recién aperturó RUC y espera mejorar su historial crediticio.', null),
      ('c11', 7, 1, 'llamada',   'Aún no cuenta con la liquidez, pero sigue interesada.', null),
      ('c11', 20, 2, 'visita',   'Muy interesada. Enviar cotización.', null),
      ('c12', 3, 0, 'llamada',   'Pidió más información y un video de la máquina. Llamar el miércoles pasadas las 4 pm.', null),
      ('c13', 3, 0, 'cotizacion', 'Se envió cotización de pre-limpia / clasificadora.', null),
      ('c14', 9, 0, 'venta',     '¡Compró! Molino 3 TN/h. Pago en soles, 50% adelanto.', null),
      ('c14', 18, 1, 'cotizacion', 'Se envió cotización.', null),
      ('c15', 9, 0, 'whatsapp',  'Está evaluando opciones de fabricación local.', null),
      ('c16', 1, 0, 'llamada',   'Quiere abonar la mitad en dólares y la mitad en bolivianos. Entrega en Desaguadero, lado boliviano.', null),
      ('c16', 6, 1, 'cotizacion', 'Se envió cotización de la cosechadora de quinua 350.', null),
      ('c17', 11, 0, 'llamada',  'Interesado en secadora, pero no cuenta con el monto completo. Quizás el próximo año.', null),
      ('c18', 4, 0, 'cotizacion', 'Desea cotizar horno, balanza y clasificadora de cilindro.', null),
      ('c19', 1, 0, 'llamada',   'Confirmó que la asociación aprueba la compra en asamblea del viernes.', null),
      ('c19', 8, 1, 'visita',    'Interesado en secadora y molino de arroz.', null),
      ('c20', 0, 0, 'nota',      'Escribió por Facebook: interesado en cosechadora de quinua 350.', null),
      ('c21', 6, 0, 'venta',     '¡Compró! Molino 3 TN/h. Pagó en bolivianos.', null),
      ('c21', 20, 1, 'visita',   'Pertenece a la asociación. Presentación a la directiva.', null),
      ('c22', 1, 0, 'whatsapp',  'Pidió videollamada con su socio para revisar la cotización.', null),
      ('c22', 4, 1, 'cotizacion', 'Se envió cotización en USD de la secadora 30 TN.', null),
      ('c23', 3, 0, 'llamada',   'Compara con otro proveedor. Pide garantía de 2 años y repuestos en stock.', null),
      ('c23', 10, 1, 'cotizacion', 'Se envió cotización del molino 3 TN/h.', null),
      ('c24', 2, 0, 'nota',      'Lo conocimos en Agroexpo. Quiere tractor para la próxima siembra.', null),
      ('c25', 12, 0, 'venta',    '¡Compró! Pulidora MN-25. Pago en USD.', null),
      ('c26', 7, 0, 'whatsapp',  'Preguntó precio en bolívares. Dijo que lo pensará.', null),
      ('c27', 3, 0, 'nota',      'Cuota 2 de 6 vencida. Dijo que deposita al cobrar su arroz en el molino.', null),
      ('c27', 30, 1, 'pago',     'Pagó cuota 1 de 6 por transferencia.', null),
      ('c27', 60, 2, 'venta',    '¡Compró! Secadora de arroz 30 TN. Financiado: inicial + 6 cuotas.', null),
      ('c28', 35, 0, 'venta',    '¡Compró! Cosechadora de quinua 350. 50% adelanto, 50% contra entrega.', null),
      ('c29', 5, 0, 'whatsapp',  'Pidió una semana más para pagar el saldo por Zelle.', null),
      ('c29', 45, 1, 'venta',    '¡Compró! Molino de arroz 3 TN/h. Saldo a 30 días.', null),
      ('c30', 10, 0, 'llamada',  'No contesta. El saldo de la pulidora y clasificadora sigue pendiente.', null),
      ('c30', 70, 1, 'venta',    '¡Compró! Pulidora + clasificadora. 50% adelanto y saldo a 30 días.', null)
    ) as v(cid, d, i, type, text, by)
    join contacts c on c.id = v.cid;

  -- Fecha de alta del contacto = su primera actividad
  update contacts c set created_at = a.first_at
    from (select contact_id, min(at) as first_at from activities group by contact_id) a
   where a.contact_id = c.id;

  -- ---------- Tratos ----------
  -- next_at = hoy + next_days 09:00 · created_at = hace 20 días 09:00
  insert into deals (id, contact_id, product, amount, currency, stage, temp, next_at, next_action, created_at, closed_at)
  select v.id, v.cid, v.product, v.amount, v.currency, v.stage, v.temp,
         vx_at(v.next_days, 9, 0), v.next_action, vx_at(-20, 9, 0), v.closed_at
    from (values
      ('d1',  'c1',  'Secadora de arroz 30 TN',         117000, 'USD', 'negociacion', 'caliente', 0,  'Cerrar forma de pago (12 meses)', null::timestamptz),
      ('d2',  'c2',  'Selectora óptica de granos',      45000,  'USD', 'cotizacion',  'tibio',    -1, 'Seguimiento a cotización', null),
      ('d3',  'c3',  'Molino de arroz compacto 1 TN/h', 36250,  'PEN', 'contactado',  'frio',     0,  'Enviar video por WhatsApp', null),
      ('d4',  'c4',  'Molino de arroz 3 TN/h',          38500,  'USD', 'cotizacion',  'caliente', 1,  'Enviar foto del tablero eléctrico', null),
      ('d5',  'c5',  'Pulidora de arroz MN-25',         6350,   'USD', 'cerrado',     'caliente', 0,  'Coordinar instalación', vx_at(vx_month_offset(3), 16, 0)),
      ('d6',  'c6',  'Motocultor 15 HP',                6000,   'PEN', 'cerrado',     'caliente', 0,  'Entrega en Bagua Grande', vx_at(0, 8, 40)),
      ('d7',  'c7',  'Secadora de maíz 18 TN',          52000,  'USD', 'negociacion', 'tibio',    0,  'Llamar: ¿ya tiene la trifásica?', null),
      ('d8',  'c8',  'Secadora de maíz 18 TN',          52000,  'USD', 'contactado',  'tibio',    3,  'Proponer separar con 30%', null),
      ('d9',  'c9',  'Pulidora + descascaradora',       14150,  'USD', 'nuevo',       'caliente', 0,  'Visita a planta', null),
      ('d10', 'c10', 'Molino de arroz compacto 1 TN/h', 9745,   'USD', 'nuevo',       'tibio',    1,  'Primera llamada', null),
      ('d11', 'c11', 'Cargador frontal 3 m³',           68000,  'USD', 'contactado',  'caliente', 2,  'Revisar opciones de leasing', null),
      ('d12', 'c12', 'Secadora de maíz 18 TN',          52000,  'USD', 'nuevo',       'tibio',    0,  'Llamar después de las 4 pm', null),
      ('d13', 'c13', 'Pre-limpia / clasificadora',      52800,  'PEN', 'cotizacion',  'tibio',    -2, 'Seguimiento a cotización', null),
      ('d14', 'c14', 'Molino de arroz 3 TN/h',          143220, 'PEN', 'cerrado',     'caliente', 0,  'Cobrar saldo 50%', vx_at(vx_month_offset(9), 12, 0)),
      ('d15', 'c15', 'Descascaradora 10x10',            7800,   'USD', 'contactado',  'frio',     6,  'Reenviar comparativo', null),
      ('d16', 'c16', 'Cosechadora de quinua 350',       33000,  'USD', 'negociacion', 'caliente', 0,  'Confirmar pago mixto USD / Bs', null),
      ('d17', 'c17', 'Secadora de maíz 35 TN',          166000, 'USD', 'contactado',  'frio',     30, 'Retomar contacto', null),
      ('d18', 'c18', 'Horno industrial 80 + balanza',   94600,  'BOB', 'cotizacion',  'tibio',    1,  'Seguimiento a cotización', null),
      ('d19', 'c19', 'Secadora + molino de arroz',      155500, 'USD', 'negociacion', 'caliente', 2,  'Asamblea de la asociación', null),
      ('d20', 'c20', 'Cosechadora de quinua 350',       33000,  'USD', 'nuevo',       'caliente', 0,  'Primera llamada', null),
      ('d21', 'c21', 'Molino de arroz 3 TN/h',          268000, 'BOB', 'cerrado',     'caliente', 0,  'Programar capacitación', vx_at(vx_month_offset(6), 11, 0)),
      ('d22', 'c22', 'Secadora de arroz 30 TN',         117000, 'USD', 'cotizacion',  'caliente', 0,  'Videollamada con el socio', null),
      ('d23', 'c23', 'Molino de arroz 3 TN/h',          38500,  'USD', 'negociacion', 'tibio',    1,  'Enviar condiciones de garantía', null),
      ('d24', 'c24', 'Tractor agrícola 90 HP',          42000,  'USD', 'nuevo',       'tibio',    2,  'Enviar ficha técnica', null),
      ('d25', 'c25', 'Pulidora de arroz MN-25',         6350,   'USD', 'cerrado',     'caliente', 0,  'Postventa', vx_at(vx_month_offset(12), 15, 0)),
      ('d26', 'c26', 'Motocultor 15 HP',                394450, 'VES', 'contactado',  'frio',     4,  'Enviar precio actualizado', null),
      ('d27', 'c27', 'Secadora de arroz 30 TN',         117000, 'USD', 'cerrado',     'caliente', 0,  'Cobrar cuota 2 de 6', vx_at(-60, 11, 0)),
      ('d28', 'c28', 'Cosechadora de quinua 350',       33000,  'USD', 'cerrado',     'caliente', 0,  'Entrega y cobro del saldo', vx_at(-35, 10, 0)),
      ('d29', 'c29', 'Molino de arroz 3 TN/h',          38500,  'USD', 'cerrado',     'tibio',    0,  'Cobrar saldo por Zelle', vx_at(-45, 15, 0)),
      ('d30', 'c30', 'Pulidora + clasificadora',        76000,  'PEN', 'cerrado',     'tibio',    0,  'Cobrar saldo', vx_at(-70, 12, 0))
    ) as v(id, cid, product, amount, currency, stage, temp, next_days, next_action, closed_at);

  -- ---------- Plan de cobro (cuotas) ----------
  -- due_at = hoy + due_days 09:00 · paid_at = hoy + paid_days 11:00 (null = pendiente)
  insert into payments (id, deal_id, contact_id, currency, n, of_total, label, amount, due_at, paid_at, method, ref)
  select v.id, v.deal_id, d.contact_id, d.currency, v.n, v.of_total, v.label, v.amount,
         vx_at(v.due_days, 9, 0),
         case when v.paid_days is not null then vx_at(v.paid_days, 11, 0) end,
         v.method, coalesce(v.ref, '')
    from (values
      ('p1',  'd5',  1, 1, 'Pago al contado',       6350,  vx_month_offset(3),  vx_month_offset(3),  'Transferencia', 'OP-558120'),
      ('p2',  'd25', 1, 1, 'Pago al contado',       6350,  vx_month_offset(12), vx_month_offset(12), 'Zelle',         null),
      ('p3',  'd6',  1, 2, 'Adelanto 50%',          3000,  0,   0,    'Yape / Plin',   null),
      ('p4',  'd6',  2, 2, 'Saldo contra entrega',  3000,  3,   null, null,            null),
      ('p5',  'd14', 1, 2, 'Adelanto 50%',          71610, vx_month_offset(9),  vx_month_offset(9),  'Depósito',      'BCP 00912'),
      ('p6',  'd14', 2, 2, 'Saldo 50%',             71610, 0,   null, null,            null),
      ('p7',  'd21', 1, 3, 'Cuota 1 de 3',          89334, vx_month_offset(6),  vx_month_offset(6),  'Transferencia', 'BNB 77410'),
      ('p8',  'd21', 2, 3, 'Cuota 2 de 3',          89333, 24,  null, null,            null),
      ('p9',  'd21', 3, 3, 'Cuota 3 de 3',          89333, 54,  null, null,            null),
      ('p10', 'd27', 0, 6, 'Inicial',               27000, -60, -60,  'Transferencia', 'OP-401233'),
      ('p11', 'd27', 1, 6, 'Cuota 1 de 6',          15000, -33, -30,  'Transferencia', 'OP-433901'),
      ('p12', 'd27', 2, 6, 'Cuota 2 de 6',          15000, -3,  null, null,            null),
      ('p13', 'd27', 3, 6, 'Cuota 3 de 6',          15000, 27,  null, null,            null),
      ('p14', 'd27', 4, 6, 'Cuota 4 de 6',          15000, 57,  null, null,            null),
      ('p15', 'd27', 5, 6, 'Cuota 5 de 6',          15000, 87,  null, null,            null),
      ('p16', 'd27', 6, 6, 'Cuota 6 de 6',          15000, 117, null, null,            null),
      ('p17', 'd28', 1, 2, 'Adelanto 50%',          16500, -35, -35,  'Transferencia', null),
      ('p18', 'd28', 2, 2, 'Saldo contra entrega',  16500, 2,   null, null,            null),
      ('p19', 'd29', 1, 2, 'Adelanto 50%',          19250, -45, -45,  'Zelle',         null),
      ('p20', 'd29', 2, 2, 'Saldo a 30 días',       19250, -12, null, null,            null),
      ('p21', 'd30', 1, 2, 'Adelanto 50%',          38000, -70, -70,  'Depósito',      null),
      ('p22', 'd30', 2, 2, 'Saldo a 30 días',       38000, -38, null, null,            null)
    ) as v(id, deal_id, n, of_total, label, amount, due_days, paid_days, method, ref)
    join deals d on d.id = v.deal_id;

  -- ---------- Agenda (tareas) ----------
  insert into tasks (id, at, type, contact_id, seller_id, title, done)
  select v.id, vx_at(v.day, v.h, v.m), v.type, v.cid, c.owner_id, v.title, v.done
    from (values
      ('t0', 0,  8,  0,  'visita',   'c6',  'Entrega del motocultor', true),
      ('t1', 0,  8,  30, 'llamada',  'c1',  'Cerrar forma de pago (financiamiento 12 meses)', true),
      ('t2', 0,  9,  30, 'whatsapp', 'c3',  'Enviar video del molino compacto (no contesta llamadas)', false),
      ('t3', 0,  10, 0,  'reunion',  'c16', 'Videollamada: pago mixto USD / Bs y entrega en Desaguadero', false),
      ('t4', 0,  11, 30, 'llamada',  'c2',  'Seguimiento a cotización de selectora óptica', false),
      ('t5', 0,  15, 0,  'visita',   'c9',  'Visita a planta en Nueva Cajamarca', false),
      ('t6', 0,  16, 15, 'llamada',  'c12', 'Llamar pasadas las 4 pm', false),
      ('t7', 0,  17, 30, 'reunion',  'c22', 'Videollamada con el socio (Calabozo)', false),
      ('t8', -2, 10, 0,  'llamada',  'c13', 'Seguimiento a cotización de pre-limpia', false),
      ('t9', 0,  12, 0,  'llamada',  'c14', 'Cobrar saldo 50% del molino (vence hoy)', false)
    ) as v(id, day, h, m, type, cid, title, done)
    join contacts c on c.id = v.cid;

  -- ---------- Alertas ----------
  insert into alerts (id, kind, contact_id, title, body, actions) values
    ('a1', 'hot',      'c1',  'Rosa Huamán abrió tu cotización 3 veces hoy',
           'Secadora de arroz 30 TN · es el mejor momento para llamar.', array['call', 'whatsapp']),
    ('a2', 'stale',    'c2',  'Llevas 4 días sin contactar a Grupo Agroindustrial Alfa',
           'Cotización de US$ 45,000 en espera. Un mensaje corto lo mantiene activo.', array['whatsapp', 'snooze']),
    ('a3', 'fx',       'c16', 'Gilberto quiere pagar mitad en USD y mitad en Bs',
           'Prepara el desglose con el tipo de cambio del día antes de la videollamada.', array['split', 'snooze']),
    ('a4', 'noanswer', 'c3',  'Segundo Neyra no contesta (3 intentos)',
           'Cambia de canal: un video de la máquina por WhatsApp suele tener respuesta.', array['whatsapp', 'snooze']),
    ('a5', 'promise',  'c7',  'Hugo Carrazco te pidió que lo llames a fin de mes',
           'Ya solicitó la instalación trifásica. Confirma si mantiene la campaña de junio.', array['call', 'snooze']),
    ('a6', 'credit',   'c8',  'A Darwin Cruz le aprobaron el crédito bancario',
           'Propón separar la secadora con 30% antes de que lo invierta todo en acopio.', array['whatsapp', 'snooze']),
    ('a7', 'stale',    'c23', 'María Gabriela pide garantía de 2 años',
           'Envía condiciones de garantía y stock de repuestos en Acarigua hoy.', array['whatsapp', 'snooze']);

  -- ---------- Estrategia ----------
  insert into strategy_cards (id, kind, title, body, position) values
    ('s1', 'enfoque', 'Enfoque de la semana',
     E'Cerrar las 3 secadoras en negociación antes de la campaña de arroz.\nPrioridad: San Martín (Perú) y Beni (Bolivia).\nMeta: 2 visitas de campo por día en Nueva Cajamarca.', 1),
    ('s2', 'promo', 'Promociones vigentes',
     E'Secadoras: instalación y capacitación gratis hasta el 15 del próximo mes.\nMolino compacto: 10% de descuento pagando al contado.\nBolivia: entrega sin costo hasta Desaguadero.', 2),
    ('s3', 'guion', 'Guion: cliente que dice "está caro"',
     'Entiendo, don ___. Comparemos lo que pierde hoy secando al sol: merma, precio castigado y días de espera. Con la secadora recupera la inversión en ___ campañas. ¿Le preparo una simulación con financiamiento a 12 meses?', 3),
    ('s4', 'guion', 'Guion: cliente que no contesta',
     'Buenas tardes ___, le escribe Andrés de Vendex. Le dejo un video de 40 segundos del molino trabajando en Juanjuí. Si le interesa, ¿le llamo mañana a las 9 o prefiere a las 4?', 4);
end $$;

revoke all on function public.seed_demo_data() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.seed_demo_data() from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.seed_demo_data() to service_role;
  end if;
end $$;

commit;
