import { pool } from '../db/pool.js';

export interface TournamentReadiness {
  tournamentReady: boolean;
  confirmedParticipants: number;
  totalParticipants: number;
}

const EXPECTED_CREATORS = 5;
const EXPECTED_PLAYER_1 = 5;
const EXPECTED_PLAYER_2 = 5;
const EXPECTED_TOTAL = EXPECTED_CREATORS + EXPECTED_PLAYER_1 + EXPECTED_PLAYER_2;

export async function getTournamentReadiness(): Promise<TournamentReadiness> {
  const { rows } = await pool.query(`
    SELECT p.type, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE p.confirmed = true)::int AS confirmed
    FROM participant p
    JOIN team t ON t.id = p.team_id
    WHERE p.type IN ('CREATOR', 'PLAYER_1', 'PLAYER_2')
    GROUP BY p.type
  `);

  const byType: Record<string, { total: number; confirmed: number }> = {};
  for (const row of rows) {
    byType[row.type] = { total: row.total, confirmed: row.confirmed };
  }

  const creatorTotal = byType['CREATOR']?.total ?? 0;
  const player1Total = byType['PLAYER_1']?.total ?? 0;
  const player2Total = byType['PLAYER_2']?.total ?? 0;

  const creatorConfirmed = byType['CREATOR']?.confirmed ?? 0;
  const player1Confirmed = byType['PLAYER_1']?.confirmed ?? 0;
  const player2Confirmed = byType['PLAYER_2']?.confirmed ?? 0;

  const confirmedParticipants = creatorConfirmed + player1Confirmed + player2Confirmed;

  const structureValid =
    creatorTotal === EXPECTED_CREATORS &&
    player1Total === EXPECTED_PLAYER_1 &&
    player2Total === EXPECTED_PLAYER_2;

  const tournamentReady =
    structureValid && confirmedParticipants === EXPECTED_TOTAL;

  return {
    tournamentReady,
    confirmedParticipants,
    totalParticipants: EXPECTED_TOTAL,
  };
}
