import { Router } from 'express';
import { pool } from '../db/pool.js';
import { calculateTeamRankings, calculateIndividualRankings, getRankingHistory } from '../engine/ranking.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows: [tournament] } = await pool.query(`SELECT id FROM tournament LIMIT 1`);
    if (!tournament) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No tournament' } });

    const teams = await calculateTeamRankings(tournament.id);
    const individuals = await calculateIndividualRankings(tournament.id);

    const { rows: [{ count }] } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM map_result mr
       JOIN map ON map.id = mr.map_id
       JOIN match ON match.id = map.match_id
       WHERE match.tournament_id = $1`,
      [tournament.id]
    );
    const hasResults = parseInt(count, 10) > 0;

    res.json({ teams, individuals, hasResults });
  } catch (err) { next(err); }
});

router.get('/history', async (_req, res, next) => {
  try {
    const { rows: [tournament] } = await pool.query(`SELECT id FROM tournament LIMIT 1`);
    if (!tournament) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No tournament' } });

    const history = await getRankingHistory(tournament.id);
    res.json(history);
  } catch (err) { next(err); }
});

export default router;
