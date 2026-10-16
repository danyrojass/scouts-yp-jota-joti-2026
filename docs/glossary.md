# Glosario — Exploración de Ypacarai

| Término | Definición |
|---|---|
| **Evento** (`Event`) | La carrera en sí. Tiene fecha, lugar y estado (`PREPARED`, `IN_PROGRESS`, `FINISHED`, `CANCELLED`). Solo puede haber uno activo a la vez. |
| **Posta** (`Station`) | Punto físico de la carrera identificado por un código QR. Tiene un desafío (`challengeType`), opcionalmente una respuesta esperada, y coordenadas (`latitude`/`longitude`) para el mapa. |
| **Coordenadas de posta** (`latitude`/`longitude`) | Ubicación opcional de la posta. Alimentan el mapa del itinerario; se cargan por el admin o por importación CSV. |
| **`mapsUrl`** | Enlace a Google Maps Directions calculado por el servidor para llegar a una posta con coordenadas. |
| **Token público** (`publicToken`) | Identificador aleatorio de la posta embebido en su QR. No es enumerable ni adivinable. |
| **Marca de agua del QR** | Logo del Grupo Scout 62 superpuesto en el centro del QR imprimible (PNG 1024×1024, corrección de errores `H`). Embebido como base64 en `server/src/assets/scout-logo.ts`. |
| **Pantalla de invitación** | Vista que reemplaza a la posta cuando el evento **finalizó o se canceló**: invita a conocer el Grupo Scout 62 Ypacaraí y su Instagram (`@gruposcout62`). Es **pública**: se muestra a cualquiera que escanee el QR, con o sin sesión. |
| **Estado público del token** | Respuesta de `GET /stations/public/:token` (sin auth): `OPEN` (evento abierto → pedir login), `CLOSED` (evento finalizado/cancelado → mostrar invitación) o `NOT_FOUND` (QR inválido). No expone datos de la posta. |
| **Desafío** (`challengeType`) | Tipo de reto de la posta: `CODE` (código/palabra), `QUESTION` (pregunta), `CONFIRMATION` (solo confirmar el paso), `AUTO` (acepta cualquier respuesta si `autoAcceptAny`). |
| **Respuesta esperada** (`expectedAnswer`) | Solución correcta de la posta. **Nunca** se envía al cliente; la valida el servidor. |
| **Código mostrado** (`displayedCode`) | Pista textual opcional que sí puede ver el equipo. |
| **Equipo** (`Team`) | Grupo que participa. Tiene usuario/contraseña, un itinerario y un pasaporte. |
| **Itinerario** (`RouteStop`) | Secuencia ordenada de postas asignada a un equipo (`position`). Distintos equipos pueden recorrer las mismas postas en orden diferente. |
| **Próxima posta** | La primera posta del itinerario del equipo que todavía no está **resuelta** (sin visita `VALID` ni `SKIPPED`). |
| **Visita** (`StationVisit`) | Registro de que un equipo visitó una posta. Estado `VALID` (correcta y cuenta para el avance), `INCORRECT` (intento fallido, se conserva para auditoría) o `SKIPPED` (saltada con frase de rescate). |
| **Frase de rescate** (`rescuePhrase`) | Frase **secreta** por posta que dictan los coordinadores. Permite a un equipo **saltar** la posta cuando no encuentra el QR. Nunca se expone al equipo ni se imprime en la hoja pública de QR. |
| **Posta saltada** (`SKIPPED`) | Posta que el equipo no escaneó y **resolvió** con la frase de rescate. Cuenta como **semi-completada**: avanza el itinerario y vale **media posta** en el puntaje `STATIONS`. |
| **Resuelta** | Posta con visita `VALID` o `SKIPPED`. Determina la "próxima posta" y el avance del equipo. |
| **Puntaje de sistema** | Puntaje de la actividad `STATIONS` recalculado automáticamente al avanzar (`evaluatedBy="sistema"`). Fórmula: `(validas + 0.5 × saltadas) × maxScore / totalStops`. Nunca pisa un puntaje cargado a mano. |
| **Integrante** (`Member`) | Beneficiario del evento administrado por el admin (solo datos, sin cuenta ni login). Puede asignarse a un equipo o quedar sin asignar; documento único por evento. |
| **Pasaporte digital** | Vista del equipo con su itinerario, progreso e historial de visitas. |
| **Safari** (`Safari` / `SafariItem` / `SafariFind`) | Checklist colaborativo por equipo, ligado 1:1 a un evento. El equipo marca `SafariItem`s encontrados (`SafariFind`); es **independiente** de las postas del pasaporte. |
| **SafariItem** | Elemento del safari (`position`, `active`). Los inactivos no se muestran ni cuentan. |
| **SafariFind** | Marca de un elemento encontrado por un equipo (`@@unique [itemId, teamId]`). |
| **Mapa del itinerario** | Vista Leaflet + OpenStreetMap del recorrido del equipo: postas numeradas con estado, línea, inicio (A) y meta (B). Las postas sin coordenadas no se dibujan. |
| **Progreso** (`ProgressSnapshot`) | `{ total, completed, valid, skipped, done, nextStationId, nextPosition, startAt, finishAt, visitedStations, resolvedStations }`, calculado en el servidor. `completed` = resueltas (`VALID`+`SKIPPED`). |
| **Auditoría** (`AuditLog`) | Registro de acciones administrativas (crear, actualizar, iniciar, finalizar, cancelar, reset, forzar itinerario). |
| **Forzar itinerario** (`force`) | Permitir cambiar el itinerario de un equipo con el evento en curso; queda auditado como `ROUTE_EDIT_FORCED`. |
| **CSRF token** | Token por sesión que el cliente envía en `x-csrf-token` en métodos no seguros. |
| **Principal** | Identidad de la sesión: `{ type: "admin" | "team", id }`. Siempre obtenida del servidor. |
| **`validKey`** | Columna única de `StationVisit` (`"{teamId}:{stationId}"`) que garantiza una sola visita válida por equipo y posta. |
