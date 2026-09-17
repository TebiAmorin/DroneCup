import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { pool } from '../db/pool.js';
import { createRankingSnapshot } from '../engine/ranking.js';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'changeme';
const AUTH_HEADER = `Bearer ${ADMIN_SECRET}`;

interface SeedData {
  tournamentId: string;
  teams: { id: string; slug: string; name: string }[];
  participants: Record<string, { creator: { id: string; name: string }; p1: { id: string; name: string }; p2: { id: string; name: string } }>;
  matches: string[];
  maps: string[][];
}

async function seedTestTournament(): Promise<SeedData> {
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

    const { rows: [tour] } = await client.query(
      `INSERT INTO tournament (name, status) VALUES ('Test Cup AdminOps', 'LIVE') RETURNING id`
    );
    const tournamentId = tour.id;

    const teamSlugs = [
      { name: 'Alpha', slug: 'alpha', color: '#f5c842' },
      { name: 'Beta', slug: 'beta', color: '#38bdf8' },
      { name: 'Gamma', slug: 'gamma', color: '#22c55e' },
      { name: 'Delta', slug: 'delta', color: '#a855f7' },
      { name: 'Epsilon', slug: 'epsilon', color: '#ef4444' },
    ];

    const teams: { id: string; slug: string; name: string }[] = [];
    const participants: SeedData['participants'] = {};

    for (const t of teamSlugs) {
      const { rows: [team] } = await client.query(
        `INSERT INTO team (tournament_id, name, slug, color) VALUES ($1, $2, $3, $4) RETURNING id`,
        [tournamentId, t.name, t.slug, t.color]
      );
      teams.push({ id: team.id, slug: t.slug, name: t.name });

      const { rows: [creator] } = await client.query(
        `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, 'CREATOR') RETURNING id, name`,
        [team.id, `${t.name}_Creator`, `${t.slug}_creator`]
      );
      const { rows: [p1] } = await client.query(
        `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, 'PLAYER_1') RETURNING id, name`,
        [team.id, `${t.name}_P1`, `${t.slug}_p1`]
      );
      const { rows: [p2] } = await client.query(
        `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, 'PLAYER_2') RETURNING id, name`,
        [team.id, `${t.name}_P2`, `${t.slug}_p2`]
      );

      participants[t.slug] = {
        creator: { id: creator.id, name: creator.name },
        p1: { id: p1.id, name: p1.name },
        p2: { id: p2.id, name: p2.name },
      };
    }

    const matches: string[] = [];
    const maps: string[][] = [];

    for (let mIdx = 1; mIdx <= 4; mIdx++) {
      const { rows: [m] } = await client.query(
        `INSERT INTO match (tournament_id, match_number, phase, status) VALUES ($1, $2, 'MAIN', 'UPCOMING') RETURNING id`,
        [tournamentId, mIdx]
      );
      matches.push(m.id);

      const matchMaps: string[] = [];
      for (let mpIdx = 1; mpIdx <= 3; mpIdx++) {
        const { rows: [mp] } = await client.query(
          `INSERT INTO map (match_id, map_index, code, status) VALUES ($1, $2, $3, 'PENDING') RETURNING id`,
          [m.id, mpIdx, `P${mIdx}M${mpIdx}`]
        );
        matchMaps.push(mp.id);
      }
      maps.push(matchMaps);

      // Match participation: 1-2 = Creator + P1; 3-4 = Creator + P2
      for (const t of teamSlugs) {
        const p = participants[t.slug];
        await client.query(
          `INSERT INTO match_participation (match_id, participant_id) VALUES ($1, $2)`,
          [m.id, p.creator.id]
        );
        await client.query(
          `INSERT INTO match_participation (match_id, participant_id) VALUES ($1, $2)`,
          [m.id, mIdx <= 2 ? p.p1.id : p.p2.id]
        );
      }
    }

    await client.query('COMMIT');
    return { tournamentId, teams, participants, matches, maps };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

async function fillMapResults(tournamentId: string, mapId: string, matchIndex: number, seed: SeedData) {
  const isP1 = matchIndex <= 2;
  const slugs = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
  const eligibleIds: string[] = [];
  for (const slug of slugs) {
    eligibleIds.push(seed.participants[slug].creator.id);
    eligibleIds.push(isP1 ? seed.participants[slug].p1.id : seed.participants[slug].p2.id);
  }

  for (let i = 0; i < eligibleIds.length; i++) {
    const pos = i + 1;
    const pts = POINTS_TABLE[i] ?? 0;
    await pool.query(
      `INSERT INTO map_result (map_id, participant_id, position, status, points) VALUES ($1, $2, $3, 'FINISHED', $4)`,
      [mapId, eligibleIds[i], pos, pts]
    );
  }

  await pool.query(
    `UPDATE map SET status = 'COMPLETED', started_at = now() - interval '30 minutes', completed_at = now() WHERE id = $1`,
    [mapId]
  );
  await createRankingSnapshot(tournamentId, mapId);
}

describe('Admin Operations — Phase A1 Backend', () => {
  let seed: SeedData;

  beforeAll(async () => {
    process.env.ADMIN_SECRET = 'changeme';
  });

  beforeEach(async () => {
    seed = await seedTestTournament();
  });

  afterAll(async () => {
    await pool.end();
  });

  // ─── 1. RENAME PLAYER_1 ──────────────────────────────────────────
  it('1. Rename PLAYER_1: 200, name updated, same UUID, match_participation intact', async () => {
    const p1 = seed.participants['alpha'].p1;
    const res = await request(app)
      .patch(`/api/participants/${p1.id}`)
      .set('Authorization', AUTH_HEADER)
      .send({ name: 'Alpha_NewPilot1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.participant.id).toBe(p1.id);
    expect(res.body.participant.name).toBe('Alpha_NewPilot1');
    expect(res.body.participant.slug).toBe('alpha_newpilot1');

    // Verify DB
    const { rows: [dbP] } = await pool.query('SELECT * FROM participant WHERE id = $1', [p1.id]);
    expect(dbP.name).toBe('Alpha_NewPilot1');
    expect(dbP.id).toBe(p1.id);

    // Verify match_participation intact (should be in match 1 and 2)
    const { rows: mpRows } = await pool.query(
      'SELECT * FROM match_participation WHERE participant_id = $1',
      [p1.id]
    );
    expect(mpRows.length).toBe(2);
  });

  // ─── 2. RENAME PLAYER_2 ──────────────────────────────────────────
  it('2. Rename PLAYER_2: 200, name updated, same UUID, match_participation intact', async () => {
    const p2 = seed.participants['beta'].p2;
    const res = await request(app)
      .patch(`/api/participants/${p2.id}`)
      .set('Authorization', AUTH_HEADER)
      .send({ name: 'Beta_NewPilot2' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.participant.id).toBe(p2.id);
    expect(res.body.participant.name).toBe('Beta_NewPilot2');
    expect(res.body.participant.slug).toBe('beta_newpilot2');

    // Verify DB
    const { rows: [dbP] } = await pool.query('SELECT * FROM participant WHERE id = $1', [p2.id]);
    expect(dbP.name).toBe('Beta_NewPilot2');
    expect(dbP.id).toBe(p2.id);

    // Verify match_participation intact (should be in match 3 and 4)
    const { rows: mpRows } = await pool.query(
      'SELECT * FROM match_participation WHERE participant_id = $1',
      [p2.id]
    );
    expect(mpRows.length).toBe(2);
  });

  // ─── 3. PROTECTED CREATOR ─────────────────────────────────────────
  it('3. Creator protected: 403 Forbidden, name unchanged in DB', async () => {
    const creator = seed.participants['gamma'].creator;
    const res = await request(app)
      .patch(`/api/participants/${creator.id}`)
      .set('Authorization', AUTH_HEADER)
      .send({ name: 'Gamma_HackedCreator' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toBe('Creator participants cannot be modified');

    // Verify DB untouched
    const { rows: [dbP] } = await pool.query('SELECT name FROM participant WHERE id = $1', [creator.id]);
    expect(dbP.name).toBe(creator.name);
  });

  // ─── 4. AUTH PATCH PARTICIPANTS ──────────────────────────────────
  it('4. Auth PATCH: 401 without token or with invalid token', async () => {
    const p1 = seed.participants['alpha'].p1;

    // No token
    const res1 = await request(app)
      .patch(`/api/participants/${p1.id}`)
      .send({ name: 'TestName' });
    expect(res1.status).toBe(401);
    expect(res1.body.error.code).toBe('UNAUTHORIZED');

    // Invalid token
    const res2 = await request(app)
      .patch(`/api/participants/${p1.id}`)
      .set('Authorization', 'Bearer wrong_secret')
      .send({ name: 'TestName' });
    expect(res2.status).toBe(401);
    expect(res2.body.error.code).toBe('UNAUTHORIZED');
  });

  // ─── 5. RESET LIVE MATCH ──────────────────────────────────────────
  it('5. Reset LIVE match: match -> UPCOMING, maps -> PENDING, 0 results, timestamps reset, tournament pointers cleared', async () => {
    const matchId = seed.matches[0]; // Match 1
    const mapId1 = seed.maps[0][0];

    // Set match to LIVE and first map ACTIVE with some results
    await pool.query(`UPDATE match SET status = 'LIVE', started_at = now() WHERE id = $1`, [matchId]);
    await pool.query(`UPDATE map SET status = 'ACTIVE', started_at = now() WHERE id = $1`, [mapId1]);
    await pool.query(
      `UPDATE tournament SET current_match_id = $1, current_map_id = $2 WHERE id = $3`,
      [matchId, mapId1, seed.tournamentId]
    );
    // Fill 1 map with results
    await fillMapResults(seed.tournamentId, mapId1, 1, seed);

    // Call reset
    const res = await request(app)
      .post(`/api/matches/${matchId}/reset`)
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('UPCOMING');

    // Verify match in DB
    const { rows: [matchDb] } = await pool.query('SELECT * FROM match WHERE id = $1', [matchId]);
    expect(matchDb.status).toBe('UPCOMING');
    expect(matchDb.started_at).toBeNull();
    expect(matchDb.completed_at).toBeNull();

    // Verify maps in DB
    const { rows: mapsDb } = await pool.query('SELECT * FROM map WHERE match_id = $1', [matchId]);
    expect(mapsDb.length).toBe(3);
    for (const m of mapsDb) {
      expect(m.status).toBe('PENDING');
      expect(m.started_at).toBeNull();
      expect(m.completed_at).toBeNull();
    }

    // Verify map_result count is 0
    const { rows: resultsDb } = await pool.query(
      'SELECT * FROM map_result WHERE map_id IN (SELECT id FROM map WHERE match_id = $1)',
      [matchId]
    );
    expect(resultsDb.length).toBe(0);

    // Verify tournament pointers cleared
    const { rows: [tourDb] } = await pool.query('SELECT * FROM tournament WHERE id = $1', [seed.tournamentId]);
    expect(tourDb.current_match_id).toBeNull();
    expect(tourDb.current_map_id).toBeNull();

    // Verify participants and match_participation intact
    const { rows: mpCount } = await pool.query(
      'SELECT count(*) FROM match_participation WHERE match_id = $1',
      [matchId]
    );
    expect(parseInt(mpCount[0].count, 10)).toBe(10);
  });

  // ─── 6. RESET COMPLETED MATCH ─────────────────────────────────────
  it('6. Reset COMPLETED match: match -> UPCOMING, maps -> PENDING, 0 results, timestamps reset', async () => {
    const matchId = seed.matches[0]; // Match 1

    // Complete all 3 maps of match 1
    for (const mapId of seed.maps[0]) {
      await fillMapResults(seed.tournamentId, mapId, 1, seed);
    }
    await pool.query(
      `UPDATE match SET status = 'COMPLETED', started_at = now() - interval '2 hours', completed_at = now() - interval '1 hour' WHERE id = $1`,
      [matchId]
    );

    // Verify we had 30 results
    const { rows: preResults } = await pool.query(
      'SELECT count(*) FROM map_result WHERE map_id IN (SELECT id FROM map WHERE match_id = $1)',
      [matchId]
    );
    expect(parseInt(preResults[0].count, 10)).toBe(30);

    // Call reset
    const res = await request(app)
      .post(`/api/matches/${matchId}/reset`)
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('UPCOMING');

    // Verify DB
    const { rows: [matchDb] } = await pool.query('SELECT * FROM match WHERE id = $1', [matchId]);
    expect(matchDb.status).toBe('UPCOMING');
    expect(matchDb.started_at).toBeNull();
    expect(matchDb.completed_at).toBeNull();

    const { rows: mapsDb } = await pool.query('SELECT * FROM map WHERE match_id = $1', [matchId]);
    for (const m of mapsDb) {
      expect(m.status).toBe('PENDING');
      expect(m.started_at).toBeNull();
      expect(m.completed_at).toBeNull();
    }

    const { rows: postResults } = await pool.query(
      'SELECT count(*) FROM map_result WHERE map_id IN (SELECT id FROM map WHERE match_id = $1)',
      [matchId]
    );
    expect(parseInt(postResults[0].count, 10)).toBe(0);
  });

  // ─── 7. RESET UPCOMING MATCH (NO-OP) ──────────────────────────────
  it('7. Reset UPCOMING match: safe no-op, returns 200, no data modified', async () => {
    const matchId = seed.matches[2]; // Match 3 (UPCOMING)

    const res = await request(app)
      .post(`/api/matches/${matchId}/reset`)
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('UPCOMING');
    expect(res.body.noop).toBe(true);

    const { rows: [matchDb] } = await pool.query('SELECT * FROM match WHERE id = $1', [matchId]);
    expect(matchDb.status).toBe('UPCOMING');
  });

  // ─── 8. RESET INTERMEDIATE MATCH ──────────────────────────────────
  it('8. Reset intermediate match: P1 completed, P2 completed -> reset P2: P1 intact, P2 wiped, rankings recalculated', async () => {
    const match1Id = seed.matches[0];
    const match2Id = seed.matches[1];

    // Complete Match 1
    for (const mapId of seed.maps[0]) {
      await fillMapResults(seed.tournamentId, mapId, 1, seed);
    }
    await pool.query(
      `UPDATE match SET status = 'COMPLETED', started_at = now() - interval '3 hours', completed_at = now() - interval '2 hours' WHERE id = $1`,
      [match1Id]
    );

    // Record P1 results count and points
    const { rows: p1ResultsBefore } = await pool.query(
      'SELECT count(*) FROM map_result WHERE map_id IN (SELECT id FROM map WHERE match_id = $1)',
      [match1Id]
    );
    expect(parseInt(p1ResultsBefore[0].count, 10)).toBe(30);

    // Complete Match 2
    for (const mapId of seed.maps[1]) {
      await fillMapResults(seed.tournamentId, mapId, 2, seed);
    }
    await pool.query(
      `UPDATE match SET status = 'COMPLETED', started_at = now() - interval '2 hours', completed_at = now() - interval '1 hour' WHERE id = $1`,
      [match2Id]
    );

    // Get rankings with P1 + P2
    const { rows: ranksWithBoth } = await pool.query<{ total_points: string }>(
      `SELECT t.name, COALESCE(SUM(mr.points), 0)::text as total_points
       FROM team t
       JOIN participant p ON p.team_id = t.id
       JOIN map_result mr ON mr.participant_id = p.id
       WHERE t.tournament_id = $1
       GROUP BY t.id, t.name ORDER BY SUM(mr.points) DESC`,
      [seed.tournamentId]
    );
    const totalPtsBoth = ranksWithBoth.reduce((acc, r) => acc + parseInt(r.total_points, 10), 0);

    // Reset ONLY Match 2
    const res = await request(app)
      .post(`/api/matches/${match2Id}/reset`)
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // P1 must remain COMPLETED
    const { rows: [m1Db] } = await pool.query('SELECT status FROM match WHERE id = $1', [match1Id]);
    expect(m1Db.status).toBe('COMPLETED');

    // P1 results must still be 30
    const { rows: p1ResultsAfter } = await pool.query(
      'SELECT count(*) FROM map_result WHERE map_id IN (SELECT id FROM map WHERE match_id = $1)',
      [match1Id]
    );
    expect(parseInt(p1ResultsAfter[0].count, 10)).toBe(30);

    // P2 must be UPCOMING
    const { rows: [m2Db] } = await pool.query('SELECT status FROM match WHERE id = $1', [match2Id]);
    expect(m2Db.status).toBe('UPCOMING');

    // P2 results must be 0
    const { rows: p2ResultsAfter } = await pool.query(
      'SELECT count(*) FROM map_result WHERE map_id IN (SELECT id FROM map WHERE match_id = $1)',
      [match2Id]
    );
    expect(parseInt(p2ResultsAfter[0].count, 10)).toBe(0);

    // Rankings must now only reflect P1 points
    const { rows: ranksAfter } = await pool.query<{ total_points: string }>(
      `SELECT t.name, COALESCE(SUM(mr.points), 0)::text as total_points
       FROM team t
       JOIN participant p ON p.team_id = t.id
       JOIN map_result mr ON mr.participant_id = p.id
       WHERE t.tournament_id = $1
       GROUP BY t.id, t.name ORDER BY SUM(mr.points) DESC`,
      [seed.tournamentId]
    );
    const totalPtsAfter = ranksAfter.reduce((acc, r) => acc + parseInt(r.total_points, 10), 0);
    expect(totalPtsAfter).toBeLessThan(totalPtsBoth);

    // Snapshots: exactly 3 snapshots per team (for maps P1M1, P1M2, P1M3)
    const { rows: snapshotCount } = await pool.query(
      'SELECT count(*) FROM ranking_snapshot WHERE tournament_id = $1',
      [seed.tournamentId]
    );
    expect(parseInt(snapshotCount[0].count, 10)).toBe(3 * 5); // 3 maps * 5 teams
  });

  // ─── 9. ROLLBACK ON TRANSACTION FAILURE ───────────────────────────
  it('9. Rollback: simulated error in transaction leaves database in original state', async () => {
    const matchId = seed.matches[0];
    const mapId = seed.maps[0][0];

    // Mark match LIVE with results
    await pool.query(`UPDATE match SET status = 'LIVE', started_at = now() WHERE id = $1`, [matchId]);
    await pool.query(`UPDATE map SET status = 'ACTIVE', started_at = now() WHERE id = $1`, [mapId]);
    await fillMapResults(seed.tournamentId, mapId, 1, seed);

    const { rows: [resultsCountBefore] } = await pool.query(
      'SELECT count(*) FROM map_result WHERE map_id = $1',
      [mapId]
    );
    expect(parseInt(resultsCountBefore.count, 10)).toBe(10);

    // Create a temporary trigger on match that raises an exception on UPDATE
    await pool.query(`
      CREATE OR REPLACE FUNCTION trg_fail_func() RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Simulated failure for rollback test';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await pool.query(`
      CREATE TRIGGER trg_test_fail BEFORE UPDATE ON match
      FOR EACH ROW EXECUTE FUNCTION trg_fail_func();
    `);

    try {
      const res = await request(app)
        .post(`/api/matches/${matchId}/reset`)
        .set('Authorization', AUTH_HEADER);

      // Should have failed and thrown 500
      expect(res.status).toBe(500);
    } finally {
      // Clean up trigger
      await pool.query('DROP TRIGGER IF EXISTS trg_test_fail ON match;');
      await pool.query('DROP FUNCTION IF EXISTS trg_fail_func();');
    }

    // Verify rollback: map_result must still be 10, match still LIVE, map still ACTIVE
    const { rows: [resultsCountAfter] } = await pool.query(
      'SELECT count(*) FROM map_result WHERE map_id = $1',
      [mapId]
    );
    expect(parseInt(resultsCountAfter.count, 10)).toBe(10);

    const { rows: [mDb] } = await pool.query('SELECT status FROM match WHERE id = $1', [matchId]);
    expect(mDb.status).toBe('LIVE');

    const { rows: [mapDb] } = await pool.query('SELECT status FROM map WHERE id = $1', [mapId]);
    expect(mapDb.status).toBe('COMPLETED');
  });

  // ─── 10. AUTH RESET MATCH ─────────────────────────────────────────
  it('10. Auth RESET: 401 without token, 401 with wrong token, 200 with correct token', async () => {
    const matchId = seed.matches[3]; // Match 4 (UPCOMING)

    // No token
    const resNoToken = await request(app)
      .post(`/api/matches/${matchId}/reset`);
    expect(resNoToken.status).toBe(401);
    expect(resNoToken.body.error.code).toBe('UNAUTHORIZED');

    // Wrong token
    const resWrongToken = await request(app)
      .post(`/api/matches/${matchId}/reset`)
      .set('Authorization', 'Bearer invalid_secret');
    expect(resWrongToken.status).toBe(401);
    expect(resWrongToken.body.error.code).toBe('UNAUTHORIZED');

    // Correct token
    const resOk = await request(app)
      .post(`/api/matches/${matchId}/reset`)
      .set('Authorization', AUTH_HEADER);
    expect(resOk.status).toBe(200);
    expect(resOk.body.success).toBe(true);
  });
});
