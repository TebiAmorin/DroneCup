import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { existsSync } from 'fs';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { timingSafeEqual } from 'crypto';
import { ApiError } from './engine/errors.js';
import { setupSocketIO } from './realtime/setup.js';
import tournamentRouter from './routes/tournament.js';
import teamsRouter from './routes/teams.js';
import participantsRouter from './routes/participants.js';
import matchesRouter from './routes/matches.js';
import mapsRouter from './routes/maps.js';
import rankingsRouter from './routes/rankings.js';
import statisticsRouter from './routes/statistics.js';
import exportRouter from './routes/export.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = setupSocketIO(httpServer);

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/auth/validate', (req, res) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    res.status(500).json({ valid: false, message: 'Admin authentication not configured' });
    return;
  }
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    res.status(400).json({ valid: false, message: 'Token required' });
    return;
  }
  try {
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(secret);
    if (tokenBuf.length === secretBuf.length && timingSafeEqual(tokenBuf, secretBuf)) {
      res.json({ valid: true });
    } else {
      res.status(401).json({ valid: false, message: 'Invalid credentials' });
    }
  } catch {
    res.status(401).json({ valid: false, message: 'Invalid credentials' });
  }
});

app.use('/api/tournament', tournamentRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/participants', participantsRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/maps', mapsRouter);
app.use('/api/rankings', rankingsRouter);
app.use('/api/statistics', statisticsRouter);
app.use('/api/export', exportRouter);

function resolveClientDist(): string | null {
  const devPath = path.resolve(__dirname, '../../client/dist');
  if (existsSync(path.join(devPath, 'index.html'))) return devPath;

  const prodPath = path.resolve(__dirname, '../../../../client/dist');
  if (existsSync(path.join(prodPath, 'index.html'))) return prodPath;

  return null;
}

const clientDist = resolveClientDist();
if (clientDist) {
  app.use(express.static(clientDist));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json(err.toJSON());
  } else {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
  }
});

export { app, httpServer, io };
