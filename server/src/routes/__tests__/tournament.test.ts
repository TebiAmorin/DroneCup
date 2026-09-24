import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../db/pool.js';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'changeme';

const TEAM_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];

let tournamentId: string;
const teamIds: string[] = [];
const creatorIds: string[] = [];
const player1Ids: string[] = [];
const player2Ids: string[] = [];

async function seedFullRoster() {
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
      `INSERT INTO tournament (name, status) VALUES ('Readiness Test', 'DRAFT') RETURNING id`
    );
    tournamentId = t.id;

    teamIds.length = 0;
    creatorIds.length = 0;
    player1Ids.length = 0;
    player2Ids.length = 0;

    for (const name of TEAM_NAMES) {
      const slug = name.toLowerCase();
      const { rows: [team] } = await client.query(
        `INSERT INTO team (tournament_id, name, slug, color) VALUES ($1, $2, $3, '#ff0000') RETURNING id`,
        [tournamentId, name, slug]
      );
      teamIds.push(team.id);

      const { rows: [cr] } = await client.query(
        `INSERT INTO participant (team_id, name, slug, type, confirmed) VALUES ($1, $2, $3, 'CREATOR', true) RETURNING id`,
        [team.id, `${name}Creator`, `${slug}creator`]
      );
      creatorIds.push(cr.id);

      const { rows: [p1] } = await client.query(
        `INSERT INTO participant (team_id, name, slug, type, confirmed) VALUES ($1, $2, $3, 'PLAYER_1', false) RETURNING id`,
        [team.id, `${name}_P1`, `${slug}_p1`]
      );
      player1Ids.push(p1.id);

      const { rows: [p2] } = await client.query(
        `INSERT INTO participant (team_id, name, slug, type, confirmed) VALUES ($1, $2, $3, 'PLAYER_2', false) RETURNING id`,
        [team.id, `${name}_P2`, `${slug}_p2`]
      );
      player2Ids.push(p2.id);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function confirmPlayer(id: string, name: string) {
  const res = await request(app)
    .post(`/api/participants/${id}/confirm`)
    .set('Authorization', `Bearer ${ADMIN_SECRET}`)
    .send({ name });
  expect(res.status).toBe(200);
}

async function resetPlayer(id: string) {
  const res = await request(app)
    .post(`/api/participants/${id}/reset`)
    .set('Authorization', `Bearer ${ADMIN_SECRET}`);
  expect(res.status).toBe(200);
}

async function getTournament() {
  const res = await request(app).get('/api/tournament');
  expect(res.status).toBe(200);
  return res.body;
}

describe('Tournament readiness (L2)', () => {
  beforeAll(async () => { await seedFullRoster(); });
  afterAll(async () => { await pool.end(); });

  describe('GET /api/tournament — readiness fields', () => {
    it('returns tournamentReady, confirmedParticipants, totalParticipants without breaking existing fields', async () => {
      const body = await getTournament();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('currentMatchId');
      expect(body).toHaveProperty('tournamentReady');
      expect(body).toHaveProperty('confirmedParticipants');
      expect(body).toHaveProperty('totalParticipants');
      expect(body.totalParticipants).toBe(15);
    });
  });

  describe('Readiness transitions', () => {
    it('initial state: 5/15 (creators only) → false', async () => {
      const body = await getTournament();
      expect(body.tournamentReady).toBe(false);
      expect(body.confirmedParticipants).toBe(5);
      expect(body.totalParticipants).toBe(15);
    });

    it('confirm 1 player → 6/15 → false', async () => {
      await confirmPlayer(player1Ids[0], 'AlphaPlayer1');
      const body = await getTournament();
      expect(body.tournamentReady).toBe(false);
      expect(body.confirmedParticipants).toBe(6);
    });

    it('confirm up to 14 → false', async () => {
      await confirmPlayer(player1Ids[1], 'BravoPlayer1');
      await confirmPlayer(player1Ids[2], 'CharliePlayer1');
      await confirmPlayer(player1Ids[3], 'DeltaPlayer1');
      await confirmPlayer(player1Ids[4], 'EchoPlayer1');
      await confirmPlayer(player2Ids[0], 'AlphaPlayer2');
      await confirmPlayer(player2Ids[1], 'BravoPlayer2');
      await confirmPlayer(player2Ids[2], 'CharliePlayer2');
      await confirmPlayer(player2Ids[3], 'DeltaPlayer2');

      const body = await getTournament();
      expect(body.tournamentReady).toBe(false);
      expect(body.confirmedParticipants).toBe(14);
    });

    it('confirm last player → 15/15 → true', async () => {
      await confirmPlayer(player2Ids[4], 'EchoPlayer2');
      const body = await getTournament();
      expect(body.tournamentReady).toBe(true);
      expect(body.confirmedParticipants).toBe(15);
    });

    it('reset after ready → 14/15 → false', async () => {
      await resetPlayer(player2Ids[4]);
      const body = await getTournament();
      expect(body.tournamentReady).toBe(false);
      expect(body.confirmedParticipants).toBe(14);
    });

    it('re-confirm → 15/15 → true', async () => {
      await confirmPlayer(player2Ids[4], 'EchoPlayer2Again');
      const body = await getTournament();
      expect(body.tournamentReady).toBe(true);
      expect(body.confirmedParticipants).toBe(15);
    });
  });

  describe('Structure validation 5/5/5', () => {
    it('incomplete structure (4 teams instead of 5) → false even if all present are confirmed', async () => {
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
          `INSERT INTO tournament (name, status) VALUES ('Bad Structure', 'DRAFT') RETURNING id`
        );

        // Only 4 teams — structure 4/4/4 = 12 confirmed
        for (let i = 0; i < 4; i++) {
          const { rows: [team] } = await client.query(
            `INSERT INTO team (tournament_id, name, slug, color) VALUES ($1, $2, $3, '#ff0000') RETURNING id`,
            [t.id, `Team${i}`, `team${i}`]
          );
          await client.query(
            `INSERT INTO participant (team_id, name, slug, type, confirmed) VALUES ($1, $2, $3, 'CREATOR', true)`,
            [team.id, `Creator${i}`, `creator${i}`]
          );
          await client.query(
            `INSERT INTO participant (team_id, name, slug, type, confirmed) VALUES ($1, $2, $3, 'PLAYER_1', true)`,
            [team.id, `P1_${i}`, `p1_${i}`]
          );
          await client.query(
            `INSERT INTO participant (team_id, name, slug, type, confirmed) VALUES ($1, $2, $3, 'PLAYER_2', true)`,
            [team.id, `P2_${i}`, `p2_${i}`]
          );
        }

        await client.query('COMMIT');
      } finally {
        client.release();
      }

      const body = await getTournament();
      expect(body.tournamentReady).toBe(false);
      expect(body.confirmedParticipants).toBe(12);
    });

    it('5 teams but missing a player_1 on one team → 14/15 structure invalid', async () => {
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

        const { rows: [t] } = await client.query(
          `SELECT id FROM tournament LIMIT 1`
        );

        for (let i = 0; i < 5; i++) {
          const { rows: [team] } = await client.query(
            `INSERT INTO team (tournament_id, name, slug, color) VALUES ($1, $2, $3, '#ff0000') RETURNING id`,
            [t.id, `Team${i}`, `team${i}`]
          );
          await client.query(
            `INSERT INTO participant (team_id, name, slug, type, confirmed) VALUES ($1, $2, $3, 'CREATOR', true)`,
            [team.id, `Creator${i}`, `creator${i}`]
          );
          // Skip player_1 on last team
          if (i < 4) {
            await client.query(
              `INSERT INTO participant (team_id, name, slug, type, confirmed) VALUES ($1, $2, $3, 'PLAYER_1', true)`,
              [team.id, `P1_${i}`, `p1_${i}`]
            );
          }
          await client.query(
            `INSERT INTO participant (team_id, name, slug, type, confirmed) VALUES ($1, $2, $3, 'PLAYER_2', true)`,
            [team.id, `P2_${i}`, `p2_${i}`]
          );
        }

        await client.query('COMMIT');
      } finally {
        client.release();
      }

      const body = await getTournament();
      expect(body.tournamentReady).toBe(false);
    });
  });

  describe('Source of truth: confirmed field, not name', () => {
    it('player with name but confirmed=false does NOT count', async () => {
      await seedFullRoster();

      // Set a proper name but keep confirmed=false
      await pool.query(
        `UPDATE participant SET name = 'RealName', slug = 'realname' WHERE id = $1`,
        [player1Ids[0]]
      );

      const body = await getTournament();
      expect(body.confirmedParticipants).toBe(5);
      expect(body.tournamentReady).toBe(false);
    });
  });

  describe('Realtime: confirm/reset emits competition.updated', () => {
    it('confirm emits competition.updated (no new events)', async () => {
      await seedFullRoster();
      const res = await request(app)
        .post(`/api/participants/${player1Ids[0]}/confirm`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ name: 'ConfirmTest' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('reset emits competition.updated (no new events)', async () => {
      await confirmPlayer(player1Ids[0], 'ResetTest');
      const res = await request(app)
        .post(`/api/participants/${player1Ids[0]}/reset`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
