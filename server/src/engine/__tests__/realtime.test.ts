import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { pool } from '../../db/pool.js';
import { startMatch, confirmMapResults, correctMapResults } from '../stateMachine.js';
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

beforeAll(async () => {
  seed = await resetAndSeed();
});

afterAll(async () => {
  await pool.end();
});

describe('Realtime Events', () => {
  beforeEach(async () => {
    seed = await resetAndSeed();
    vi.clearAllMocks();
  });

  describe('startMatch', () => {
    it('emits match.started, map.started, competition.updated', async () => {
      await startMatch(seed.matches[0]);

      expect(emitter.emitMatchStarted).toHaveBeenCalledOnce();
      expect(emitter.emitMatchStarted).toHaveBeenCalledWith(
        expect.objectContaining({
          matchId: seed.matches[0],
          matchNumber: 1,
          phase: 'MAIN',
          status: 'LIVE',
          currentMapId: seed.maps[0][0],
          currentMapCode: 'P1M1',
        })
      );

      expect(emitter.emitMapStarted).toHaveBeenCalledOnce();
      expect(emitter.emitMapStarted).toHaveBeenCalledWith(
        expect.objectContaining({
          mapId: seed.maps[0][0],
          matchId: seed.matches[0],
          mapCode: 'P1M1',
          mapIndex: 1,
        })
      );

      expect(emitter.emitCompetitionUpdated).toHaveBeenCalledOnce();
      expect(emitter.emitCompetitionUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          tournamentId: seed.tournamentId,
          status: 'LIVE',
          currentMatchId: seed.matches[0],
          currentMapId: seed.maps[0][0],
        })
      );
    });

    it('does NOT emit events when startMatch fails', async () => {
      await startMatch(seed.matches[0]);
      vi.clearAllMocks();

      await expect(startMatch(seed.matches[1])).rejects.toThrow('Another match is already LIVE');

      expect(emitter.emitMatchStarted).not.toHaveBeenCalled();
      expect(emitter.emitMapStarted).not.toHaveBeenCalled();
      expect(emitter.emitCompetitionUpdated).not.toHaveBeenCalled();
    });
  });

  describe('confirmMapResults', () => {
    it('emits map.completed, ranking.updated, map.started, competition.updated for mid-match map', async () => {
      await startMatch(seed.matches[0]);
      vi.clearAllMocks();

      await confirmMapResults(seed.maps[0][0], buildMapResults(seed, 0));

      expect(emitter.emitMapCompleted).toHaveBeenCalledOnce();
      expect(emitter.emitMapCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          mapId: seed.maps[0][0],
          mapCode: 'P1M1',
          results: expect.arrayContaining([
            expect.objectContaining({ points: expect.any(Number) }),
          ]),
        })
      );

      expect(emitter.emitRankingUpdated).toHaveBeenCalledOnce();
      expect(emitter.emitRankingUpdated).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ teamSlug: expect.any(String), totalPoints: expect.any(Number) }),
        ])
      );

      expect(emitter.emitMapStarted).toHaveBeenCalledOnce();
      expect(emitter.emitMapStarted).toHaveBeenCalledWith(
        expect.objectContaining({
          mapId: seed.maps[0][1],
          matchId: seed.matches[0],
          mapCode: 'P1M2',
          mapIndex: 2,
        })
      );

      expect(emitter.emitCompetitionUpdated).toHaveBeenCalledOnce();
      expect(emitter.emitMatchCompleted).not.toHaveBeenCalled();
    });

    it('emits match.completed instead of map.started on last map of match', async () => {
      await startMatch(seed.matches[0]);
      await confirmMapResults(seed.maps[0][0], buildMapResults(seed, 0));
      await confirmMapResults(seed.maps[0][1], buildMapResults(seed, 0));
      vi.clearAllMocks();

      await confirmMapResults(seed.maps[0][2], buildMapResults(seed, 0));

      expect(emitter.emitMapCompleted).toHaveBeenCalledOnce();
      expect(emitter.emitRankingUpdated).toHaveBeenCalledOnce();

      expect(emitter.emitMatchCompleted).toHaveBeenCalledOnce();
      expect(emitter.emitMatchCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          matchId: seed.matches[0],
          matchNumber: 1,
          phase: 'MAIN',
        })
      );

      expect(emitter.emitMapStarted).not.toHaveBeenCalled();

      expect(emitter.emitCompetitionUpdated).toHaveBeenCalledOnce();
      expect(emitter.emitCompetitionUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          currentMatchId: null,
          currentMapId: null,
        })
      );
    });

    it('does NOT emit events when confirmMapResults fails', async () => {
      await expect(
        confirmMapResults(seed.maps[0][0], buildMapResults(seed, 0))
      ).rejects.toThrow();

      expect(emitter.emitMapCompleted).not.toHaveBeenCalled();
      expect(emitter.emitRankingUpdated).not.toHaveBeenCalled();
    });
  });

  describe('correctMapResults', () => {
    it('emits result.updated and ranking.updated after correction', async () => {
      await startMatch(seed.matches[0]);
      await confirmMapResults(seed.maps[0][0], buildMapResults(seed, 0));
      await confirmMapResults(seed.maps[0][1], buildMapResults(seed, 0));
      await confirmMapResults(seed.maps[0][2], buildMapResults(seed, 0));
      vi.clearAllMocks();

      const corrected = buildMapResults(seed, 0);
      const idx = corrected.findIndex(r => r.participantId === seed.participants['alpha'].creator);
      corrected.splice(idx, 1);
      corrected.forEach((r, i) => { r.position = i + 1; });
      corrected.push({ participantId: seed.participants['alpha'].creator, position: null, status: 'DNF' });

      await correctMapResults(seed.maps[0][0], corrected);

      expect(emitter.emitResultUpdated).toHaveBeenCalledOnce();
      expect(emitter.emitResultUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          mapId: seed.maps[0][0],
          mapCode: 'P1M1',
          results: expect.arrayContaining([
            expect.objectContaining({ participantId: seed.participants['alpha'].creator, status: 'DNF', points: 0 }),
          ]),
        })
      );

      expect(emitter.emitRankingUpdated).toHaveBeenCalledOnce();

      expect(emitter.emitMapCompleted).not.toHaveBeenCalled();
      expect(emitter.emitMatchStarted).not.toHaveBeenCalled();
    });

    it('does NOT emit events when correction fails', async () => {
      await expect(
        correctMapResults(seed.maps[0][0], buildMapResults(seed, 0))
      ).rejects.toThrow();

      expect(emitter.emitResultUpdated).not.toHaveBeenCalled();
      expect(emitter.emitRankingUpdated).not.toHaveBeenCalled();
    });
  });

  describe('Event ordering', () => {
    it('emits events in correct sequence for startMatch', async () => {
      const callOrder: string[] = [];
      vi.mocked(emitter.emitMatchStarted).mockImplementation(() => { callOrder.push('match.started'); });
      vi.mocked(emitter.emitMapStarted).mockImplementation(() => { callOrder.push('map.started'); });
      vi.mocked(emitter.emitCompetitionUpdated).mockImplementation(() => { callOrder.push('competition.updated'); });

      await startMatch(seed.matches[0]);

      expect(callOrder).toEqual(['match.started', 'map.started', 'competition.updated']);
    });

    it('emits events in correct sequence for confirmMapResults (mid-match)', async () => {
      await startMatch(seed.matches[0]);

      const callOrder: string[] = [];
      vi.mocked(emitter.emitMapCompleted).mockImplementation(() => { callOrder.push('map.completed'); });
      vi.mocked(emitter.emitRankingUpdated).mockImplementation(() => { callOrder.push('ranking.updated'); });
      vi.mocked(emitter.emitMapStarted).mockImplementation(() => { callOrder.push('map.started'); });
      vi.mocked(emitter.emitCompetitionUpdated).mockImplementation(() => { callOrder.push('competition.updated'); });

      await confirmMapResults(seed.maps[0][0], buildMapResults(seed, 0));

      expect(callOrder).toEqual(['map.completed', 'ranking.updated', 'map.started', 'competition.updated']);
    });

    it('emits events in correct sequence for confirmMapResults (last map)', async () => {
      await startMatch(seed.matches[0]);
      await confirmMapResults(seed.maps[0][0], buildMapResults(seed, 0));
      await confirmMapResults(seed.maps[0][1], buildMapResults(seed, 0));

      const callOrder: string[] = [];
      vi.mocked(emitter.emitMapCompleted).mockImplementation(() => { callOrder.push('map.completed'); });
      vi.mocked(emitter.emitRankingUpdated).mockImplementation(() => { callOrder.push('ranking.updated'); });
      vi.mocked(emitter.emitMatchCompleted).mockImplementation(() => { callOrder.push('match.completed'); });
      vi.mocked(emitter.emitCompetitionUpdated).mockImplementation(() => { callOrder.push('competition.updated'); });

      await confirmMapResults(seed.maps[0][2], buildMapResults(seed, 0));

      expect(callOrder).toEqual(['map.completed', 'ranking.updated', 'match.completed', 'competition.updated']);
    });
  });
});
