# Deployment Guide — Wasteland Drone Cup

## Requirements

- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14
- **npm** ≥ 9

## Environment Variables

Create a `.env` file in `server/` based on `server/.env.example`:

| Variable | Required | Description | Example |
|---|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/dronecup` |
| `PORT` | No | Server port (default: `3001`) | `3001` |
| `NODE_ENV` | No | Environment (`development` / `production`) | `production` |
| `ADMIN_SECRET` | Yes | Bearer token for admin mutations | A strong random string |
| `CORS_ORIGIN` | No | Allowed CORS origin (default: `*`) | `https://yourdomain.com` |

**Important:** `ADMIN_SECRET` must be set to a strong, unique value in production. All mutation endpoints (start match, submit results, correct results, reset match, rename participant) require `Authorization: Bearer <ADMIN_SECRET>`.

## Database Setup

```bash
cd server
npm run db:migrate
npm run db:seed
```

`db:migrate` creates all tables. `db:seed` populates the tournament with the 5 official teams, 15 participants, 4 matches, and maps.

## Build

```bash
# Build frontend
cd client
npm install
npm run build

# Build backend
cd ../server
npm install
npm run build
```

The frontend builds to `client/dist/`. The backend compiles TypeScript to `server/dist/`.

## Start (Production)

```bash
cd server
npm start
```

This runs `node dist/server/src/index.js` (the TypeScript build outputs to `dist/server/src/` because `tsconfig.json` uses `rootDir: ".."`  to include the shared types).

The server:
1. Starts Express on the configured `PORT` (default 3001)
2. Mounts all API routes under `/api/`
3. Sets up Socket.IO for realtime updates
4. Serves `client/dist/` as static files with SPA fallback (if the build exists)

When the client build is present, a single process serves both API and frontend. No separate web server (nginx, etc.) is required for basic deployments.

## URLs

| Path | Description |
|---|---|
| `/` | Public website (Home) |
| `/classification` | Live rankings |
| `/matches` | Match list and details |
| `/teams` | Team roster |
| `/streams` | Twitch multi-stream viewer |
| `/admin` | Admin panel (requires ADMIN_SECRET) |
| `/broadcast/creator/:slug` | OBS overlay per creator |
| `/api/health` | Health check endpoint |

## Admin Authentication

The admin panel prompts for the `ADMIN_SECRET` on first visit. The secret is stored in `sessionStorage` (browser tab only, not persisted across sessions).

Protected endpoints:
- `POST /api/matches/:id/start` — Start a match
- `POST /api/matches/:id/reset` — Reset a match
- `POST /api/maps/:id/results` — Submit map results
- `PUT /api/maps/:id/results` — Correct map results
- `PATCH /api/participants/:id` — Rename participant

All require header: `Authorization: Bearer <ADMIN_SECRET>`

## CORS Configuration

- **Development:** Set `CORS_ORIGIN=http://localhost:5173` (Vite dev server)
- **Production (same origin):** Set `CORS_ORIGIN=*` or omit (backend serves frontend)
- **Production (separate origins):** Set `CORS_ORIGIN=https://yourdomain.com`

CORS applies to both REST API and Socket.IO connections.

## OBS Overlays

Broadcast overlays are available at `/broadcast/creator/<slug>` where slug is: `vetel`, `caramelo`, `miwell`, `sora`, `barra`.

Add as Browser Source in OBS with recommended resolution 1920x1080. The overlay auto-updates via Socket.IO.

## Development

```bash
# Terminal 1: Backend (hot-reload)
cd server
npm run dev

# Terminal 2: Frontend (Vite dev server)
cd client
npm run dev
```

The Vite dev server proxies `/api` and `/socket.io` to `localhost:3001`.

## Tests

```bash
cd server
npm test
```

Requires `DATABASE_URL_TEST` in `.env` pointing to a test database. Tests run against a real PostgreSQL instance (no mocks).

---

## PREPROD — Render

### Service

| Setting | Value |
|---|---|
| Service type | Web Service |
| Name | `dronecup-preprod` |
| Region | Frankfurt (EU) or closest |
| Branch | `main` |
| Root Directory | _(leave empty — repo root)_ |
| Build Command | `cd client && npm install && npm run build && cd ../server && npm install && npm run build` |
| Start Command | `cd server && npm start` |
| Health Check Path | `/api/health` |

### Domain

```
https://test.dronecup.tebimedia.com
```

Custom domain configured via Cloudflare DNS (see below).

### Environment Variables (Render Dashboard)

Set these in the Render service's Environment tab:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `ADMIN_SECRET` | _(generate a strong random string, ≥32 chars)_ |
| `CORS_ORIGIN` | `https://test.dronecup.tebimedia.com` |
| `DATABASE_URL` | _(auto-populated by linking Render PostgreSQL)_ |
| `PORT` | _(not needed — Render sets this automatically)_ |

Do NOT copy development secrets. Generate new values for PREPROD.

### PostgreSQL (Render)

1. Create a Render PostgreSQL instance named `dronecup-preprod`
2. Link it to the `dronecup-preprod` Web Service — this auto-populates `DATABASE_URL`
3. After the first deploy, initialize the database via Render Shell:

```bash
cd server
npx tsx src/db/migrate.ts
npx tsx src/db/seed.ts
npx tsx src/db/verify.ts
```

Alternatively, use the compiled versions (no `tsx` needed):

```bash
cd server
node dist/server/src/db/migrate.js
node dist/server/src/db/seed.js
node dist/server/src/db/verify.js
```

The seed creates the tournament with 5 teams, 15 participants, 4 matches, and sample results. It is destructive — it deletes all existing data before inserting.

### Database Separation

```
DEV     → DATABASE_URL     → dronecup        (local)
TEST    → DATABASE_URL_TEST → dronecup_test   (local)
PREPROD → DATABASE_URL     → dronecup_preprod (Render PostgreSQL)
```

The application uses `DATABASE_URL` in all non-test environments. Separation is achieved by providing different connection strings per environment. PREPROD never shares a database with DEV or TEST.

### Cloudflare DNS

To connect `test.dronecup.tebimedia.com` to Render:

1. In Render: add `test.dronecup.tebimedia.com` as a Custom Domain on the `dronecup-preprod` service
2. Render will show a CNAME target (e.g. `dronecup-preprod.onrender.com`)
3. In Cloudflare DNS for `tebimedia.com`: add a CNAME record:
   - Name: `test.dronecup`
   - Target: _(the value Render provides)_
   - Proxy status: DNS only (gray cloud) — Render handles TLS
4. Wait for DNS propagation and TLS certificate provisioning

### Socket.IO on Render

Socket.IO uses the same HTTP server as Express. Render supports WebSocket connections on Web Services. No additional configuration is needed — the upgrade from HTTP to WebSocket happens automatically.

### Architecture

```
         INTERNET
            │
    test.dronecup.tebimedia.com
          (HTTPS)
            │
     ┌──────▼──────┐
     │ Render       │
     │ Web Service  │
     │ Node/Express │
     └──┬───┬───┬──┘
        │   │   │
   React  API  Socket.IO
        │   │   │
        └───┼───┘
            │
     ┌──────▼──────┐
     │ Render       │
     │ PostgreSQL   │
     │ dronecup_    │
     │ preprod      │
     └─────────────┘
```

Single Node.js process serves everything: static frontend, REST API, and WebSocket connections.
