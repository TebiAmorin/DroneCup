import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { pool } from '../../db/pool.js';
import { startMatch, confirmMapResults, resetMap } from '../stateMachine.js';
import { calculateTeamRankings } from '../ranking.js';
import * as emitter from '../../realtime/emitter.js';

vi.mock('../../realtime/emitter.js', () => ({
  setIO: vi.fn(),
  getIO: vi.fn(),
  emitCompetitionUpdated: vi.fn(),
  emitMatchStarted: vi.fn(),
  emitMatchCompleted: vi.fn(),
  emitMapStarted: vi.fn(),
  emitMapCompleted: vi.fn(),
  emitResultUpdated: vi.fn(),
  emitRankingUpdated: vi.fn(),
}));

const SCORING_TABLE: Record<number, number> = {
  1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
};

interface SeedData {
  tournamentId: string;
  teams: { id: string; slug: string }[];
  participants: Record<string, { creator: string; player1: string }>;
  matchId: string;
  maps: string[];
}

async function cleanSeed(): Promise<SeedData> {
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
      `INSERT INTO tournament (name, status) VALUES ('ResetMap Test', 'LIVE') RETURNING id`
    );
    const tid = t.id;

    const teamDefs = [
      { name: 'Alpha', slug: 'alpha', color: '#ff0000' },
      { name: 'Beta', slug: 'beta', color: '#00ff00' },
      { name: 'Gamma', slug: 'gamma', color: '#0000ff' },
      { name: 'Delta', slug: 'delta', color: '#ffff00' },
      { name: 'Epsilon', slug: 'epsilon', color: '#ff00ff' },
    ];

    const teams: SeedData['teams'] = [];
    const participants: SeedData['participants'] = {};

    for (const td of teamDefs) {
      const { rows: [team] } = await client.query(
        `INSERT INTO team (tournament_id, name, slug, color) VALUES ($1, $2, $3, $4) RETURNING id`,
        [tid, td.name, td.slug, td.color]
      );
      teams.push({ id: team.id, slug: td.slug });

      const { rows: [cr] } = await client.query(
        `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, 'CREATOR') RETURNING id`,
        [team.id, td.name, td.slug]
      );
      const { rows: [p1] } = await client.query(
        `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, 'PLAYER_1') RETURNING id`,
        [team.id, `${td.name}_P1`, `${td.slug}_p1`]
      );
      participants[td.slug] = { creator: cr.id, player1: p1.id };
    }

    const { rows: [m] } = await client.query(
      `INSERT INTO match (tournament_id, match_number, phase, status) VALUES ($1, 1, 'MAIN', 'UPCOMING') RETURNING id`,
      [tid]
    );

    const maps: string[] = [];
    for (let j = 1; j <= 3; j++) {
      const { rows: [mp] } = await client.query(
        `INSERT INTO map (match_id, map_index, code, status) VALUES ($1, $2, $3, 'PENDING') RETURNING id`,
        [m.id, j, `MAP${j}`]
      );
      maps.push(mp.id);
    }

    const slugs = Object.keys(participants);
    for (const slug of slugs) {
      const p = participants[slug];
      await client.query(`INSERT INTO match_participation (match_id, participant_id) VALUES ($1, $2)`, [m.id, p.creator]);
      await client.query(`INSERT INTO match_participation (match_id, participant_id) VALUES ($1, $2)`, [m.id, p.player1]);
    }

    await client.query('COMMIT');
    return { tournamentId: tid, teams, participants, matchId: m.id, maps };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function buildResults(seed: SeedData): { participantId: string; position: number; status: 'FINISHED' }[] {
  const slugs = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
  const results: { participantId: string; position: number; status: 'FINISHED' }[] = [];
  let pos = 1;
  for (const slug of slugs) {
    results.push({ participantId: seed.participants[slug].creator, position: pos++, status: 'FINISHED' });
    results.push({ participantId: seed.participants[slug].player1, position: pos++, status: 'FINISHED' });
  }
  return results;
}

describe('resetMap', () => {
  let seed: SeedData;

  beforeEach(async () => {
    seed = await cleanSeed();
    vi.clearAllMocks();
  });

  it('reset PENDING map is a noop', async () => {
    const result = await resetMap(seed.maps[0]);
    expect(result.success).toBe(true);
    expect(result.noop).toBe(true);
    expect(result.affectedMaps).toEqual([]);
  });

  it('reset ACTIVE map (middle) resets it and later maps', async () => {
    await startMatch(seed.matchId);
    await confirmMapResults(seed.maps[0], buildResults(seed));
    // Now: MAP1=COMPLETED, MAP2=ACTIVE, MAP3=PENDING

    const result = await resetMap(seed.maps[1]);
    expect(result.success).toBe(true);
    expect(result.noop).toBeUndefined();
    expect(result.affectedMaps).toHaveLength(2);
    expect(result.affectedMaps).toContain(seed.maps[1]);
    expect(result.affectedMaps).toContain(seed.maps[2]);
    expect(result.matchStatus).toBe('LIVE');

    // MAP1 should still be COMPLETED
    const { rows: [m1] } = await pool.query(`SELECT status FROM map WHERE id = $1`, [seed.maps[0]]);
    expect(m1.status).toBe('COMPLETED');

    // MAP2 should be ACTIVE (re-activated since MAP1 is completed)
    const { rows: [m2] } = await pool.query(`SELECT status FROM map WHERE id = $1`, [seed.maps[1]]);
    expect(m2.status).toBe('ACTIVE');

    // MAP3 should be PENDING
    const { rows: [m3] } = await pool.query(`SELECT status FROM map WHERE id = $1`, [seed.maps[2]]);
    expect(m3.status).toBe('PENDING');

    // MAP2 results should be deleted
    const { rows: m2results } = await pool.query(`SELECT * FROM map_result WHERE map_id = $1`, [seed.maps[1]]);
    expect(m2results).toHaveLength(0);

    // MAP1 results should remain
    const { rows: m1results } = await pool.query(`SELECT * FROM map_result WHERE map_id = $1`, [seed.maps[0]]);
    expect(m1results.length).toBeGreaterThan(0);

    // Tournament pointers should point to the reset map
    const { rows: [tour] } = await pool.query(`SELECT current_match_id, current_map_id FROM tournament WHERE id = $1`, [seed.tournamentId]);
    expect(tour.current_match_id).toBe(seed.matchId);
    expect(tour.current_map_id).toBe(seed.maps[1]);
  });

  it('reset COMPLETED map (middle) resets it and later maps', async () => {
    await startMatch(seed.matchId);
    await confirmMapResults(seed.maps[0], buildResults(seed));
    await confirmMapResults(seed.maps[1], buildResults(seed));
    await confirmMapResults(seed.maps[2], buildResults(seed));
    // Now: all COMPLETED, match COMPLETED

    const result = await resetMap(seed.maps[1]);
    expect(result.success).toBe(true);
    expect(result.matchStatus).toBe('LIVE');
    expect(result.affectedMaps).toHaveLength(2);

    const { rows: [m1] } = await pool.query(`SELECT status FROM map WHERE id = $1`, [seed.maps[0]]);
    expect(m1.status).toBe('COMPLETED');

    const { rows: [m2] } = await pool.query(`SELECT status FROM map WHERE id = $1`, [seed.maps[1]]);
    expect(m2.status).toBe('ACTIVE');

    const { rows: [m3] } = await pool.query(`SELECT status FROM map WHERE id = $1`, [seed.maps[2]]);
    expect(m3.status).toBe('PENDING');

    const { rows: [match] } = await pool.query(`SELECT status FROM match WHERE id = $1`, [seed.matchId]);
    expect(match.status).toBe('LIVE');

    // MAP1 results should remain, MAP2+MAP3 results deleted
    const { rows: m1r } = await pool.query(`SELECT * FROM map_result WHERE map_id = $1`, [seed.maps[0]]);
    expect(m1r.length).toBeGreaterThan(0);
    const { rows: m2r } = await pool.query(`SELECT * FROM map_result WHERE map_id = $1`, [seed.maps[1]]);
    expect(m2r).toHaveLength(0);
    const { rows: m3r } = await pool.query(`SELECT * FROM map_result WHERE map_id = $1`, [seed.maps[2]]);
    expect(m3r).toHaveLength(0);
  });

  it('reset first map resets all maps and match becomes UPCOMING', async () => {
    await startMatch(seed.matchId);
    await confirmMapResults(seed.maps[0], buildResults(seed));
    await confirmMapResults(seed.maps[1], buildResults(seed));
    await confirmMapResults(seed.maps[2], buildResults(seed));

    const result = await resetMap(seed.maps[0]);
    expect(result.success).toBe(true);
    expect(result.matchStatus).toBe('UPCOMING');
    expect(result.affectedMaps).toHaveLength(3);

    for (const mapId of seed.maps) {
      const { rows: [m] } = await pool.query(`SELECT status FROM map WHERE id = $1`, [mapId]);
      expect(m.status).toBe('PENDING');
      const { rows: results } = await pool.query(`SELECT * FROM map_result WHERE map_id = $1`, [mapId]);
      expect(results).toHaveLength(0);
    }

    const { rows: [match] } = await pool.query(`SELECT status, started_at FROM match WHERE id = $1`, [seed.matchId]);
    expect(match.status).toBe('UPCOMING');
    expect(match.started_at).toBeNull();

    // Tournament pointers cleared
    const { rows: [tour] } = await pool.query(`SELECT current_match_id, current_map_id FROM tournament WHERE id = $1`, [seed.tournamentId]);
    expect(tour.current_match_id).toBeNull();
    expect(tour.current_map_id).toBeNull();
  });

  it('ranking recalculates correctly after reset', async () => {
    await startMatch(seed.matchId);
    await confirmMapResults(seed.maps[0], buildResults(seed));
    await confirmMapResults(seed.maps[1], buildResults(seed));

    const rankingBefore = await calculateTeamRankings(seed.tournamentId);
    const topBefore = rankingBefore[0].totalPoints;

    await resetMap(seed.maps[1]);

    const rankingAfter = await calculateTeamRankings(seed.tournamentId);
    expect(rankingAfter[0].totalPoints).toBeLessThan(topBefore);
  });

  it('reset all maps clears ranking to 0', async () => {
    await startMatch(seed.matchId);
    await confirmMapResults(seed.maps[0], buildResults(seed));

    await resetMap(seed.maps[0]);

    const ranking = await calculateTeamRankings(seed.tournamentId);
    for (const team of ranking) {
      expect(team.totalPoints).toBe(0);
    }
  });

  it('emits ranking and competition events after reset', async () => {
    await startMatch(seed.matchId);
    await confirmMapResults(seed.maps[0], buildResults(seed));

    vi.clearAllMocks();
    await resetMap(seed.maps[0]);

    expect(emitter.emitRankingUpdated).toHaveBeenCalledTimes(1);
    expect(emitter.emitCompetitionUpdated).toHaveBeenCalledTimes(1);
  });

  it('rejects non-existent map with 404', async () => {
    await expect(resetMap('00000000-0000-0000-0000-000000000000')).rejects.toThrow('Map not found');
  });

  it('ranking snapshots are cleaned for affected maps', async () => {
    await startMatch(seed.matchId);
    await confirmMapResults(seed.maps[0], buildResults(seed));
    await confirmMapResults(seed.maps[1], buildResults(seed));

    const { rows: snapsBefore } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM ranking_snapshot WHERE tournament_id = $1`,
      [seed.tournamentId]
    );
    expect(snapsBefore[0].cnt).toBeGreaterThan(0);

    await resetMap(seed.maps[1]);

    // Should only have snapshots for MAP1 now
    const { rows: snapsAfter } = await pool.query(
      `SELECT DISTINCT map_id FROM ranking_snapshot WHERE tournament_id = $1`,
      [seed.tournamentId]
    );
    expect(snapsAfter).toHaveLength(1);
    expect(snapsAfter[0].map_id).toBe(seed.maps[0]);
  });
});
