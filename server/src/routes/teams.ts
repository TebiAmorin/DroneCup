import { Router } from 'express';
import { pool } from '../db/pool.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows: teams } = await pool.query(`
      SELECT
        t.id, t.tournament_id AS "tournamentId", t.name, t.slug, t.color,
        t.logo_url AS "logoUrl",
        t.created_at AS "createdAt", t.updated_at AS "updatedAt"
      FROM team t
      ORDER BY t.name
    `);
    const { rows: participants } = await pool.query(`
      SELECT p.id, p.team_id AS "teamId", p.name, p.slug, p.type, t.name AS "teamName"
      FROM participant p JOIN team t ON t.id = p.team_id ORDER BY p.type
    `);
    const result = teams.map((t: any) => ({
      ...t,
      participants: participants.filter((p: any) => p.teamId === t.id),
    }));
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [team] } = await pool.query(`
      SELECT
        t.id, t.tournament_id AS "tournamentId", t.name, t.slug, t.color,
        t.logo_url AS "logoUrl",
        t.created_at AS "createdAt", t.updated_at AS "updatedAt"
      FROM team t
      WHERE t.id = $1
    `, [req.params.id]);
    if (!team) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Team not found' } });

    const { rows: participants } = await pool.query(`
      SELECT id, name, slug, type, created_at AS "createdAt"
      FROM participant WHERE team_id = $1 ORDER BY type
    `, [team.id]);

    res.json({ ...team, participants });
  } catch (err) { next(err); }
});

export default router;
