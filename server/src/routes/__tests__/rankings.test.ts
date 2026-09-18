import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../db/pool.js';

let tournamentId: string;
let teamIds: string[] = [];
let participantIds: string[] = [];
let matchId: string;
let mapId: string;

async function seedMinimal() {
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
      `INSERT INTO tournament (name, status) VALUES ('Rankings Test', 'LIVE') RETURNING id`
    );
    tournamentId = t.id;

    const teamDefs = [
      { name: 'Team A', slug: 'team-a', color: '#ff0000' },
      { name: 'Team B', slug: 'team-b', color: '#00ff00' },
    ];
    teamIds = [];
    participantIds = [];

    for (const td of teamDefs) {
      const { rows: [team] } = await client.query(
        `INSERT INTO team (tournament_id, name, slug, color) VALUES ($1, $2, $3, $4) RETURNING id`,
        [tournamentId, td.name, td.slug, td.color]
      );
      teamIds.push(team.id);

      const { rows: [p] } = await client.query(
        `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, 'CREATOR') RETURNING id`,
        [team.id, `${td.name} Creator`, `${td.slug}-creator`]
      );
      participantIds.push(p.id);
    }

    const { rows: [m] } = await client.query(
      `INSERT INTO match (tournament_id, match_number, phase, status) VALUES ($1, 1, 'MAIN', 'COMPLETED') RETURNING id`,
      [tournamentId]
    );
    matchId = m.id;

    for (const pid of participantIds) {
      await client.query(
        `INSERT INTO match_participation (match_id, participant_id) VALUES ($1, $2)`,
        [matchId, pid]
      );
    }

    const { rows: [mp] } = await client.query(
      `INSERT INTO map (match_id, map_index, code, status) VALUES ($1, 1, 'BANK', 'COMPLETED') RETURNING id`,
      [matchId]
    );
    mapId = mp.id;

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

describe('GET /api/rankings — hasResults field', () => {
  beforeAll(async () => {
    await seedMinimal();
  });

  it('returns hasResults: false when no map_result rows exist', async () => {
    await pool.query('DELETE FROM map_result');

    const res = await request(app).get('/api/rankings');
    expect(res.status).toBe(200);
    expect(res.body.hasResults).toBe(false);
    expect(res.body.teams).toBeInstanceOf(Array);
    expect(res.body.teams.length).toBeGreaterThan(0);
    for (const team of res.body.teams) {
      expect(team.totalPoints).toBe(0);
    }
  });

  it('returns hasResults: true when at least one map_result exists', async () => {
    await pool.query(
      `INSERT INTO map_result (map_id, participant_id, position, status, points)
       VALUES ($1, $2, 1, 'FINISHED', 25)`,
      [mapId, participantIds[0]]
    );

    const res = await request(app).get('/api/rankings');
    expect(res.status).toBe(200);
    expect(res.body.hasResults).toBe(true);
    expect(res.body.teams.some((t: { totalPoints: number }) => t.totalPoints > 0)).toBe(true);
  });

  it('returns hasResults: true even when all results are DNF (0 points)', async () => {
    await pool.query('DELETE FROM map_result');
    for (const pid of participantIds) {
      await pool.query(
        `INSERT INTO map_result (map_id, participant_id, position, status, points)
         VALUES ($1, $2, NULL, 'DNF', 0)`,
        [mapId, pid]
      );
    }

    const res = await request(app).get('/api/rankings');
    expect(res.status).toBe(200);
    expect(res.body.hasResults).toBe(true);
    for (const team of res.body.teams) {
      expect(team.totalPoints).toBe(0);
    }
  });

  afterAll(async () => {
    await pool.query('DELETE FROM ranking_snapshot');
    await pool.query('DELETE FROM map_result');
    await pool.query('DELETE FROM map');
    await pool.query('DELETE FROM match_participation');
    await pool.query('DELETE FROM match');
    await pool.query('DELETE FROM participant');
    await pool.query('DELETE FROM team');
    await pool.query('DELETE FROM tournament');
  });
});
