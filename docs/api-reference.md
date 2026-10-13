# API — Exploración de Ypacarai

Base URL: `/api/v1`. En desarrollo, el cliente (5173) proxya `/api` hacia el servidor (4000).

- Autenticación: **cookie de sesión** (`ypacarai.sid`, HttpOnly). Todas las llamadas usan `credentials: "include"`.
- **CSRF**: los métodos `POST`, `PUT`, `PATCH`, `DELETE` requieren el header `x-csrf-token` con el token de la sesión. Se obtiene en `GET /auth/csrf` (o en la respuesta del login).
- Formato de error: `{ "error": { "code": string, "message": string, "details"?: unknown } }`.
- Códigos: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `TOO_MANY_REQUESTS` (429), `BAD_REQUEST` (400), `INTERNAL_ERROR` (500).

## Autenticación

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/auth/csrf` | — | Devuelve `{ csrfToken }` para la sesión actual. |
| POST | `/auth/login` | — | Body `{ username, password }` → `{ principal, csrfToken }`. Regenera la sesión. |
| POST | `/auth/logout` | cualquiera | Cierra la sesión → `{ ok: true }`. |
| GET | `/auth/me` | cualquiera | Devuelve `{ principal }` de la sesión. |

`principal` es `{ type: "admin", user }` o `{ type: "team", team, eventName }`.

## Equipo (rol `team`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/passport` | Pasaporte: `{ team, event, progress, stops, history }`. Cada stop incluye `latitude`, `longitude` y `mapsUrl` (null si la posta no tiene coordenadas). |
| GET | `/passport/next-station` | `{ nextStation }` (id o null). |
| PATCH | `/passport/profile` | El equipo renombra su **nombre visible**. Body `{ name }` → `{ team }`. Debe ser único en el evento (`409` si ya existe); el `username` de login no cambia. |
| GET | `/visits/posta/:token` | Pantalla de desafío. `{ status, station? }`. |
| POST | `/visits` | Registra visita. Body `{ publicToken, answer }`. |
| GET | `/safari` | Safari del equipo: `{ team, event, safari, items, categories, progress }`. `safari` es `null` si el evento no tiene safari. Cada ítem trae `category`, `itemType`, `requiresPhoto`, `found`, `foundAt`, `value` (observación, p. ej. cantidad) y `photoReady` (evidencia fotográfica declarada). |
| POST | `/safari/items/:itemId/find` | Marca un elemento como encontrado (idempotente). Body opcional `{ value }` (obligatorio para `itemType: NUMERIC`). Requiere evento `IN_PROGRESS` (`409` si no lo está; `403` si el elemento es de otro evento). Devuelve el safari actualizado. |
| DELETE | `/safari/items/:itemId/find` | Desmarca un elemento (idempotente). Mismas restricciones. |
| POST | `/safari/items/:itemId/photo` | Registra `{ ready: boolean }`: declara que la evidencia fotográfica está lista/compartida según las reglas. Solo declara; **no** sube ni publica imágenes. |

### Estados de `/visits/posta/:token`

`NEXT` (con `station`), `NOT_YOUR_NEXT`, `COMPLETED`, `INACTIVE`, `WRONG_EVENT`, `EVENT_NOT_READY`, `EVENT_FINISHED`, `EVENT_CANCELLED`.

Cuando es `NEXT`, `station` incluye `{ id, name, instructions, challengeType, autoAcceptAny, displayedCode }` — nunca `expectedAnswer`.

Si el **itinerario del equipo** tiene una *pregunta bonus* en esa posta (`RouteStop.question`), el desafío de la posta se reemplaza: `challengeType` pasa a `QUESTION` (hay respuesta válida) o `AUTO` (vale cualquier respuesta) e `instructions` trae la pregunta. Permite que dos equipos tengan preguntas distintas en la misma posta física.

### Resultado de `POST /visits`

```jsonc
// válida
{ "result": "VALID", "message": "...", "nextStation": { "id", "name", "position" } | null, "remaining": 3 }
// respuesta incorrecta
{ "result": "INCORRECT", "message": "...", "attemptNumber": 1 }
// sin avance
{ "result": "ALREADY_COMPLETED" | "NOT_YOUR_NEXT" | "EVENT_NOT_READY" | "EVENT_FINISHED" | "EVENT_CANCELLED" | "INACTIVE" | "WRONG_EVENT", "message": "..." }
```

## Eventos (rol `admin`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/events` | Lista de eventos con conteos. |
| GET | `/events/:id` | Evento con `teams` (y sus `routeStops`, incluyendo `question`/`questionAnswer` de la pregunta bonus) y `stations`. |
| POST | `/events` | Crea evento. Body `{ name, description?, date, location?, status? }`. |
| PATCH | `/events/:id` | Actualiza datos/estado. Con `IN_PROGRESS`, editar datos requiere `force`. |
| POST | `/events/:id/start` | `PREPARED → IN_PROGRESS` (valida postas e itinerarios). |
| POST | `/events/:id/finish` | `IN_PROGRESS → FINISHED`. |
| POST | `/events/:id/cancel` | `→ CANCELLED`. |
| DELETE | `/events/:id` | Elimina el evento (no si está `IN_PROGRESS`) → 204. |

Solo puede existir **un** evento activo a la vez (409 si se intenta crear/activar otro).

## Equipos (rol `admin`)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/teams` | Crea equipo. Body `{ eventId, name, username, password }`. |
| GET | `/teams/:id` | Equipo con progreso. |
| PATCH | `/teams/:id` | Actualiza `{ name?, username?, password?, active? }`. |
| GET | `/teams/:id/route` | Itinerario ordenado. |
| PUT | `/teams/:id/route` | Setea itinerario. Body `{ stationIds: string[], force? }`. |
| POST | `/teams/:id/reset-progress` | Borra las visitas del equipo. |

## Postas (rol `admin`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/stations?eventId=` | Lista postas del evento. |
| POST | `/stations` | Crea posta. Body `{ eventId, name, challengeType, instructions?, expectedAnswer?, displayedCode?, autoAcceptAny?, description?, latitude?, longitude? }`. |
| GET | `/stations/:id` | Detalle (sin `expectedAnswer`). |
| PATCH | `/stations/:id` | Actualiza la posta. |
| DELETE | `/stations/:id` | Elimina → 204. |
| GET | `/stations/:id/qr` | PNG imprimible del QR. |
| GET | `/stations/:id/qr/data` | `{ url, token }` del QR. |
| POST | `/stations/import` | Importa coordenadas desde CSV. Body `{ eventId, csv }` → `{ updated, errors: [{ row, error }], parsed }`. No crea postas: empareja por nombre, `publicToken` o `displayedCode`. |

`challengeType`: `CODE`, `QUESTION`, `CONFIRMATION`, `AUTO`. `latitude` y `longitude` son opcionales pero deben venir juntas (`-90..90` / `-180..180`).

El CSV tiene columnas `nombre, qr_id, latitud, longitud, descripcion` (el encabezado es opcional; delimitador `,`, `;` o tab).

`challengeType`: `CODE`, `QUESTION`, `CONFIRMATION`, `AUTO`.

## Administración / métricas (rol `admin`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/admin/dashboard?eventId=` | Métricas y estado por equipo. |
| GET | `/admin/results?eventId=` | Resultados en CSV (`text/csv`, con BOM). |
| GET | `/admin/audit-logs?eventId=` | Últimos 100 registros de auditoría. |

## Safari (rol `admin`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/admin/safari?eventId=` | `{ safari }` (o `null`) con sus items. |
| POST | `/admin/safari` | Crea el safari del evento (1:1). Body `{ eventId, title?, description? }`. |
| PATCH | `/admin/safari/:id` | Actualiza `{ title?, description?, active? }`. |
| GET | `/admin/safari/:id/progress` | Reporte: `{ safari, counts, teams, items }`. |
| POST | `/admin/safari/:id/items` | Crea ítem. Body `{ name, description?, active?, position?, category?, itemType?, requiresPhoto? }`. `category`: `LUGARES_CULTURA` \| `NATURALEZA` \| `OBJETOS_CURIOSIDADES` \| `DESAFIOS_FOTOGRAFICOS` \| `GENERAL`. `itemType`: `PHOTO` \| `OBJECT` \| `NUMERIC` \| `COLLECTION`. |
| PATCH | `/admin/safari/items/:itemId` | Actualiza ítem (mismos campos que el create). |
| DELETE | `/admin/safari/items/:itemId` | Elimina ítem → 204. |
| POST | `/admin/safari/:id/reorder` | Reordena. Body `{ itemIds: string[] }`. |
| POST | `/admin/safari/reset` | Borra progreso. Body `{ eventId, teamId? }` (sin `teamId` = todos) → `{ deleted }`. Se audita. |

## Actividades y puntuaciones (rol `admin`)

Base `/admin/scoring`. Todas las mutaciones requieren `x-csrf-token`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/admin/scoring/activities?eventId=` | `{ activities }` ordenadas por `position`. |
| POST | `/admin/scoring/activities` | Crea actividad. Body `{ eventId, name, description?, maxScore?, position?, status?, scoringMethod?, published?, allowMaxScoreExceeded?, active? }` → 201 `{ activity }`. `name` es único por evento (`409`). |
| PATCH | `/admin/scoring/activities/reorder` | Reordena. Body `{ eventId, activityIds }` (debe incluir todas, sin repetir) → `{ activities }`. |
| PATCH | `/admin/scoring/activities/:id` | Actualiza campos parciales → `{ activity }`. |
| DELETE | `/admin/scoring/activities/:id` | Elimina la actividad y sus puntajes (cascade) → 204. |
| GET | `/admin/scoring/scores?eventId=` | Matriz: `{ event, activities, teams, scores }`. |
| PUT | `/admin/scoring/scores` | Upsert del puntaje. Body `{ eventId, teamId, activityId, evaluated, score?, observations? }` → `{ score, created }`. `evaluated:false` guarda `score=null`. Puntaje negativo o mayor a `maxScore` (sin `allowMaxScoreExceeded`) → 400. |
| DELETE | `/admin/scoring/scores/:id` | Borra el puntaje → 204. |
| GET | `/admin/scoring/ranking?eventId=` | Ranking completo (incluye actividades no publicadas) con posiciones y estado por equipo. |
| GET | `/admin/scoring/teams/:teamId?eventId=` | Detalle por equipo (una fila por actividad, **con** observaciones). |
| POST | `/admin/scoring/ranking/publish` | Body `{ eventId, published }` → `{ event: { id, rankingPublished, rankingPublishedAt } }`. Se audita. |
| GET | `/admin/scoring/export?eventId=` | CSV (`text/csv`, con BOM): posición, equipo, total, evaluadas y una columna por actividad. |

`status`: `PENDING` \| `IN_EVALUATION` \| `FINISHED`. `scoringMethod`: `MANUAL` \| `CHECKLIST` \| `STATIONS`.

Reglas: el total suma solo actividades evaluadas (pendiente ≠ 0); empates con ranking "1224" (misma posición para igual total); equipos inactivos se marcan `INACTIVO`.

## Ranking (público)

Sin sesión. Base `/ranking`. Solo expone datos si el evento tiene `rankingPublished=true` y filtra a actividades con `published=true`. Nunca incluye observaciones.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/ranking` | `{ published, event, activities, activitiesCount, allComplete, teams }` del evento publicado más reciente, o `?eventId=` para uno puntual. Si el evento no está publicado → `published:false` con listas vacías. |
| GET | `/ranking/:eventId` | Igual que el anterior, para un evento específico. |
| GET | `/ranking/:eventId/teams/:teamId` | Detalle público de un equipo (sin observaciones). `404` si el evento no está publicado. |

## Health

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | `{ status: "ok", ts }`. |
