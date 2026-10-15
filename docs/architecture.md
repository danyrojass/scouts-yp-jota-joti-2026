# Arquitectura — Exploración de Ypacarai

## Visión general

Aplicación web para una carrera de orientación por postas con código QR. Cada equipo tiene un **itinerario** (orden de postas) y un **pasaporte digital**. En cada posta escanea un QR, resuelve un desafío y el **servidor** valida y registra el avance. La administración configura el evento, los equipos, las postas y los itinerarios, y sigue el progreso en vivo. Además hay un **Safari de Exploración** (checklist colaborativo por equipo), un **mapa** del itinerario (Leaflet + OpenStreetMap con coordenadas por posta), un **módulo de puntuaciones y ranking general** (actividades configurables, carga de puntajes por equipo, ranking admin/público con publicación explícita), la **recuperación de postas** (un equipo puede saltar una posta que no encuentra ingresando una frase de rescate, contando como semi-completada) y una **lista de integrantes** (beneficiarios del evento, sin cuenta ni inicio de sesión).

```
┌──────────────┐        HTTPS (cookies HTTP-only)        ┌───────────────┐
│   Cliente    │  ───────────────────────────────────▶  │   API REST    │
│ React + Vite │  ◀───────────────────────────────────  │  Express + TS │
│  (SPA)       │         JSON  ·  x-csrf-token           └──────┬────────┘
└──────────────┘                                                 │ Prisma
                                                                 ▼
                                                        ┌───────────────┐
                                                        │  PostgreSQL   │
                                                        └───────────────┘
```

- **Cliente** (`client/`): React 18 + Vite + TypeScript + Tailwind. Mobile-first. Vistas de equipo (pasaporte, itinerario con mapa, escaneo, safari, posta, ranking público) y de admin (eventos, equipos, postas, itinerarios, safari, actividades, ranking, QR imprimibles, resultados).
- **API** (`server/`): Express + TypeScript. Autenticación por sesión (cookies HTTP-only) y autorización por rol. Toda la lógica de negocio y validación vive aquí.
- **Datos**: PostgreSQL vía Prisma ORM.

## Modelo de datos
```
User (admin)                Event 1─* Team 1─* RouteStop *─1 Station
  id, username,             id, name, date,     teamId,           id, name,
  passwordHash, role        location, status    stationId,        publicToken,
                            (_counts)           position          challengeType,
                                                                  expectedAnswer,
                                                                  latitude, longitude,
                                                                  active, ...

Event 1─* Station           Team 1─* StationVisit *─1 Station
Event 1─* StationVisit      AuditLog *─1 Event / *─1 User / *─1 Team
session  (tabla de Express/connect-pg-simple)

Event 1─1 Safari 1─* SafariItem
  id, eventId(@unique),    id, safariId, name,
  title, description,      description, position, active
  active

Safari 1─* SafariFind *─1 Team
  id, safariId,            (@unique [itemId, teamId])
  itemId, teamId, eventId, foundAt
```

```
Event 1─* Activity 1─* TeamActivityScore *─1 Team
  id, eventId,          id, teamId,
  name, position,       activityId, eventId,
  maxScore, status,     score, evaluated,       (@unique [teamId, activityId])
  scoringMethod,        observations,
  published, active,    evaluatedBy, evaluatedAt
  allowMaxScoreExceeded

Event (extra): rankingPublished Boolean @default(false)
               rankingPublishedAt DateTime?

Event 1─* Member *─1 Team (opcional)
  id, eventId,             id, firstName,
  teamId?, lastName,       lastName, document?,
  document, birthDate?,    role (@enum MemberRole),
  role, phone?, notes?,    active, ...          (@unique [eventId, document])

Station (extra): rescuePhrase String?   (frase secreta de rescate)
StationVisit (extra): skipReason String?  (nota del salto)
VisitStatus: VALID | INCORRECT | SKIPPED
```

Restricción clave de integrantes: `Member @@unique([eventId, document])`. Como PostgreSQL permite múltiples `NULL` en un índice `UNIQUE`, varios integrantes pueden no tener documento; si lo tienen, es único dentro del evento.

Restricción clave: `StationVisit.validKey String? @unique`. Solo se setea cuando la visita es `VALID`, con el valor `"{teamId}:{stationId}"`. Como PostgreSQL permite múltiples `NULL` en una columna `UNIQUE`, esto garantiza **a lo sumo una visita válida por equipo y posta**, incluso con peticiones concurrentes.

## Decisiones de diseño

### Autenticación por sesión (sin Firebase)
- `express-session` + `connect-pg-simple`: las sesiones se guardan en la tabla `session` de Postgres. La cookie es `HttpOnly`, `SameSite=Lax` (configurable) y `Secure` en producción.
- Al hacer login se **regenera** el id de sesión (evita session fixation).
- El login busca primero en `User` (admin) y luego en `Team` (equipo). El error es idéntico para usuario inexistente y contraseña incorrecta (no filtra existencia de cuentas).
- Rate limit en `/auth/login` (`LOGIN_MAX_ATTEMPTS` / `LOGIN_WINDOW_MINUTES`).
- **CSRF**: token por sesión (`session.csrfToken`) que el cliente envía en el header `x-csrf-token` para métodos no seguros. El cliente lo obtiene en `GET /auth/csrf` y lo refresca tras el login.

### Identidad solo del lado del servidor
El principal (`{ type: "admin" | "team", id }`) proviene siempre de la sesión. El cliente **nunca** envía su propio id; no puede leer el pasaporte ni el progreso de otro equipo ni registrar visitas a nombre de otro.

### Registro de visitas robusto
`registerVisit` corre en una transacción `SERIALIZABLE`:
1. Valida que el evento esté `IN_PROGRESS`, la posta activa y pertenezca al evento del equipo.
2. Verifica que la posta sea la **próxima** según el itinerario (`NOT_YOUR_NEXT` en caso contrario).
3. Evalúa la respuesta (normaliza mayúsculas/acentos; `CONFIRMATION` acepta cualquiera; `AUTO` con `autoAcceptAny` acepta cualquier respuesta no vacía).
4. Inserta la visita. Si es inválida, la guarda como `INCORRECT` (auditoría de intentos). Si es válida, usa el `validKey` único.
5. Ante conflicto de `validKey` (P2002) → `ALREADY_COMPLETED`. Ante fallo de serialización (P2034) se **reintenta** la transacción; el reintento observa la fila ya confirmada y resuelve a `ALREADY_COMPLETED`.

Resultado: con N peticiones simultáneas a la misma posta, exactamente **una** termina `VALID`.

### Máquina de estados del evento
```
PREPARED ──start──▶ IN_PROGRESS ──finish──▶ FINISHED
    │                    │
    └──── cancel ────────┴──── cancel ─────▶ CANCELLED
```
- Solo puede haber **un evento activo** (`PREPARED` o `IN_PROGRESS`) a la vez.
- `start` valida que haya ≥2 postas y que cada equipo activo tenga un itinerario de ≥2 postas existentes.
- Editar datos del evento con `IN_PROGRESS` requiere `force` (se audita) o se rechaza con 403.
- Las visitas se bloquean según el estado (`EVENT_NOT_READY`, `EVENT_FINISHED`, `EVENT_CANCELLED`).

### Códigos QR
- Cada posta tiene un `publicToken` aleatorio (`randomBytes(12).toString("base64url")`).
- El QR codifica `"${PUBLIC_BASE_URL}/posta/{token}"`. El cliente extrae el token y llama a la API.
- `GET /stations/:id/qr` devuelve un PNG (librería `qrcode`) para imprimir; `/:id/qr/data` devuelve la URL y el token.
- El escaneo en el navegador usa `@zxing/browser`.

### Safari de Exploración
- Checklist colaborativo **por equipo**, persistido en el servidor (una fila `SafariFind` por `itemId`+`teamId`). Es **independiente** de las postas del pasaporte.
- Un `Safari` está ligado 1:1 a un evento (`eventId @unique`). Los `SafariItem` tienen `position` (sin restricción única, para reordenar con facilidad) y `active`; los inactivos no se cuentan ni se muestran.
- Cada ítem tiene `category` (`LUGARES_CULTURA`, `NATURALEZA`, `OBJETOS_CURIOSIDADES`, `DESAFIOS_FOTOGRAFICOS`, `PREGUNTAS_YPACARAI`, `GENERAL`) e `itemType` (`PHOTO`, `OBJECT`, `NUMERIC`, `COLLECTION`, `QUESTION`). Los tipos `NUMERIC` (observación) y `QUESTION` (pregunta abierta, p. ej. sobre Ypacaraí) exigen que el equipo registre un `value` al marcar; no hay validación de acierto, es solo un registro.
- El equipo solo puede marcar/desmarcar con el evento `IN_PROGRESS`; un elemento de otro evento responde `403` y fuera de estado `409`.
- El admin administra el safari (items, orden, activo) y ve el progreso por equipo (`GET /admin/safari/:id/progress`), con la posibilidad de reiniciar el progreso de un equipo o de todos (se audita como `RESET`).

### Puntuaciones y ranking general
- Las **actividades** son configurables por evento (`Activity`): nombre único por evento, `position` para ordenar, `maxScore` opcional, `status` (`PENDING`/`IN_EVALUATION`/`FINISHED`), `scoringMethod` (`MANUAL`/`CHECKLIST`/`STATIONS`), `published` (visible en la vista pública) y `allowMaxScoreExceeded` (permite superar el tope).
- El puntaje vigente de un equipo en una actividad es único (`TeamActivityScore @@unique([teamId, activityId])`). El admin hace **upsert** (crear o actualizar en el lugar, nunca duplica).
- **Sin evaluar ≠ 0**: `evaluated=false` guarda `score=null`. El total del ranking suma solo actividades evaluadas; las pendientes no cuentan como cero. `maxScore` se valida en el servidor (puntajes no negativos; superar el tope solo con `allowMaxScoreExceeded`).
- **Ranking de competición "1224"**: los equipos con el mismo total comparten posición y la siguiente refleja el orden competitivo (`1 + nº de equipos con total estrictamente mayor`). No hay criterios secundarios de desempate (el orden alfabético es solo estable para la presentación).
- **Vista pública** gated por `Event.rankingPublished` (se publica/oculta explícitamente desde el panel; se registra `rankingPublishedAt`). La vista pública (`publicOnly`) considera solo actividades con `published=true` y **nunca** expone observaciones ni datos de auditoría.
- Exportación CSV (`GET /admin/scoring/export`) con posición, total, evaluadas y una columna por actividad. Las operaciones se auditan (`Activity`, `TeamActivityScore`, `RANKING_PUBLISHED`/`RANKING_UNPUBLISHED`).

### Recuperación de postas (salto con frase de rescate)
- Si un equipo **no encuentra el QR** de su próxima posta, puede **saltarla** ingresando la **frase de rescate** que le dictan los coordinadores. No hay cupo fijo de saltos: la frase por posta **es** el control de acceso.
- Cada posta tiene un `rescuePhrase` **secreto** (columna `Station.rescuePhrase`, solo admin). **Nunca** se envía al cliente del equipo ni se imprime en la hoja pública de QR.
- El salto crea una visita `SKIPPED` (con `skipReason` opcional) y **cuenta como semi-completada**: para el avance es una posta **resuelta** y para el puntaje vale **media posta**.
- **Orden por resolución, no por conteo**: la "próxima posta" es la primera del itinerario cuyo estado no sea `VALID` ni `SKIPPED`. Sin saltos el comportamiento es idéntico al anterior (retrocompatible).
- `skipStation` corre en transacción `SERIALIZABLE` (con reintento): valida estado del evento y que la posta sea la próxima sin resolver, compara la frase normalizada y usa el mismo `validKey` único. Códigos: `RESCUE_PHRASE_INVALID`, `SKIP_DISABLED`, `ALL_RESOLVED`.
- **Puntaje automático de la actividad STATIONS** (`recomputeStationsScoreForTeam`): al confirmar o saltar (y al forzar/reiniciar itinerario) se recalcula y hace upsert de `TeamActivityScore` con `evaluatedBy="sistema"`:
  `score = round2((validas + 0.5 × saltadas) × maxScore / totalStops)`, con tope en `maxScore`. Solo aplica a la actividad `scoringMethod=STATIONS` con `maxScore` definido y **nunca pisa** un puntaje cargado a mano (si `evaluatedBy !== "sistema"` se respeta).
- El admin puede **saltar/deshacer el salto** de una posta de un equipo (`skipTeamStation`/`unskipTeamStation`), auditado (`STATION_SKIPPED`/`STATION_UNSKIPPED`); nunca reemplaza una visita `VALID`.
- El progreso (`ProgressSnapshot`) expone `completed` (resueltas = `VALID`+`SKIPPED`), `valid`, `skipped` y `resolvedStations`; el pasaporte marca `skipped`/`skippedAt` por parada.

### Integrantes (Member)
- Lista de **beneficiarios** del evento administrada por el admin. Son **solo datos**: no tienen cuenta, sesión ni login.
- Globales por evento con `teamId` **opcional** (equipo preasignado). Campos mínimos: nombre, apellido, documento/fecha de nacimiento/teléfono/notas opcionales, `role` (`SCOUT`/`DIRIGENTE`/`OTRO`), `active`.
- Módulo `/api/v1/members` (todo `requireAdmin`): listar por evento, crear, editar y eliminar. Documento duplicado en el evento → `P2002` → `409`.

### Coordenadas y mapa
- `Station.latitude` / `Station.longitude` (`Float?`) alimentan el mapa; **solo el admin** las gestiona (formulario de posta o importación CSV masiva `POST /stations/import`).
- La importación es **idempotente y no crea postas**: empareja por nombre, `publicToken` o `displayedCode` y reporta errores por fila.
- El servidor expone en el pasaporte del equipo `latitude`, `longitude` y un `mapsUrl` (Google Maps Directions) precalculado; el cliente (`react-leaflet` + OSM) dibuja marcadores numerados, línea del recorrido, inicio/meta y la leyenda de estados. Las postas sin coordenadas se listan pero no se dibujan.

## Despliegue (Vercel, proyecto único)

```
Navegador ──▶ Vercel Edge (CDN) ──▶ client/dist (SPA)
                     │
                     └─ /api/* ──▶ Vercel Function (api/index.js → server/dist/app)
                                              │ driver adapter (pg)
                                              ▼
                                       PostgreSQL gestionado (Neon/…)
```

- La SPA se sirve como estático desde `client/dist`; el catch-all `rewrites` devuelve `index.html` para las rutas del router (`BrowserRouter`).
- `/api/*` se rutea a una **Vercel Function** (`api/index.js`) que reexporta la app Express compilada (`server/dist`, sin alias de paths gracias a `tsc-alias`).
- Prisma usa el **driver adapter** (`@prisma/adapter-pg`) sobre un pool `pg` compartido con la sesión: evita el binario nativo del motor de consultas en el runtime serverless.
- SPA y API comparten dominio ⇒ cookies same-origin (`SameSite=Lax`), sin CORS cruzado ni `VITE_API_URL`.

## Estructura del código

```
server/src/
├─ config/env.ts            # validación de variables de entorno (zod)
├─ lib/dbPool.ts            # pool pg compartido (Prisma + sesiones)
├─ lib/prisma.ts            # cliente Prisma singleton (driver adapter @prisma/adapter-pg)
├─ lib/session.ts           # store de sesiones en Postgres + middleware
├─ middleware/              # auth (requireAdmin/requireTeam), csrf, rateLimit
├─ utils/                   # ApiError, asyncHandler, errorHandler, audit, geo
├─ modules/
│  ├─ auth/                 # login, logout, me, sesiones
│  ├─ events/               # CRUD + transiciones de estado
│  ├─ teams/                # equipos + itinerarios + reset de progreso
│  ├─ stations/             # postas + coordenadas + import CSV + QR
│  ├─ visits/               # resolución de posta y registro de visitas
│  ├─ passport/             # pasaporte del equipo (con coords + mapsUrl)
│  ├─ safari/               # safari de exploración (equipo + admin/progreso)
│  ├─ scoring/              # actividades, puntajes, ranking (admin + público) y CSV
│  ├─ members/              # integrantes del evento (beneficiarios, solo admin)
│  ├─ admin/                # dashboard, resultados CSV, auditoría
│  └─ progress/             # cálculo de progreso (compartido)
├─ app.ts                   # composición de la app Express
└─ index.ts                 # arranque del servidor
```

## Seguridad

- `helmet` para cabeceras HTTP; CORS restringido a `CORS_ORIGINS`.
- Contraseñas con `bcryptjs` (12 rondas).
- Cookies `HttpOnly` + `Secure` (producción) + `SameSite`.
- CSRF token por sesión.
- Rate limiting en login.
- Auditoría de acciones administrativas (`AuditLog`).
- Las respuestas a equipos **nunca** incluyen `expectedAnswer`.
