import { Router } from 'express';
import { pool } from '../db/pool.js';
import { calculateTeamRankings, calculateIndividualRankings, getRankingHistory } from '../engine/ranking.js';
import { getTeamStatistics, getParticipantStatistics } from '../engine/statistics.js';
import { ApiError } from '../engine/errors.js';

const router = Router();

function escapeCsv(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(fields: (string | number | null)[]): string {
  return fields.map(escapeCsv).join(',');
}

async function getTournamentId(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>('SELECT id FROM tournament LIMIT 1');
  if (rows.length === 0) throw new ApiError(404, 'NO_TOURNAMENT', 'No tournament found');
  return rows[0].id;
}

// GET /api/export/teams.csv
router.get('/teams.csv', async (_req, res, next) => {
  try {
    const tournamentId = await getTournamentId();
    const stats = await getTeamStatistics(tournamentId);

    const header = csvRow(['Posición', 'Equipo', 'Puntos Totales', 'Mapas Jugados', 'Mapas Ganados']);
    const rows = stats.map(t =>
      csvRow([t.globalPosition, t.teamName, t.totalPoints, t.mapsPlayed, t.mapsWon])
    );

    const csv = [header, ...rows].join('\r\n') + '\r\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="clasificacion_equipos.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

// GET /api/export/participants.csv
router.get('/participants.csv', async (_req, res, next) => {
  try {
    const tournamentId = await getTournamentId();
    const stats = await getParticipantStatistics(tournamentId);

    const sorted = [...stats].sort((a, b) => b.totalPoints - a.totalPoints || a.participantName.localeCompare(b.participantName));

    const header = csvRow(['Posición', 'Jugador', 'Tipo', 'Equipo', 'Puntos Totales', 'Mapas Jugados', 'Promedio por Mapa']);
    const rows = sorted.map((p, i) =>
      csvRow([
        i + 1,
        p.participantName,
        p.participantType,
        p.teamName,
        p.totalPoints,
        p.mapsPlayed,
        p.averagePointsPerMap !== null ? p.averagePointsPerMap : '',
      ])
    );

    const csv = [header, ...rows].join('\r\n') + '\r\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="clasificacion_individual.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

// GET /api/export/results-by-map.csv
router.get('/results-by-map.csv', async (_req, res, next) => {
  try {
    const tournamentId = await getTournamentId();

    const { rows: results } = await pool.query<{
      map_code: string;
      match_number: number;
      map_index: number;
      position: number | null;
      participant_name: string;
      participant_type: string;
      team_name: string;
      result_status: string;
      points: number;
    }>(`
      SELECT
        map.code AS map_code,
        match.match_number,
        map.map_index,
        mr.position,
        p.name AS participant_name,
        p.type AS participant_type,
        t.name AS team_name,
        mr.status AS result_status,
        mr.points
      FROM map_result mr
      JOIN map ON map.id = mr.map_id
      JOIN match ON match.id = map.match_id
      JOIN participant p ON p.id = mr.participant_id
      JOIN team t ON t.id = p.team_id
      WHERE match.tournament_id = $1
        AND map.status = 'COMPLETED'
      ORDER BY match.match_number, map.map_index, COALESCE(mr.position, 999)
    `, [tournamentId]);

    const header = csvRow(['Mapa', 'Partida', 'Índice Mapa', 'Posición', 'Jugador', 'Tipo', 'Equipo', 'Estado', 'Puntos']);
    const rows = results.map(r =>
      csvRow([
        r.map_code,
        r.match_number,
        r.map_index,
        r.position,
        r.participant_name,
        r.participant_type,
        r.team_name,
        r.result_status,
        r.points,
      ])
    );

    const csv = [header, ...rows].join('\r\n') + '\r\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="resultados_por_mapa.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

// GET /api/export/results-by-match.csv
router.get('/results-by-match.csv', async (_req, res, next) => {
  try {
    const tournamentId = await getTournamentId();
    const stats = await getTeamStatistics(tournamentId);

    const matchNumbers = new Set<number>();
    for (const t of stats) {
      for (const mp of t.pointsByMatch) {
        matchNumbers.add(mp.matchNumber);
      }
    }
    const sortedMatchNumbers = [...matchNumbers].sort((a, b) => a - b);

    const header = csvRow(['Equipo', 'Puntos Totales', ...sortedMatchNumbers.map(n => `Partida ${n}`)]);
    const rows = stats.map(t => {
      const matchPointsMap = new Map(t.pointsByMatch.map(mp => [mp.matchNumber, mp.points]));
      return csvRow([
        t.teamName,
        t.totalPoints,
        ...sortedMatchNumbers.map(n => matchPointsMap.get(n) ?? 0),
      ]);
    });

    const csv = [header, ...rows].join('\r\n') + '\r\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="resultados_por_partida.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

// GET /api/export/consolidated.json
router.get('/consolidated.json', async (_req, res, next) => {
  try {
    const tournamentId = await getTournamentId();

    const { rows: [tournament] } = await pool.query(`
      SELECT id, name, status,
        current_match_id AS "currentMatchId",
        current_map_id AS "currentMapId",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM tournament WHERE id = $1
    `, [tournamentId]);

    const { rows: teams } = await pool.query(`
      SELECT id, name, slug, color,
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM team WHERE tournament_id = $1
      ORDER BY name
    `, [tournamentId]);

    const { rows: participants } = await pool.query(`
      SELECT p.id, p.team_id AS "teamId", p.name, p.slug, p.type,
        t.name AS "teamName",
        p.created_at AS "createdAt", p.updated_at AS "updatedAt"
      FROM participant p
      JOIN team t ON t.id = p.team_id
      WHERE t.tournament_id = $1
      ORDER BY t.name, p.type
    `, [tournamentId]);

    const { rows: matches } = await pool.query(`
      SELECT id, match_number AS "matchNumber", phase, status,
        started_at AS "startedAt", completed_at AS "completedAt"
      FROM match WHERE tournament_id = $1
      ORDER BY match_number
    `, [tournamentId]);

    const { rows: maps } = await pool.query(`
      SELECT map.id, map.match_id AS "matchId", map.map_index AS "mapIndex",
        map.code, map.status,
        map.started_at AS "startedAt", map.completed_at AS "completedAt",
        match.match_number AS "matchNumber"
      FROM map
      JOIN match ON match.id = map.match_id
      WHERE match.tournament_id = $1
      ORDER BY match.match_number, map.map_index
    `, [tournamentId]);

    const { rows: results } = await pool.query(`
      SELECT mr.map_id AS "mapId", mr.participant_id AS "participantId",
        mr.position, mr.status, mr.points,
        p.name AS "participantName", t.name AS "teamName"
      FROM map_result mr
      JOIN participant p ON p.id = mr.participant_id
      JOIN team t ON t.id = p.team_id
      JOIN map ON map.id = mr.map_id
      JOIN match ON match.id = map.match_id
      WHERE match.tournament_id = $1
      ORDER BY match.match_number, map.map_index, COALESCE(mr.position, 999)
    `, [tournamentId]);

    const [teamRankings, individualRankings, rankingHistory, teamStats, participantStats] = await Promise.all([
      calculateTeamRankings(tournamentId),
      calculateIndividualRankings(tournamentId),
      getRankingHistory(tournamentId),
      getTeamStatistics(tournamentId),
      getParticipantStatistics(tournamentId),
    ]);

    const consolidated = {
      exportedAt: new Date().toISOString(),
      tournament,
      teams,
      participants,
      matches,
      maps,
      results,
      rankings: {
        teams: teamRankings,
        individuals: individualRankings,
        history: rankingHistory,
      },
      statistics: {
        teams: teamStats,
        participants: participantStats,
      },
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="drone_cup_export.json"');
    res.json(consolidated);
  } catch (err) { next(err); }
});

export default router;
