import { Router } from 'express';
import { pool } from '../db/pool.js';
import { startMatch, resetMatch } from '../engine/stateMachine.js';
import { ApiError } from '../engine/errors.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        m.id, m.tournament_id AS "tournamentId",
        m.match_number AS "matchNumber", m.phase, m.status,
        m.started_at AS "startedAt", m.completed_at AS "completedAt",
        m.created_at AS "createdAt"
      FROM match m
      ORDER BY m.phase, m.match_number
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [match] } = await pool.query(`
      SELECT
        m.id, m.tournament_id AS "tournamentId",
        m.match_number AS "matchNumber", m.phase, m.status,
        m.started_at AS "startedAt", m.completed_at AS "completedAt"
      FROM match m WHERE m.id = $1
    `, [req.params.id]);
    if (!match) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Match not found' } });

    const { rows: maps } = await pool.query(`
      SELECT id, map_index AS "mapIndex", code, status,
        started_at AS "startedAt", completed_at AS "completedAt"
      FROM map WHERE match_id = $1 ORDER BY map_index
    `, [match.id]);

    const { rows: participants } = await pool.query(`
      SELECT p.id, p.name, p.type, t.name AS "teamName", t.slug AS "teamSlug", t.color AS "teamColor"
      FROM match_participation mp
      JOIN participant p ON p.id = mp.participant_id
      JOIN team t ON t.id = p.team_id
      WHERE mp.match_id = $1
      ORDER BY t.name, p.type
    `, [match.id]);

    res.json({ ...match, maps, participants });
  } catch (err) { next(err); }
});

router.post('/:id/start', requireAdmin, async (req, res, next) => {
  try {
    const result = await startMatch(req.params.id as string);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.post('/:id/reset', requireAdmin, async (req, res, next) => {
  try {
    const result = await resetMatch(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
