# Glosario — Exploración de Ypacarai

| Término | Definición |
|---|---|
| **Evento** (`Event`) | La carrera en sí. Tiene fecha, lugar y estado (`PREPARED`, `IN_PROGRESS`, `FINISHED`, `CANCELLED`). Solo puede haber uno activo a la vez. |
| **Posta** (`Station`) | Punto físico de la carrera identificado por un código QR. Tiene un desafío (`challengeType`), opcionalmente una respuesta esperada, y coordenadas (`latitude`/`longitude`) para el mapa. |
| **Coordenadas de posta** (`latitude`/`longitude`) | Ubicación opcional de la posta. Alimentan el mapa del itinerario; se cargan por el admin o por importación CSV. |
| **`mapsUrl`** | Enlace a Google Maps Directions calculado por el servidor para llegar a una posta con coordenadas. |
| **Token público** (`publicToken`) | Identificador aleatorio de la posta embebido en su QR. No es enumerable ni adivinable. |
| **Desafío** (`challengeType`) | Tipo de reto de la posta: `CODE` (código/palabra), `QUESTION` (pregunta), `CONFIRMATION` (solo confirmar el paso), `AUTO` (acepta cualquier respuesta si `autoAcceptAny`). |
| **Respuesta esperada** (`expectedAnswer`) | Solución correcta de la posta. **Nunca** se envía al cliente; la valida el servidor. |
| **Código mostrado** (`displayedCode`) | Pista textual opcional que sí puede ver el equipo. |
| **Equipo** (`Team`) | Grupo que participa. Tiene usuario/contraseña, un itinerario y un pasaporte. |
| **Itinerario** (`RouteStop`) | Secuencia ordenada de postas asignada a un equipo (`position`). Distintos equipos pueden recorrer las mismas postas en orden diferente. |
| **Próxima posta** | La posta con la menor `position` del itinerario del equipo que todavía no tiene una visita válida. |
| **Visita** (`StationVisit`) | Registro de que un equipo visitó una posta. Estado `VALID` (correcta y cuenta para el avance) o `INCORRECT` (intento fallido, se conserva para auditoría). |
| **Pasaporte digital** | Vista del equipo con su itinerario, progreso e historial de visitas. |
| **Safari** (`Safari` / `SafariItem` / `SafariFind`) | Checklist colaborativo por equipo, ligado 1:1 a un evento. El equipo marca `SafariItem`s encontrados (`SafariFind`); es **independiente** de las postas del pasaporte. |
| **SafariItem** | Elemento del safari (`position`, `active`). Los inactivos no se muestran ni cuentan. |
| **SafariFind** | Marca de un elemento encontrado por un equipo (`@@unique [itemId, teamId]`). |
| **Mapa del itinerario** | Vista Leaflet + OpenStreetMap del recorrido del equipo: postas numeradas con estado, línea, inicio (A) y meta (B). Las postas sin coordenadas no se dibujan. |
| **Progreso** (`ProgressSnapshot`) | `{ total, completed, done, nextStationId, nextPosition, startAt, finishAt }`, calculado en el servidor. |
| **Auditoría** (`AuditLog`) | Registro de acciones administrativas (crear, actualizar, iniciar, finalizar, cancelar, reset, forzar itinerario). |
| **Forzar itinerario** (`force`) | Permitir cambiar el itinerario de un equipo con el evento en curso; queda auditado como `ROUTE_EDIT_FORCED`. |
| **CSRF token** | Token por sesión que el cliente envía en `x-csrf-token` en métodos no seguros. |
| **Principal** | Identidad de la sesión: `{ type: "admin" | "team", id }`. Siempre obtenida del servidor. |
| **`validKey`** | Columna única de `StationVisit` (`"{teamId}:{stationId}"`) que garantiza una sola visita válida por equipo y posta. |
