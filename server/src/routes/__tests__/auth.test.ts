import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../db/pool.js';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'changeme';

let matchId: string;
let mapId: string;

beforeAll(async () => {
  const { rows: matches } = await pool.query(
    `SELECT id FROM match ORDER BY match_number LIMIT 1`
  );
  matchId = matches[0]?.id ?? 'nonexistent';

  const { rows: maps } = await pool.query(
    `SELECT map.id FROM map JOIN match ON match.id = map.match_id ORDER BY match.match_number, map.map_index LIMIT 1`
  );
  mapId = maps[0]?.id ?? 'nonexistent';
});

describe('Auth middleware', () => {
  describe('GET public endpoints require no auth', () => {
    it('GET /api/health', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('GET /api/tournament', async () => {
      const res = await request(app).get('/api/tournament');
      expect(res.status).toBe(200);
    });

    it('GET /api/teams', async () => {
      const res = await request(app).get('/api/teams');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/matches', async () => {
      const res = await request(app).get('/api/matches');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/rankings', async () => {
      const res = await request(app).get('/api/rankings');
      expect(res.status).toBe(200);
    });

    it('GET /api/maps/:id', async () => {
      const res = await request(app).get(`/api/maps/${mapId}`);
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('POST /api/matches/:id/start', () => {
    it('rejects without auth header → 401', async () => {
      const res = await request(app).post(`/api/matches/${matchId}/start`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects with wrong secret → 401', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/start`)
        .set('Authorization', 'Bearer wrong-secret');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects with malformed header → 401', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/start`)
        .set('Authorization', `Basic ${ADMIN_SECRET}`);
      expect(res.status).toBe(401);
    });

    it('accepts with correct secret', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/start`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`);
      // May be 200 or 4xx depending on match state, but NOT 401
      expect(res.status).not.toBe(401);
    });
  });

  describe('POST /api/maps/:id/results', () => {
    it('rejects without auth header → 401', async () => {
      const res = await request(app)
        .post(`/api/maps/${mapId}/results`)
        .send({ results: [] });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects with wrong secret → 401', async () => {
      const res = await request(app)
        .post(`/api/maps/${mapId}/results`)
        .set('Authorization', 'Bearer wrong-secret')
        .send({ results: [] });
      expect(res.status).toBe(401);
    });

    it('accepts with correct secret (may fail on business logic)', async () => {
      const res = await request(app)
        .post(`/api/maps/${mapId}/results`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ results: [] });
      expect(res.status).not.toBe(401);
    });
  });

  describe('PUT /api/maps/:id/results', () => {
    it('rejects without auth header → 401', async () => {
      const res = await request(app)
        .put(`/api/maps/${mapId}/results`)
        .send({ results: [] });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects with wrong secret → 401', async () => {
      const res = await request(app)
        .put(`/api/maps/${mapId}/results`)
        .set('Authorization', 'Bearer wrong-secret')
        .send({ results: [] });
      expect(res.status).toBe(401);
    });

    it('accepts with correct secret (may fail on business logic)', async () => {
      const res = await request(app)
        .put(`/api/maps/${mapId}/results`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ results: [] });
      expect(res.status).not.toBe(401);
    });
  });
});
