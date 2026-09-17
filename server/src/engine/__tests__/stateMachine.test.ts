import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../../db/pool.js';
import { startMatch, confirmMapResults, correctMapResults } from '../stateMachine.js';
import { calculateTeamRankings } from '../ranking.js';

interface SeedData {
  tournamentId: string;
  teams: { id: string; slug: string }[];
  participants: Record<string, { creator: string; player1: string; player2: string }>;
  matches: string[];
  maps: string[][];
}

let seed: SeedData;

async function fullReset(): Promise<SeedData> {
  await pool.query('DELETE FROM ranking_snapshot');
  await pool.query('DELETE FROM map_result');
  await pool.query('DELETE FROM map');
  await pool.query('DELETE FROM match_participation');
  await pool.query('DELETE FROM match');
  await pool.query('DELETE FROM participant');
  await pool.query('DELETE FROM team');
  await pool.query('DELETE FROM tournament');

  const { rows: [t] } = await pool.query(
    `INSERT INTO tournament (name, status) VALUES ('Test Tournament', 'LIVE') RETURNING id`
  );

  const slugs = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
  const teams: { id: string; slug: string }[] = [];
  const participants: Record<string, { creator: string; player1: string; player2: string }> = {};

  for (const slug of slugs) {
    const { rows: [team] } = await pool.query(
      `INSERT INTO team (tournament_id, name, slug) VALUES ($1, $2, $3) RETURNING id`,
      [t.id, slug.charAt(0).toUpperCase() + slug.slice(1), slug]
    );
    teams.push({ id: team.id, slug });

    const { rows: [c] } = await pool.query(
      `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, 'CREATOR') RETURNING id`,
      [team.id, `${slug}_creator`, `${slug}_creator`]
    );
    const { rows: [p1] } = await pool.query(
      `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, 'PLAYER_1') RETURNING id`,
      [team.id, `${slug}_p1`, `${slug}_p1`]
    );
    const { rows: [p2] } = await pool.query(
      `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, 'PLAYER_2') RETURNING id`,
      [team.id, `${slug}_p2`, `${slug}_p2`]
    );
    participants[slug] = { creator: c.id, player1: p1.id, player2: p2.id };
  }

  const matches: string[] = [];
  const maps: string[][] = [];

  for (let i = 1; i <= 4; i++) {
    const { rows: [m] } = await pool.query(
      `INSERT INTO match (tournament_id, match_number, phase, status) VALUES ($1, $2, 'MAIN', 'UPCOMING') RETURNING id`,
      [t.id, i]
    );
    matches.push(m.id);

    const matchMaps: string[] = [];
    for (let j = 1; j <= 3; j++) {
      const { rows: [mp] } = await pool.query(
        `INSERT INTO map (match_id, map_index, code, status) VALUES ($1, $2, $3, 'PENDING') RETURNING id`,
        [m.id, j, `P${i}M${j}`]
      );
      matchMaps.push(mp.id);
    }
    maps.push(matchMaps);

    for (const slug of slugs) {
      const p = participants[slug];
      await pool.query(
        `INSERT INTO match_participation (match_id, participant_id) VALUES ($1, $2)`,
        [m.id, p.creator]
      );
      await pool.query(
        `INSERT INTO match_participation (match_id, participant_id) VALUES ($1, $2)`,
        [m.id, i <= 2 ? p.player1 : p.player2]
      );
    }
  }

  return { tournamentId: t.id, teams, participants, matches, maps };
}

function buildResults(s: SeedData, matchIndex: number) {
  const slugs = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
  const results: { participantId: string; position: number; status: 'FINISHED' }[] = [];
  let pos = 1;
  for (const slug of slugs) {
    results.push({ participantId: s.participants[slug].creator, position: pos++, status: 'FINISHED' });
    const partner = matchIndex < 2 ? s.participants[slug].player1 : s.participants[slug].player2;
    results.push({ participantId: partner, position: pos++, status: 'FINISHED' });
  }
  return results;
}

beforeAll(async () => {
  seed = await fullReset();
});

afterAll(async () => {
  await pool.end();
});

describe('Start Match', () => {
  beforeEach(async () => {
    seed = await fullReset();
  });

  it('starts an UPCOMING match, sets it LIVE, activates Map 1', async () => {
    const result = await startMatch(seed.matches[0]);
    expect(result.matchId).toBe(seed.matches[0]);

    const { rows: [match] } = await pool.query(`SELECT status FROM match WHERE id = $1`, [seed.matches[0]]);
    expect(match.status).toBe('LIVE');

    const { rows: mapRows } = await pool.query(`SELECT status, map_index FROM map WHERE match_id = $1 ORDER BY map_index`, [seed.matches[0]]);
    expect(mapRows[0].status).toBe('ACTIVE');
    expect(mapRows[1].status).toBe('PENDING');
    expect(mapRows[2].status).toBe('PENDING');

    const { rows: [tournament] } = await pool.query(`SELECT current_match_id, current_map_id FROM tournament WHERE id = $1`, [seed.tournamentId]);
    expect(tournament.current_match_id).toBe(seed.matches[0]);
    expect(tournament.current_map_id).toBe(seed.maps[0][0]);
  });

  it('rejects starting a LIVE match', async () => {
    await startMatch(seed.matches[0]);
    await expect(startMatch(seed.matches[0])).rejects.toThrow(/LIVE/);
  });

  it('rejects starting a match when another is LIVE', async () => {
    await startMatch(seed.matches[0]);
    await expect(startMatch(seed.matches[1])).rejects.toThrow(/already LIVE/);
  });

  it('rejects starting a nonexistent match', async () => {
    await expect(startMatch('00000000-0000-0000-0000-000000000000')).rejects.toThrow(/not found/);
  });
});

describe('Map Flow', () => {
  beforeEach(async () => {
    seed = await fullReset();
  });

  it('confirming Map 1 activates Map 2', async () => {
    await startMatch(seed.matches[0]);
    await confirmMapResults(seed.maps[0][0], buildResults(seed, 0));

    const { rows: mapRows } = await pool.query(`SELECT status, map_index FROM map WHERE match_id = $1 ORDER BY map_index`, [seed.matches[0]]);
    expect(mapRows[0].status).toBe('COMPLETED');
    expect(mapRows[1].status).toBe('ACTIVE');
    expect(mapRows[2].status).toBe('PENDING');
  });

  it('confirming Map 2 activates Map 3', async () => {
    await startMatch(seed.matches[0]);
    await confirmMapResults(seed.maps[0][0], buildResults(seed, 0));
    await confirmMapResults(seed.maps[0][1], buildResults(seed, 0));

    const { rows: mapRows } = await pool.query(`SELECT status, map_index FROM map WHERE match_id = $1 ORDER BY map_index`, [seed.matches[0]]);
    expect(mapRows[0].status).toBe('COMPLETED');
    expect(mapRows[1].status).toBe('COMPLETED');
    expect(mapRows[2].status).toBe('ACTIVE');
  });

  it('confirming Map 3 completes the match', async () => {
    await startMatch(seed.matches[0]);
    await confirmMapResults(seed.maps[0][0], buildResults(seed, 0));
    await confirmMapResults(seed.maps[0][1], buildResults(seed, 0));
    const result = await confirmMapResults(seed.maps[0][2], buildResults(seed, 0));

    expect(result.matchCompleted).toBe(true);

    const { rows: [match] } = await pool.query(`SELECT status FROM match WHERE id = $1`, [seed.matches[0]]);
    expect(match.status).toBe('COMPLETED');
  });

  it('next match stays UPCOMING after completing current', async () => {
    await startMatch(seed.matches[0]);
    await confirmMapResults(seed.maps[0][0], buildResults(seed, 0));
    await confirmMapResults(seed.maps[0][1], buildResults(seed, 0));
    await confirmMapResults(seed.maps[0][2], buildResults(seed, 0));

    const { rows: [next] } = await pool.query(`SELECT status FROM match WHERE id = $1`, [seed.matches[1]]);
    expect(next.status).toBe('UPCOMING');
  });

  it('tournament pointers are cleared after match completion', async () => {
    await startMatch(seed.matches[0]);
    await confirmMapResults(seed.maps[0][0], buildResults(seed, 0));
    await confirmMapResults(seed.maps[0][1], buildResults(seed, 0));
    await confirmMapResults(seed.maps[0][2], buildResults(seed, 0));

    const { rows: [t] } = await pool.query(`SELECT current_match_id, current_map_id FROM tournament WHERE id = $1`, [seed.tournamentId]);
    expect(t.current_match_id).toBeNull();
    expect(t.current_map_id).toBeNull();
  });

  it('tournament current_map_id updates after each map', async () => {
    await startMatch(seed.matches[0]);

    let { rows: [t] } = await pool.query(`SELECT current_map_id FROM tournament WHERE id = $1`, [seed.tournamentId]);
    expect(t.current_map_id).toBe(seed.maps[0][0]);

    await confirmMapResults(seed.maps[0][0], buildResults(seed, 0));
    ({ rows: [t] } = await pool.query(`SELECT current_map_id FROM tournament WHERE id = $1`, [seed.tournamentId]));
    expect(t.current_map_id).toBe(seed.maps[0][1]);

    await confirmMapResults(seed.maps[0][1], buildResults(seed, 0));
    ({ rows: [t] } = await pool.query(`SELECT current_map_id FROM tournament WHERE id = $1`, [seed.tournamentId]));
    expect(t.current_map_id).toBe(seed.maps[0][2]);
  });
});

describe('Result Validation via State Machine', () => {
  beforeEach(async () => {
    seed = await fullReset();
  });

  it('accepts valid results for 10 participants', async () => {
    await startMatch(seed.matches[0]);
    const result = await confirmMapResults(seed.maps[0][0], buildResults(seed, 0));
    expect(result.ranked).toHaveLength(5);
  });

  it('accepts multiple DNFs', async () => {
    await startMatch(seed.matches[0]);
    const results = buildResults(seed, 0);
    // Make last 3 participants DNF
    for (let i = 7; i < 10; i++) {
      (results[i] as any).position = null;
      (results[i] as any).status = 'DNF';
    }
    // Reassign positions 1-7 for finished
    let pos = 1;
    for (let i = 0; i < 7; i++) {
      results[i].position = pos++;
    }

    const result = await confirmMapResults(seed.maps[0][0], results);
    expect(result.ranked).toHaveLength(5);
  });

  it('rejects ineligible participant', async () => {
    await startMatch(seed.matches[0]);
    const results = buildResults(seed, 0);
    // Replace a participant with player2 who is not in match 1
    results[0].participantId = seed.participants['alpha'].player2;
    await expect(confirmMapResults(seed.maps[0][0], results)).rejects.toThrow(/not eligible/);
  });

  it('rejects duplicate participant', async () => {
    await startMatch(seed.matches[0]);
    const results = buildResults(seed, 0);
    results[1].participantId = results[0].participantId;
    await expect(confirmMapResults(seed.maps[0][0], results)).rejects.toThrow(/Duplicate/);
  });

  it('rejects duplicate position', async () => {
    await startMatch(seed.matches[0]);
    const results = buildResults(seed, 0);
    results[1].position = 1;
    await expect(confirmMapResults(seed.maps[0][0], results)).rejects.toThrow(/Duplicate/);
  });

  it('rejects invalid position (0)', async () => {
    await startMatch(seed.matches[0]);
    const results = buildResults(seed, 0);
    results[0].position = 0;
    await expect(confirmMapResults(seed.maps[0][0], results)).rejects.toThrow(/Invalid position/);
  });

  it('rejects invalid position (11)', async () => {
    await startMatch(seed.matches[0]);
    const results = buildResults(seed, 0);
    results[0].position = 11;
    await expect(confirmMapResults(seed.maps[0][0], results)).rejects.toThrow(/Invalid position/);
  });

  it('rejects confirming a PENDING map', async () => {
    await startMatch(seed.matches[0]);
    // Map 2 is still PENDING
    await expect(confirmMapResults(seed.maps[0][1], buildResults(seed, 0))).rejects.toThrow(/PENDING/);
  });

  it('rejects confirming when match is not LIVE (map is PENDING)', async () => {
    // Don't start the match — map stays PENDING
    await expect(confirmMapResults(seed.maps[0][0], buildResults(seed, 0))).rejects.toThrow(/PENDING/);
  });

  it('does not leave partial state on validation failure', async () => {
    await startMatch(seed.matches[0]);
    const results = buildResults(seed, 0);
    results[0].position = 0; // Invalid

    try {
      await confirmMapResults(seed.maps[0][0], results);
    } catch (_e) { /* expected */ }

    // Map should still be ACTIVE
    const { rows: [map] } = await pool.query(`SELECT status FROM map WHERE id = $1`, [seed.maps[0][0]]);
    expect(map.status).toBe('ACTIVE');

    // No results should be saved
    const { rows: mapResults } = await pool.query(`SELECT * FROM map_result WHERE map_id = $1`, [seed.maps[0][0]]);
    expect(mapResults).toHaveLength(0);
  });
});

describe('Result Corrections', () => {
  beforeEach(async () => {
    seed = await fullReset();
  });

  it('corrects results of a completed map', async () => {
    await startMatch(seed.matches[0]);
    await confirmMapResults(seed.maps[0][0], buildResults(seed, 0));

    // Correct: swap positions of alpha creator (1st→2nd) and beta creator (3rd→1st)
    const corrected = buildResults(seed, 0);
    corrected[0].position = 3; // alpha creator was 1st, now 3rd
    corrected[2].position = 1; // beta creator was 3rd, now 1st

    const result = await correctMapResults(seed.maps[0][0], corrected);
    expect(result.ranked).toHaveLength(5);

    // Verify beta team now has more points
    const beta = result.ranked.find(r => r.teamSlug === 'beta')!;
    const alpha = result.ranked.find(r => r.teamSlug === 'alpha')!;
    expect(beta.totalPoints).toBeGreaterThan(alpha.totalPoints);
  });

  it('rejects correcting a non-completed map', async () => {
    await startMatch(seed.matches[0]);
    await expect(correctMapResults(seed.maps[0][0], buildResults(seed, 0))).rejects.toThrow(/COMPLETED/);
  });

  it('recalculates snapshots after correction', async () => {
    await startMatch(seed.matches[0]);
    await confirmMapResults(seed.maps[0][0], buildResults(seed, 0));
    await confirmMapResults(seed.maps[0][1], buildResults(seed, 0));

    // Check original snapshots
    const { rows: beforeRows } = await pool.query(
      `SELECT total_points FROM ranking_snapshot WHERE map_id = $1 ORDER BY rank LIMIT 1`,
      [seed.maps[0][0]]
    );
    const pointsBefore = beforeRows[0].total_points;

    // Correct map 1 results - alpha creator DNF
    const corrected = buildResults(seed, 0);
    (corrected[0] as any).position = null;
    (corrected[0] as any).status = 'DNF';
    // Shift remaining positions
    for (let i = 1; i < 10; i++) {
      corrected[i].position = i;
    }

    await correctMapResults(seed.maps[0][0], corrected);

    // Snapshots should be recalculated
    const { rows: afterRows } = await pool.query(
      `SELECT total_points FROM ranking_snapshot WHERE map_id = $1 ORDER BY rank LIMIT 1`,
      [seed.maps[0][0]]
    );
    expect(afterRows[0].total_points).not.toBe(pointsBefore);
  });
});

describe('Full Match Flow', () => {
  beforeEach(async () => {
    seed = await fullReset();
  });

  it('runs Match 1 completely: start → 3 maps → completed', async () => {
    await startMatch(seed.matches[0]);

    // Map 1
    const r1 = await confirmMapResults(seed.maps[0][0], buildResults(seed, 0));
    expect(r1.matchCompleted).toBe(false);

    // Map 2
    const r2 = await confirmMapResults(seed.maps[0][1], buildResults(seed, 0));
    expect(r2.matchCompleted).toBe(false);

    // Map 3
    const r3 = await confirmMapResults(seed.maps[0][2], buildResults(seed, 0));
    expect(r3.matchCompleted).toBe(true);

    // Match 1 completed
    const { rows: [m1] } = await pool.query(`SELECT status FROM match WHERE id = $1`, [seed.matches[0]]);
    expect(m1.status).toBe('COMPLETED');

    // Match 2 still UPCOMING
    const { rows: [m2] } = await pool.query(`SELECT status FROM match WHERE id = $1`, [seed.matches[1]]);
    expect(m2.status).toBe('UPCOMING');

    // 3 snapshots exist
    const { rows: snapshots } = await pool.query(
      `SELECT * FROM ranking_snapshot WHERE tournament_id = $1`,
      [seed.tournamentId]
    );
    expect(snapshots.length).toBe(15); // 3 maps × 5 teams

    // Rankings are consistent
    const ranked = await calculateTeamRankings(seed.tournamentId);
    expect(ranked[0].totalPoints).toBeGreaterThan(0);
    expect(ranked[0].rank).toBe(1);
  });
});
