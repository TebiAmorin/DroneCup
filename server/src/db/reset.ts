import { pool } from './pool.js';

async function reset() {
  console.log('Dropping all tables...');
  try {
    await pool.query(`
      DROP TABLE IF EXISTS ranking_snapshot CASCADE;
      DROP TABLE IF EXISTS map_result CASCADE;
      DROP TABLE IF EXISTS map CASCADE;
      DROP TABLE IF EXISTS match_participation CASCADE;
      DROP TABLE IF EXISTS match CASCADE;
      DROP TABLE IF EXISTS participant CASCADE;
      DROP TABLE IF EXISTS team CASCADE;
      DROP TABLE IF EXISTS tournament CASCADE;

      DROP TYPE IF EXISTS tournament_status CASCADE;
      DROP TYPE IF EXISTS participant_type CASCADE;
      DROP TYPE IF EXISTS match_status CASCADE;
      DROP TYPE IF EXISTS match_phase CASCADE;
      DROP TYPE IF EXISTS map_status CASCADE;
      DROP TYPE IF EXISTS result_status CASCADE;

      DROP FUNCTION IF EXISTS update_updated_at CASCADE;
    `);
    console.log('All tables dropped.');
  } catch (err) {
    console.error('Drop failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

reset();
