import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';
import { emitCompetitionUpdated } from '../realtime/emitter.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { team, type, match } = req.query;
    let query = `
      SELECT
        p.id, p.team_id AS "teamId", p.name, p.slug, p.type,
        t.name AS "teamName",
        p.created_at AS "createdAt"
      FROM participant p
      JOIN team t ON t.id = p.team_id
      WHERE 1=1
    `;
    const params: string[] = [];

    if (team) {
      params.push(team as string);
      query += ` AND p.team_id = $${params.length}`;
    }
    if (type) {
      params.push(type as string);
      query += ` AND p.type = $${params.length}`;
    }
    if (match) {
      params.push(match as string);
      query += ` AND p.id IN (SELECT participant_id FROM match_participation WHERE match_id = $${params.length})`;
    }

    query += ` ORDER BY t.name, p.type`;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
});

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (name === undefined || typeof name !== 'string') {
      return res.status(400).json({ error: { code: 'INVALID_NAME', message: 'Name is required and must be a string' } });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 50) {
      return res.status(400).json({ error: { code: 'INVALID_NAME', message: 'Name must be between 1 and 50 characters' } });
    }

    const { rows: [participant] } = await pool.query(
      `SELECT p.id, p.team_id, p.name, p.slug, p.type, t.tournament_id
       FROM participant p
       JOIN team t ON t.id = p.team_id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (!participant) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Participant not found' } });
    }

    if (participant.type === 'CREATOR') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Creator participants cannot be modified' } });
    }

    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9_.-]/g, '_');

    const { rows: [updated] } = await pool.query(
      `UPDATE participant
       SET name = $1, slug = $2, updated_at = now()
       WHERE id = $3
       RETURNING id, team_id AS "teamId", name, slug, type, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [trimmedName, slug, participant.id]
    );

    const { rows: [tour] } = await pool.query(
      `SELECT id, status, current_match_id AS "currentMatchId", current_map_id AS "currentMapId"
       FROM tournament WHERE id = $1`,
      [participant.tournament_id]
    );

    if (tour) {
      emitCompetitionUpdated({
        tournamentId: tour.id,
        status: tour.status,
        currentMatchId: tour.currentMatchId,
        currentMapId: tour.currentMapId,
      });
    }

    res.json({ success: true, participant: updated });
  } catch (err) { next(err); }
});

export default router;
