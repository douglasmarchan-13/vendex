# Vendex · Backend

API REST de Vendex en **NestJS 12 + TypeScript** sobre **Supabase** (Postgres).
Reemplaza el `localStorage` del frontend: cada acción de `frontend/src/store.jsx` tiene su endpoint
(el cliente está en `frontend/src/lib/api.js`).

```
backend/
├── supabase/vendex.sql              ← esquema + funciones + semilla (un solo script)
├── src/
│   ├── main.ts                      ← arranque (carga .env, puerto, logs)
│   ├── setup.ts                     ← prefijo /api, CORS, body JSON, filtro de errores, Swagger
│   ├── app.module.ts                ← módulos + AuthGuard global
│   ├── core/                        ← servicios globales
│   │   ├── app-config.ts            ←   variables de entorno validadas con Zod
│   │   ├── supabase.service.ts      ←   cliente service_role + helpers q / one / rpc
│   │   └── clock.service.ts         ←   fechas en la zona horaria del negocio
│   ├── database/database.types.ts   ← tipos generados desde la base (npm run gen:types)
│   ├── common/
│   │   ├── auth/                    ← AuthGuard (modo demo o JWT), @Public(), @SellerId()
│   │   ├── errors/                  ← ApiError, errores de Postgres → HTTP, filtro global
│   │   ├── validation/              ← @ZBody / @ZQuery / @ZParam (Zod + Swagger), esquemas comunes
│   │   └── utils/mappers.ts         ← filas snake_case ⇄ objetos camelCase del frontend
│   └── modules/                     ← un módulo por recurso: *.controller.ts + *.service.ts + *.schemas.ts
│       ├── bootstrap/  catalogs/  contacts/  deals/  payments/
│       └── tasks/  alerts/  strategy/  settings/  health/
├── test/app.e2e-spec.ts             ← pruebas e2e de toda la API (Vitest + Supertest)
└── scripts/gen-types.mjs            ← regenera database.types.ts
```

### Cómo está organizado

- **Controller** recibe la petición HTTP: valida con Zod (`@ZBody`, `@ZQuery`, `@ZParam`) y llama al service.
  Los mismos esquemas Zod generan la documentación Swagger.
- **Service** contiene la lógica y las consultas a Supabase. Las operaciones que tocan varias tablas
  (cerrar una venta, plan de cobro, registrar un pago, cambiar temperatura) son funciones SQL atómicas
  que el service llama con `rpc()`, tipadas con `database.types.ts`.
- **AuthGuard** global identifica al vendedor de cada petición; `@Public()` marca rutas sin autenticación.
- **AllExceptionsFilter** responde siempre `{ error, details? }` y traduce los errores de Postgres
  (400 validación, 404 no existe, 409 conflicto).

## 1. Base de datos

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, pega el contenido de [`supabase/vendex.sql`](supabase/vendex.sql) y ejecútalo.

El script:

- Crea 16 tablas (catálogos, contactos, actividades, tratos, cuotas, tareas, alertas, estrategia, ajustes…), índices y triggers de `updated_at`.
- Activa **RLS sin políticas** en todas: con la clave `anon` no se puede leer nada. Solo el backend (clave `service_role`) accede.
- Crea funciones atómicas usadas por la API: `move_deal`, `create_payment_plan`, `register_payment`, `set_contact_temp`.
- Carga la **semilla** con los datos de `frontend/src/data/mock.js` (30 contactos, 54 actividades, 30 tratos, 22 cuotas, 10 tareas, 7 alertas, 4 tarjetas de estrategia, 15 productos, 4 vendedores, 3 países, 4 monedas).

Es re-ejecutable: no duplica tablas y solo siembra si `contacts` está vacía.
Las fechas de la semilla son **relativas a hoy** (como en el mock), así la agenda, los vencimientos y las ventas del mes siempre tienen sentido.

Para volver a los datos de demostración: `select public.seed_demo_data();` o `POST /api/admin/reset`.

Después aplica, en orden, las migraciones de [`supabase/migrations/`](supabase/migrations/) (001 → 005).
La **004** agrega `users.must_change_password` y la función `create_member_direct` (alta directa con contraseña
temporal): el backend actual la necesita para iniciar sesión. La **005** agrega `companies.user_onboarding`
(`invitacion` | `directa`): el método de alta de cada empresa, que fija el super admin.

### Superadministrador

El proyecto no trae credenciales por defecto. Créalo o restablece su contraseña desde `backend/`:

```bash
npm run superadmin -- --list                                  # correos de los super admin que existen
npm run superadmin -- --email tu@correo.com --name "Tu Nombre" # pide la clave sin mostrarla
npm run superadmin -- --email tu@correo.com --generate         # genera una clave segura y la muestra una vez
```

Usa `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` de `.env`. Restablecer la clave desbloquea la cuenta y cierra sus
sesiones abiertas. Alternativa en el SQL Editor: `select public.create_super_admin('correo', 'clave', 'Nombre');`

**Si cambias el SQL**, regenera los tipos de TypeScript: pon `SUPABASE_DB_URL` en `.env` y ejecuta
`npm run gen:types` y luego `npm run typecheck` (te dirá qué código hay que ajustar).

## 2. Servidor

Requisitos: Node.js ≥ 22.9.

```bash
cd backend
cp .env.example .env      # completa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
npm install
npm run start:dev         # desarrollo con recarga: http://localhost:4000/api
```

| Script | Qué hace |
|---|---|
| `npm run start:dev` | Compila y reinicia al guardar cambios |
| `npm run build` | Compila a `dist/` |
| `npm start` | Ejecuta `dist/` (producción: define `NODE_ENV=production` en el entorno) |
| `npm run typecheck` | Revisa tipos de `src/` y `test/` |
| `npm run test:e2e` | Pruebas e2e de toda la API (ver abajo) |
| `npm run gen:types` | Regenera `src/database/database.types.ts` desde la base |

**Documentación interactiva (Swagger):** <http://localhost:4000/api/docs> (JSON en `/api/docs-json`).

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto (Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave `service_role`. **Solo en el servidor.** |
| `PORT` | Puerto (4000) |
| `CORS_ORIGIN` | Orígenes permitidos, separados por coma (`http://localhost:5173`) |
| `BUSINESS_TZ` | Zona horaria del negocio (`America/Lima`). Debe coincidir con `app_settings.timezone` |
| `REQUIRE_AUTH` | `true` exige `Authorization: Bearer <token de Supabase Auth>` |
| `DEFAULT_SELLER_ID` | Vendedor por defecto en modo demo (`andres`) |
| `ALLOW_DEMO_RESET` | Habilita `POST /api/admin/reset`. Por defecto `false` con `NODE_ENV=production` |
| `SUPABASE_DB_URL` | (Opcional) Conexión Postgres, solo para `npm run gen:types` |

La configuración se valida al arrancar: si falta una variable o tiene un valor inválido, el servidor
no inicia y dice cuál es. Las variables del sistema tienen prioridad sobre las de `.env`.

### Autenticación

- **Modo demo** (`REQUIRE_AUTH=false`): sin login. El autor de las actividades sale de la cabecera `X-Seller-Id` o de `DEFAULT_SELLER_ID`.
- **Modo real** (`REQUIRE_AUTH=true`): el frontend inicia sesión con Supabase Auth y envía el `access_token`. El backend lo valida y busca el vendedor con `sellers.auth_user_id = <id del usuario>`; para enlazarlos:
  `update sellers set auth_user_id = '<uuid de auth.users>' where id = 'andres';`

## 3. Pruebas

```bash
cp .env.test.example .env.test   # una base SOLO de pruebas
npm run test:e2e
```

Levantan la app completa en memoria y recorren todos los flujos (alta de trato → cierre → plan de cobro
→ abono parcial → pago total, filtros, agenda, ajustes, errores, Swagger y modo autenticado).
**Borran los datos y recargan la semilla de demo**, por eso leen únicamente `.env.test` y nunca `.env`.

## 4. Endpoints

Todas las respuestas usan las mismas claves que el frontend (`contactId`, `nextAt`, `dueAt`, `paidAt`, `of`…).
El detalle de cada cuerpo y parámetro está en Swagger (`/api/docs`).

| Método | Ruta | Acción del store |
|---|---|---|
| GET | `/api/health?db=1` | — (pública) |
| GET | `/api/bootstrap` | Estado completo con la forma de `seed()` + `catalogs` |
| POST | `/api/admin/reset` | `reset()` |
| GET | `/api/catalogs` | `COUNTRIES`, `SELLERS`, `CHANNELS`, `STAGES`, `PRODUCTS`, `PAY_METHODS`, `GOAL_SHARE` |
| POST/PATCH/DELETE | `/api/catalogs/products[/:id]` | Gestión de productos |
| PUT | `/api/catalogs/pay-methods/:country` | Medios de pago por país |
| GET | `/api/contacts?country&owner&temp&q&timeline=true` | Lista / búsqueda |
| GET | `/api/contacts/:id` | Contacto + timeline + tratos + cuotas |
| POST / PATCH / DELETE | `/api/contacts[/:id]` | Alta / edición / baja |
| PUT | `/api/contacts/:id/temp` `{temp}` | `setTemp()` |
| GET / POST | `/api/contacts/:id/activities` `{type,text}` | `logActivity()` |
| GET | `/api/deals?stage&contactId&country&open=true` | Embudo |
| POST | `/api/deals` | `addDeal()` (con `contactId` o datos del contacto nuevo) |
| PATCH / DELETE | `/api/deals/:id` | Edición / baja |
| POST | `/api/deals/:id/move` `{stage}` | `moveDeal()` → `{deal, needsPlan}` |
| POST | `/api/deals/:id/pause` | `pauseDeal()` |
| POST | `/api/deals/:id/snooze` `{days}` | `snoozeDeal()` |
| POST | `/api/deals/:id/payment-plan` `{items, firstPaid}` | `createPlan()` |
| GET | `/api/payments?status&dealId&contactId&country` | Cuotas con `status` (vencido, hoy, semana, proximo, pagado) |
| GET | `/api/payments/summary?country` | Cartera: pendiente, vencido, antigüedad (USD) |
| POST | `/api/payments/:id/register` `{amount,method,date?,ref?}` | `registerPayment()` (total o abono parcial) |
| PATCH / DELETE | `/api/payments/:id` | Editar cuota pendiente / borrar |
| POST | `/api/payments/:id/unpay` | Revertir un pago |
| GET | `/api/tasks?date=YYYY-MM-DD&done&sellerId&overdue=true` | Agenda |
| POST / PATCH / DELETE | `/api/tasks[/:id]` | `addTask()` |
| POST | `/api/tasks/:id/toggle` | `toggleTask()` (registra actividad al completar) |
| GET / POST / DELETE | `/api/alerts[/:id]` | `dismissAlert()` |
| GET / POST / PUT / DELETE | `/api/strategy[/:id]` | `saveStrategy()` / `removeStrategy()` |
| GET | `/api/settings` | Meta, planificador, tipo de cambio |
| PUT | `/api/settings/goal` `{goalUSD}` | `setGoal()` |
| PATCH | `/api/settings/plan` | `setPlan()` |
| PATCH | `/api/settings/rates` `{PEN: 3.75}` | `setRates()` |
| GET / PUT / DELETE | `/api/snoozes[/:itemId]` `{days}` | `snooze()` |

Errores: `{ "error": "mensaje", "details": [...] }` con 400 (validación), 401/403 (auth), 404, 409 (conflicto, p. ej. cuota ya pagada) o 500.

## 5. Agregar un endpoint

1. Esquema Zod en `modules/<recurso>/<recurso>.schemas.ts` (y su tipo con `z.output`).
2. Método en el service usando `this.sb.q(...)`, `this.sb.one(...)` o `this.sb.rpc(...)`; mapea la fila con `common/utils/mappers.ts`.
3. Ruta en el controller con `@ZBody(esquema)` / `@ZQuery(esquema)` / `@ZParam('id', id)`; usa `@SellerId()` si registra actividades.
4. Un caso en `test/app.e2e-spec.ts`.
