import { Router } from 'express';
import { pool } from '../db/pool.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows: [tournament] } = await pool.query(`
      SELECT
        t.id, t.name, t.status,
        t.current_match_id AS "currentMatchId",
        t.current_map_id AS "currentMapId",
        t.created_at AS "createdAt",
        t.updated_at AS "updatedAt"
      FROM tournament t
      LIMIT 1
    `);
    if (!tournament) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No tournament found' } });
    res.json(tournament);
  } catch (err) { next(err); }
});

export default router;
