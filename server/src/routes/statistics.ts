import { Router } from 'express';
import { pool } from '../db/pool.js';
import { getTeamStatistics, getSingleTeamStatistics, getParticipantStatistics, getSingleParticipantStatistics } from '../engine/statistics.js';
import { getRankingHistory } from '../engine/ranking.js';
import { ApiError } from '../engine/errors.js';

const router = Router();

async function getTournamentId(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>('SELECT id FROM tournament LIMIT 1');
  if (rows.length === 0) throw new ApiError(404, 'NO_TOURNAMENT', 'No tournament found');
  return rows[0].id;
}

// GET /api/statistics/teams
router.get('/teams', async (_req, res, next) => {
  try {
    const tournamentId = await getTournamentId();
    const stats = await getTeamStatistics(tournamentId);
    res.json(stats);
  } catch (err) { next(err); }
});

// GET /api/statistics/teams/:id
router.get('/teams/:id', async (req, res, next) => {
  try {
    const tournamentId = await getTournamentId();
    const stats = await getSingleTeamStatistics(tournamentId, req.params.id);
    if (!stats) throw new ApiError(404, 'TEAM_NOT_FOUND', 'Team not found');
    res.json(stats);
  } catch (err) { next(err); }
});

// GET /api/statistics/participants
router.get('/participants', async (_req, res, next) => {
  try {
    const tournamentId = await getTournamentId();
    const stats = await getParticipantStatistics(tournamentId);
    res.json(stats);
  } catch (err) { next(err); }
});

// GET /api/statistics/participants/:id
router.get('/participants/:id', async (req, res, next) => {
  try {
    const tournamentId = await getTournamentId();
    const stats = await getSingleParticipantStatistics(tournamentId, req.params.id);
    if (!stats) throw new ApiError(404, 'PARTICIPANT_NOT_FOUND', 'Participant not found');
    res.json(stats);
  } catch (err) { next(err); }
});

// GET /api/statistics/progression
router.get('/progression', async (_req, res, next) => {
  try {
    const tournamentId = await getTournamentId();
    const [teams, participants] = await Promise.all([
      getTeamStatistics(tournamentId),
      getParticipantStatistics(tournamentId),
    ]);
    const teamProgression = teams.map(t => ({
      teamId: t.teamId,
      teamName: t.teamName,
      teamColor: t.teamColor,
      progression: t.progression,
    }));
    const participantProgression = participants
      .filter(p => p.progression.length > 0)
      .map(p => ({
        participantId: p.participantId,
        participantName: p.participantName,
        participantType: p.participantType,
        teamId: p.teamId,
        teamName: p.teamName,
        progression: p.progression,
      }));
    res.json({ teams: teamProgression, participants: participantProgression });
  } catch (err) { next(err); }
});

export default router;
