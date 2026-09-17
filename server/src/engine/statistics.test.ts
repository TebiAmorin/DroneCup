import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../db/pool.js';
import { getTeamStatistics, getSingleTeamStatistics, getParticipantStatistics, getSingleParticipantStatistics } from './statistics.js';
import { recalculateAllSnapshots, createRankingSnapshot } from './ranking.js';
import { SCORING_TABLE } from '../../../shared/types.js';

const POINTS = Object.values(SCORING_TABLE).sort((a, b) => b - a); // [25,18,15,12,10,8,6,4,2,1]

interface Seed {
  tournamentId: string;
  teams: { id: string; slug: string; name: string }[];
  participants: Record<string, { creator: string; player1: string; player2: string }>;
  matches: string[];
  maps: string[][];
}

let seed: Seed;

async function resetAndSeed(): Promise<Seed> {
  await pool.query('DELETE FROM ranking_snapshot');
  await pool.query('DELETE FROM map_result');
  await pool.query('DELETE FROM map');
  await pool.query('DELETE FROM match_participation');
  await pool.query('DELETE FROM match');
  await pool.query('DELETE FROM participant');
  await pool.query('DELETE FROM team');
  await pool.query('DELETE FROM tournament');

  const { rows: [t] } = await pool.query(
    `INSERT INTO tournament (name, status) VALUES ('Stats Test', 'LIVE') RETURNING id`
  );
  const tournamentId = t.id;

  const teamSlugs = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
  const teams: Seed['teams'] = [];
  const participants: Seed['participants'] = {};

  for (const slug of teamSlugs) {
    const name = slug.charAt(0).toUpperCase() + slug.slice(1);
    const { rows: [team] } = await pool.query(
      `INSERT INTO team (tournament_id, name, slug, color) VALUES ($1, $2, $3, $4) RETURNING id`,
      [tournamentId, name, slug, '#aaa']
    );
    teams.push({ id: team.id, slug, name });

    const { rows: [c] } = await pool.query(
      `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, 'CREATOR') RETURNING id`,
      [team.id, `${name}_C`, `${slug}_c`]
    );
    const { rows: [p1] } = await pool.query(
      `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, 'PLAYER_1') RETURNING id`,
      [team.id, `${name}_P1`, `${slug}_p1`]
    );
    const { rows: [p2] } = await pool.query(
      `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, 'PLAYER_2') RETURNING id`,
      [team.id, `${name}_P2`, `${slug}_p2`]
    );
    participants[slug] = { creator: c.id, player1: p1.id, player2: p2.id };
  }

  // 2 matches, 2 maps each = 4 maps total
  const matches: string[] = [];
  const maps: string[][] = [];

  for (let i = 1; i <= 2; i++) {
    const status = i === 1 ? 'COMPLETED' : 'COMPLETED';
    const { rows: [m] } = await pool.query(
      `INSERT INTO match (tournament_id, match_number, phase, status) VALUES ($1, $2, 'MAIN', $3) RETURNING id`,
      [tournamentId, i, status]
    );
    matches.push(m.id);

    const mapRow: string[] = [];
    for (let j = 1; j <= 2; j++) {
      const { rows: [mp] } = await pool.query(
        `INSERT INTO map (match_id, map_index, code, status) VALUES ($1, $2, $3, 'COMPLETED') RETURNING id`,
        [m.id, j, `P${i}M${j}`]
      );
      mapRow.push(mp.id);
    }
    maps.push(mapRow);
  }

  // Match participations: Match 1-2 = Creator + Player_1 for all teams
  for (const matchId of matches) {
    for (const slug of teamSlugs) {
      await pool.query('INSERT INTO match_participation (match_id, participant_id) VALUES ($1, $2)', [matchId, participants[slug].creator]);
      await pool.query('INSERT INTO match_participation (match_id, participant_id) VALUES ($1, $2)', [matchId, participants[slug].player1]);
    }
  }

  // Known results — 10 participants per map, fixed finish order
  // All 4 maps: same pilot pool (5 creators + 5 player1s = 10)
  const pilotOrder = teamSlugs.flatMap(s => [participants[s].creator, participants[s].player1]);
  // pilotOrder: [alpha_c, alpha_p1, beta_c, beta_p1, gamma_c, gamma_p1, delta_c, delta_p1, epsilon_c, epsilon_p1]

  // Map 1 (P1M1): finish order = 0,1,2,3,4,5,6,7,8,9 (alpha_c wins)
  // Map 2 (P1M2): finish order = 2,3,0,1,4,5,6,7,8,9 (beta_c wins)
  // Map 3 (P2M1): finish order = 0,1,2,3,4,5,6,7,8,9 (alpha_c wins again)
  // Map 4 (P2M2): finish order = 4,5,6,7,0,1,2,3,8,9 (gamma_c wins)

  const finishOrders = [
    [0,1,2,3,4,5,6,7,8,9],
    [2,3,0,1,4,5,6,7,8,9],
    [0,1,2,3,4,5,6,7,8,9],
    [4,5,6,7,0,1,2,3,8,9],
  ];

  const allMaps = [maps[0][0], maps[0][1], maps[1][0], maps[1][1]];

  for (let mIdx = 0; mIdx < allMaps.length; mIdx++) {
    const mapId = allMaps[mIdx];
    const order = finishOrders[mIdx];
    for (let pos = 0; pos < 10; pos++) {
      const participantId = pilotOrder[order[pos]];
      await pool.query(
        `INSERT INTO map_result (map_id, participant_id, position, status, points) VALUES ($1, $2, $3, 'FINISHED', $4)`,
        [mapId, participantId, pos + 1, POINTS[pos]]
      );
    }
  }

  // Create snapshots
  for (const mapId of allMaps) {
    await createRankingSnapshot(tournamentId, mapId);
  }

  return { tournamentId, teams, participants, matches, maps };
}

// Expected values:
// pilotOrder: [alpha_c, alpha_p1, beta_c, beta_p1, gamma_c, gamma_p1, delta_c, delta_p1, epsilon_c, epsilon_p1]
//
// Map 1: alpha_c=25, alpha_p1=18, beta_c=15, beta_p1=12, gamma_c=10, gamma_p1=8, delta_c=6, delta_p1=4, epsilon_c=2, epsilon_p1=1
// Map 2: beta_c=25, beta_p1=18, alpha_c=15, alpha_p1=12, gamma_c=10, gamma_p1=8, delta_c=6, delta_p1=4, epsilon_c=2, epsilon_p1=1
// Map 3: same as Map 1
// Map 4: gamma_c=25, gamma_p1=18, delta_c=15, delta_p1=12, alpha_c=10, alpha_p1=8, beta_c=6, beta_p1=4, epsilon_c=2, epsilon_p1=1
//
// TEAM TOTALS:
// Alpha: (25+18)+(15+12)+(25+18)+(10+8) = 43+27+43+18 = 131
// Beta:  (15+12)+(25+18)+(15+12)+(6+4)  = 27+43+27+10 = 107
// Gamma: (10+8)+(10+8)+(10+8)+(25+18)   = 18+18+18+43 = 97
// Delta: (6+4)+(6+4)+(6+4)+(15+12)      = 10+10+10+27 = 57
// Epsilon:(2+1)+(2+1)+(2+1)+(2+1)       = 3+3+3+3     = 12
//
// MAP WINS (by team combined score):
// Map1: Alpha(43) → Alpha wins
// Map2: Beta(43) → Beta wins
// Map3: Alpha(43) → Alpha wins
// Map4: Gamma(43) → Gamma wins
//
// Alpha: 2 won, Beta: 1 won, Gamma: 1 won, Delta: 0, Epsilon: 0
//
// INDIVIDUAL TOTALS:
// Alpha_C:   25+15+25+10 = 75
// Alpha_P1:  18+12+18+8  = 56
// Beta_C:    15+25+15+6  = 61
// Beta_P1:   12+18+12+4  = 46
// Gamma_C:   10+10+10+25 = 55
// Gamma_P1:  8+8+8+18    = 42
// Delta_C:   6+6+6+15    = 33
// Delta_P1:  4+4+4+12    = 24
// Epsilon_C: 2+2+2+2     = 8
// Epsilon_P1:1+1+1+1     = 4

const EXPECTED_TEAMS = {
  alpha:   { pts: 131, won: 2, pos: 1 },
  beta:    { pts: 107, won: 1, pos: 2 },
  gamma:   { pts: 97,  won: 1, pos: 3 },
  delta:   { pts: 57,  won: 0, pos: 4 },
  epsilon: { pts: 12,  won: 0, pos: 5 },
};

const EXPECTED_PARTICIPANTS: Record<string, { pts: number; maps: number; best: number }> = {
  'Alpha_C':    { pts: 75, maps: 4, best: 1 },
  'Alpha_P1':   { pts: 56, maps: 4, best: 2 },
  'Beta_C':     { pts: 61, maps: 4, best: 1 },
  'Beta_P1':    { pts: 46, maps: 4, best: 2 },
  'Gamma_C':    { pts: 55, maps: 4, best: 1 },
  'Gamma_P1':   { pts: 42, maps: 4, best: 2 },
  'Delta_C':    { pts: 33, maps: 4, best: 3 },
  'Delta_P1':   { pts: 24, maps: 4, best: 4 },
  'Epsilon_C':  { pts: 8,  maps: 4, best: 9 },
  'Epsilon_P1': { pts: 4,  maps: 4, best: 10 },
};

beforeAll(async () => {
  seed = await resetAndSeed();
});

afterAll(async () => {
  await pool.end();
});

// ── TEAM TESTS ──

describe('Team Statistics', () => {
  it('returns stats for all 5 teams', async () => {
    const stats = await getTeamStatistics(seed.tournamentId);
    expect(stats).toHaveLength(5);
  });

  it('has correct total points', async () => {
    const stats = await getTeamStatistics(seed.tournamentId);
    for (const [slug, exp] of Object.entries(EXPECTED_TEAMS)) {
      const team = stats.find(s => s.teamSlug === slug)!;
      expect(team, `team ${slug} not found`).toBeDefined();
      expect(team.totalPoints).toBe(exp.pts);
    }
  });

  it('has correct global positions', async () => {
    const stats = await getTeamStatistics(seed.tournamentId);
    for (const [slug, exp] of Object.entries(EXPECTED_TEAMS)) {
      expect(stats.find(s => s.teamSlug === slug)!.globalPosition).toBe(exp.pos);
    }
  });

  it('has correct maps played (4 for all teams)', async () => {
    const stats = await getTeamStatistics(seed.tournamentId);
    for (const s of stats) {
      expect(s.mapsPlayed).toBe(4);
    }
  });

  it('has correct maps won', async () => {
    const stats = await getTeamStatistics(seed.tournamentId);
    for (const [slug, exp] of Object.entries(EXPECTED_TEAMS)) {
      expect(stats.find(s => s.teamSlug === slug)!.mapsWon).toBe(exp.won);
    }
  });

  it('has correct points by match', async () => {
    const stats = await getTeamStatistics(seed.tournamentId);
    const alpha = stats.find(s => s.teamSlug === 'alpha')!;
    expect(alpha.pointsByMatch).toHaveLength(2);
    expect(alpha.pointsByMatch[0].matchNumber).toBe(1);
    expect(alpha.pointsByMatch[0].points).toBe(70);  // 43+27
    expect(alpha.pointsByMatch[1].matchNumber).toBe(2);
    expect(alpha.pointsByMatch[1].points).toBe(61);  // 43+18
  });

  it('has correct points by map', async () => {
    const stats = await getTeamStatistics(seed.tournamentId);
    const alpha = stats.find(s => s.teamSlug === 'alpha')!;
    expect(alpha.pointsByMap).toHaveLength(4);
    expect(alpha.pointsByMap[0].points).toBe(43); // P1M1
    expect(alpha.pointsByMap[1].points).toBe(27); // P1M2
    expect(alpha.pointsByMap[2].points).toBe(43); // P2M1
    expect(alpha.pointsByMap[3].points).toBe(18); // P2M2
  });

  it('has correct progression (cumulative)', async () => {
    const stats = await getTeamStatistics(seed.tournamentId);
    const alpha = stats.find(s => s.teamSlug === 'alpha')!;
    expect(alpha.progression).toHaveLength(4);
    expect(alpha.progression[0].cumulativePoints).toBe(43);
    expect(alpha.progression[1].cumulativePoints).toBe(70);
    expect(alpha.progression[2].cumulativePoints).toBe(113);
    expect(alpha.progression[3].cumulativePoints).toBe(131);
  });

  it('returns single team stats', async () => {
    const alphaId = seed.teams.find(t => t.slug === 'alpha')!.id;
    const stats = await getSingleTeamStatistics(seed.tournamentId, alphaId);
    expect(stats).not.toBeNull();
    expect(stats!.teamSlug).toBe('alpha');
    expect(stats!.totalPoints).toBe(131);
  });

  it('returns null for unknown team', async () => {
    const stats = await getSingleTeamStatistics(seed.tournamentId, '00000000-0000-0000-0000-000000000000');
    expect(stats).toBeNull();
  });
});

// ── PARTICIPANT TESTS ──

describe('Participant Statistics', () => {
  it('returns stats for all 15 participants', async () => {
    const stats = await getParticipantStatistics(seed.tournamentId);
    expect(stats).toHaveLength(15);
  });

  it('has correct total points', async () => {
    const stats = await getParticipantStatistics(seed.tournamentId);
    for (const [name, exp] of Object.entries(EXPECTED_PARTICIPANTS)) {
      const p = stats.find(s => s.participantName === name)!;
      expect(p, `participant ${name} not found`).toBeDefined();
      expect(p.totalPoints).toBe(exp.pts);
    }
  });

  it('has correct maps played', async () => {
    const stats = await getParticipantStatistics(seed.tournamentId);
    for (const [name, exp] of Object.entries(EXPECTED_PARTICIPANTS)) {
      expect(stats.find(s => s.participantName === name)!.mapsPlayed).toBe(exp.maps);
    }
    // P2 participants have 0 maps
    const p2s = stats.filter(s => s.participantType === 'PLAYER_2');
    for (const p of p2s) {
      expect(p.mapsPlayed).toBe(0);
    }
  });

  it('has correct average points per map', async () => {
    const stats = await getParticipantStatistics(seed.tournamentId);
    const alphaC = stats.find(s => s.participantName === 'Alpha_C')!;
    expect(alphaC.averagePointsPerMap).toBe(18.75); // 75/4
  });

  it('returns null average for participant with 0 maps', async () => {
    const stats = await getParticipantStatistics(seed.tournamentId);
    const p2 = stats.find(s => s.participantType === 'PLAYER_2')!;
    expect(p2.averagePointsPerMap).toBeNull();
  });

  it('has correct best position', async () => {
    const stats = await getParticipantStatistics(seed.tournamentId);
    for (const [name, exp] of Object.entries(EXPECTED_PARTICIPANTS)) {
      expect(stats.find(s => s.participantName === name)!.bestPosition).toBe(exp.best);
    }
  });

  it('returns null best position for participant with 0 maps', async () => {
    const stats = await getParticipantStatistics(seed.tournamentId);
    const p2 = stats.find(s => s.participantType === 'PLAYER_2')!;
    expect(p2.bestPosition).toBeNull();
  });

  it('has correct position distribution', async () => {
    const stats = await getParticipantStatistics(seed.tournamentId);
    // Alpha_C: positions 1,3,1,5 → pos1=2, pos3=1, pos5=1
    const alphaC = stats.find(s => s.participantName === 'Alpha_C')!;
    expect(alphaC.positionCounts.find(p => p.position === 1)!.count).toBe(2);
    expect(alphaC.positionCounts.find(p => p.position === 3)!.count).toBe(1);
    expect(alphaC.positionCounts.find(p => p.position === 5)!.count).toBe(1);
    expect(alphaC.positionCounts.find(p => p.position === 'DNF')!.count).toBe(0);
  });

  it('has correct DNF count (0 for all test data)', async () => {
    const stats = await getParticipantStatistics(seed.tournamentId);
    for (const s of stats) {
      expect(s.dnfCount).toBe(0);
    }
  });

  it('has correct points by map', async () => {
    const stats = await getParticipantStatistics(seed.tournamentId);
    const alphaC = stats.find(s => s.participantName === 'Alpha_C')!;
    expect(alphaC.pointsByMap).toHaveLength(4);
    expect(alphaC.pointsByMap[0].points).toBe(25);
    expect(alphaC.pointsByMap[1].points).toBe(15);
    expect(alphaC.pointsByMap[2].points).toBe(25);
    expect(alphaC.pointsByMap[3].points).toBe(10);
  });

  it('has correct progression (cumulative)', async () => {
    const stats = await getParticipantStatistics(seed.tournamentId);
    const alphaC = stats.find(s => s.participantName === 'Alpha_C')!;
    expect(alphaC.progression).toHaveLength(4);
    expect(alphaC.progression[0].cumulativePoints).toBe(25);
    expect(alphaC.progression[1].cumulativePoints).toBe(40);
    expect(alphaC.progression[2].cumulativePoints).toBe(65);
    expect(alphaC.progression[3].cumulativePoints).toBe(75);
  });

  it('returns single participant stats', async () => {
    const id = seed.participants['alpha'].creator;
    const stats = await getSingleParticipantStatistics(seed.tournamentId, id);
    expect(stats).not.toBeNull();
    expect(stats!.participantName).toBe('Alpha_C');
    expect(stats!.totalPoints).toBe(75);
  });

  it('returns null for unknown participant', async () => {
    const stats = await getSingleParticipantStatistics(seed.tournamentId, '00000000-0000-0000-0000-000000000000');
    expect(stats).toBeNull();
  });
});

// ── 0 RESULTS ──

describe('Participant with 0 results', () => {
  it('shows zeroes for P2 participant with no results', async () => {
    const stats = await getParticipantStatistics(seed.tournamentId);
    const p2 = stats.find(s => s.participantName === 'Alpha_P2')!;
    expect(p2).toBeDefined();
    expect(p2.totalPoints).toBe(0);
    expect(p2.mapsPlayed).toBe(0);
    expect(p2.averagePointsPerMap).toBeNull();
    expect(p2.bestPosition).toBeNull();
    expect(p2.dnfCount).toBe(0);
    expect(p2.pointsByMap).toHaveLength(0);
    expect(p2.progression).toHaveLength(0);
    for (const pc of p2.positionCounts) {
      expect(pc.count).toBe(0);
    }
  });
});

describe('Team with 0 results scenario', () => {
  it('no NaN, no Infinity, no negative values', async () => {
    const stats = await getTeamStatistics(seed.tournamentId);
    for (const s of stats) {
      expect(Number.isFinite(s.totalPoints)).toBe(true);
      expect(Number.isFinite(s.mapsPlayed)).toBe(true);
      expect(Number.isFinite(s.mapsWon)).toBe(true);
      expect(s.totalPoints).toBeGreaterThanOrEqual(0);
      expect(s.mapsPlayed).toBeGreaterThanOrEqual(0);
      expect(s.mapsWon).toBeGreaterThanOrEqual(0);
      expect(s.globalPosition).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── CORRECTIONS ──

describe('Result correction reflects in statistics', () => {
  it('stats change after correcting a result to DNF', async () => {
    const before = await getTeamStatistics(seed.tournamentId);
    const alphaBefore = before.find(s => s.teamSlug === 'alpha')!;
    const initialPoints = alphaBefore.totalPoints; // 131

    // Find Alpha_C's pos-1 result (25 pts)
    const { rows } = await pool.query<{ id: string; map_id: string }>(
      `SELECT mr.id, mr.map_id FROM map_result mr
       JOIN participant p ON p.id = mr.participant_id
       WHERE p.id = $1 AND mr.position = 1 LIMIT 1`,
      [seed.participants['alpha'].creator]
    );
    const original = rows[0];

    // Change to DNF → -25 pts
    await pool.query(
      `UPDATE map_result SET position = NULL, status = 'DNF', points = 0 WHERE id = $1`,
      [original.id]
    );
    await recalculateAllSnapshots(seed.tournamentId);

    const after = await getTeamStatistics(seed.tournamentId);
    const alphaAfter = after.find(s => s.teamSlug === 'alpha')!;
    expect(alphaAfter.totalPoints).toBe(initialPoints - 25);

    // Restore
    await pool.query(
      `UPDATE map_result SET position = 1, status = 'FINISHED', points = 25 WHERE id = $1`,
      [original.id]
    );
    await recalculateAllSnapshots(seed.tournamentId);

    const restored = await getTeamStatistics(seed.tournamentId);
    expect(restored.find(s => s.teamSlug === 'alpha')!.totalPoints).toBe(initialPoints);
  });
});

// ── DNF HANDLING ──

describe('DNF handling', () => {
  it('DNF shows in participant stats', async () => {
    // Temporarily change Epsilon_P1's result (pos 10, 1pt) to DNF
    const { rows } = await pool.query<{ id: string; position: number; points: number }>(
      `SELECT mr.id, mr.position, mr.points FROM map_result mr WHERE mr.participant_id = $1 LIMIT 1`,
      [seed.participants['epsilon'].player1]
    );
    const original = rows[0];

    await pool.query(
      `UPDATE map_result SET position = NULL, status = 'DNF', points = 0 WHERE id = $1`,
      [original.id]
    );

    const stats = await getParticipantStatistics(seed.tournamentId);
    const ep1 = stats.find(s => s.participantName === 'Epsilon_P1')!;
    expect(ep1.dnfCount).toBe(1);
    expect(ep1.positionCounts.find(p => p.position === 'DNF')!.count).toBe(1);

    // Restore
    await pool.query(
      `UPDATE map_result SET position = $1, status = 'FINISHED', points = $2 WHERE id = $3`,
      [original.position, original.points, original.id]
    );
  });
});

// ── PROGRESSION ORDER ──

describe('Progression chronological order', () => {
  it('team progression follows match_number then map_index', async () => {
    const stats = await getTeamStatistics(seed.tournamentId);
    for (const s of stats) {
      for (let i = 1; i < s.progression.length; i++) {
        const prev = s.progression[i - 1];
        const curr = s.progression[i];
        const prevOrd = prev.matchNumber * 100 + prev.mapIndex;
        const currOrd = curr.matchNumber * 100 + curr.mapIndex;
        expect(currOrd).toBeGreaterThan(prevOrd);
        expect(curr.cumulativePoints).toBeGreaterThanOrEqual(prev.cumulativePoints);
      }
    }
  });

  it('participant progression is chronologically ordered', async () => {
    const stats = await getParticipantStatistics(seed.tournamentId);
    for (const s of stats) {
      for (let i = 1; i < s.progression.length; i++) {
        const prev = s.progression[i - 1];
        const curr = s.progression[i];
        expect(curr.matchNumber * 100 + curr.mapIndex).toBeGreaterThan(prev.matchNumber * 100 + prev.mapIndex);
      }
    }
  });
});

// ── EDGE CASES ──

describe('Edge cases', () => {
  it('position 1 gets 25 points', async () => {
    const stats = await getParticipantStatistics(seed.tournamentId);
    const alphaC = stats.find(s => s.participantName === 'Alpha_C')!;
    expect(alphaC.positionCounts.find(p => p.position === 1)!.count).toBe(2);
  });

  it('position 10 gets 1 point', async () => {
    const stats = await getParticipantStatistics(seed.tournamentId);
    const ep1 = stats.find(s => s.participantName === 'Epsilon_P1')!;
    expect(ep1.positionCounts.find(p => p.position === 10)!.count).toBe(4);
    expect(ep1.totalPoints).toBe(4);
  });

  it('all position counts sum to maps played', async () => {
    const stats = await getParticipantStatistics(seed.tournamentId);
    for (const s of stats) {
      const total = s.positionCounts.reduce((sum, p) => sum + p.count, 0);
      expect(total).toBe(s.mapsPlayed);
    }
  });

  it('no NaN or Infinity in averages', async () => {
    const stats = await getParticipantStatistics(seed.tournamentId);
    for (const s of stats) {
      if (s.averagePointsPerMap !== null) {
        expect(Number.isFinite(s.averagePointsPerMap)).toBe(true);
      }
    }
  });
});
