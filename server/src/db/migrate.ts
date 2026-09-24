import { pool } from './pool.js';

const migration = `
-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$ BEGIN
  CREATE TYPE tournament_status AS ENUM ('DRAFT', 'READY', 'LIVE', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE participant_type AS ENUM ('CREATOR', 'PLAYER_1', 'PLAYER_2');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE match_status AS ENUM ('UPCOMING', 'LIVE', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE match_phase AS ENUM ('MAIN', 'TIEBREAK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE map_status AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE result_status AS ENUM ('FINISHED', 'DNF');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tournament
CREATE TABLE IF NOT EXISTS tournament (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  status          tournament_status NOT NULL DEFAULT 'DRAFT',
  current_match_id UUID,
  current_map_id   UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Team
CREATE TABLE IF NOT EXISTS team (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID NOT NULL REFERENCES tournament(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  color           TEXT,
  logo_url        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, slug)
);

-- Participant
CREATE TABLE IF NOT EXISTS participant (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  type            participant_type NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, type)
);

-- Match
CREATE TABLE IF NOT EXISTS match (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID NOT NULL REFERENCES tournament(id) ON DELETE CASCADE,
  match_number    INT NOT NULL CHECK (match_number >= 1),
  phase           match_phase NOT NULL DEFAULT 'MAIN',
  status          match_status NOT NULL DEFAULT 'UPCOMING',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, match_number, phase)
);

-- Match Participation
CREATE TABLE IF NOT EXISTS match_participation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        UUID NOT NULL REFERENCES match(id) ON DELETE CASCADE,
  participant_id  UUID NOT NULL REFERENCES participant(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(match_id, participant_id)
);

-- Map
CREATE TABLE IF NOT EXISTS map (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        UUID NOT NULL REFERENCES match(id) ON DELETE CASCADE,
  map_index       INT NOT NULL CHECK (map_index >= 1),
  code            TEXT NOT NULL,
  status          map_status NOT NULL DEFAULT 'PENDING',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(match_id, map_index)
);

-- Map Result
CREATE TABLE IF NOT EXISTS map_result (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id          UUID NOT NULL REFERENCES map(id) ON DELETE CASCADE,
  participant_id  UUID NOT NULL REFERENCES participant(id) ON DELETE CASCADE,
  position        INT CHECK (position >= 1 AND position <= 10),
  status          result_status NOT NULL DEFAULT 'FINISHED',
  points          INT NOT NULL DEFAULT 0 CHECK (points >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(map_id, participant_id),
  CONSTRAINT finished_must_have_position CHECK (
    (status = 'FINISHED' AND position IS NOT NULL) OR
    (status = 'DNF' AND position IS NULL)
  )
);

-- Unique finished positions per map (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS uq_map_result_position
  ON map_result (map_id, position)
  WHERE position IS NOT NULL;

-- Ranking Snapshot (for ranking history after each map)
CREATE TABLE IF NOT EXISTS ranking_snapshot (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID NOT NULL REFERENCES tournament(id) ON DELETE CASCADE,
  map_id          UUID NOT NULL REFERENCES map(id) ON DELETE CASCADE,
  team_id         UUID NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  rank            INT NOT NULL CHECK (rank >= 1),
  total_points    INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(map_id, team_id)
);

-- Deferred FK for tournament current pointers
ALTER TABLE tournament
  DROP CONSTRAINT IF EXISTS fk_tournament_current_match;
ALTER TABLE tournament
  ADD CONSTRAINT fk_tournament_current_match
  FOREIGN KEY (current_match_id) REFERENCES match(id) ON DELETE SET NULL;

ALTER TABLE tournament
  DROP CONSTRAINT IF EXISTS fk_tournament_current_map;
ALTER TABLE tournament
  ADD CONSTRAINT fk_tournament_current_map
  FOREIGN KEY (current_map_id) REFERENCES map(id) ON DELETE SET NULL;

-- Registration fields on team (F5.1)
ALTER TABLE team ADD COLUMN IF NOT EXISTS registration_url TEXT;
ALTER TABLE team ADD COLUMN IF NOT EXISTS registration_type VARCHAR(30);
ALTER TABLE team ADD COLUMN IF NOT EXISTS community_note TEXT;

-- Registration platform field on team (F5.2.2)
ALTER TABLE team ADD COLUMN IF NOT EXISTS registration_platform VARCHAR(30);

-- Populate registration fields from current frontend data (F5.1)
UPDATE team SET
  registration_url = CASE slug
    WHEN 'caramelo' THEN 'https://twitter.com/CarameloOficial'
    WHEN 'vetel'    THEN 'https://discord.gg/vetel'
    WHEN 'miwell'   THEN 'https://www.twitch.tv/DonMiwell'
    WHEN 'sora'     THEN 'https://twitter.com/soramusicr6'
    WHEN 'barra'    THEN 'https://discord.gg/barra'
  END,
  registration_type = CASE slug
    WHEN 'caramelo' THEN 'external'
    WHEN 'vetel'    THEN 'external'
    WHEN 'miwell'   THEN 'external'
    WHEN 'sora'     THEN 'external'
    WHEN 'barra'    THEN 'external'
  END,
  community_note = CASE slug
    WHEN 'caramelo' THEN 'Draft y plazas abiertas en su post de X'
    WHEN 'vetel'    THEN 'Inscripciones en el canal #drone-cup'
    WHEN 'miwell'   THEN 'Clasificatorio en directo durante su stream'
    WHEN 'sora'     THEN 'Responde al tweet oficial fijado'
    WHEN 'barra'    THEN 'Formulario disponible en su servidor'
  END
WHERE slug IN ('caramelo', 'vetel', 'miwell', 'sora', 'barra')
  AND registration_url IS NULL;

-- Populate registration platform from current frontend data (F5.2.2)
UPDATE team SET
  registration_platform = CASE slug
    WHEN 'caramelo' THEN 'twitter'
    WHEN 'vetel'    THEN 'discord'
    WHEN 'miwell'   THEN 'twitch'
    WHEN 'sora'     THEN 'twitter'
    WHEN 'barra'    THEN 'discord'
  END
WHERE slug IN ('caramelo', 'vetel', 'miwell', 'sora', 'barra')
  AND registration_platform IS NULL;

-- Registration status field on team (F6.1)
ALTER TABLE team ADD COLUMN IF NOT EXISTS registration_status VARCHAR(20) DEFAULT 'upcoming';
UPDATE team SET registration_status = 'upcoming' WHERE registration_status IS NULL;

-- Qualifier content fields on team (F6.2)
ALTER TABLE team ADD COLUMN IF NOT EXISTS qualifier_date DATE;
ALTER TABLE team ADD COLUMN IF NOT EXISTS qualifier_start_time TIME;
ALTER TABLE team ADD COLUMN IF NOT EXISTS qualifier_end_time TIME;
ALTER TABLE team ADD COLUMN IF NOT EXISTS qualifier_format TEXT;
ALTER TABLE team ADD COLUMN IF NOT EXISTS qualifier_requirements TEXT;
ALTER TABLE team ADD COLUMN IF NOT EXISTS qualifier_how_to_participate TEXT;

-- Participant confirmation field (L1)
ALTER TABLE participant ADD COLUMN IF NOT EXISTS confirmed BOOLEAN NOT NULL DEFAULT false;
UPDATE participant SET confirmed = true WHERE type = 'CREATOR' AND confirmed = false;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_team_tournament ON team(tournament_id);
CREATE INDEX IF NOT EXISTS idx_participant_team ON participant(team_id);
CREATE INDEX IF NOT EXISTS idx_match_tournament ON match(tournament_id);
CREATE INDEX IF NOT EXISTS idx_match_participation_match ON match_participation(match_id);
CREATE INDEX IF NOT EXISTS idx_match_participation_participant ON match_participation(participant_id);
CREATE INDEX IF NOT EXISTS idx_map_match ON map(match_id);
CREATE INDEX IF NOT EXISTS idx_map_result_map ON map_result(map_id);
CREATE INDEX IF NOT EXISTS idx_map_result_participant ON map_result(participant_id);
CREATE INDEX IF NOT EXISTS idx_ranking_snapshot_tournament ON ranking_snapshot(tournament_id);
CREATE INDEX IF NOT EXISTS idx_ranking_snapshot_map ON ranking_snapshot(map_id);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['tournament','team','participant','match','map','map_result'])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_at ON %I; CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
      t, t
    );
  END LOOP;
END $$;
`;

async function migrate() {
  console.log('Running migration...');
  try {
    await pool.query(migration);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
