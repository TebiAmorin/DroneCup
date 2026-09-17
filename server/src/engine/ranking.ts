import { pool } from '../db/pool.js';

export interface TeamRankingRow {
  rank: number;
  teamId: string;
  teamName: string;
  teamSlug: string;
  teamColor: string | null;
  totalPoints: number;
}

export interface IndividualRankingRow {
  rank: number;
  participantId: string;
  participantName: string;
  participantType: string;
  teamId: string;
  teamName: string;
  totalPoints: number;
}

export async function calculateTeamRankings(tournamentId: string): Promise<TeamRankingRow[]> {
  const { rows } = await pool.query<{
    team_id: string;
    team_name: string;
    team_slug: string;
    team_color: string | null;
    total_points: string;
  }>(`
    SELECT
      t.id AS team_id,
      t.name AS team_name,
      t.slug AS team_slug,
      t.color AS team_color,
      COALESCE(SUM(mr.points), 0)::text AS total_points
    FROM team t
    LEFT JOIN participant p ON p.team_id = t.id
    LEFT JOIN map_result mr ON mr.participant_id = p.id
    WHERE t.tournament_id = $1
    GROUP BY t.id, t.name, t.slug, t.color
    ORDER BY COALESCE(SUM(mr.points), 0) DESC, t.name ASC
  `, [tournamentId]);

  return rows.map((row, i) => ({
    rank: i + 1,
    teamId: row.team_id,
    teamName: row.team_name,
    teamSlug: row.team_slug,
    teamColor: row.team_color,
    totalPoints: parseInt(row.total_points, 10),
  }));
}

export async function calculateIndividualRankings(tournamentId: string): Promise<IndividualRankingRow[]> {
  const { rows } = await pool.query<{
    participant_id: string;
    participant_name: string;
    participant_type: string;
    team_id: string;
    team_name: string;
    total_points: string;
  }>(`
    SELECT
      p.id AS participant_id,
      p.name AS participant_name,
      p.type AS participant_type,
      t.id AS team_id,
      t.name AS team_name,
      COALESCE(SUM(mr.points), 0)::text AS total_points
    FROM participant p
    JOIN team t ON t.id = p.team_id
    LEFT JOIN map_result mr ON mr.participant_id = p.id
    WHERE t.tournament_id = $1
    GROUP BY p.id, p.name, p.type, t.id, t.name
    ORDER BY COALESCE(SUM(mr.points), 0) DESC, p.name ASC
  `, [tournamentId]);

  return rows.map((row, i) => ({
    rank: i + 1,
    participantId: row.participant_id,
    participantName: row.participant_name,
    participantType: row.participant_type,
    teamId: row.team_id,
    teamName: row.team_name,
    totalPoints: parseInt(row.total_points, 10),
  }));
}

export async function createRankingSnapshot(tournamentId: string, mapId: string): Promise<void> {
  const rankings = await calculateTeamRankings(tournamentId);

  await pool.query(
    `DELETE FROM ranking_snapshot WHERE tournament_id = $1 AND map_id = $2`,
    [tournamentId, mapId]
  );

  if (rankings.length === 0) return;

  const values: string[] = [];
  const params: (string | number)[] = [tournamentId, mapId];
  let paramIndex = 3;

  for (const r of rankings) {
    values.push(`($1, $2, $${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`);
    params.push(r.teamId, r.rank, r.totalPoints);
    paramIndex += 3;
  }

  await pool.query(
    `INSERT INTO ranking_snapshot (tournament_id, map_id, team_id, rank, total_points)
     VALUES ${values.join(', ')}`,
    params
  );
}

export async function recalculateAllSnapshots(tournamentId: string): Promise<void> {
  const { rows: completedMaps } = await pool.query<{ map_id: string }>(`
    SELECT map.id AS map_id
    FROM map
    JOIN match ON match.id = map.match_id
    WHERE match.tournament_id = $1
      AND map.status = 'COMPLETED'
    ORDER BY match.match_number ASC, map.map_index ASC
  `, [tournamentId]);

  await pool.query(
    `DELETE FROM ranking_snapshot WHERE tournament_id = $1`,
    [tournamentId]
  );

  for (const { map_id } of completedMaps) {
    await createSnapshotAtMap(tournamentId, map_id);
  }
}

async function createSnapshotAtMap(tournamentId: string, upToMapId: string): Promise<void> {
  const { rows } = await pool.query<{
    team_id: string;
    total_points: string;
  }>(`
    SELECT
      t.id AS team_id,
      COALESCE(SUM(mr.points), 0)::text AS total_points
    FROM team t
    LEFT JOIN participant p ON p.team_id = t.id
    LEFT JOIN map_result mr ON mr.participant_id = p.id
      AND mr.map_id IN (
        SELECT m2.id FROM map m2
        JOIN match mt2 ON mt2.id = m2.match_id
        WHERE mt2.tournament_id = $1
          AND m2.status = 'COMPLETED'
          AND (mt2.match_number, m2.map_index) <= (
            SELECT mt3.match_number, m3.map_index
            FROM map m3 JOIN match mt3 ON mt3.id = m3.match_id
            WHERE m3.id = $2
          )
      )
    WHERE t.tournament_id = $1
    GROUP BY t.id
    ORDER BY COALESCE(SUM(mr.points), 0) DESC, t.name ASC
  `, [tournamentId, upToMapId]);

  if (rows.length === 0) return;

  const values: string[] = [];
  const params: (string | number)[] = [tournamentId, upToMapId];
  let paramIndex = 3;

  rows.forEach((row, i) => {
    values.push(`($1, $2, $${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`);
    params.push(row.team_id, i + 1, parseInt(row.total_points, 10));
    paramIndex += 3;
  });

  await pool.query(
    `INSERT INTO ranking_snapshot (tournament_id, map_id, team_id, rank, total_points)
     VALUES ${values.join(', ')}`,
    params
  );
}

export async function getRankingHistory(tournamentId: string): Promise<{
  mapId: string;
  mapCode: string;
  rankings: { teamId: string; teamName: string; rank: number; totalPoints: number }[];
}[]> {
  const { rows } = await pool.query<{
    map_id: string;
    map_code: string;
    team_id: string;
    team_name: string;
    rank: number;
    total_points: number;
  }>(`
    SELECT
      rs.map_id,
      map.code AS map_code,
      rs.team_id,
      t.name AS team_name,
      rs.rank,
      rs.total_points
    FROM ranking_snapshot rs
    JOIN map ON map.id = rs.map_id
    JOIN match ON match.id = map.match_id
    JOIN team t ON t.id = rs.team_id
    WHERE rs.tournament_id = $1
    ORDER BY match.match_number, map.map_index, rs.rank
  `, [tournamentId]);

  const byMap = new Map<string, {
    mapId: string;
    mapCode: string;
    rankings: { teamId: string; teamName: string; rank: number; totalPoints: number }[];
  }>();

  for (const row of rows) {
    if (!byMap.has(row.map_id)) {
      byMap.set(row.map_id, { mapId: row.map_id, mapCode: row.map_code, rankings: [] });
    }
    byMap.get(row.map_id)!.rankings.push({
      teamId: row.team_id,
      teamName: row.team_name,
      rank: row.rank,
      totalPoints: row.total_points,
    });
  }

  return Array.from(byMap.values());
}
