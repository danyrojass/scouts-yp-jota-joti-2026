# Runbook — Exploración de Ypacarai

## Puesta en marcha local

```bash
docker compose up -d db                 # PostgreSQL en 127.0.0.1:5433
copy .env.example server\.env           # cp en macOS/Linux
npm install
npm run db:migrate
npm run db:seed
npm run dev                             # cliente 5173 + API 4000
```

Verificar: `curl http://localhost:4000/api/health`.

## Operaciones frecuentes

| Objetivo | Comando |
|---|---|
| Crear/actualizar admin | `npm run create-admin` |
| Aplicar migraciones (dev) | `npm run db:migrate` |
| Aplicar migraciones (prod) | `npm run db:deploy` |
| Re-sembrar demo | borrar el evento (`DELETE FROM "Event"`, cascade) y correr `npm run db:seed` → evento + 9 postas del recorrido urbano + equipos `equipo1`..`equipo10` (clave `explora2026`, override con `TEAM_PASSWORD`), cada uno con ruta en orden **aleatorio**. El admin se crea/actualiza por upsert |
| Cargar coordenadas de postas | Evento → **Postas** → *Importar CSV* (`nombre,qr_id,latitud,longitud,descripcion`) o editando cada posta |
| Configurar el safari | Evento → **Safari** (crear, items, orden, activo) |
| Reiniciar progreso del safari | Evento → **Safari** → *Reiniciar* (por equipo o todos); queda auditado |
| Correr tests | `npm test` |
| Compilar todo | `npm run build` |
| Arrancar la API compilada | `node server/dist/index.js` |

## Variables de entorno

Definidas en `server/.env` (ver `.env.example`). Claves:

- `DATABASE_URL` — cadena de conexión PostgreSQL.
- `SESSION_SECRET` — **obligatorio ≥32 caracteres en producción**.
- `PUBLIC_BASE_URL` — base de las URLs de QR (debe ser accesible desde los celulares).
- `CORS_ORIGINS` — orígenes permitidos, separados por coma.
- `COOKIE_SECURE=true` y `TRUST_PROXY=1` en producción (detrás de un proxy HTTPS; usar un número de saltos, no `true`).
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — usados por el seed y `create-admin`.

## Despliegue en Vercel (SPA + API en un solo proyecto)

1. Provisioná PostgreSQL gestionado (Neon/Supabase/Vercel Postgres) y usá la cadena **pooled** con `sslmode=require`.
2. Definí en Vercel (Settings → Environment Variables): `NODE_ENV=production`, `DATABASE_URL`, `SESSION_SECRET` (≥32), `COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax`, `TRUST_PROXY=1`, `PUBLIC_BASE_URL=https://<proyecto>.vercel.app`, `CORS_ORIGINS=https://<proyecto>.vercel.app`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`. Podés cargarlas todas juntas con **Paste .env** del Dashboard.
3. Aplicá el esquema y creá el admin desde tu equipo, apuntando a la base remota:
   ```powershell
   $env:DATABASE_URL="postgresql://...?sslmode=require"; npm run db:deploy
   $env:DATABASE_URL="postgresql://...?sslmode=require"; npm run create-admin
   ```
4. Deploy: `vercel.json` define `buildCommand=npm run build:vercel`, `outputDirectory=client/dist`, rutea `/api/*` a `api/index.js` y el resto a `index.html`. El router usa `BrowserRouter`, por eso el fallback SPA es imprescindible.
5. Verificá `GET https://<proyecto>.vercel.app/api/health` → `{"status":"ok"}`.

Notas:
- La app usa el **driver adapter** de Prisma (`@prisma/adapter-pg`) para no depender del binario nativo del motor en Vercel. Igual se generan `binaryTargets` (`native` + `rhel-openssl-3.0.x`) para que `prisma migrate deploy` funcione en el build/runtime Linux.
- El rate-limit es en memoria: cada instancia serverless cuenta por separado (aceptable para este evento).
- `express.static()` no se usa: el SPA se sirve desde el CDN de Vercel (`client/dist`).

## Checklist de despliegue a producción

1. `NODE_ENV=production`, `SESSION_SECRET` largo y único, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax`, `TRUST_PROXY=1`.
2. `DATABASE_URL` con `sslmode=require` apuntando a un PostgreSQL gestionado.
3. `CORS_ORIGINS` = dominio real del cliente; `PUBLIC_BASE_URL` = dominio público (para los QR).
4. Ejecutar `npm run db:deploy` antes de arrancar.
5. Crear el admin con `npm run create-admin` (no usar la contraseña por defecto).
6. Servir el cliente (`client/dist`). En Vercel va por CDN en el mismo dominio que la API; en un split, definí `VITE_API_URL` con el dominio de la API.
7. Verificar HTTPS extremo a extremo (cookies `Secure` no viajan por HTTP).

## Troubleshooting

**`Invalid environment configuration` (runtime)**
- La app valida el entorno con zod al arrancar (`server/src/config/env.ts`) y
  **loguea cada variable inválida con el motivo** (p. ej.
  `PUBLIC_BASE_URL: Invalid url`, `SESSION_SECRET: ... at least 32 chars`).
  El array `[…]{…}` que muestra Vercel es el log truncado: mirá la línea
  `Invalid environment configuration:` completa.
- Causas típicas al pegar un `.env` en el Dashboard: valores con comillas
  (`"https://…"`), espacios o `\n` al final, o un `# comentario` en la misma
  línea. El parser recorta comillas y espacios sobrantes, pero igual verificá
  que `PUBLIC_BASE_URL` incluya `https://` y que `SESSION_SECRET` tenga ≥32
  caracteres.
- Confirmá que las variables estén cargadas en el entorno **Production** (no
  solo Development/Preview) y hacé **Redeploy**: los cambios de env no se
  aplican a deploys ya hechos.

**`Origen no permitido por CORS`**
- El request trae un header `Origin` que no está en la allow list. En un deploy
  same-domain (SPA + API en el mismo dominio) el browser igual manda `Origin`,
  así que debe incluirse el dominio real.
- El origen de `PUBLIC_BASE_URL` se permite **automáticamente**, igual que las
  URLs que Vercel inyecta en runtime (`VERCEL_PROJECT_PRODUCTION_URL`,
  `VERCEL_BRANCH_URL`, `VERCEL_URL`), así que producción/branch/preview del mismo
  proyecto funcionan sin configurar nada. Podés sumar otros en `CORS_ORIGINS`
  (separados por coma, con `https://`, sin barra final). El error incluye el
  origen rechazado para identificarlo.

**`P1001: Can't reach database server`**
- El contenedor no está arriba: `docker compose up -d db` y `docker compose ps` (debe decir `healthy`).
- Conflicto de puerto: si ya hay un PostgreSQL local en 5432, este proyecto usa **5433** en el host. Verificá que `DATABASE_URL` use `127.0.0.1:5433`.
- En Windows, `localhost` puede resolver a IPv6 (`::1`) y fallar; usá `127.0.0.1` en `DATABASE_URL`.

**Docker Desktop no inicia el daemon**
- Abrir Docker Desktop y esperar a que el motor esté "running"; recién entonces `docker compose up`.

**`relation "session" does not exist`**
- La tabla la crea `connect-pg-simple` (`createTableIfMissing: true`) al iniciar la app. Si corrés consultas manuales antes, iniciá la app una vez o creala con el SQL del `tests/global-setup.ts`.

**`Prisma Client could not locate the Query Engine ... rhel-openssl-3.0.x` (Vercel)**
- La app usa el driver adapter `@prisma/adapter-pg`, que no necesita el motor binario. Asegurá que el build corra `prisma generate` (lo hace `npm run build:vercel`) y que `@prisma/adapter-pg` esté instalado. Si persiste, verificá que `server/dist` exista antes de empaquetar la función `api/index.js`.

**La API en Vercel devuelve 404 en `/api/v1/...`**
- Confirmá que `server/dist` se compiló (el entry `api/index.js` lo require) y que `vercel.json` rutea `/api/(.*)` → `/api`.

**Reiniciar la base de datos desde cero (local)**
```bash
docker compose down -v      # borra el volumen
docker compose up -d db
npm run db:migrate
npm run db:seed
```

**Nueva migración falla por drift (`Added tables - session`, `prisma migrate dev`)**
- `connect-pg-simple` crea la tabla `session` en tiempo de ejecución, fuera del historial de migraciones. `prisma migrate dev` lo interpreta como drift.
- Workaround: generar la migración contra una base limpia y luego aplicarla con `migrate deploy`:
  ```powershell
  # 1) base scratch para generar la migración
  $env:DATABASE_URL="postgresql://ypacarai:ypacarai@127.0.0.1:5433/ypacarai_mig?schema=public"
  npx prisma migrate dev --name <nombre> --skip-seed
  # 2) aplicar a las bases reales
  $env:DATABASE_URL="postgresql://ypacarai:ypacarai@127.0.0.1:5433/ypacarai?schema=public"; npx prisma migrate deploy
  $env:DATABASE_URL="postgresql://ypacarai:ypacarai@127.0.0.1:5433/ypacarai_test?schema=public"; npx prisma migrate deploy
  # 3) borrar la base scratch (createdb/dropdb o psql)
  ```
- Correr los comandos desde `server/` (donde está `prisma/schema.prisma`).

**El mapa del itinerario no muestra postas**
- Las postas sin `latitude`/`longitude` no se dibujan (sí aparecen en la lista). Cargalas desde **Postas** (formulario o *Importar CSV*).

**El equipo no puede marcar el safari (409)**
- Solo se puede marcar con el evento `IN_PROGRESS`. Verificá el estado del evento y que el safari esté `active`.

**El cliente no ve los cambios / CORS**
- Revisá que `CORS_ORIGINS` incluya el origen del cliente y que el proxy de Vite (`/api` → `:4000`) esté activo.

**Errores 403 en POST/PUT/DELETE**
- Falta el header `x-csrf-token`. El cliente lo obtiene en `/auth/csrf` y lo refresca tras el login; si integraste otro cliente, replicá ese flujo.

**Login bloqueado por rate limit**
- Ajustá `LOGIN_MAX_ATTEMPTS` / `LOGIN_WINDOW_MINUTES` o esperá la ventana.

## Tests de integración

```bash
npm test
```
- Usan una base `ypacarai_test` en la misma instancia PostgreSQL (`127.0.0.1:5433`).
- El entorno de test (`DATABASE_URL` = `TEST_DATABASE_URL`, `NODE_ENV`, cookie, etc.) se define en `vitest.config.ts` (`test.env`), que se aplica antes de cargar cualquier módulo. No lo definas en `tests/setup.ts`: los `import` se evaluarían antes de la asignación y Prisma apuntaría a la base de desarrollo.
- `tests/global-setup.ts` aplica migraciones y crea la tabla `session`.
- `fileParallelism: false`: los archivos corren en serie; cada uno limpia la base antes de empezar.
