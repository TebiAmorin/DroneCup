import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../db/pool.js';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'changeme';

let tournamentId: string;
let teamId: string;
let creatorId: string;
let player1Id: string;
let player2Id: string;
let mapId: string;
let matchId: string;

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

    const { rows: [cr] } = await client.query(
      `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, 'CreatorName', 'creatorname', 'CREATOR') RETURNING id`,
      [teamId]
    );
    creatorId = cr.id;

    const { rows: [p1] } = await client.query(
      `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, 'Player1Name', 'player1name', 'PLAYER_1') RETURNING id`,
      [teamId]
    );
    player1Id = p1.id;

    const { rows: [p2] } = await client.query(
      `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, 'Player2Name', 'player2name', 'PLAYER_2') RETURNING id`,
      [teamId]
    );
    player2Id = p2.id;

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

describe('PATCH /api/participants/:id', () => {
  beforeAll(async () => {
    await seedParticipants();
  });

  afterAll(async () => {
    await pool.end();
  });

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
