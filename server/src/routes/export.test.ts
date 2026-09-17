import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { pool } from '../db/pool.js';
import { createRankingSnapshot } from '../engine/ranking.js';

const POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

async function resetAndSeed() {
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
      `INSERT INTO tournament (name, status) VALUES ('Export Test Cup', 'LIVE') RETURNING id`
    );
    const tid = t.id;

    const teams = [
      { name: 'Alpha', slug: 'alpha', color: '#ff0000' },
      { name: 'Beta', slug: 'beta', color: '#00ff00' },
    ];

    const teamIds: Record<string, string> = {};
    const participantIds: Record<string, { creator: string; player1: string }> = {};

    for (const tm of teams) {
      const { rows: [team] } = await client.query(
        `INSERT INTO team (tournament_id, name, slug, color) VALUES ($1, $2, $3, $4) RETURNING id`,
        [tid, tm.name, tm.slug, tm.color]
      );
      teamIds[tm.slug] = team.id;

      const { rows: [cr] } = await client.query(
        `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, 'CREATOR') RETURNING id`,
        [team.id, `${tm.name}_C`, `${tm.slug}_c`]
      );
      const { rows: [p1] } = await client.query(
        `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, 'PLAYER_1') RETURNING id`,
        [team.id, `${tm.name}_P1`, `${tm.slug}_p1`]
      );
      participantIds[tm.slug] = { creator: cr.id, player1: p1.id };
    }

    // 1 match, 2 maps, both completed
    const { rows: [match] } = await client.query(
      `INSERT INTO match (tournament_id, match_number, phase, status, started_at, completed_at)
       VALUES ($1, 1, 'MAIN', 'COMPLETED', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour') RETURNING id`,
      [tid]
    );

    for (const slug of Object.keys(participantIds)) {
      const p = participantIds[slug];
      await client.query(`INSERT INTO match_participation (match_id, participant_id) VALUES ($1, $2)`, [match.id, p.creator]);
      await client.query(`INSERT INTO match_participation (match_id, participant_id) VALUES ($1, $2)`, [match.id, p.player1]);
    }

    const mapIds: string[] = [];
    for (let j = 1; j <= 2; j++) {
      const { rows: [map] } = await client.query(
        `INSERT INTO map (match_id, map_index, code, status, started_at, completed_at)
         VALUES ($1, $2, $3, 'COMPLETED', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour') RETURNING id`,
        [match.id, j, `P1M${j}`]
      );
      mapIds.push(map.id);
    }

    // Map 1: Alpha_C=1st(25), Beta_C=2nd(18), Alpha_P1=3rd(15), Beta_P1=4th(12)
    const map1Order = [
      participantIds.alpha.creator,
      participantIds.beta.creator,
      participantIds.alpha.player1,
      participantIds.beta.player1,
    ];
    for (let pos = 0; pos < map1Order.length; pos++) {
      await client.query(
        `INSERT INTO map_result (map_id, participant_id, position, status, points) VALUES ($1, $2, $3, 'FINISHED', $4)`,
        [mapIds[0], map1Order[pos], pos + 1, POINTS_TABLE[pos]]
      );
    }

    // Map 2: Beta_C=1st(25), Alpha_C=2nd(18), Beta_P1=3rd(15), Alpha_P1=4th(12)
    const map2Order = [
      participantIds.beta.creator,
      participantIds.alpha.creator,
      participantIds.beta.player1,
      participantIds.alpha.player1,
    ];
    for (let pos = 0; pos < map2Order.length; pos++) {
      await client.query(
        `INSERT INTO map_result (map_id, participant_id, position, status, points) VALUES ($1, $2, $3, 'FINISHED', $4)`,
        [mapIds[1], map2Order[pos], pos + 1, POINTS_TABLE[pos]]
      );
    }

    await client.query('COMMIT');

    for (const mapId of mapIds) {
      await createRankingSnapshot(tid, mapId);
    }

    return { tid, teamIds, participantIds, matchId: match.id, mapIds };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function clearAll() {
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
    await client.query('COMMIT');
  } finally {
    client.release();
  }
}

describe('Export API', () => {
  let seed: Awaited<ReturnType<typeof resetAndSeed>>;

  beforeAll(async () => {
    seed = await resetAndSeed();
  });

  // ── Teams CSV ────────────────────────────────────────

  describe('GET /api/export/teams.csv', () => {
    it('returns CSV with correct Content-Type and headers', async () => {
      const res = await request(app).get('/api/export/teams.csv');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('clasificacion_equipos.csv');
    });

    it('contains header row and all teams', async () => {
      const res = await request(app).get('/api/export/teams.csv');
      const lines = res.text.trim().split('\r\n');
      expect(lines[0]).toContain('Posición');
      expect(lines[0]).toContain('Equipo');
      expect(lines[0]).toContain('Puntos Totales');
      expect(lines.length).toBe(3); // header + 2 teams
    });

    it('teams are ordered by globalPosition', async () => {
      const res = await request(app).get('/api/export/teams.csv');
      const lines = res.text.trim().split('\r\n');
      // Alpha: 25+15+18+12=70, Beta: 18+12+25+15=70 — tie, alphabetical
      const line1 = lines[1];
      const line2 = lines[2];
      expect(line1).toContain('1');
      expect(line2).toContain('2');
    });

    it('shows correct total points for each team', async () => {
      const res = await request(app).get('/api/export/teams.csv');
      const lines = res.text.trim().split('\r\n');
      // Both teams have 70 total points
      expect(lines[1]).toContain('70');
      expect(lines[2]).toContain('70');
    });
  });

  // ── Participants CSV ─────────────────────────────────

  describe('GET /api/export/participants.csv', () => {
    it('returns CSV with correct headers', async () => {
      const res = await request(app).get('/api/export/participants.csv');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      const lines = res.text.trim().split('\r\n');
      expect(lines[0]).toContain('Jugador');
      expect(lines[0]).toContain('Tipo');
      expect(lines[0]).toContain('Promedio por Mapa');
    });

    it('contains all participants', async () => {
      const res = await request(app).get('/api/export/participants.csv');
      const lines = res.text.trim().split('\r\n');
      expect(lines.length).toBe(5); // header + 4 participants
    });

    it('participants sorted by total points desc', async () => {
      const res = await request(app).get('/api/export/participants.csv');
      const lines = res.text.trim().split('\r\n');
      // Alpha_C: 25+18=43, Beta_C: 18+25=43, Alpha_P1: 15+12=27, Beta_P1: 12+15=27
      const firstDataLine = lines[1];
      expect(firstDataLine).toContain('43');
    });

    it('includes participant type', async () => {
      const res = await request(app).get('/api/export/participants.csv');
      expect(res.text).toContain('CREATOR');
      expect(res.text).toContain('PLAYER_1');
    });
  });

  // ── Results by Map CSV ───────────────────────────────

  describe('GET /api/export/results-by-map.csv', () => {
    it('returns CSV with correct headers', async () => {
      const res = await request(app).get('/api/export/results-by-map.csv');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      const lines = res.text.trim().split('\r\n');
      expect(lines[0]).toContain('Mapa');
      expect(lines[0]).toContain('Posición');
      expect(lines[0]).toContain('Puntos');
    });

    it('contains results for all completed maps', async () => {
      const res = await request(app).get('/api/export/results-by-map.csv');
      const lines = res.text.trim().split('\r\n');
      // 2 maps * 4 results each = 8 data lines + 1 header
      expect(lines.length).toBe(9);
    });

    it('results ordered by match_number, map_index, position', async () => {
      const res = await request(app).get('/api/export/results-by-map.csv');
      const lines = res.text.trim().split('\r\n');
      // First result should be P1M1, position 1
      expect(lines[1]).toContain('P1M1');
      expect(lines[1]).toContain('Alpha_C');
      expect(lines[1]).toContain('25');
    });

    it('includes map code and match number', async () => {
      const res = await request(app).get('/api/export/results-by-map.csv');
      expect(res.text).toContain('P1M1');
      expect(res.text).toContain('P1M2');
    });
  });

  // ── Results by Match CSV ─────────────────────────────

  describe('GET /api/export/results-by-match.csv', () => {
    it('returns CSV with match columns', async () => {
      const res = await request(app).get('/api/export/results-by-match.csv');
      expect(res.status).toBe(200);
      const lines = res.text.trim().split('\r\n');
      expect(lines[0]).toContain('Equipo');
      expect(lines[0]).toContain('Puntos Totales');
      expect(lines[0]).toContain('Partida 1');
    });

    it('contains all teams', async () => {
      const res = await request(app).get('/api/export/results-by-match.csv');
      const lines = res.text.trim().split('\r\n');
      expect(lines.length).toBe(3); // header + 2 teams
    });

    it('shows correct match totals per team', async () => {
      const res = await request(app).get('/api/export/results-by-match.csv');
      const lines = res.text.trim().split('\r\n');
      // Both teams have 70 total, 70 for match 1
      expect(lines[1]).toContain('70');
    });
  });

  // ── Consolidated JSON ────────────────────────────────

  describe('GET /api/export/consolidated.json', () => {
    it('returns JSON with correct Content-Type', async () => {
      const res = await request(app).get('/api/export/consolidated.json');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.headers['content-disposition']).toContain('drone_cup_export.json');
    });

    it('contains all top-level keys', async () => {
      const res = await request(app).get('/api/export/consolidated.json');
      const data = res.body;
      expect(data).toHaveProperty('exportedAt');
      expect(data).toHaveProperty('tournament');
      expect(data).toHaveProperty('teams');
      expect(data).toHaveProperty('participants');
      expect(data).toHaveProperty('matches');
      expect(data).toHaveProperty('maps');
      expect(data).toHaveProperty('results');
      expect(data).toHaveProperty('rankings');
      expect(data).toHaveProperty('statistics');
    });

    it('tournament has correct fields', async () => {
      const res = await request(app).get('/api/export/consolidated.json');
      const { tournament } = res.body;
      expect(tournament.name).toBe('Export Test Cup');
      expect(tournament.status).toBe('LIVE');
      expect(tournament).toHaveProperty('id');
    });

    it('teams array has all teams', async () => {
      const res = await request(app).get('/api/export/consolidated.json');
      expect(res.body.teams).toHaveLength(2);
      const names = res.body.teams.map((t: any) => t.name).sort();
      expect(names).toEqual(['Alpha', 'Beta']);
    });

    it('participants include teamName', async () => {
      const res = await request(app).get('/api/export/consolidated.json');
      for (const p of res.body.participants) {
        expect(p).toHaveProperty('teamName');
      }
    });

    it('results include participantName and teamName', async () => {
      const res = await request(app).get('/api/export/consolidated.json');
      expect(res.body.results.length).toBeGreaterThan(0);
      for (const r of res.body.results) {
        expect(r).toHaveProperty('participantName');
        expect(r).toHaveProperty('teamName');
      }
    });

    it('rankings has teams, individuals, and history', async () => {
      const res = await request(app).get('/api/export/consolidated.json');
      const { rankings } = res.body;
      expect(rankings).toHaveProperty('teams');
      expect(rankings).toHaveProperty('individuals');
      expect(rankings).toHaveProperty('history');
      expect(rankings.teams.length).toBe(2);
      expect(rankings.individuals.length).toBe(4);
    });

    it('statistics has teams and participants', async () => {
      const res = await request(app).get('/api/export/consolidated.json');
      const { statistics } = res.body;
      expect(statistics).toHaveProperty('teams');
      expect(statistics).toHaveProperty('participants');
      expect(statistics.teams.length).toBe(2);
      expect(statistics.participants.length).toBe(4);
    });

    it('exportedAt is a valid ISO date', async () => {
      const res = await request(app).get('/api/export/consolidated.json');
      const d = new Date(res.body.exportedAt);
      expect(d.getTime()).not.toBeNaN();
    });

    it('does not include sensitive data', async () => {
      const res = await request(app).get('/api/export/consolidated.json');
      const json = JSON.stringify(res.body);
      expect(json).not.toContain('password');
      expect(json).not.toContain('token');
      expect(json).not.toContain('secret');
    });
  });

  // ── Empty DB ─────────────────────────────────────────

  describe('Empty DB', () => {
    it('returns 404 for CSVs when no tournament exists', async () => {
      await clearAll();
      const res = await request(app).get('/api/export/teams.csv');
      expect(res.status).toBe(404);
    });

    it('returns 404 for JSON when no tournament exists', async () => {
      const res = await request(app).get('/api/export/consolidated.json');
      expect(res.status).toBe(404);
    });
  });

  // ── Corrections reflected ────────────────────────────

  describe('Corrections reflected immediately', () => {
    let corrSeed: Awaited<ReturnType<typeof resetAndSeed>>;

    beforeAll(async () => {
      corrSeed = await resetAndSeed();
    });

    it('CSV reflects corrected data after map result update', async () => {
      const before = await request(app).get('/api/export/teams.csv');
      const beforeLines = before.text.trim().split('\r\n');
      expect(beforeLines[1]).toContain('70');

      // Change Alpha_C from position 1 (25 pts) to DNF (0 pts) in map 1
      await pool.query(
        `UPDATE map_result SET position = NULL, status = 'DNF', points = 0 WHERE map_id = $1 AND participant_id = $2`,
        [corrSeed.mapIds[0], corrSeed.participantIds.alpha.creator]
      );

      const after = await request(app).get('/api/export/teams.csv');
      const afterLines = after.text.trim().split('\r\n');
      // Alpha was 70 (25+15+18+12), now 45 (0+15+18+12)
      expect(afterLines.find(l => l.includes('Alpha'))).toContain('45');
      // Beta unchanged at 70
      expect(afterLines.find(l => l.includes('Beta'))).toContain('70');
    });
  });
});
