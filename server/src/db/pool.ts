import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

let connectionString: string | undefined;

if (isTest) {
  if (!process.env.DATABASE_URL_TEST) {
    throw new Error(
      'FATAL: DATABASE_URL_TEST environment variable is missing for test environment.\n' +
      'Tests are strictly blocked from using the development database (DATABASE_URL) to protect official data.'
    );
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL_TEST === process.env.DATABASE_URL) {
    throw new Error(
      'FATAL: DATABASE_URL_TEST cannot be identical to DATABASE_URL.\n' +
      'Tests must run against an isolated test database to prevent overwriting development/production data.'
    );
  }
  connectionString = process.env.DATABASE_URL_TEST;
} else {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }
  connectionString = process.env.DATABASE_URL;
}

const pool = new pg.Pool({
  connectionString,
});

export { pool };
