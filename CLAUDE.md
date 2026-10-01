# Drone Cup

Plataforma web para gestionar y mostrar en tiempo real una competición de carreras de drones de
Rainbow Six Siege (evento de Ubisoft). Dos operadores humanos, ambos con permisos de administrador,
introducen los resultados manualmente. No existe API ni integración con el juego.

## Estructura y stack
- `client/`: React 19, Vite 6, react-router 7, TypeScript.
- `server/`: Node 22, Express 4, Socket.IO, PostgreSQL con `pg` (sin ORM), TypeScript.
- `shared/`: tipos y constantes compartidos entre cliente y servidor (alias `@shared`).
- Sin workspaces: `client/` y `server/` tienen cada uno su propio `package.json`.

## Fuente de verdad y dominio
- El backend es la fuente de verdad competitiva.
- Los resultados por mapa (posiciones) son la entrada fundamental. Puntos, totales, rankings,
  historial y estadísticas se derivan en el backend.
- El frontend puede mostrar o previsualizar información derivada para mejorar la UX, pero nunca debe
  ser la fuente de verdad, persistir resultados derivados ni decidir rankings o puntuaciones
  competitivas. El cliente no sustituye las decisiones competitivas del backend.
- No inventar reglas de tiebreak que no estén definidas.

## Estado y realtime
- Match: `UPCOMING → LIVE → COMPLETED`. El inicio de cada match es manual.
- Los mapas avanzan dentro del match según el estado definido por el backend.
- El siguiente match no arranca automáticamente.
- El backend es la fuente de estado: los clientes lo obtienen por REST y reciben actualizaciones
  por Socket.IO.
- Corregir un resultado debe actualizar el estado derivado y el realtime sin exponer estados parciales.

## Reglas de competición que afectan al desarrollo
- La clasificación principal es por equipos; la individual es secundaria.
- La rotación de participantes la define el formato del torneo; no debe convertirse en una
  selección manual arbitraria.
- El tiebreak es una fase separada de la competición principal.

## No añadir sin aprobación
Son decisiones deliberadas del proyecto:
- Docker, Redis, microservicios.
- Integración con el juego o ingesta automática de resultados.
- Roles complejos o cuentas de espectadores.
- Sistema social.
- Gestión de clips/replays.
- Detección automática de "epic moments".
- Gamificación no solicitada.

## Datos y seguridad
- Dev, test y preproducción usan bases de datos diferenciadas.
- Los tests usan PostgreSQL real y `DATABASE_URL_TEST`.
- `db:reset`, `db:seed` y `db:setup` pueden destruir o reemplazar datos. Antes de ejecutar cualquiera
  de ellos, verifica explícitamente a qué base de datos apunta `DATABASE_URL`.
- Las mutaciones administrativas requieren autenticación mediante el mecanismo existente.
- Nunca leer, mostrar ni imprimir secretos de `.env`.

## Documentación
`ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `REALTIME.md`, `BROADCAST.md`, `STATISTICS.md`,
`UI_UX.md`, `ROADMAP.md` y `docs/DEPLOYMENT.md` son documentación contextual: consúltalos cuando la
tarea los afecte. Pueden estar desactualizados respecto al código. Si detectas una discrepancia entre
documentación y comportamiento real, no asumas cuál es correcta y señálala antes de hacer un cambio
que dependa de ella.

## Archivos protegidos
- No eliminar el `index.html` de la raíz: es una referencia visual histórica deliberada.
- No tocar los `.env` ni exponer sus secretos.

## Comandos
- Backend dev: `npm --prefix server run dev`
- Frontend dev: `npm --prefix client run dev`
- Tests: `npm --prefix server test`
- Cliente, build + typecheck: `npm --prefix client run build`
- Servidor, build: `npm --prefix server run build`
