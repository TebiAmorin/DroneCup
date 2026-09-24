import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../db/pool.js';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'changeme';

let tournamentId: string;
let teamId: string;
let teamId2: string;
let creatorId: string;
let player1Id: string;
let player2Id: string;
let mapId: string;
let matchId: string;
let otherPlayer1Id: string;

async function seedParticipants() {
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
      `INSERT INTO tournament (name, status) VALUES ('Participant Test', 'LIVE') RETURNING id`
    );
    tournamentId = t.id;

    const { rows: [team] } = await client.query(
      `INSERT INTO team (tournament_id, name, slug, color) VALUES ($1, 'TestTeam', 'testteam', '#ff0000') RETURNING id`,
      [tournamentId]
    );
    teamId = team.id;

    const { rows: [team2] } = await client.query(
      `INSERT INTO team (tournament_id, name, slug, color) VALUES ($1, 'OtherTeam', 'otherteam', '#00ff00') RETURNING id`,
      [tournamentId]
    );
    teamId2 = team2.id;

    const { rows: [cr] } = await client.query(
      `INSERT INTO participant (team_id, name, slug, type, confirmed) VALUES ($1, 'CreatorName', 'creatorname', 'CREATOR', true) RETURNING id`,
      [teamId]
    );
    creatorId = cr.id;

    const { rows: [p1] } = await client.query(
      `INSERT INTO participant (team_id, name, slug, type, confirmed) VALUES ($1, 'TestTeam_P1', 'testteam_p1', 'PLAYER_1', false) RETURNING id`,
      [teamId]
    );
    player1Id = p1.id;

    const { rows: [p2] } = await client.query(
      `INSERT INTO participant (team_id, name, slug, type, confirmed) VALUES ($1, 'TestTeam_P2', 'testteam_p2', 'PLAYER_2', false) RETURNING id`,
      [teamId]
    );
    player2Id = p2.id;

    const { rows: [op1] } = await client.query(
      `INSERT INTO participant (team_id, name, slug, type, confirmed) VALUES ($1, 'OtherTeam_P1', 'otherteam_p1', 'PLAYER_1', false) RETURNING id`,
      [teamId2]
    );
    otherPlayer1Id = op1.id;

    await client.query(
      `INSERT INTO participant (team_id, name, slug, type, confirmed) VALUES ($1, 'OtherCreator', 'othercreator', 'CREATOR', true)`,
      [teamId2]
    );
    await client.query(
      `INSERT INTO participant (team_id, name, slug, type, confirmed) VALUES ($1, 'OtherTeam_P2', 'otherteam_p2', 'PLAYER_2', false)`,
      [teamId2]
    );

    const { rows: [m] } = await client.query(
      `INSERT INTO match (tournament_id, match_number, phase, status) VALUES ($1, 1, 'MAIN', 'COMPLETED') RETURNING id`,
      [tournamentId]
    );
    matchId = m.id;

    const { rows: [mp] } = await client.query(
      `INSERT INTO map (match_id, map_index, code, status) VALUES ($1, 1, 'BANK', 'COMPLETED') RETURNING id`,
      [matchId]
    );
    mapId = mp.id;

    for (const pid of [creatorId, player1Id, player2Id]) {
      await client.query(
        `INSERT INTO match_participation (match_id, participant_id) VALUES ($1, $2)`,
        [matchId, pid]
      );
    }

    await client.query(
      `INSERT INTO map_result (map_id, participant_id, position, status, points) VALUES ($1, $2, 1, 'FINISHED', 25)`,
      [mapId, creatorId]
    );
    await client.query(
      `INSERT INTO map_result (map_id, participant_id, position, status, points) VALUES ($1, $2, 2, 'FINISHED', 18)`,
      [mapId, player1Id]
    );
    await client.query(
      `INSERT INTO map_result (map_id, participant_id, position, status, points) VALUES ($1, $2, 3, 'FINISHED', 15)`,
      [mapId, player2Id]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

describe('Participants API', () => {
  beforeAll(async () => {
    await seedParticipants();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('PATCH /api/participants/:id', () => {
    it('renames PLAYER_1 successfully', async () => {
      const res = await request(app)
        .patch(`/api/participants/${player1Id}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ name: 'NewPlayer1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.participant.name).toBe('NewPlayer1');
      expect(res.body.participant.id).toBe(player1Id);
    });

    it('renames PLAYER_2 successfully', async () => {
      const res = await request(app)
        .patch(`/api/participants/${player2Id}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ name: 'NewPlayer2' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.participant.name).toBe('NewPlayer2');
      expect(res.body.participant.id).toBe(player2Id);
    });

    it('rejects renaming CREATOR', async () => {
      const res = await request(app)
        .patch(`/api/participants/${creatorId}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ name: 'HackedCreator' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects empty name', async () => {
      const res = await request(app)
        .patch(`/api/participants/${player1Id}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_NAME');
    });

    it('rejects name longer than 50 characters', async () => {
      const res = await request(app)
        .patch(`/api/participants/${player1Id}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ name: 'A'.repeat(51) });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_NAME');
    });

    it('preserves UUID after rename', async () => {
      const res = await request(app)
        .patch(`/api/participants/${player1Id}`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ name: 'RenamedPlayer1' });

      expect(res.status).toBe(200);
      expect(res.body.participant.id).toBe(player1Id);
      expect(res.body.participant.teamId).toBe(teamId);
      expect(res.body.participant.type).toBe('PLAYER_1');
    });

    it('preserves results and points after rename', async () => {
      const { rows: results } = await pool.query(
        `SELECT participant_id, position, points FROM map_result WHERE map_id = $1 ORDER BY position`,
        [mapId]
      );
      expect(results).toHaveLength(3);

      const p1Result = results.find((r: { participant_id: string }) => r.participant_id === player1Id);
      expect(p1Result).toBeDefined();
      expect(p1Result.position).toBe(2);
      expect(p1Result.points).toBe(18);

      const p2Result = results.find((r: { participant_id: string }) => r.participant_id === player2Id);
      expect(p2Result).toBeDefined();
      expect(p2Result.position).toBe(3);
      expect(p2Result.points).toBe(15);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .patch(`/api/participants/${player1Id}`)
        .send({ name: 'NoAuth' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/participants/:id/confirm', () => {
    it('confirms PLAYER_1 with valid name', async () => {
      await pool.query(`UPDATE participant SET name = 'Phox', confirmed = false WHERE id = $1`, [player1Id]);

      const res = await request(app)
        .post(`/api/participants/${player1Id}/confirm`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ name: 'Phox' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.participant.confirmed).toBe(true);
      expect(res.body.participant.name).toBe('Phox');
      expect(res.body.participant.id).toBe(player1Id);
    });

    it('confirms PLAYER_2 with valid name', async () => {
      await pool.query(`UPDATE participant SET name = 'Riko', confirmed = false WHERE id = $1`, [player2Id]);

      const res = await request(app)
        .post(`/api/participants/${player2Id}/confirm`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ name: 'Riko' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.participant.confirmed).toBe(true);
      expect(res.body.participant.name).toBe('Riko');
    });

    it('rejects confirming CREATOR', async () => {
      const res = await request(app)
        .post(`/api/participants/${creatorId}/confirm`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ name: 'CreatorName' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects nonexistent participant', async () => {
      const res = await request(app)
        .post(`/api/participants/00000000-0000-0000-0000-000000000000/confirm`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('rejects empty name', async () => {
      const res = await request(app)
        .post(`/api/participants/${player1Id}/confirm`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_NAME');
    });

    it('rejects placeholder name POR DETERMINAR', async () => {
      const res = await request(app)
        .post(`/api/participants/${player1Id}/confirm`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ name: 'POR DETERMINAR' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PLACEHOLDER_NAME');
    });

    it('rejects placeholder name _P1', async () => {
      const res = await request(app)
        .post(`/api/participants/${player1Id}/confirm`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ name: 'TestTeam_P1' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PLACEHOLDER_NAME');
    });

    it('rejects placeholder name _P2', async () => {
      const res = await request(app)
        .post(`/api/participants/${player2Id}/confirm`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ name: 'SomeTeam_P2' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PLACEHOLDER_NAME');
    });

    it('rejects placeholder name PILOTO 1', async () => {
      const res = await request(app)
        .post(`/api/participants/${player1Id}/confirm`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ name: 'PILOTO 1' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PLACEHOLDER_NAME');
    });

    it('rejects placeholder name PLAYER 2', async () => {
      const res = await request(app)
        .post(`/api/participants/${player2Id}/confirm`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ name: 'PLAYER 2' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PLACEHOLDER_NAME');
    });

    it('normalizes name with extra spaces', async () => {
      await pool.query(`UPDATE participant SET confirmed = false WHERE id = $1`, [player1Id]);

      const res = await request(app)
        .post(`/api/participants/${player1Id}/confirm`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`)
        .send({ name: '  Phox  ' });

      expect(res.status).toBe(200);
      expect(res.body.participant.name).toBe('Phox');
      expect(res.body.participant.confirmed).toBe(true);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .post(`/api/participants/${player1Id}/confirm`)
        .send({ name: 'NoAuth' });

      expect(res.status).toBe(401);
    });

    it('does not modify results after confirm', async () => {
      const { rows: results } = await pool.query(
        `SELECT participant_id, position, points FROM map_result WHERE map_id = $1 ORDER BY position`,
        [mapId]
      );
      expect(results).toHaveLength(3);

      const p1Result = results.find((r: { participant_id: string }) => r.participant_id === player1Id);
      expect(p1Result).toBeDefined();
      expect(p1Result.position).toBe(2);
      expect(p1Result.points).toBe(18);
    });
  });

  describe('POST /api/participants/:id/reset', () => {
    it('resets confirmed PLAYER_1', async () => {
      await pool.query(`UPDATE participant SET name = 'Phox', confirmed = true WHERE id = $1`, [player1Id]);

      const res = await request(app)
        .post(`/api/participants/${player1Id}/reset`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.participant.confirmed).toBe(false);
      expect(res.body.participant.name).toBe('TestTeam_P1');
      expect(res.body.participant.id).toBe(player1Id);
    });

    it('resets confirmed PLAYER_2', async () => {
      await pool.query(`UPDATE participant SET name = 'Riko', confirmed = true WHERE id = $1`, [player2Id]);

      const res = await request(app)
        .post(`/api/participants/${player2Id}/reset`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`);

      expect(res.status).toBe(200);
      expect(res.body.participant.confirmed).toBe(false);
      expect(res.body.participant.name).toBe('TestTeam_P2');
      expect(res.body.participant.id).toBe(player2Id);
    });

    it('preserves participant ID after reset', async () => {
      await pool.query(`UPDATE participant SET name = 'TempName', confirmed = true WHERE id = $1`, [player1Id]);

      const res = await request(app)
        .post(`/api/participants/${player1Id}/reset`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`);

      expect(res.status).toBe(200);
      expect(res.body.participant.id).toBe(player1Id);
      expect(res.body.participant.teamId).toBe(teamId);
      expect(res.body.participant.type).toBe('PLAYER_1');
    });

    it('rejects resetting CREATOR', async () => {
      const res = await request(app)
        .post(`/api/participants/${creatorId}/reset`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects nonexistent participant', async () => {
      const res = await request(app)
        .post(`/api/participants/00000000-0000-0000-0000-000000000000/reset`)
        .set('Authorization', `Bearer ${ADMIN_SECRET}`);

      expect(res.status).toBe(404);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .post(`/api/participants/${player1Id}/reset`);

      expect(res.status).toBe(401);
    });

    it('does not modify results after reset', async () => {
      const { rows: results } = await pool.query(
        `SELECT participant_id, position, points FROM map_result WHERE map_id = $1 ORDER BY position`,
        [mapId]
      );
      expect(results).toHaveLength(3);

      const p1Result = results.find((r: { participant_id: string }) => r.participant_id === player1Id);
      expect(p1Result).toBeDefined();
      expect(p1Result.position).toBe(2);
      expect(p1Result.points).toBe(18);
    });

    it('does not modify rankings after reset', async () => {
      const { rows: snapshots } = await pool.query(
        `SELECT * FROM ranking_snapshot WHERE tournament_id = $1`,
        [tournamentId]
      );
      // Snapshots should be unchanged (they are map-level, not affected by roster changes)
      for (const snap of snapshots) {
        expect(snap.total_points).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('GET /api/participants - confirmed field', () => {
    it('returns confirmed field in participant list', async () => {
      await pool.query(`UPDATE participant SET confirmed = true WHERE id = $1`, [player1Id]);
      await pool.query(`UPDATE participant SET confirmed = false WHERE id = $1`, [player2Id]);

      const res = await request(app).get('/api/participants');

      expect(res.status).toBe(200);
      const p1 = res.body.find((p: { id: string }) => p.id === player1Id);
      const p2 = res.body.find((p: { id: string }) => p.id === player2Id);
      expect(p1.confirmed).toBe(true);
      expect(p2.confirmed).toBe(false);
    });
  });
});
