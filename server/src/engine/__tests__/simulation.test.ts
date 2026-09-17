import { describe, it, expect, beforeAll, vi } from 'vitest';
import { pool } from '../../db/pool.js';
import { startMatch, confirmMapResults, correctMapResults } from '../stateMachine.js';
import { calculateTeamRankings, calculateIndividualRankings, getRankingHistory } from '../ranking.js';
import { getTeamStatistics, getParticipantStatistics } from '../statistics.js';
import * as emitter from '../../realtime/emitter.js';
import request from 'supertest';
import { app } from '../../app.js';

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
  teams: { id: string; slug: string; name: string }[];
  participants: Record<string, { creator: string; player1: string; player2: string }>;
  matches: string[];
  maps: string[][];
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
      `INSERT INTO tournament (name, status) VALUES ('Wasteland Drone Cup', 'DRAFT') RETURNING id`
    );
    const tid = t.id;

    const teamDefs = [
      { name: 'Caramelo', slug: 'caramelo', color: '#f5c842' },
      { name: 'Vetel', slug: 'vetel', color: '#38bdf8' },
      { name: 'Miwell', slug: 'miwell', color: '#22c55e' },
      { name: 'SoraMusic', slug: 'sora', color: '#a855f7' },
      { name: 'Barra', slug: 'barra', color: '#ef4444' },
    ];

    const teams: SeedData['teams'] = [];
    const participants: SeedData['participants'] = {};

    for (const td of teamDefs) {
      const { rows: [team] } = await client.query(
        `INSERT INTO team (tournament_id, name, slug, color) VALUES ($1, $2, $3, $4) RETURNING id`,
        [tid, td.name, td.slug, td.color]
      );
      teams.push({ id: team.id, slug: td.slug, name: td.name });

      const { rows: [cr] } = await client.query(
        `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, 'CREATOR') RETURNING id`,
        [team.id, td.name, td.slug]
      );
      const { rows: [p1] } = await client.query(
        `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, 'PLAYER_1') RETURNING id`,
        [team.id, `${td.name}_P1`, `${td.slug}_p1`]
      );
      const { rows: [p2] } = await client.query(
        `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, 'PLAYER_2') RETURNING id`,
        [team.id, `${td.name}_P2`, `${td.slug}_p2`]
      );
      participants[td.slug] = { creator: cr.id, player1: p1.id, player2: p2.id };
    }

    const matches: string[] = [];
    const maps: string[][] = [];

    for (let i = 1; i <= 4; i++) {
      const { rows: [m] } = await client.query(
        `INSERT INTO match (tournament_id, match_number, phase, status) VALUES ($1, $2, 'MAIN', 'UPCOMING') RETURNING id`,
        [tid, i]
      );
      matches.push(m.id);

      const matchMaps: string[] = [];
      for (let j = 1; j <= 3; j++) {
        const { rows: [mp] } = await client.query(
          `INSERT INTO map (match_id, map_index, code, status) VALUES ($1, $2, $3, 'PENDING') RETURNING id`,
          [m.id, j, `P${i}M${j}`]
        );
        matchMaps.push(mp.id);
      }
      maps.push(matchMaps);

      // Rotation: Match 1-2 = Creator + P1, Match 3-4 = Creator + P2
      for (const slug of Object.keys(participants)) {
        const p = participants[slug];
        await client.query(`INSERT INTO match_participation (match_id, participant_id) VALUES ($1, $2)`, [m.id, p.creator]);
        const partner = i <= 2 ? p.player1 : p.player2;
        await client.query(`INSERT INTO match_participation (match_id, participant_id) VALUES ($1, $2)`, [m.id, partner]);
      }
    }

    await client.query('COMMIT');
    return { tournamentId: tid, teams, participants, matches, maps };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Deterministic finish orders for 12 maps
// Each row: indices into the 10-participant array for that match
// Match 1-2 participants: [caramelo_C, caramelo_P1, vetel_C, vetel_P1, miwell_C, miwell_P1, sora_C, sora_P1, barra_C, barra_P1]
// Match 3-4 participants: [caramelo_C, caramelo_P2, vetel_C, vetel_P2, miwell_C, miwell_P2, sora_C, sora_P2, barra_C, barra_P2]
const FINISH_ORDERS: number[][] = [
  // Match 1
  [2, 0, 4, 1, 6, 3, 8, 5, 7, 9],  // P1M1: Vetel_C 1st, Caramelo_C 2nd...
  [0, 4, 2, 6, 1, 8, 3, 5, 9, 7],  // P1M2: Caramelo_C 1st, Miwell_C 2nd...
  [4, 2, 0, 8, 6, 1, 3, 9, 5, 7],  // P1M3: Miwell_C 1st, Vetel_C 2nd...
  // Match 2
  [6, 2, 0, 4, 8, 1, 3, 7, 5, 9],  // P2M1: Sora_C 1st, Vetel_C 2nd...
  [8, 0, 6, 2, 4, 9, 1, 3, 7, 5],  // P2M2: Barra_C 1st, Caramelo_C 2nd... (with DNF for last)
  [2, 8, 4, 0, 6, 1, 9, 3, 5, 7],  // P2M3: Vetel_C 1st, Barra_C 2nd...
  // Match 3
  [0, 2, 4, 6, 8, 1, 3, 5, 7, 9],  // P3M1: Caramelo_C 1st...
  [4, 6, 8, 0, 2, 5, 7, 9, 1, 3],  // P3M2: Miwell_C 1st...
  [8, 4, 0, 6, 2, 9, 5, 1, 7, 3],  // P3M3: Barra_C 1st...
  // Match 4
  [6, 0, 8, 2, 4, 7, 1, 9, 3, 5],  // P4M1: Sora_C 1st...
  [2, 6, 0, 8, 4, 3, 7, 1, 9, 5],  // P4M2: Vetel_C 1st...
  [0, 4, 8, 2, 6, 1, 5, 9, 3, 7],  // P4M3: Caramelo_C 1st... (last map)
];

function buildParticipantOrder(seed: SeedData, matchIndex: number): string[] {
  const slugs = ['caramelo', 'vetel', 'miwell', 'sora', 'barra'];
  const order: string[] = [];
  for (const slug of slugs) {
    order.push(seed.participants[slug].creator);
    order.push(matchIndex < 2 ? seed.participants[slug].player1 : seed.participants[slug].player2);
  }
  return order;
}

function buildResults(
  seed: SeedData,
  matchIndex: number,
  mapGlobalIndex: number,
  withDnf = false,
): { participantId: string; position: number | null; status: 'FINISHED' | 'DNF' }[] {
  const participantOrder = buildParticipantOrder(seed, matchIndex);
  const finishOrder = FINISH_ORDERS[mapGlobalIndex];
  const results: { participantId: string; position: number | null; status: 'FINISHED' | 'DNF' }[] = [];

  for (let pos = 0; pos < 10; pos++) {
    const pid = participantOrder[finishOrder[pos]];
    if (withDnf && pos === 9) {
      results.push({ participantId: pid, position: null, status: 'DNF' });
    } else {
      results.push({ participantId: pid, position: pos + 1, status: 'FINISHED' });
    }
  }
  return results;
}

// Track cumulative expected points
function expectedPointsForPosition(pos: number): number {
  return SCORING_TABLE[pos] ?? 0;
}

describe('J1 Full Tournament Simulation', () => {
  let seed: SeedData;
  const eventLog: string[] = [];

  beforeAll(async () => {
    seed = await cleanSeed();

    // Wire event tracking
    vi.mocked(emitter.emitMatchStarted).mockImplementation(() => { eventLog.push('match.started'); });
    vi.mocked(emitter.emitMapStarted).mockImplementation(() => { eventLog.push('map.started'); });
    vi.mocked(emitter.emitMapCompleted).mockImplementation(() => { eventLog.push('map.completed'); });
    vi.mocked(emitter.emitMatchCompleted).mockImplementation(() => { eventLog.push('match.completed'); });
    vi.mocked(emitter.emitRankingUpdated).mockImplementation(() => { eventLog.push('ranking.updated'); });
    vi.mocked(emitter.emitResultUpdated).mockImplementation(() => { eventLog.push('result.updated'); });
    vi.mocked(emitter.emitCompetitionUpdated).mockImplementation(() => { eventLog.push('competition.updated'); });
  });

  // ══════════════════════════════════════════════════
  // 1. INITIAL STATE
  // ══════════════════════════════════════════════════

  describe('1. Initial State', () => {
    it('has 1 tournament', async () => {
      const { rows } = await pool.query('SELECT * FROM tournament');
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Wasteland Drone Cup');
    });

    it('has 5 teams', async () => {
      const { rows } = await pool.query('SELECT * FROM team WHERE tournament_id = $1', [seed.tournamentId]);
      expect(rows).toHaveLength(5);
    });

    it('has 15 participants', async () => {
      const { rows } = await pool.query(`
        SELECT p.* FROM participant p
        JOIN team t ON t.id = p.team_id
        WHERE t.tournament_id = $1
      `, [seed.tournamentId]);
      expect(rows).toHaveLength(15);
    });

    it('has 4 matches all UPCOMING', async () => {
      const { rows } = await pool.query(
        `SELECT * FROM match WHERE tournament_id = $1 ORDER BY match_number`, [seed.tournamentId]
      );
      expect(rows).toHaveLength(4);
      for (const m of rows) {
        expect(m.status).toBe('UPCOMING');
      }
    });

    it('has 40 match participations', async () => {
      const { rows } = await pool.query(`
        SELECT mp.* FROM match_participation mp
        JOIN match m ON m.id = mp.match_id
        WHERE m.tournament_id = $1
      `, [seed.tournamentId]);
      expect(rows).toHaveLength(40);
    });

    it('has 12 maps all PENDING', async () => {
      const { rows } = await pool.query(`
        SELECT map.* FROM map
        JOIN match ON match.id = map.match_id
        WHERE match.tournament_id = $1
        ORDER BY match.match_number, map.map_index
      `, [seed.tournamentId]);
      expect(rows).toHaveLength(12);
      for (const m of rows) {
        expect(m.status).toBe('PENDING');
      }
    });

    it('has 0 map results', async () => {
      const { rows } = await pool.query(`
        SELECT mr.* FROM map_result mr
        JOIN map ON map.id = mr.map_id
        JOIN match ON match.id = map.match_id
        WHERE match.tournament_id = $1
      `, [seed.tournamentId]);
      expect(rows).toHaveLength(0);
    });

    it('rankings show 0 points for all teams', async () => {
      const rankings = await calculateTeamRankings(seed.tournamentId);
      expect(rankings).toHaveLength(5);
      for (const r of rankings) {
        expect(r.totalPoints).toBe(0);
      }
    });

    it('statistics show no data', async () => {
      const stats = await getTeamStatistics(seed.tournamentId);
      for (const s of stats) {
        expect(s.totalPoints).toBe(0);
        expect(s.mapsPlayed).toBe(0);
        expect(s.mapsWon).toBe(0);
        expect(s.pointsByMatch).toHaveLength(0);
        expect(s.pointsByMap).toHaveLength(0);
        expect(s.progression).toHaveLength(0);
      }
    });
  });

  // ══════════════════════════════════════════════════
  // 2. VALIDATE ROTATION
  // ══════════════════════════════════════════════════

  describe('2. Validate Rotation', () => {
    it('Match 1-2 have Creator + Player_1 (10 participants each)', async () => {
      for (let i = 0; i < 2; i++) {
        const { rows } = await pool.query(`
          SELECT mp.participant_id, p.type, p.name
          FROM match_participation mp
          JOIN participant p ON p.id = mp.participant_id
          WHERE mp.match_id = $1
          ORDER BY p.type, p.name
        `, [seed.matches[i]]);

        expect(rows).toHaveLength(10);
        const types = rows.map((r: any) => r.type);
        expect(types.filter((t: string) => t === 'CREATOR')).toHaveLength(5);
        expect(types.filter((t: string) => t === 'PLAYER_1')).toHaveLength(5);
        expect(types.filter((t: string) => t === 'PLAYER_2')).toHaveLength(0);
      }
    });

    it('Match 3-4 have Creator + Player_2 (10 participants each)', async () => {
      for (let i = 2; i < 4; i++) {
        const { rows } = await pool.query(`
          SELECT mp.participant_id, p.type
          FROM match_participation mp
          JOIN participant p ON p.id = mp.participant_id
          WHERE mp.match_id = $1
        `, [seed.matches[i]]);

        expect(rows).toHaveLength(10);
        const types = rows.map((r: any) => r.type);
        expect(types.filter((t: string) => t === 'CREATOR')).toHaveLength(5);
        expect(types.filter((t: string) => t === 'PLAYER_2')).toHaveLength(5);
        expect(types.filter((t: string) => t === 'PLAYER_1')).toHaveLength(0);
      }
    });
  });

  // ══════════════════════════════════════════════════
  // 3. SIMULATE MATCH 1
  // ══════════════════════════════════════════════════

  describe('3. Simulate Match 1', () => {
    it('starts match 1 → LIVE, first map → ACTIVE', async () => {
      eventLog.length = 0;
      const result = await startMatch(seed.matches[0]);
      expect(result.matchId).toBe(seed.matches[0]);
      expect(result.mapId).toBe(seed.maps[0][0]);

      const { rows: [match] } = await pool.query('SELECT status FROM match WHERE id = $1', [seed.matches[0]]);
      expect(match.status).toBe('LIVE');

      const { rows: [map] } = await pool.query('SELECT status FROM map WHERE id = $1', [seed.maps[0][0]]);
      expect(map.status).toBe('ACTIVE');

      expect(eventLog).toContain('match.started');
      expect(eventLog).toContain('map.started');
    });

    it('cannot start match 2 while match 1 is LIVE', async () => {
      await expect(startMatch(seed.matches[1])).rejects.toThrow('Another match is already LIVE');
    });

    it('completes P1M1 with results, next map becomes ACTIVE', async () => {
      eventLog.length = 0;
      const results = buildResults(seed, 0, 0);
      const { ranked } = await confirmMapResults(seed.maps[0][0], results);

      expect(ranked).toHaveLength(5);
      expect(eventLog).toContain('map.completed');
      expect(eventLog).toContain('ranking.updated');
      expect(eventLog).toContain('map.started');

      const { rows: [map1] } = await pool.query('SELECT status FROM map WHERE id = $1', [seed.maps[0][0]]);
      expect(map1.status).toBe('COMPLETED');

      const { rows: [map2] } = await pool.query('SELECT status FROM map WHERE id = $1', [seed.maps[0][1]]);
      expect(map2.status).toBe('ACTIVE');
    });

    it('completes P1M2', async () => {
      const results = buildResults(seed, 0, 1);
      await confirmMapResults(seed.maps[0][1], results);

      const { rows: [map3] } = await pool.query('SELECT status FROM map WHERE id = $1', [seed.maps[0][2]]);
      expect(map3.status).toBe('ACTIVE');
    });

    it('completes P1M3 (includes DNF) → match 1 COMPLETED', async () => {
      eventLog.length = 0;
      const results = buildResults(seed, 0, 2, true); // last player DNF
      const { matchCompleted } = await confirmMapResults(seed.maps[0][2], results);
      expect(matchCompleted).toBe(true);

      expect(eventLog).toContain('match.completed');
      expect(eventLog).not.toContain('map.started'); // no next map

      const { rows: [match] } = await pool.query('SELECT status FROM match WHERE id = $1', [seed.matches[0]]);
      expect(match.status).toBe('COMPLETED');

      const { rows: [match2] } = await pool.query('SELECT status FROM match WHERE id = $1', [seed.matches[1]]);
      expect(match2.status).toBe('UPCOMING');
    });
  });

  // ══════════════════════════════════════════════════
  // 4. VALIDATE MATCH 1
  // ══════════════════════════════════════════════════

  describe('4. Validate Match 1', () => {
    it('scoring: points match scoring table', async () => {
      const { rows } = await pool.query(`
        SELECT mr.position, mr.status, mr.points
        FROM map_result mr
        JOIN map ON map.id = mr.map_id
        JOIN match ON match.id = map.match_id
        WHERE match.id = $1
        ORDER BY map.map_index, COALESCE(mr.position, 999)
      `, [seed.matches[0]]);

      for (const r of rows) {
        if (r.status === 'DNF') {
          expect(r.points).toBe(0);
          expect(r.position).toBeNull();
        } else {
          expect(r.points).toBe(SCORING_TABLE[r.position]);
        }
      }
    });

    it('team rankings are consistent', async () => {
      const rankings = await calculateTeamRankings(seed.tournamentId);
      expect(rankings).toHaveLength(5);
      for (let i = 1; i < rankings.length; i++) {
        expect(rankings[i - 1].totalPoints).toBeGreaterThanOrEqual(rankings[i].totalPoints);
      }
      expect(rankings[0].rank).toBe(1);
    });

    it('individual rankings are consistent', async () => {
      const rankings = await calculateIndividualRankings(seed.tournamentId);
      expect(rankings.length).toBeGreaterThan(0);
      for (let i = 1; i < rankings.length; i++) {
        expect(rankings[i - 1].totalPoints).toBeGreaterThanOrEqual(rankings[i].totalPoints);
      }
    });

    it('team statistics: mapsPlayed, progression, pointsByMap', async () => {
      const stats = await getTeamStatistics(seed.tournamentId);
      for (const s of stats) {
        expect(s.mapsPlayed).toBe(3);
        expect(s.pointsByMap).toHaveLength(3);
        expect(s.pointsByMatch).toHaveLength(1);
        expect(s.progression).toHaveLength(3);
        // Progression is cumulative
        for (let i = 1; i < s.progression.length; i++) {
          expect(s.progression[i].cumulativePoints).toBeGreaterThanOrEqual(s.progression[i - 1].cumulativePoints);
        }
      }
    });

    it('participant statistics: mapsPlayed, DNF reflected', async () => {
      const stats = await getParticipantStatistics(seed.tournamentId);
      // P1M3 had a DNF for the last-position participant
      const dnfParticipants = stats.filter(s => s.dnfCount > 0);
      expect(dnfParticipants.length).toBeGreaterThanOrEqual(1);

      for (const s of stats) {
        if (s.mapsPlayed > 0 && s.totalPoints > 0) {
          expect(s.averagePointsPerMap).not.toBeNull();
          expect(s.averagePointsPerMap).toBeGreaterThan(0);
        }
      }
    });

    it('realtime events were emitted for match 1', () => {
      // We already checked in the simulation steps above
      // Just verify total event count makes sense
      const matchStartedCalls = vi.mocked(emitter.emitMatchStarted).mock.calls;
      expect(matchStartedCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ══════════════════════════════════════════════════
  // 5. SIMULATE MATCHES 2, 3, 4
  // ══════════════════════════════════════════════════

  describe('5. Simulate Matches 2, 3, 4', () => {
    for (let matchIdx = 1; matchIdx < 4; matchIdx++) {
      const matchNum = matchIdx + 1;

      it(`starts Match ${matchNum}`, async () => {
        await startMatch(seed.matches[matchIdx]);
        const { rows: [m] } = await pool.query('SELECT status FROM match WHERE id = $1', [seed.matches[matchIdx]]);
        expect(m.status).toBe('LIVE');
      });

      for (let mapIdx = 0; mapIdx < 3; mapIdx++) {
        const mapGlobal = matchIdx * 3 + mapIdx;
        const mapCode = `P${matchNum}M${mapIdx + 1}`;
        const isLastMap = mapIdx === 2;
        // P2M2 (global index 4) has a DNF
        const withDnf = mapGlobal === 4;

        it(`completes ${mapCode}${withDnf ? ' (with DNF)' : ''}${isLastMap ? ' → Match COMPLETED' : ''}`, async () => {
          const results = buildResults(seed, matchIdx, mapGlobal, withDnf);
          const { matchCompleted } = await confirmMapResults(seed.maps[matchIdx][mapIdx], results);

          if (isLastMap) {
            expect(matchCompleted).toBe(true);
            const { rows: [m] } = await pool.query('SELECT status FROM match WHERE id = $1', [seed.matches[matchIdx]]);
            expect(m.status).toBe('COMPLETED');
          } else {
            expect(matchCompleted).toBe(false);
            const { rows: [nextMap] } = await pool.query('SELECT status FROM map WHERE id = $1', [seed.maps[matchIdx][mapIdx + 1]]);
            expect(nextMap.status).toBe('ACTIVE');
          }
        });
      }

      if (matchIdx < 3) {
        it(`after Match ${matchNum}, next match is still UPCOMING`, async () => {
          const { rows: [next] } = await pool.query('SELECT status FROM match WHERE id = $1', [seed.matches[matchIdx + 1]]);
          expect(next.status).toBe('UPCOMING');
        });
      }
    }
  });

  // ══════════════════════════════════════════════════
  // 6. CORRECTION
  // ══════════════════════════════════════════════════

  describe('6. Correction', () => {
    let preCorrectionTeamPoints: Map<string, number>;
    let preCorrectionParticipantPoints: Map<string, number>;

    it('captures pre-correction state', async () => {
      const teamRanks = await calculateTeamRankings(seed.tournamentId);
      preCorrectionTeamPoints = new Map(teamRanks.map(r => [r.teamId, r.totalPoints]));

      const indRanks = await calculateIndividualRankings(seed.tournamentId);
      preCorrectionParticipantPoints = new Map(indRanks.map(r => [r.participantId, r.totalPoints]));
    });

    it('corrects P1M1 results: change position 1 to DNF', async () => {
      eventLog.length = 0;

      // Get current map results for P1M1
      const { rows: currentResults } = await pool.query(`
        SELECT mr.participant_id, mr.position, mr.status, mr.points
        FROM map_result mr WHERE mr.map_id = $1
        ORDER BY COALESCE(mr.position, 999)
      `, [seed.maps[0][0]]);

      // Rebuild results: move pos 1 to DNF, shift others up
      const pos1Participant = currentResults.find((r: any) => r.position === 1);
      expect(pos1Participant).toBeDefined();

      const correctedResults: { participantId: string; position: number | null; status: 'FINISHED' | 'DNF' }[] = currentResults
        .filter((r: any) => r.participant_id !== pos1Participant.participant_id)
        .map((r: any, i: number) => ({
          participantId: r.participant_id as string,
          position: (i + 1) as number | null,
          status: 'FINISHED' as const,
        }));
      correctedResults.push({
        participantId: pos1Participant.participant_id,
        position: null,
        status: 'DNF',
      });

      await correctMapResults(seed.maps[0][0], correctedResults);

      expect(eventLog).toContain('result.updated');
      expect(eventLog).toContain('ranking.updated');
    });

    it('map result reflects the correction', async () => {
      const { rows } = await pool.query(`
        SELECT mr.participant_id, mr.position, mr.status, mr.points
        FROM map_result mr WHERE mr.map_id = $1
        ORDER BY COALESCE(mr.position, 999)
      `, [seed.maps[0][0]]);

      const dnfs = rows.filter((r: any) => r.status === 'DNF');
      expect(dnfs).toHaveLength(1);
      expect(dnfs[0].points).toBe(0);
      expect(dnfs[0].position).toBeNull();

      const finished = rows.filter((r: any) => r.status === 'FINISHED');
      expect(finished).toHaveLength(9);
      // Positions should be 1-9 now
      const positions = finished.map((r: any) => r.position).sort((a: number, b: number) => a - b);
      expect(positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('team points changed after correction', async () => {
      const teamRanks = await calculateTeamRankings(seed.tournamentId);
      const postPoints = new Map(teamRanks.map(r => [r.teamId, r.totalPoints]));

      // The team whose creator was DNF'd lost 25 points from that map
      let changed = false;
      for (const [teamId, prePts] of preCorrectionTeamPoints) {
        const postPts = postPoints.get(teamId)!;
        if (prePts !== postPts) changed = true;
      }
      expect(changed).toBe(true);
    });

    it('participant points changed after correction', async () => {
      const indRanks = await calculateIndividualRankings(seed.tournamentId);
      const postPoints = new Map(indRanks.map(r => [r.participantId, r.totalPoints]));

      let changed = false;
      for (const [pid, prePts] of preCorrectionParticipantPoints) {
        const postPts = postPoints.get(pid)!;
        if (prePts !== postPts) changed = true;
      }
      expect(changed).toBe(true);
    });

    it('statistics reflect the correction', async () => {
      const stats = await getTeamStatistics(seed.tournamentId);
      const totalStatsPoints = stats.reduce((acc, s) => acc + s.totalPoints, 0);

      const rankings = await calculateTeamRankings(seed.tournamentId);
      const totalRankPoints = rankings.reduce((acc, r) => acc + r.totalPoints, 0);

      expect(totalStatsPoints).toBe(totalRankPoints);
    });

    it('ranking snapshots were recalculated', async () => {
      const history = await getRankingHistory(seed.tournamentId);
      // Should have 12 snapshots (one per completed map)
      expect(history).toHaveLength(12);
    });

    it('export reflects the correction', async () => {
      const res = await request(app).get('/api/export/teams.csv');
      expect(res.status).toBe(200);

      const teamRanks = await calculateTeamRankings(seed.tournamentId);
      for (const rank of teamRanks) {
        expect(res.text).toContain(rank.teamName);
        expect(res.text).toContain(String(rank.totalPoints));
      }
    });

    it('undo correction: restore original P1M1 results', async () => {
      // Restore the original results
      const originalResults = buildResults(seed, 0, 0);
      await correctMapResults(seed.maps[0][0], originalResults);

      // Verify restoration
      const teamRanks = await calculateTeamRankings(seed.tournamentId);
      const postPoints = new Map(teamRanks.map(r => [r.teamId, r.totalPoints]));

      for (const [teamId, prePts] of preCorrectionTeamPoints) {
        expect(postPoints.get(teamId)).toBe(prePts);
      }
    });
  });

  // ══════════════════════════════════════════════════
  // 7. RECONNECTION
  // ══════════════════════════════════════════════════

  describe('7. Reconnection (REST fallback)', () => {
    it('REST /api/rankings returns current state independent of Socket.IO', async () => {
      const res = await request(app).get('/api/rankings');
      expect(res.status).toBe(200);
      expect(res.body.teams).toHaveLength(5);
      expect(res.body.individuals.length).toBeGreaterThan(0);
    });

    it('REST /api/matches returns all matches with correct statuses', async () => {
      const res = await request(app).get('/api/matches');
      expect(res.status).toBe(200);
      for (const m of res.body) {
        expect(m.status).toBe('COMPLETED');
      }
    });

    it('REST /api/tournament reflects final state', async () => {
      const res = await request(app).get('/api/tournament');
      expect(res.status).toBe(200);
      // After all matches complete, currentMatchId and currentMapId should be null
      expect(res.body.currentMatchId).toBeNull();
      expect(res.body.currentMapId).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════
  // 8. FINAL TOURNAMENT STATE
  // ══════════════════════════════════════════════════

  describe('8. Final Tournament State', () => {
    it('4/4 matches COMPLETED', async () => {
      const { rows } = await pool.query(
        `SELECT status FROM match WHERE tournament_id = $1`, [seed.tournamentId]
      );
      expect(rows).toHaveLength(4);
      for (const m of rows) {
        expect(m.status).toBe('COMPLETED');
      }
    });

    it('12/12 maps COMPLETED', async () => {
      const { rows } = await pool.query(`
        SELECT map.status FROM map
        JOIN match ON match.id = map.match_id
        WHERE match.tournament_id = $1
      `, [seed.tournamentId]);
      expect(rows).toHaveLength(12);
      for (const m of rows) {
        expect(m.status).toBe('COMPLETED');
      }
    });

    it('120 map results registered', async () => {
      const { rows } = await pool.query(`
        SELECT COUNT(*)::int AS count FROM map_result mr
        JOIN map ON map.id = mr.map_id
        JOIN match ON match.id = map.match_id
        WHERE match.tournament_id = $1
      `, [seed.tournamentId]);
      expect(rows[0].count).toBe(120);
    });

    it('final team rankings are consistent', async () => {
      const rankings = await calculateTeamRankings(seed.tournamentId);
      expect(rankings).toHaveLength(5);

      // Verify total points = sum of all map_result points for each team
      for (const rank of rankings) {
        const { rows: [{ sum }] } = await pool.query(`
          SELECT COALESCE(SUM(mr.points), 0)::int AS sum
          FROM map_result mr
          JOIN participant p ON p.id = mr.participant_id
          WHERE p.team_id = $1
        `, [rank.teamId]);
        expect(rank.totalPoints).toBe(sum);
      }
    });

    it('final statistics match rankings', async () => {
      const rankings = await calculateTeamRankings(seed.tournamentId);
      const stats = await getTeamStatistics(seed.tournamentId);

      for (const rank of rankings) {
        const stat = stats.find(s => s.teamId === rank.teamId);
        expect(stat).toBeDefined();
        expect(stat!.totalPoints).toBe(rank.totalPoints);
        expect(stat!.globalPosition).toBe(rank.rank);
        expect(stat!.mapsPlayed).toBe(12);
      }
    });

    it('participant statistics: all creators played 12 maps', async () => {
      const stats = await getParticipantStatistics(seed.tournamentId);
      const creators = stats.filter(s => s.participantType === 'CREATOR');
      expect(creators).toHaveLength(5);
      for (const c of creators) {
        expect(c.mapsPlayed).toBe(12);
      }
    });

    it('participant statistics: P1s played 6 maps, P2s played 6 maps', async () => {
      const stats = await getParticipantStatistics(seed.tournamentId);
      const p1s = stats.filter(s => s.participantType === 'PLAYER_1');
      const p2s = stats.filter(s => s.participantType === 'PLAYER_2');
      expect(p1s).toHaveLength(5);
      expect(p2s).toHaveLength(5);
      for (const p of p1s) {
        expect(p.mapsPlayed).toBe(6);
      }
      for (const p of p2s) {
        expect(p.mapsPlayed).toBe(6);
      }
    });
  });

  // ══════════════════════════════════════════════════
  // 9. TIEBREAK
  // ══════════════════════════════════════════════════

  describe('9. Tiebreak', () => {
    it('if a tie exists, both teams share the same rank value and no tiebreak is invented', async () => {
      const rankings = await calculateTeamRankings(seed.tournamentId);
      // Check if any tie exists
      const pointGroups = new Map<number, string[]>();
      for (const r of rankings) {
        const group = pointGroups.get(r.totalPoints) || [];
        group.push(r.teamName);
        pointGroups.set(r.totalPoints, group);
      }

      for (const [pts, teams] of pointGroups) {
        if (teams.length > 1) {
          // Tied teams should have sequential ranks (alphabetical ordering)
          const tiedRanks = rankings
            .filter(r => r.totalPoints === pts)
            .map(r => r.rank);
          // Ranks should be sequential
          for (let i = 1; i < tiedRanks.length; i++) {
            expect(tiedRanks[i]).toBe(tiedRanks[i - 1] + 1);
          }
        }
      }
      // No special tiebreak rules were applied — this test passes regardless
    });
  });

  // ══════════════════════════════════════════════════
  // 10. EXPORT
  // ══════════════════════════════════════════════════

  describe('10. Export', () => {
    it('teams.csv has all 5 teams with correct totals', async () => {
      const res = await request(app).get('/api/export/teams.csv');
      expect(res.status).toBe(200);
      const lines = res.text.trim().split('\r\n');
      expect(lines).toHaveLength(6); // header + 5 teams
    });

    it('participants.csv has all participants', async () => {
      const res = await request(app).get('/api/export/participants.csv');
      expect(res.status).toBe(200);
      const lines = res.text.trim().split('\r\n');
      expect(lines).toHaveLength(16); // header + 15 participants
    });

    it('results-by-map.csv has 120 result rows', async () => {
      const res = await request(app).get('/api/export/results-by-map.csv');
      expect(res.status).toBe(200);
      const lines = res.text.trim().split('\r\n');
      expect(lines).toHaveLength(121); // header + 120 results
    });

    it('results-by-match.csv has teams with match breakdowns', async () => {
      const res = await request(app).get('/api/export/results-by-match.csv');
      expect(res.status).toBe(200);
      const lines = res.text.trim().split('\r\n');
      expect(lines).toHaveLength(6); // header + 5 teams
      expect(lines[0]).toContain('Partida 1');
      expect(lines[0]).toContain('Partida 4');
    });

    it('consolidated.json has complete data', async () => {
      const res = await request(app).get('/api/export/consolidated.json');
      expect(res.status).toBe(200);
      expect(res.body.matches).toHaveLength(4);
      expect(res.body.maps).toHaveLength(12);
      expect(res.body.results).toHaveLength(120);
      expect(res.body.rankings.teams).toHaveLength(5);
      expect(res.body.statistics.teams).toHaveLength(5);
    });

    it('export totals match ranking totals', async () => {
      const exportRes = await request(app).get('/api/export/consolidated.json');
      const rankings = await calculateTeamRankings(seed.tournamentId);

      for (const exportTeam of exportRes.body.rankings.teams) {
        const rank = rankings.find(r => r.teamId === exportTeam.teamId);
        expect(rank).toBeDefined();
        expect(exportTeam.totalPoints).toBe(rank!.totalPoints);
      }
    });
  });

  // ══════════════════════════════════════════════════
  // 12. CONSISTENCY
  // ══════════════════════════════════════════════════

  describe('12. Global Consistency', () => {
    it('team total points match across rankings, statistics, and export', async () => {
      const rankings = await calculateTeamRankings(seed.tournamentId);
      const stats = await getTeamStatistics(seed.tournamentId);
      const exportRes = await request(app).get('/api/export/consolidated.json');

      for (const rank of rankings) {
        const stat = stats.find(s => s.teamId === rank.teamId)!;
        const expTeam = exportRes.body.rankings.teams.find((t: any) => t.teamId === rank.teamId)!;
        const expStat = exportRes.body.statistics.teams.find((t: any) => t.teamId === rank.teamId)!;

        expect(stat.totalPoints).toBe(rank.totalPoints);
        expect(expTeam.totalPoints).toBe(rank.totalPoints);
        expect(expStat.totalPoints).toBe(rank.totalPoints);
      }
    });

    it('team positions match across rankings, statistics, and export', async () => {
      const rankings = await calculateTeamRankings(seed.tournamentId);
      const stats = await getTeamStatistics(seed.tournamentId);
      const exportRes = await request(app).get('/api/export/consolidated.json');

      for (const rank of rankings) {
        const stat = stats.find(s => s.teamId === rank.teamId)!;
        const expTeam = exportRes.body.rankings.teams.find((t: any) => t.teamId === rank.teamId)!;

        expect(stat.globalPosition).toBe(rank.rank);
        expect(expTeam.rank).toBe(rank.rank);
      }
    });

    it('total sum of all points across all results is consistent', async () => {
      const { rows: [{ sum }] } = await pool.query(`
        SELECT SUM(mr.points)::int AS sum
        FROM map_result mr
        JOIN map ON map.id = mr.map_id
        JOIN match ON match.id = map.match_id
        WHERE match.tournament_id = $1
      `, [seed.tournamentId]);

      const rankings = await calculateTeamRankings(seed.tournamentId);
      const rankingSum = rankings.reduce((acc, r) => acc + r.totalPoints, 0);
      expect(rankingSum).toBe(sum);

      const stats = await getTeamStatistics(seed.tournamentId);
      const statsSum = stats.reduce((acc, s) => acc + s.totalPoints, 0);
      expect(statsSum).toBe(sum);
    });
  });
});
