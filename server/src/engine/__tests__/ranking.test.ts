import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../../db/pool.js';
import { calculateTeamRankings, calculateIndividualRankings, getRankingHistory } from '../ranking.js';
import { startMatch, confirmMapResults, correctMapResults } from '../stateMachine.js';

interface SeedData {
  tournamentId: string;
  teams: { id: string; slug: string }[];
  participants: Record<string, { creator: string; player1: string; player2: string }>;
  matches: string[];
  maps: string[][];
}

let seed: SeedData;

async function resetAndSeed(): Promise<SeedData> {
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
  const tournamentId = t.id;

  const teamSlugs = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
  const teams: { id: string; slug: string }[] = [];
  const participants: Record<string, { creator: string; player1: string; player2: string }> = {};

  for (const slug of teamSlugs) {
    const { rows: [team] } = await pool.query(
      `INSERT INTO team (tournament_id, name, slug) VALUES ($1, $2, $3) RETURNING id`,
      [tournamentId, slug.charAt(0).toUpperCase() + slug.slice(1), slug]
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
      [tournamentId, i]
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

    for (const slug of teamSlugs) {
      const p = participants[slug];
      await pool.query(
        `INSERT INTO match_participation (match_id, participant_id) VALUES ($1, $2)`,
        [m.id, p.creator]
      );
      const partner = i <= 2 ? p.player1 : p.player2;
      await pool.query(
        `INSERT INTO match_participation (match_id, participant_id) VALUES ($1, $2)`,
        [m.id, partner]
      );
    }
  }

  return { tournamentId, teams, participants, matches, maps };
}

function buildMapResults(s: SeedData, matchIndex: number) {
  const slugs = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
  const results: { participantId: string; position: number | null; status: 'FINISHED' | 'DNF' }[] = [];
  let pos = 1;
  for (const slug of slugs) {
    results.push({ participantId: s.participants[slug].creator, position: pos++, status: 'FINISHED' });
    const partner = matchIndex < 2 ? s.participants[slug].player1 : s.participants[slug].player2;
    results.push({ participantId: partner, position: pos++, status: 'FINISHED' });
  }
  return results;
}

async function startAndConfirmMap(s: SeedData, matchIdx: number, mapIdx: number, results?: ReturnType<typeof buildMapResults>) {
  const r = results ?? buildMapResults(s, matchIdx);
  return confirmMapResults(s.maps[matchIdx][mapIdx], r);
}

beforeAll(async () => {
  seed = await resetAndSeed();
});

afterAll(async () => {
  await pool.end();
});

describe('Team Ranking', () => {
  beforeEach(async () => {
    seed = await resetAndSeed();
  });

  it('returns all 5 teams with 0 points before any results', async () => {
    const rankings = await calculateTeamRankings(seed.tournamentId);
    expect(rankings).toHaveLength(5);
    rankings.forEach(r => expect(r.totalPoints).toBe(0));
  });

  it('calculates team score as sum of all participant points', async () => {
    await startMatch(seed.matches[0]);
    const results = buildMapResults(seed, 0);
    await confirmMapResults(seed.maps[0][0], results);

    const rankings = await calculateTeamRankings(seed.tournamentId);
    const alpha = rankings.find(r => r.teamSlug === 'alpha')!;
    expect(alpha.totalPoints).toBe(25 + 18); // 43
    const beta = rankings.find(r => r.teamSlug === 'beta')!;
    expect(beta.totalPoints).toBe(15 + 12); // 27
  });

  it('ranks teams in descending order by points', async () => {
    await startMatch(seed.matches[0]);
    await confirmMapResults(seed.maps[0][0], buildMapResults(seed, 0));

    const rankings = await calculateTeamRankings(seed.tournamentId);
    for (let i = 1; i < rankings.length; i++) {
      expect(rankings[i - 1].totalPoints).toBeGreaterThanOrEqual(rankings[i].totalPoints);
    }
    expect(rankings[0].rank).toBe(1);
    expect(rankings[4].rank).toBe(5);
  });

  it('accumulates points across multiple maps', async () => {
    await startMatch(seed.matches[0]);
    await confirmMapResults(seed.maps[0][0], buildMapResults(seed, 0));
    await confirmMapResults(seed.maps[0][1], buildMapResults(seed, 0));

    const rankings = await calculateTeamRankings(seed.tournamentId);
    const alpha = rankings.find(r => r.teamSlug === 'alpha')!;
    expect(alpha.totalPoints).toBe((25 + 18) * 2); // 86
  });

  it('handles ties — teams with same points both appear', async () => {
    await startMatch(seed.matches[0]);
    const results1 = buildMapResults(seed, 0);
    await confirmMapResults(seed.maps[0][0], results1);

    // Reverse alpha and beta for second map to create a tie
    const results2 = buildMapResults(seed, 0);
    const alphaCreator = seed.participants['alpha'].creator;
    const betaCreator = seed.participants['beta'].creator;
    const alphaP1 = seed.participants['alpha'].player1;
    const betaP1 = seed.participants['beta'].player1;

    const idxAC = results2.findIndex(r => r.participantId === alphaCreator);
    const idxBC = results2.findIndex(r => r.participantId === betaCreator);
    const idxAP = results2.findIndex(r => r.participantId === alphaP1);
    const idxBP = results2.findIndex(r => r.participantId === betaP1);

    [results2[idxAC].position, results2[idxBC].position] = [results2[idxBC].position, results2[idxAC].position];
    [results2[idxAP].position, results2[idxBP].position] = [results2[idxBP].position, results2[idxAP].position];

    await confirmMapResults(seed.maps[0][1], results2);

    const rankings = await calculateTeamRankings(seed.tournamentId);
    const alpha = rankings.find(r => r.teamSlug === 'alpha')!;
    const beta = rankings.find(r => r.teamSlug === 'beta')!;
    expect(alpha.totalPoints).toBe(beta.totalPoints);
  });
});

describe('Individual Ranking', () => {
  beforeEach(async () => {
    seed = await resetAndSeed();
  });

  it('calculates individual score as sum of points from participated maps', async () => {
    await startMatch(seed.matches[0]);
    await confirmMapResults(seed.maps[0][0], buildMapResults(seed, 0));

    const rankings = await calculateIndividualRankings(seed.tournamentId);
    const alphaCreator = rankings.find(r => r.participantId === seed.participants['alpha'].creator)!;
    expect(alphaCreator.totalPoints).toBe(25);
  });

  it('only counts maps where participant actually played', async () => {
    // Match 1 (Player 1)
    await startMatch(seed.matches[0]);
    await confirmMapResults(seed.maps[0][0], buildMapResults(seed, 0));
    await confirmMapResults(seed.maps[0][1], buildMapResults(seed, 0));
    await confirmMapResults(seed.maps[0][2], buildMapResults(seed, 0));

    // Match 3 (Player 2)
    await startMatch(seed.matches[2]);
    await confirmMapResults(seed.maps[2][0], buildMapResults(seed, 2));
    await confirmMapResults(seed.maps[2][1], buildMapResults(seed, 2));
    await confirmMapResults(seed.maps[2][2], buildMapResults(seed, 2));

    const rankings = await calculateIndividualRankings(seed.tournamentId);
    const alphaP1 = rankings.find(r => r.participantId === seed.participants['alpha'].player1)!;
    // Player 1 played 3 maps in match 1 only
    expect(alphaP1.totalPoints).toBe(18 * 3);

    const alphaP2 = rankings.find(r => r.participantId === seed.participants['alpha'].player2)!;
    // Player 2 played 3 maps in match 3 only
    expect(alphaP2.totalPoints).toBe(18 * 3);
  });

  it('creator accumulates points across matches', async () => {
    await startMatch(seed.matches[0]);
    await confirmMapResults(seed.maps[0][0], buildMapResults(seed, 0));
    await confirmMapResults(seed.maps[0][1], buildMapResults(seed, 0));
    await confirmMapResults(seed.maps[0][2], buildMapResults(seed, 0));

    await startMatch(seed.matches[2]);
    await confirmMapResults(seed.maps[2][0], buildMapResults(seed, 2));

    const rankings = await calculateIndividualRankings(seed.tournamentId);
    const alphaCreator = rankings.find(r => r.participantId === seed.participants['alpha'].creator)!;
    expect(alphaCreator.totalPoints).toBe(25 * 4); // 1st in all 4 maps
  });

  it('DNF contributes 0 to individual score', async () => {
    await startMatch(seed.matches[0]);
    const results = buildMapResults(seed, 0);
    const idx = results.findIndex(r => r.participantId === seed.participants['alpha'].creator);
    results.splice(idx, 1);
    results.forEach((r, i) => { r.position = i + 1; });
    results.push({ participantId: seed.participants['alpha'].creator, position: null, status: 'DNF' });

    await confirmMapResults(seed.maps[0][0], results);

    const rankings = await calculateIndividualRankings(seed.tournamentId);
    const alpha = rankings.find(r => r.participantId === seed.participants['alpha'].creator)!;
    expect(alpha.totalPoints).toBe(0);
  });
});

describe('Ranking Snapshots', () => {
  beforeEach(async () => {
    seed = await resetAndSeed();
  });

  it('creates a snapshot after confirming map results', async () => {
    await startMatch(seed.matches[0]);
    await confirmMapResults(seed.maps[0][0], buildMapResults(seed, 0));

    const { rows } = await pool.query(
      `SELECT * FROM ranking_snapshot WHERE tournament_id = $1 AND map_id = $2 ORDER BY rank`,
      [seed.tournamentId, seed.maps[0][0]]
    );
    expect(rows).toHaveLength(5);
    expect(rows[0].rank).toBe(1);
    expect(rows[4].rank).toBe(5);
  });

  it('preserves ranking history across maps', async () => {
    await startMatch(seed.matches[0]);
    await confirmMapResults(seed.maps[0][0], buildMapResults(seed, 0));
    await confirmMapResults(seed.maps[0][1], buildMapResults(seed, 0));

    const history = await getRankingHistory(seed.tournamentId);
    expect(history).toHaveLength(2);
    expect(history[0].mapCode).toBe('P1M1');
    expect(history[1].mapCode).toBe('P1M2');
    history.forEach(h => expect(h.rankings).toHaveLength(5));
  });
});

describe('Result Corrections via ranking engine', () => {
  beforeEach(async () => {
    seed = await resetAndSeed();
  });

  it('recalculates points after correcting a result', async () => {
    await startMatch(seed.matches[0]);
    await confirmMapResults(seed.maps[0][0], buildMapResults(seed, 0));

    const before = await calculateTeamRankings(seed.tournamentId);
    const alphaBefore = before.find(r => r.teamSlug === 'alpha')!;
    expect(alphaBefore.totalPoints).toBe(43);

    // Correct alpha creator from 1st to DNF
    const corrected = buildMapResults(seed, 0);
    const idx = corrected.findIndex(r => r.participantId === seed.participants['alpha'].creator);
    corrected.splice(idx, 1);
    corrected.forEach((r, i) => { r.position = i + 1; });
    corrected.push({ participantId: seed.participants['alpha'].creator, position: null, status: 'DNF' });

    await correctMapResults(seed.maps[0][0], corrected);

    const after = await calculateTeamRankings(seed.tournamentId);
    const alphaAfter = after.find(r => r.teamSlug === 'alpha')!;
    // alpha_player1 moved from pos 2 to pos 1 (25pts), creator DNF=0
    expect(alphaAfter.totalPoints).toBe(25);
    // Alpha should now have fewer points than before (was 43=25+18, now 25=25+0)
    expect(alphaAfter.totalPoints).toBeLessThan(alphaBefore.totalPoints);
  });

  it('recalculates all snapshots after correction', async () => {
    await startMatch(seed.matches[0]);
    await confirmMapResults(seed.maps[0][0], buildMapResults(seed, 0));
    await confirmMapResults(seed.maps[0][1], buildMapResults(seed, 0));

    // Correct map 1: alpha creator becomes DNF
    const corrected = buildMapResults(seed, 0);
    const idx = corrected.findIndex(r => r.participantId === seed.participants['alpha'].creator);
    corrected.splice(idx, 1);
    corrected.forEach((r, i) => { r.position = i + 1; });
    corrected.push({ participantId: seed.participants['alpha'].creator, position: null, status: 'DNF' });

    await correctMapResults(seed.maps[0][0], corrected);

    const history = await getRankingHistory(seed.tournamentId);
    const firstMap = history.find(h => h.mapCode === 'P1M1')!;
    const alphaFirst = firstMap.rankings.find(r => r.teamId === seed.teams[0].id)!;
    // alpha_player1 moved to pos 1 (25pts), creator DNF=0 → total 25
    expect(alphaFirst.totalPoints).toBe(25);

    const secondMap = history.find(h => h.mapCode === 'P1M2')!;
    const alphaSecond = secondMap.rankings.find(r => r.teamId === seed.teams[0].id)!;
    // map1 corrected(25) + map2 original(25+18) = 68
    expect(alphaSecond.totalPoints).toBe(25 + 25 + 18);
  });
});
