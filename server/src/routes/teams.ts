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
        t.registration_status AS "registrationStatus",
        t.community_note AS "communityNote",
        t.qualifier_date::text AS "qualifierDate",
        t.qualifier_start_time::text AS "qualifierStartTime",
        t.qualifier_end_time::text AS "qualifierEndTime",
        t.qualifier_format AS "qualifierFormat",
        t.qualifier_requirements AS "qualifierRequirements",
        t.qualifier_how_to_participate AS "qualifierHowToParticipate",
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
        t.registration_status AS "registrationStatus",
        t.community_note AS "communityNote",
        t.qualifier_date::text AS "qualifierDate",
        t.qualifier_start_time::text AS "qualifierStartTime",
        t.qualifier_end_time::text AS "qualifierEndTime",
        t.qualifier_format AS "qualifierFormat",
        t.qualifier_requirements AS "qualifierRequirements",
        t.qualifier_how_to_participate AS "qualifierHowToParticipate",
        t.created_at AS "createdAt", t.updated_at AS "updatedAt"
      FROM team t
      WHERE t.id = $1
    `, [req.params.id]);
    if (!team) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Team not found' } });

    const { rows: participants } = await pool.query(`
      SELECT id, name, slug, type, confirmed, created_at AS "createdAt"
      FROM participant WHERE team_id = $1 ORDER BY type
    `, [team.id]);

    res.json({ ...team, participants });
  } catch (err) { next(err); }
});

const ALLOWED_REGISTRATION_TYPES = ['google_forms', 'typeform', 'external'];
const ALLOWED_REGISTRATION_PLATFORMS = ['twitter', 'discord', 'twitch', 'google_forms', 'typeform', 'external'];
const ALLOWED_REGISTRATION_STATUSES = ['upcoming', 'open', 'closed', 'completed'];

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { registrationUrl, registrationType, registrationPlatform, registrationStatus, communityNote, qualifierDate, qualifierStartTime, qualifierEndTime, qualifierFormat, qualifierRequirements, qualifierHowToParticipate } = req.body;

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

    // Validate registrationStatus
    if (registrationStatus !== undefined) {
      if (registrationStatus === null || typeof registrationStatus !== 'string' || !ALLOWED_REGISTRATION_STATUSES.includes(registrationStatus)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_STATUS',
            message: `registrationStatus must be one of: ${ALLOWED_REGISTRATION_STATUSES.join(', ')}`,
          },
        });
      }
    }

    // Validate qualifierDate (YYYY-MM-DD)
    if (qualifierDate !== undefined && qualifierDate !== null) {
      if (typeof qualifierDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(qualifierDate) || isNaN(Date.parse(qualifierDate))) {
        return res.status(400).json({
          error: { code: 'INVALID_DATE', message: 'qualifierDate must be a valid date in YYYY-MM-DD format' },
        });
      }
    }

    // Validate qualifierStartTime (HH:mm)
    if (qualifierStartTime !== undefined && qualifierStartTime !== null) {
      if (typeof qualifierStartTime !== 'string' || !/^\d{2}:\d{2}$/.test(qualifierStartTime)) {
        return res.status(400).json({
          error: { code: 'INVALID_TIME', message: 'qualifierStartTime must be in HH:mm format' },
        });
      }
    }

    // Validate qualifierEndTime (HH:mm)
    if (qualifierEndTime !== undefined && qualifierEndTime !== null) {
      if (typeof qualifierEndTime !== 'string' || !/^\d{2}:\d{2}$/.test(qualifierEndTime)) {
        return res.status(400).json({
          error: { code: 'INVALID_TIME', message: 'qualifierEndTime must be in HH:mm format' },
        });
      }
    }

    // Validate qualifierFormat
    if (qualifierFormat !== undefined && qualifierFormat !== null) {
      if (typeof qualifierFormat !== 'string' || qualifierFormat.length > 2000) {
        return res.status(400).json({
          error: { code: 'INVALID_FORMAT', message: 'qualifierFormat must be a string of 2000 characters or less' },
        });
      }
    }

    // Validate qualifierRequirements
    if (qualifierRequirements !== undefined && qualifierRequirements !== null) {
      if (typeof qualifierRequirements !== 'string' || qualifierRequirements.length > 2000) {
        return res.status(400).json({
          error: { code: 'INVALID_REQUIREMENTS', message: 'qualifierRequirements must be a string of 2000 characters or less' },
        });
      }
    }

    // Validate qualifierHowToParticipate
    if (qualifierHowToParticipate !== undefined && qualifierHowToParticipate !== null) {
      if (typeof qualifierHowToParticipate !== 'string' || qualifierHowToParticipate.length > 2000) {
        return res.status(400).json({
          error: { code: 'INVALID_HOW_TO_PARTICIPATE', message: 'qualifierHowToParticipate must be a string of 2000 characters or less' },
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
    if (registrationStatus !== undefined) {
      setClauses.push(`registration_status = $${paramIdx++}`);
      values.push(registrationStatus);
    }
    if (qualifierDate !== undefined) {
      setClauses.push(`qualifier_date = $${paramIdx++}`);
      values.push(qualifierDate);
    }
    if (qualifierStartTime !== undefined) {
      setClauses.push(`qualifier_start_time = $${paramIdx++}`);
      values.push(qualifierStartTime);
    }
    if (qualifierEndTime !== undefined) {
      setClauses.push(`qualifier_end_time = $${paramIdx++}`);
      values.push(qualifierEndTime);
    }
    if (qualifierFormat !== undefined) {
      setClauses.push(`qualifier_format = $${paramIdx++}`);
      values.push(qualifierFormat);
    }
    if (qualifierRequirements !== undefined) {
      setClauses.push(`qualifier_requirements = $${paramIdx++}`);
      values.push(qualifierRequirements);
    }
    if (qualifierHowToParticipate !== undefined) {
      setClauses.push(`qualifier_how_to_participate = $${paramIdx++}`);
      values.push(qualifierHowToParticipate);
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
         registration_status AS "registrationStatus",
         community_note AS "communityNote",
         qualifier_date::text AS "qualifierDate",
         qualifier_start_time::text AS "qualifierStartTime",
         qualifier_end_time::text AS "qualifierEndTime",
         qualifier_format AS "qualifierFormat",
         qualifier_requirements AS "qualifierRequirements",
         qualifier_how_to_participate AS "qualifierHowToParticipate",
         created_at AS "createdAt", updated_at AS "updatedAt"`,
      values,
    );

    res.json({ success: true, team: updated });
  } catch (err) { next(err); }
});

export default router;
