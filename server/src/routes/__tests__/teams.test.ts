import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../db/pool.js';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'changeme';

let teamId: string;

async function seedTeams() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM ranking_snapshot');
    await client.query('DELETE FROM map_result');
    await client.query('DELETE FROM map');
    await client.query('DELETE FROM match_participation');
    await client.query('DELETE FROM match');
    await client.query('DELETE FROM participant');
    await client.query('DELETE FROM team');
    await client.query('DELETE FROM tournament');

    const { rows: [t] } = await client.query(
      `INSERT INTO tournament (name, status) VALUES ('Teams Test', 'LIVE') RETURNING id`
    );

    const { rows: [team] } = await client.query(
      `INSERT INTO team (tournament_id, name, slug, color, registration_url, registration_type, registration_platform, community_note)
       VALUES ($1, 'TestTeam', 'testteam', '#ff0000', 'https://example.com/register', 'external', 'discord', 'Join via the link')
       RETURNING id`,
      [t.id]
    );
    teamId = team.id;

    await client.query(
      `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, 'Creator', 'creator', 'CREATOR')`,
      [teamId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

describe('Teams API — registration fields (F5.1)', () => {
  beforeAll(async () => {
    await seedTeams();
  });

  afterAll(async () => {
    await pool.end();
  });

  // ── GET ──

  describe('GET /api/teams', () => {
    it('returns registration fields', async () => {
      const res = await request(app).get('/api/teams');
      expect(res.status).toBe(200);
      const team = res.body.find((t: any) => t.id === teamId);
      expect(team).toBeDefined();
      expect(team.registrationUrl).toBe('https://example.com/register');
      expect(team.registrationType).toBe('external');
      expect(team.registrationPlatform).toBe('discord');
      expect(team.communityNote).toBe('Join via the link');
    });
  });

  describe('GET /api/teams/:id', () => {
    it('returns registration fields', async () => {
      const res = await request(app).get(`/api/teams/${teamId}`);
      expect(res.status).toBe(200);
      expect(res.body.registrationUrl).toBe('https://example.com/register');
      expect(res.body.registrationType).toBe('external');
      expect(res.body.registrationPlatform).toBe('discord');
      expect(res.body.communityNote).toBe('Join via the link');
    });
  });

  // ── PATCH — authorized ──

  describe('PATCH /api/teams/:id (authorized)', () => {
    it('updates registrationUrl', async () => {
      const res = await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ registrationUrl: 'https://forms.google.com/abc' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.team.registrationUrl).toBe('https://forms.google.com/abc');
    });

    it('updates registrationType', async () => {
      const res = await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ registrationType: 'google_forms' });

      expect(res.status).toBe(200);
      expect(res.body.team.registrationType).toBe('google_forms');
    });

    it('updates communityNote', async () => {
      const res = await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ communityNote: 'Updated instructions' });

      expect(res.status).toBe(200);
      expect(res.body.team.communityNote).toBe('Updated instructions');
    });

    it('updates registrationPlatform', async () => {
      const res = await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ registrationPlatform: 'twitter' });

      expect(res.status).toBe(200);
      expect(res.body.team.registrationPlatform).toBe('twitter');
    });

    it('allows setting registrationPlatform to null', async () => {
      const res = await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ registrationPlatform: null });

      expect(res.status).toBe(200);
      expect(res.body.team.registrationPlatform).toBeNull();
    });

    it('allows partial update — preserves omitted fields', async () => {
      // Set known state
      await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({
          registrationUrl: 'https://example.com/final',
          registrationType: 'typeform',
          registrationPlatform: 'twitch',
          communityNote: 'Final note',
        });

      // Partial update — only communityNote
      const res = await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ communityNote: 'Changed only note' });

      expect(res.status).toBe(200);
      expect(res.body.team.communityNote).toBe('Changed only note');
      expect(res.body.team.registrationUrl).toBe('https://example.com/final');
      expect(res.body.team.registrationType).toBe('typeform');
      expect(res.body.team.registrationPlatform).toBe('twitch');
    });

    it('allows setting registrationUrl to null', async () => {
      const res = await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ registrationUrl: null });

      expect(res.status).toBe(200);
      expect(res.body.team.registrationUrl).toBeNull();
    });

    it('persists changes across queries', async () => {
      await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({
          registrationUrl: 'https://persisted.example.com',
          registrationType: 'external',
          communityNote: 'Persisted note',
        });

      const res = await request(app).get(`/api/teams/${teamId}`);
      expect(res.status).toBe(200);
      expect(res.body.registrationUrl).toBe('https://persisted.example.com');
      expect(res.body.registrationType).toBe('external');
      expect(res.body.communityNote).toBe('Persisted note');
    });
  });

  // ── PATCH — unauthorized ──

  describe('PATCH /api/teams/:id (unauthorized)', () => {
    it('rejects without auth header → 401', async () => {
      const res = await request(app)
        .patch(`/api/teams/${teamId}`)
        .send({ communityNote: 'Hack' });

      expect(res.status).toBe(401);
    });

    it('rejects with wrong secret → 401', async () => {
      const res = await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', 'Bearer wrong-secret')
        .send({ communityNote: 'Hack' });

      expect(res.status).toBe(401);
    });
  });

  // ── Validation ──

  describe('PATCH validation', () => {
    it('rejects http:// URL', async () => {
      const res = await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ registrationUrl: 'http://insecure.example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_URL');
    });

    it('rejects javascript: URL', async () => {
      const res = await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ registrationUrl: 'javascript:alert(1)' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_URL');
    });

    it('rejects data: URL', async () => {
      const res = await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ registrationUrl: 'data:text/html,<h1>hack</h1>' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_URL');
    });

    it('rejects invalid registrationPlatform', async () => {
      const res = await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ registrationPlatform: 'instagram' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PLATFORM');
    });

    it('rejects invalid registrationType', async () => {
      const res = await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ registrationType: 'invalid_type' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_TYPE');
    });

    it('rejects communityNote longer than 500 characters', async () => {
      const res = await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ communityNote: 'A'.repeat(501) });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_NOTE');
    });

    it('rejects modification of competitive field: name', async () => {
      const res = await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ name: 'HackedName', communityNote: 'legit' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FIELD_NOT_ALLOWED');
    });

    it('rejects modification of competitive field: slug', async () => {
      const res = await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ slug: 'hacked-slug' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FIELD_NOT_ALLOWED');
    });

    it('rejects modification of competitive field: color', async () => {
      const res = await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ color: '#000000' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FIELD_NOT_ALLOWED');
    });

    it('returns 404 for nonexistent team', async () => {
      const res = await request(app)
        .patch('/api/teams/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ communityNote: 'test' });

      expect(res.status).toBe(404);
    });

    it('rejects empty body (no valid fields)', async () => {
      const res = await request(app)
        .patch(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NO_FIELDS');
    });
  });
});
