import { pool } from '../db/pool.js';
import { calculateTeamRankings, calculateIndividualRankings } from './ranking.js';
import type { TeamStats, ParticipantStats, MapPoints, MatchPoints, ProgressionPoint, PositionCount } from '../../../shared/types.js';

// ── TEAM STATISTICS ────────────────────────────────────

export async function getTeamStatistics(tournamentId: string): Promise<TeamStats[]> {
  const rankings = await calculateTeamRankings(tournamentId);

  const { rows: teamMapData } = await pool.query<{
    team_id: string;
    map_id: string;
    map_code: string;
    match_id: string;
    match_number: number;
    map_index: number;
    team_points: string;
  }>(`
    SELECT
      t.id AS team_id,
      map.id AS map_id,
      map.code AS map_code,
      match.id AS match_id,
      match.match_number,
      map.map_index,
      COALESCE(SUM(mr.points), 0)::text AS team_points
    FROM team t
    JOIN participant p ON p.team_id = t.id
    JOIN map_result mr ON mr.participant_id = p.id
    JOIN map ON map.id = mr.map_id
    JOIN match ON match.id = map.match_id
    WHERE t.tournament_id = $1
      AND map.status = 'COMPLETED'
    GROUP BY t.id, map.id, map.code, match.id, match.match_number, map.map_index
    ORDER BY match.match_number, map.map_index
  `, [tournamentId]);

  // Maps won: for each completed map, find which team had the highest combined score
  const mapWins = new Map<string, Set<string>>();
  const mapTeamPoints = new Map<string, { teamId: string; points: number }[]>();

  for (const row of teamMapData) {
    if (!mapTeamPoints.has(row.map_id)) {
      mapTeamPoints.set(row.map_id, []);
    }
    mapTeamPoints.get(row.map_id)!.push({
      teamId: row.team_id,
      points: parseInt(row.team_points, 10),
    });
  }

  for (const [mapId, entries] of mapTeamPoints) {
    const maxPts = Math.max(...entries.map(e => e.points));
    if (maxPts > 0) {
      const winners = entries.filter(e => e.points === maxPts);
      // Only count as a win if there's a single team with the highest score
      if (winners.length === 1) {
        const tid = winners[0].teamId;
        if (!mapWins.has(tid)) mapWins.set(tid, new Set());
        mapWins.get(tid)!.add(mapId);
      }
    }
  }

  return rankings.map(r => {
    const teamRows = teamMapData.filter(d => d.team_id === r.teamId);
    const mapIds = new Set(teamRows.map(d => d.map_id));

    const pointsByMap: MapPoints[] = teamRows.map(d => ({
      mapId: d.map_id,
      mapCode: d.map_code,
      matchNumber: d.match_number,
      mapIndex: d.map_index,
      points: parseInt(d.team_points, 10),
    }));

    const matchMap = new Map<string, { matchId: string; matchNumber: number; points: number }>();
    for (const d of teamRows) {
      const existing = matchMap.get(d.match_id);
      const pts = parseInt(d.team_points, 10);
      if (existing) {
        existing.points += pts;
      } else {
        matchMap.set(d.match_id, { matchId: d.match_id, matchNumber: d.match_number, points: pts });
      }
    }
    const pointsByMatch: MatchPoints[] = Array.from(matchMap.values())
      .sort((a, b) => a.matchNumber - b.matchNumber);

    // Progression: cumulative points in chronological order
    let cumulative = 0;
    const progression: ProgressionPoint[] = pointsByMap.map(mp => {
      cumulative += mp.points;
      return {
        mapId: mp.mapId,
        mapCode: mp.mapCode,
        matchNumber: mp.matchNumber,
        mapIndex: mp.mapIndex,
        cumulativePoints: cumulative,
      };
    });

    return {
      teamId: r.teamId,
      teamName: r.teamName,
      teamSlug: r.teamSlug,
      teamColor: r.teamColor,
      totalPoints: r.totalPoints,
      globalPosition: r.rank,
      mapsPlayed: mapIds.size,
      mapsWon: mapWins.get(r.teamId)?.size ?? 0,
      pointsByMatch,
      pointsByMap,
      progression,
    };
  });
}

export async function getSingleTeamStatistics(tournamentId: string, teamId: string): Promise<TeamStats | null> {
  const all = await getTeamStatistics(tournamentId);
  return all.find(t => t.teamId === teamId) ?? null;
}

// ── PARTICIPANT STATISTICS ─────────────────────────────

export async function getParticipantStatistics(tournamentId: string): Promise<ParticipantStats[]> {
  const rankings = await calculateIndividualRankings(tournamentId);

  const { rows: resultData } = await pool.query<{
    participant_id: string;
    map_id: string;
    map_code: string;
    match_number: number;
    map_index: number;
    position: number | null;
    result_status: string;
    points: number;
  }>(`
    SELECT
      mr.participant_id,
      map.id AS map_id,
      map.code AS map_code,
      match.match_number,
      map.map_index,
      mr.position,
      mr.status AS result_status,
      mr.points
    FROM map_result mr
    JOIN map ON map.id = mr.map_id
    JOIN match ON match.id = map.match_id
    JOIN participant p ON p.id = mr.participant_id
    JOIN team t ON t.id = p.team_id
    WHERE t.tournament_id = $1
      AND map.status = 'COMPLETED'
    ORDER BY match.match_number, map.map_index
  `, [tournamentId]);

  return rankings.map(r => {
    const pRows = resultData.filter(d => d.participant_id === r.participantId);
    const mapsPlayed = pRows.length;

    const pointsByMap: MapPoints[] = pRows.map(d => ({
      mapId: d.map_id,
      mapCode: d.map_code,
      matchNumber: d.match_number,
      mapIndex: d.map_index,
      points: d.points,
    }));

    let cumulative = 0;
    const progression: ProgressionPoint[] = pointsByMap.map(mp => {
      cumulative += mp.points;
      return {
        mapId: mp.mapId,
        mapCode: mp.mapCode,
        matchNumber: mp.matchNumber,
        mapIndex: mp.mapIndex,
        cumulativePoints: cumulative,
      };
    });

    const finishedPositions = pRows
      .filter(d => d.result_status === 'FINISHED' && d.position !== null)
      .map(d => d.position!);

    const bestPosition = finishedPositions.length > 0
      ? Math.min(...finishedPositions)
      : null;

    const dnfCount = pRows.filter(d => d.result_status === 'DNF').length;

    // Position distribution: count for each position 1-10 + DNF
    const positionCounts: PositionCount[] = [];
    for (let pos = 1; pos <= 10; pos++) {
      const count = pRows.filter(d => d.result_status === 'FINISHED' && d.position === pos).length;
      positionCounts.push({ position: pos, count });
    }
    positionCounts.push({ position: 'DNF', count: dnfCount });

    const averagePointsPerMap = mapsPlayed > 0
      ? Math.round((r.totalPoints / mapsPlayed) * 100) / 100
      : null;

    return {
      participantId: r.participantId,
      participantName: r.participantName,
      participantType: r.participantType as ParticipantStats['participantType'],
      teamId: r.teamId,
      teamName: r.teamName,
      totalPoints: r.totalPoints,
      mapsPlayed,
      averagePointsPerMap,
      bestPosition,
      positionCounts,
      dnfCount,
      pointsByMap,
      progression,
    };
  });
}

export async function getSingleParticipantStatistics(tournamentId: string, participantId: string): Promise<ParticipantStats | null> {
  const all = await getParticipantStatistics(tournamentId);
  return all.find(p => p.participantId === participantId) ?? null;
}
