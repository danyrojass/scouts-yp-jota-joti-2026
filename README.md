# Exploración de Ypacarai

Carrera de orientación por postas con códigos QR. Monorepo con cliente web (React + Vite + TypeScript + Tailwind), API (Express + TypeScript + PostgreSQL + Prisma) y autenticación por sesión con cookies HTTP-only persistidas en Postgres.

- **Cliente**: SPA mobile-first para equipos (pasaporte digital, escaneo de QR, itinerario con mapa, safari de exploración, postas) y panel de administración (eventos, equipos, postas con coordenadas, itinerarios, safari, QR imprimibles, resultados).
- **Servidor**: API REST `/api/v1`, reglas de negocio y validación **del lado del servidor** (nada de Firebase ni datos mock).
- **Base de datos**: PostgreSQL con Prisma ORM.

## Funcionalidades

**Equipos**
- Pasaporte digital con progreso, historial y próxima posta.
- Escaneo de QR en el navegador (`@zxing/browser`) con validación en el servidor.
- **Mi itinerario**: recorrido en mapa (Leaflet + OpenStreetMap) con marcadores numerados, estados (próxima / completada / pendiente), inicio y meta, y enlaces *Cómo llegar*.
- **Safari de Exploración**: checklist colaborativo por equipo, guardado en el servidor.

**Administración**
- Eventos con máquina de estados (`PREPARED → IN_PROGRESS → FINISHED`, `CANCELLED`).
- Equipos, asignación de itinerarios y reinicio de progreso.
- Postas con desafíos (`CODE`, `QUESTION`, `CONFIRMATION`, `AUTO`), coordenadas y **QR imprimibles**.
- Importación masiva de coordenadas por **CSV**.
- Safari (ítems, orden, activo) y progreso por equipo.
- Pizarra en vivo, resultados (CSV) y auditoría.

## Estructura

```
scouts-yp-qr/
├─ api/           # entry serverless para Vercel (reexporta server/dist/app)
├─ client/        # SPA React + Vite + Tailwind
├─ server/        # API Express + Prisma
│  ├─ prisma/     # schema, migraciones y seed
│  ├─ src/        # código fuente
│  └─ tests/      # tests de integración (Vitest + Supertest)
├─ docs/          # arquitectura, API, runbook y glosario
├─ docker-compose.yml
├─ vercel.json    # configuración de despliegue en Vercel
└─ .env.example
```

## Requisitos

- Node.js 20+ (probado con 24) y npm 10+.
- Docker (recomendado) para levantar PostgreSQL, o un PostgreSQL propio.

## Puesta en marcha (desarrollo)

1. **Base de datos**

   ```bash
   docker compose up -d db
   ```

   Levanta PostgreSQL en `127.0.0.1:5433` (se usa 5433 en el host para no chocar con un PostgreSQL local en 5432). Usuario, contraseña y base: `ypacarai`.

2. **Variables de entorno**

   ```bash
   copy .env.example server\.env      # Windows
   # cp .env.example server/.env      # macOS/Linux
   ```

   Ajustá `SESSION_SECRET` y `ADMIN_PASSWORD` antes de cualquier despliegue.

3. **Dependencias**

   ```bash
   npm install
   ```

4. **Migrar y sembrar**

   ```bash
   npm run db:migrate      # aplica migraciones (prisma migrate dev)
   npm run db:seed         # datos de demostración
   npm run create-admin    # crea/actualiza el admin desde .env (opcional: el seed ya crea uno)
   ```

5. **Levantar todo**

   ```bash
   npm run dev
   ```

   - Cliente: http://localhost:5173
   - API: http://localhost:4000 (health: `/api/health`)

### Credenciales de demostración

| Rol   | Usuario  | Contraseña                    |
|-------|----------|-------------------------------|
| Admin | `admin`  | valor de `ADMIN_PASSWORD`     |
| Equipo| `aguara` | `explora2026`                 |
| Equipo| `lobo`   | `explora2026`                 |
| Equipo| `halcon` | `explora2026`                 |

El seed crea el evento **"Exploracion de Ypacarai 2026"** (PREPARED), 5 postas (con coordenadas aproximadas) y 3 equipos, cada uno con un itinerario distinto sobre **las mismas** postas físicas.

### Mapa y Safari

- **Mi itinerario** dibuja el recorrido del equipo en un mapa Leaflet + OpenStreetMap: marcadores numerados con estado (próxima / completada / pendiente), línea del recorrido, inicio (A) y meta (B), y un enlace *Cómo llegar* (Google Maps) por posta. Las postas **sin coordenadas** se listan pero no aparecen en el mapa.
- Las coordenadas se cargan por el admin (formulario de posta o **importación CSV** en Postas → *Importar CSV*, columnas `nombre,qr_id,latitud,longitud,descripcion`).
- **Safari de Exploración** es un checklist colaborativo por equipo (guardado en el servidor) que se completa durante el evento; es **independiente** de las postas del pasaporte. Se administra en Evento → *Safari*.

## Scripts (raíz)

| Script | Descripción |
|---|---|
| `npm run dev` | Cliente + servidor en paralelo |
| `npm run build` | Compila servidor (tsc) y cliente (vite build) |
| `npm run build:vercel` | Genera el cliente Prisma y compila todo (lo usa Vercel) |
| `npm test` | Tests de servidor + cliente |
| `npm run test:server` | Tests de integración de la API (Vitest) |
| `npm run test:client` | Tests unitarios del cliente (Vitest) |
| `npm run typecheck` | Chequeo de tipos en ambos workspaces |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` (producción) |
| `npm run db:seed` | Datos de demostración |
| `npm run create-admin` | Bootstrap del administrador |

## Tests

```bash
npm test                       # servidor + cliente
npm run test:server            # solo API
npm --workspace server run test:watch
```

Los tests del servidor son de **integración**: levantan la app Express con Supertest y usan una base separada `ypacarai_test` (misma instancia Postgres). `tests/global-setup.ts` aplica las migraciones y crea la tabla de sesiones antes de correr.

Cubren: login correcto/incorrecto, protección de rutas, aislamiento entre equipos, itinerarios que comparten QR, visitas fuera de orden, respuestas incorrectas, duplicados, postas de confirmación, integridad ante solicitudes concurrentes, expiración de sesión, restricciones por estado del evento, progreso del safari e importación/entrega de coordenadas.

## Despliegue en Vercel

El proyecto está preparado para desplegarse **completo en Vercel** (SPA + API en el mismo dominio):

- `vercel.json` mantiene `framework: null`, compila con `npm run build:vercel`, publica el SPA desde `client/dist` y rutea `/api/*` a la función serverless [`api/index.js`](api/index.js) (que reexporta la app Express compilada). El resto de las rutas caen al `index.html` (deep links del SPA).
- La app de Express usa **driver adapter de Prisma** (`@prisma/adapter-pg`) sobre un pool `pg` compartido, así no depende del binario nativo del motor de consultas (habitualmente ausente en Vercel).
- Como la SPA y la API comparten dominio, no hace falta `VITE_API_URL` (el cliente usa rutas relativas `/api/...`) ni configurar CORS cruzado.

### Pasos

1. **Base de datos** — Creá un PostgreSQL gestionado (Neon, Supabase, Vercel Postgres). Copiá la cadena **pooled** y agregá `?sslmode=require`.
2. **Variables de entorno** (Vercel → Settings → Environment Variables):

   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | cadena pooled con `sslmode=require` |
   | `SESSION_SECRET` | aleatorio, **≥32 caracteres** |
   | `COOKIE_SECURE` | `true` |
   | `COOKIE_SAMESITE` | `lax` |
   | `TRUST_PROXY` | `1` |
   | `PUBLIC_BASE_URL` | `https://<proyecto>.vercel.app` |
   | `CORS_ORIGINS` | `https://<proyecto>.vercel.app` |
   | `ADMIN_USERNAME` / `ADMIN_PASSWORD` | credenciales del admin |

3. **Migrar y sembrar** (una vez, desde tu equipo apuntando a la base remota):

   ```bash
   $env:DATABASE_URL="postgresql://...?sslmode=require"; npm run db:deploy
   $env:DATABASE_URL="postgresql://...?sslmode=require"; npm run create-admin
   ```

4. **Deploy** — Conectá el repo a Vercel; el build usa `npm run build:vercel` automáticamente. Verificá `https://<proyecto>.vercel.app/api/health`.

> Alternativa (API aparte): la SPA se sirve estática en Vercel y la API en un host de contenedores (Render/Railway/Fly) con `node server/dist/index.js`. En ese caso definí `VITE_API_URL` con el dominio de la API y ajustá `CORS_ORIGINS`/cookies (`SameSite=None; Secure`).

Ver [`docs/runbook.md`](docs/runbook.md) para la checklist de producción.

## Documentación

- [`docs/architecture.md`](docs/architecture.md) — decisiones y diagramas.
- [`docs/api-reference.md`](docs/api-reference.md) — contratos y endpoints.
- [`docs/runbook.md`](docs/runbook.md) — operación y troubleshooting.
- [`docs/glossary.md`](docs/glossary.md) — términos del dominio.
