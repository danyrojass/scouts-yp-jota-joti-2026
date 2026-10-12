# Bitácora de deploy — Vercel

Registro de avance del despliegue de **Exploración de Ypacaraí** en Vercel.
Última actualización: **2026-10-12**.

## Estado actual

- Proyecto importado en Vercel como **un solo proyecto**:
  - Root Directory: `./` (raíz del repo)
  - Application Preset: `Other`
  - Services: **OFF**
- El deploy **compila** y en runtime quedó **operativo** (verificado 2026-10-12):
  `/api/health` → `{"status":"ok"}` y login admin y de equipo OK.
- Cadena resuelta: `Invalid environment configuration` → fix de parser (`1382825`);
  `Origen no permitido por CORS` → CORS permite `PUBLIC_BASE_URL` y las URLs de
  Vercel (`0c94e65`); `P2021` (tablas inexistentes) → migraciones aplicadas a Neon;
  datos → seed (admin + equipos demo).

## Configuración usada

- `vercel.json` (raíz, sin Services):
  - `installCommand: npm install --include=dev`
  - `buildCommand: npm run build:vercel` (Prisma generate + server + client)
  - `outputDirectory: client/dist`
  - Function `api/index.js` (`maxDuration: 30`) que reexporta `server/dist/app.js`
  - Rewrites: `/api/(.*) → /api` y `/(.*) → /index.html`
- `server/tsconfig.build.json`: `types: ["node"]` (el build ya no exige types de vitest).

## Decisiones

- **Un solo proyecto / un solo dominio.** La auth usa cookie de sesión
  same-origin (`ypacarai.sid`); dos proyectos separados forzarían cookies
  cross-site (`SameSite=None`), que Safari bloquea.
- **No usar Services** porque `vercel.json` ya resuelve SPA + Function en la raíz.
- DB: **Neon Postgres** creada desde Vercel → Storage → Postgres (inyecta
  `DATABASE_URL` pooled). Se borró una `DATABASE_URL` manual previa que chocaba.

## Problemas encontrados y solución

| Problema | Causa | Solución |
|---|---|---|
| `TS2688: Cannot find type definition file for 'node'` / `'vitest/globals'` | Vercel instala con `NODE_ENV=production` y omitía devDependencies | `installCommand: npm install --include=dev` + quitar `vitest/globals` del build |
| `This project already has an existing environment variable DATABASE_URL` | Había una `DATABASE_URL` manual | Borrarla y dejar que Storage inyecte la de Neon |
| `Invalid environment configuration` (runtime) | `SESSION_SECRET` < 32, `PUBLIC_BASE_URL` sin `https://`, o valores pegados con comillas/espacios/salto de línea | Parser endurecido: recorta comillas y espacios y loguea el motivo exacto por variable. Igual hay que corregir los valores en Vercel (ver próximos pasos) |
| `Origen no permitido por CORS` (runtime) | `CORS_ORIGINS` no incluía el dominio real (quedó el default `localhost:5173`); el browser manda `Origin` aun en same-origin | CORS ahora permite automáticamente el origen de `PUBLIC_BASE_URL` y el error loguea el origen rechazado. Igual conviene setear `CORS_ORIGINS` con el dominio real |

## Variables de entorno (Production)

Ya inyectada: `DATABASE_URL` (pooled).

Cargadas a mano:

```
NODE_ENV=production
SESSION_SECRET=<32+ chars aleatorios, sin comillas>   # ← revisar (<32 o comillas)
PUBLIC_BASE_URL=https://<proyecto>.vercel.app          # ← revisar (debe incluir https://, sin comillas)
CORS_ORIGINS=https://<proyecto>.vercel.app
COOKIE_SECURE=true
TRUST_PROXY=1
ADMIN_USERNAME=<usuario>
ADMIN_PASSWORD=<password fuerte>
```

`DATABASE_URL_UNPOOLED` (directa, sin pgbouncer) **no la usa la app**: sirve solo
para `prisma migrate deploy` desde local.

## Próximos pasos

1. ~~Corregir env vars~~ ✅ (Production).
2. ~~Migrar la DB con la URL unpooled~~ ✅ (`prisma migrate deploy` sobre Neon).
3. ~~Crear datos~~ ✅ (seed: admin + equipos `aguara`/`lobo`/`halcon`).
4. ~~Verificar login~~ ✅ (`/api/health`, login admin y equipo contra el deploy).
5. **Seguridad (pendiente)**:
   - **Rotar la contraseña** del rol de Neon (se pegaron credenciales en el chat),
     actualizar `DATABASE_URL` (pooled) en Vercel y **Redeploy**.
   - Cambiar la contraseña del **admin** (usar `npm run create-admin`) y de los
     equipos antes del evento real.
   - Reemplazar/borrar los **datos demo** (evento, postas y equipos) por los reales.

## Verificación (2026-10-12)

```powershell
# health
Invoke-RestMethod "https://scouts-yp-jota-joti-2026.vercel.app/api/health"
# login equipo (con header Origin, como el browser)
# -> { principal: { type: "team", ... } }
```

## Notas y trampas

- Esta máquina tiene **IPv6 localhost roto**: usar `127.0.0.1` (Docker Postgres
  en `5433`). Vite se expone con `server.host: true`.
- Los cambios de env vars **no aplican** a deploys ya hechos: siempre **Redeploy**.
- Neon da dos cadenas: **pooled** (runtime) y **unpooled** (migraciones).
- Las credenciales de Neon se pegaron en el chat → **rotar** la contraseña del rol
  si ese chat se comparte/guarda.
- Cambios de env vars de build (devDeps) requieren un deploy nuevo para tomarse.

## Commits relevantes

> Nota: los hashes se reescribieron (2026-10-12) al corregir el autor/committer
> del historial a `Daniel Rojas <danyrsimon@hotmail.com>` (force-push).

- `1382825` fix(server): sanear los valores de entorno y loguear el motivo del error
- `f4e5869` fix(vercel): instalar devDependencies en el build y no requerir types de vitest
- `e5c9a38` docs(runbook): mencionar la carga de variables con Paste .env en Vercel
- `9694bf8` fix(client): corregir la ruta /itinierario a /itinerario
- `64a2fb0` chore(client): exponer el dev server en la red local (host: true)
- `ce3a004` fix(client): anidar las subrutas del evento bajo EventDetailPage
- `aaac61d` docs(runbook): documentar que el entorno de test se define en vitest.config.ts
