import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows: teams } = await pool.query(`
      SELECT
        t.id, t.tournament_id AS "tournamentId", t.name, t.slug, t.color,
        t.logo_url AS "logoUrl",
        t.registration_url AS "registrationUrl",
        t.registration_type AS "registrationType",
        t.registration_platform AS "registrationPlatform",
        t.community_note AS "communityNote",
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
        t.registration_url AS "registrationUrl",
        t.registration_type AS "registrationType",
        t.registration_platform AS "registrationPlatform",
        t.community_note AS "communityNote",
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

const ALLOWED_REGISTRATION_TYPES = ['google_forms', 'typeform', 'external'];
const ALLOWED_REGISTRATION_PLATFORMS = ['twitter', 'discord', 'twitch', 'google_forms', 'typeform', 'external'];

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { registrationUrl, registrationType, registrationPlatform, communityNote } = req.body;

    // Reject attempts to modify competitive fields
    for (const field of ['name', 'slug', 'color', 'participants', 'logoUrl']) {
      if (req.body[field] !== undefined) {
        return res.status(400).json({
          error: { code: 'FIELD_NOT_ALLOWED', message: `Field '${field}' cannot be modified via this endpoint` },
        });
      }
    }

    // Validate registrationUrl
    if (registrationUrl !== undefined && registrationUrl !== null) {
      if (typeof registrationUrl !== 'string') {
        return res.status(400).json({
          error: { code: 'INVALID_URL', message: 'registrationUrl must be a string' },
        });
      }
      try {
        const parsed = new URL(registrationUrl);
        if (parsed.protocol !== 'https:') {
          return res.status(400).json({
            error: { code: 'INVALID_URL', message: 'registrationUrl must use https: protocol' },
          });
        }
      } catch {
        return res.status(400).json({
          error: { code: 'INVALID_URL', message: 'registrationUrl must be a valid URL' },
        });
      }
    }

    // Validate registrationType
    if (registrationType !== undefined && registrationType !== null) {
      if (typeof registrationType !== 'string' || !ALLOWED_REGISTRATION_TYPES.includes(registrationType)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_TYPE',
            message: `registrationType must be one of: ${ALLOWED_REGISTRATION_TYPES.join(', ')}`,
          },
        });
      }
    }

    // Validate communityNote
    if (communityNote !== undefined && communityNote !== null) {
      if (typeof communityNote !== 'string') {
        return res.status(400).json({
          error: { code: 'INVALID_NOTE', message: 'communityNote must be a string' },
        });
      }
      if (communityNote.length > 500) {
        return res.status(400).json({
          error: { code: 'INVALID_NOTE', message: 'communityNote must be 500 characters or less' },
        });
      }
    }

    // Validate registrationPlatform
    if (registrationPlatform !== undefined && registrationPlatform !== null) {
      if (typeof registrationPlatform !== 'string' || !ALLOWED_REGISTRATION_PLATFORMS.includes(registrationPlatform)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_PLATFORM',
            message: `registrationPlatform must be one of: ${ALLOWED_REGISTRATION_PLATFORMS.join(', ')}`,
          },
        });
      }
    }

    // Verify team exists
    const { rows: [existing] } = await pool.query(
      `SELECT id FROM team WHERE id = $1`,
      [req.params.id],
    );
    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Team not found' } });
    }

    // Build dynamic SET clause (only update provided fields)
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (registrationUrl !== undefined) {
      setClauses.push(`registration_url = $${paramIdx++}`);
      values.push(registrationUrl);
    }
    if (registrationType !== undefined) {
      setClauses.push(`registration_type = $${paramIdx++}`);
      values.push(registrationType);
    }
    if (communityNote !== undefined) {
      setClauses.push(`community_note = $${paramIdx++}`);
      values.push(communityNote);
    }
    if (registrationPlatform !== undefined) {
      setClauses.push(`registration_platform = $${paramIdx++}`);
      values.push(registrationPlatform);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        error: { code: 'NO_FIELDS', message: 'No valid fields provided to update' },
      });
    }

    values.push(req.params.id);
    const { rows: [updated] } = await pool.query(
      `UPDATE team SET ${setClauses.join(', ')}, updated_at = now()
       WHERE id = $${paramIdx}
       RETURNING id, tournament_id AS "tournamentId", name, slug, color,
         logo_url AS "logoUrl",
         registration_url AS "registrationUrl",
         registration_type AS "registrationType",
         registration_platform AS "registrationPlatform",
         community_note AS "communityNote",
         created_at AS "createdAt", updated_at AS "updatedAt"`,
      values,
    );

    res.json({ success: true, team: updated });
  } catch (err) { next(err); }
});

export default router;
