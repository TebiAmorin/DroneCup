import { Router } from 'express';
import { pool } from '../db/pool.js';
import { confirmMapResults, correctMapResults } from '../engine/stateMachine.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [map] } = await pool.query(`
      SELECT
        map.id, map.match_id AS "matchId", map.map_index AS "mapIndex",
        map.code, map.status,
        map.started_at AS "startedAt", map.completed_at AS "completedAt",
        m.match_number AS "matchNumber", m.phase
      FROM map
      JOIN match m ON m.id = map.match_id
      WHERE map.id = $1
    `, [req.params.id]);
    if (!map) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Map not found' } });

    const { rows: results } = await pool.query(`
      SELECT
        mr.participant_id AS "participantId",
        p.name AS "participantName",
        p.type AS "participantType",
        t.name AS "teamName",
        t.slug AS "teamSlug",
        t.color AS "teamColor",
        mr.position, mr.status, mr.points
      FROM map_result mr
      JOIN participant p ON p.id = mr.participant_id
      JOIN team t ON t.id = p.team_id
      WHERE mr.map_id = $1
      ORDER BY COALESCE(mr.position, 999)
    `, [req.params.id]);

    res.json({ ...map, results });
  } catch (err) { next(err); }
});

router.post('/:id/results', requireAdmin, async (req, res, next) => {
  try {
    const { results } = req.body;
    if (!Array.isArray(results)) {
      return res.status(400).json({ error: { code: 'INVALID_RESULT', message: 'results must be an array' } });
    }
    const result = await confirmMapResults(req.params.id as string, results);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.put('/:id/results', requireAdmin, async (req, res, next) => {
  try {
    const { results } = req.body;
    if (!Array.isArray(results)) {
      return res.status(400).json({ error: { code: 'INVALID_RESULT', message: 'results must be an array' } });
    }
    const result = await correctMapResults(req.params.id as string, results);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

export default router;
