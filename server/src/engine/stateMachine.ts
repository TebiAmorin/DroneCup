import { pool } from '../db/pool.js';
import { validateAndScoreMapResults } from './scoring.js';
import type { MapResultInput } from './scoring.js';
import { calculateTeamRankings, createRankingSnapshot, recalculateAllSnapshots } from './ranking.js';
import { getEligibleParticipants, getTournamentIdForMap } from './results.js';
import { ApiError } from './errors.js';
import {
  emitCompetitionUpdated, emitMatchStarted, emitMatchCompleted,
  emitMapStarted, emitMapCompleted, emitResultUpdated, emitRankingUpdated,
} from '../realtime/emitter.js';

export async function startMatch(matchId: string) {
  const client = await pool.connect();
  let matchNumber: number;
  let phase: string;
  let firstMapId: string;
  let firstMapCode: string;
  let tournamentId: string;

  try {
    await client.query('BEGIN');

    const { rows: [match] } = await client.query(
      `SELECT id, tournament_id, status, match_number, phase FROM match WHERE id = $1 FOR UPDATE`,
      [matchId]
    );
    if (!match) throw new ApiError(404, 'NOT_FOUND', 'Match not found');
    if (match.status !== 'UPCOMING') {
      throw new ApiError(409, 'MATCH_NOT_READY', `Match is ${match.status}, can only start UPCOMING matches`);
    }

    tournamentId = match.tournament_id;
    matchNumber = match.match_number;
    phase = match.phase;

    const { rows: activeLive } = await client.query(
      `SELECT id FROM match WHERE tournament_id = $1 AND status = 'LIVE'`,
      [tournamentId]
    );
    if (activeLive.length > 0) {
      throw new ApiError(409, 'MATCH_ALREADY_LIVE', 'Another match is already LIVE');
    }

    await client.query(
      `UPDATE match SET status = 'LIVE', started_at = now() WHERE id = $1`,
      [matchId]
    );

    const { rows: [firstMap] } = await client.query(
      `SELECT id, code FROM map WHERE match_id = $1 ORDER BY map_index ASC LIMIT 1`,
      [matchId]
    );
    if (!firstMap) throw new ApiError(500, 'INTERNAL', 'Match has no maps');

    firstMapId = firstMap.id;
    firstMapCode = firstMap.code;

    await client.query(
      `UPDATE map SET status = 'ACTIVE', started_at = now() WHERE id = $1`,
      [firstMapId]
    );

    await client.query(
      `UPDATE tournament SET current_match_id = $1, current_map_id = $2 WHERE id = $3`,
      [matchId, firstMapId, tournamentId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Emit events only after successful commit
  emitMatchStarted({
    matchId, matchNumber, phase, status: 'LIVE',
    currentMapId: firstMapId, currentMapCode: firstMapCode,
  });
  emitMapStarted({ mapId: firstMapId, matchId, mapCode: firstMapCode, mapIndex: 1 });
  emitCompetitionUpdated({
    tournamentId, status: 'LIVE',
    currentMatchId: matchId, currentMapId: firstMapId,
  });

  return { matchId, mapId: firstMapId, tournamentId };
}

export async function confirmMapResults(mapId: string, inputResults: MapResultInput[]) {
  const client = await pool.connect();
  let tournamentId: string;
  let matchId: string;
  let mapCode: string;
  let matchNumber: number;
  let phase: string;
  let isLastMap: boolean;
  let nextMapId: string | null = null;
  let nextMapCode: string | null = null;
  let nextMapIndex: number | null = null;
  let scoredResults: { participantId: string; position: number | null; status: string; points: number }[];

  try {
    await client.query('BEGIN');

    const { rows: [map] } = await client.query(
      `SELECT map.id, map.match_id, map.status, map.map_index, map.code,
              match.status AS match_status, match.tournament_id, match.match_number, match.phase
       FROM map
       JOIN match ON match.id = map.match_id
       WHERE map.id = $1
       FOR UPDATE OF map`,
      [mapId]
    );
    if (!map) throw new ApiError(404, 'NOT_FOUND', 'Map not found');
    if (map.status !== 'ACTIVE') {
      throw new ApiError(409, 'MAP_NOT_ACTIVE', `Map is ${map.status}, can only confirm ACTIVE maps`);
    }
    if (map.match_status !== 'LIVE') {
      throw new ApiError(409, 'MATCH_NOT_LIVE', `Match is ${map.match_status}, must be LIVE`);
    }

    matchId = map.match_id;
    tournamentId = map.tournament_id;
    mapCode = map.code;
    matchNumber = map.match_number;
    phase = map.phase;

    const { rows: eligibleRows } = await client.query(
      `SELECT mp.participant_id FROM match_participation mp WHERE mp.match_id = $1`,
      [matchId]
    );
    const eligibleIds = eligibleRows.map((r: { participant_id: string }) => r.participant_id);

    const resultsWithDefaults: MapResultInput[] = inputResults.map(r => ({
      participantId: r.participantId,
      position: r.position,
      status: r.status || (r.position !== null ? 'FINISHED' : 'DNF'),
    }));

    const validation = validateAndScoreMapResults(resultsWithDefaults, eligibleIds);
    if (!validation.valid) {
      const first = validation.errors[0];
      const code = mapErrorCode(first.field);
      throw new ApiError(400, code, first.message);
    }

    scoredResults = validation.scored.map(r => ({
      participantId: r.participantId,
      position: r.position,
      status: r.status,
      points: r.points,
    }));

    await client.query(`DELETE FROM map_result WHERE map_id = $1`, [mapId]);

    for (const r of validation.scored) {
      await client.query(
        `INSERT INTO map_result (map_id, participant_id, position, status, points)
         VALUES ($1, $2, $3, $4, $5)`,
        [mapId, r.participantId, r.position, r.status, r.points]
      );
    }

    await client.query(
      `UPDATE map SET status = 'COMPLETED', completed_at = now() WHERE id = $1`,
      [mapId]
    );

    const { rows: [nextMapRow] } = await client.query(
      `SELECT id, code, map_index FROM map WHERE match_id = $1 AND status = 'PENDING' ORDER BY map_index ASC LIMIT 1`,
      [matchId]
    );

    isLastMap = !nextMapRow;

    if (nextMapRow) {
      nextMapId = nextMapRow.id;
      nextMapCode = nextMapRow.code;
      nextMapIndex = nextMapRow.map_index;
      await client.query(
        `UPDATE map SET status = 'ACTIVE', started_at = now() WHERE id = $1`,
        [nextMapId]
      );
      await client.query(
        `UPDATE tournament SET current_map_id = $1 WHERE id = $2`,
        [nextMapId, tournamentId]
      );
    } else {
      await client.query(
        `UPDATE match SET status = 'COMPLETED', completed_at = now() WHERE id = $1`,
        [matchId]
      );
      await client.query(
        `UPDATE tournament SET current_match_id = NULL, current_map_id = NULL WHERE id = $1`,
        [tournamentId]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await createRankingSnapshot(tournamentId, mapId);
  const ranked = await calculateTeamRankings(tournamentId);

  // Emit events after successful commit + ranking
  emitMapCompleted({ mapId, mapCode, results: scoredResults });
  emitRankingUpdated(ranked);

  if (isLastMap) {
    emitMatchCompleted({ matchId, matchNumber, phase, ranked });
    emitCompetitionUpdated({
      tournamentId, status: 'LIVE',
      currentMatchId: null, currentMapId: null,
    });
  } else {
    emitMapStarted({ mapId: nextMapId!, matchId, mapCode: nextMapCode!, mapIndex: nextMapIndex! });
    emitCompetitionUpdated({
      tournamentId, status: 'LIVE',
      currentMatchId: matchId, currentMapId: nextMapId,
    });
  }

  return { ranked, matchCompleted: isLastMap };
}

export async function correctMapResults(mapId: string, inputResults: MapResultInput[]) {
  const client = await pool.connect();
  let tournamentId: string;
  let mapCode: string;
  let scoredResults: { participantId: string; position: number | null; status: string; points: number }[];

  try {
    await client.query('BEGIN');

    const { rows: [map] } = await client.query(
      `SELECT map.id, map.match_id, map.status, map.code, match.tournament_id
       FROM map
       JOIN match ON match.id = map.match_id
       WHERE map.id = $1`,
      [mapId]
    );
    if (!map) throw new ApiError(404, 'NOT_FOUND', 'Map not found');
    if (map.status !== 'COMPLETED') {
      throw new ApiError(409, 'MAP_NOT_COMPLETED', 'Can only correct results of COMPLETED maps');
    }

    tournamentId = map.tournament_id;
    mapCode = map.code;

    const { rows: eligibleRows } = await client.query(
      `SELECT mp.participant_id FROM match_participation mp WHERE mp.match_id = $1`,
      [map.match_id]
    );
    const eligibleIds = eligibleRows.map((r: { participant_id: string }) => r.participant_id);

    const resultsWithDefaults: MapResultInput[] = inputResults.map(r => ({
      participantId: r.participantId,
      position: r.position,
      status: r.status || (r.position !== null ? 'FINISHED' : 'DNF'),
    }));

    const validation = validateAndScoreMapResults(resultsWithDefaults, eligibleIds);
    if (!validation.valid) {
      const first = validation.errors[0];
      throw new ApiError(400, mapErrorCode(first.field), first.message);
    }

    scoredResults = validation.scored.map(r => ({
      participantId: r.participantId,
      position: r.position,
      status: r.status,
      points: r.points,
    }));

    await client.query(`DELETE FROM map_result WHERE map_id = $1`, [mapId]);

    for (const r of validation.scored) {
      await client.query(
        `INSERT INTO map_result (map_id, participant_id, position, status, points)
         VALUES ($1, $2, $3, $4, $5)`,
        [mapId, r.participantId, r.position, r.status, r.points]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await recalculateAllSnapshots(tournamentId);
  const ranked = await calculateTeamRankings(tournamentId);

  // Emit events after successful commit + recalculation
  emitResultUpdated({ mapId, mapCode, results: scoredResults });
  emitRankingUpdated(ranked);

  return { ranked };
}

export async function resetMatch(matchId: string) {
  const client = await pool.connect();
  let tournamentId: string;
  let tournamentStatus: string;
  let currentMatchId: string | null = null;
  let currentMapId: string | null = null;
  let isNoop = false;

  try {
    await client.query('BEGIN');

    const { rows: [match] } = await client.query(
      `SELECT m.id, m.tournament_id, m.status, m.match_number, m.phase,
              t.status AS tournament_status, t.current_match_id, t.current_map_id
       FROM match m
       JOIN tournament t ON t.id = m.tournament_id
       WHERE m.id = $1
       FOR UPDATE OF m`,
      [matchId]
    );

    if (!match) {
      throw new ApiError(404, 'NOT_FOUND', 'Match not found');
    }

    tournamentId = match.tournament_id;
    tournamentStatus = match.tournament_status;
    currentMatchId = match.current_match_id;
    currentMapId = match.current_map_id;

    if (match.status === 'UPCOMING') {
      isNoop = true;
      await client.query('COMMIT');
    } else {
      // 1. Delete all map_result belonging to maps of this match
      await client.query(
        `DELETE FROM map_result
         WHERE map_id IN (SELECT id FROM map WHERE match_id = $1)`,
        [matchId]
      );

      // 2. Reset all maps of this match to PENDING with null timestamps
      await client.query(
        `UPDATE map
         SET status = 'PENDING', started_at = NULL, completed_at = NULL
         WHERE match_id = $1`,
        [matchId]
      );

      // 3. Reset match to UPCOMING with null timestamps
      await client.query(
        `UPDATE match
         SET status = 'UPCOMING', started_at = NULL, completed_at = NULL
         WHERE id = $1`,
        [matchId]
      );

      // 4. If tournament points to this match, clear pointers
      if (currentMatchId === matchId) {
        await client.query(
          `UPDATE tournament
           SET current_match_id = NULL, current_map_id = NULL
           WHERE id = $1`,
          [tournamentId]
        );
        currentMatchId = null;
        currentMapId = null;
      }

      await client.query('COMMIT');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (isNoop) {
    return {
      success: true,
      matchId,
      status: 'UPCOMING',
      noop: true,
    };
  }

  // After commit:
  // Reconstruct ranking snapshots using existing infrastructure
  await recalculateAllSnapshots(tournamentId);

  // Recalculate current team rankings using existing infrastructure
  const ranked = await calculateTeamRankings(tournamentId);

  // Emit realtime events
  emitRankingUpdated(ranked);
  emitCompetitionUpdated({
    tournamentId,
    status: tournamentStatus,
    currentMatchId,
    currentMapId,
  });

  return {
    success: true,
    matchId,
    status: 'UPCOMING',
    ranked,
  };
}

function mapErrorCode(field: string): string {
  switch (field) {
    case 'results': return 'INVALID_RESULT';
    case 'participantId': return 'INVALID_PARTICIPANT';
    case 'position': return 'INVALID_POSITION';
    default: return 'INVALID_RESULT';
  }
}
