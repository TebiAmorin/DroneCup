import { pool } from '../db/pool.js';
import { positionToPoints, validateAndScoreMapResults } from './scoring.js';
import type { MapResultInput, ValidatedMapResult, ValidationError } from './scoring.js';
import { calculateTeamRankings, createRankingSnapshot, recalculateAllSnapshots } from './ranking.js';

export async function getEligibleParticipants(mapId: string): Promise<string[]> {
  const { rows } = await pool.query<{ participant_id: string }>(`
    SELECT mp.participant_id
    FROM match_participation mp
    JOIN map ON map.match_id = mp.match_id
    WHERE map.id = $1
  `, [mapId]);
  return rows.map(r => r.participant_id);
}

export async function getTournamentIdForMap(mapId: string): Promise<string> {
  const { rows } = await pool.query<{ tournament_id: string }>(`
    SELECT match.tournament_id
    FROM map
    JOIN match ON match.id = map.match_id
    WHERE map.id = $1
  `, [mapId]);
  if (rows.length === 0) throw new Error(`Map ${mapId} not found`);
  return rows[0].tournament_id;
}

export async function submitMapResults(
  mapId: string,
  results: MapResultInput[]
): Promise<
  | { success: true; ranked: Awaited<ReturnType<typeof calculateTeamRankings>> }
  | { success: false; errors: ValidationError[] }
> {
  const eligible = await getEligibleParticipants(mapId);
  const validation = validateAndScoreMapResults(results, eligible);

  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  const tournamentId = await getTournamentIdForMap(mapId);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

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

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await createRankingSnapshot(tournamentId, mapId);
  const ranked = await calculateTeamRankings(tournamentId);
  return { success: true, ranked };
}

export async function correctMapResult(
  mapId: string,
  participantId: string,
  position: number | null,
  status: 'FINISHED' | 'DNF'
): Promise<
  | { success: true; ranked: Awaited<ReturnType<typeof calculateTeamRankings>> }
  | { success: false; errors: ValidationError[] }
> {
  const points = positionToPoints(position, status);
  const tournamentId = await getTournamentIdForMap(mapId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rowCount } = await client.query(
      `UPDATE map_result
       SET position = $1, status = $2, points = $3, updated_at = now()
       WHERE map_id = $4 AND participant_id = $5`,
      [position, status, points, mapId, participantId]
    );

    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return { success: false, errors: [{ field: 'participantId', message: 'Result not found for this participant on this map' }] };
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
  return { success: true, ranked };
}
