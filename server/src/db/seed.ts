import { pool } from './pool.js';
import { createRankingSnapshot } from '../engine/ranking.js';

const TEAMS = [
  { name: 'Caramelo',  slug: 'caramelo',  color: '#f5c842' },
  { name: 'Vetel',     slug: 'vetel',     color: '#38bdf8' },
  { name: 'Miwell',    slug: 'miwell',    color: '#22c55e' },
  { name: 'SoraMusic', slug: 'sora',      color: '#a855f7' },
  { name: 'Barra',     slug: 'barra',     color: '#ef4444' },
];

const PARTICIPANTS: Record<string, { creator: string; player1: string; player2: string }> = {
  caramelo:  { creator: 'Caramelo',    player1: 'Caramelo_P1', player2: 'Caramelo_P2' },
  vetel:     { creator: 'Vetel',       player1: 'Vetel_P1',    player2: 'Vetel_P2' },
  miwell:    { creator: 'Miwell',      player1: 'Miwell_P1',   player2: 'Miwell_P2' },
  sora:      { creator: 'SoraMusic',   player1: 'Sora_P1',     player2: 'Sora_P2' },
  barra:     { creator: 'Barra',       player1: 'Barra_P1',    player2: 'Barra_P2' },
};

const POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 0. Clean old data
    await client.query('DELETE FROM ranking_snapshot');
    await client.query('DELETE FROM map_result');
    await client.query('DELETE FROM map');
    await client.query('DELETE FROM match_participation');
    await client.query('DELETE FROM match');
    await client.query('DELETE FROM participant');
    await client.query('DELETE FROM team');
    await client.query('DELETE FROM tournament');

    // 1. Tournament
    const { rows: [tournament] } = await client.query(
      `INSERT INTO tournament (name, status) VALUES ($1, $2) RETURNING id`,
      ['Wasteland Drone Cup', 'LIVE']
    );
    const tournamentId = tournament.id;
    console.log(`Tournament created: ${tournamentId}`);

    // 2. Teams + Participants
    const teamIds: Record<string, string> = {};
    const participantIds: Record<string, { creator: string; player1: string; player2: string }> = {};

    for (const t of TEAMS) {
      const { rows: [team] } = await client.query(
        `INSERT INTO team (tournament_id, name, slug, color) VALUES ($1, $2, $3, $4) RETURNING id`,
        [tournamentId, t.name, t.slug, t.color]
      );
      teamIds[t.slug] = team.id;

      const p = PARTICIPANTS[t.slug];

      const { rows: [creator] } = await client.query(
        `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, $4) RETURNING id`,
        [team.id, p.creator, p.creator.toLowerCase(), 'CREATOR']
      );
      const { rows: [player1] } = await client.query(
        `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, $4) RETURNING id`,
        [team.id, p.player1, p.player1.toLowerCase(), 'PLAYER_1']
      );
      const { rows: [player2] } = await client.query(
        `INSERT INTO participant (team_id, name, slug, type) VALUES ($1, $2, $3, $4) RETURNING id`,
        [team.id, p.player2, p.player2.toLowerCase(), 'PLAYER_2']
      );

      participantIds[t.slug] = { creator: creator.id, player1: player1.id, player2: player2.id };
    }
    console.log(`5 teams, 15 participants created.`);

    // 3. Matches (4 MAIN matches)
    const matchIds: string[] = [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 120 * 60 * 1000);

    for (let i = 1; i <= 4; i++) {
      const status = i === 1 ? 'COMPLETED' : i === 2 ? 'LIVE' : 'UPCOMING';
      const startedAt = i === 1 ? twoHoursAgo : i === 2 ? oneHourAgo : null;
      const completedAt = i === 1 ? oneHourAgo : null;

      const { rows: [match] } = await client.query(
        `INSERT INTO match (tournament_id, match_number, phase, status, started_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [tournamentId, i, 'MAIN', status, startedAt, completedAt]
      );
      matchIds.push(match.id);
    }
    console.log(`4 matches created.`);

    // 4. Match Participations
    // Match 1-2: Creator + Player 1
    // Match 3-4: Creator + Player 2
    for (let i = 0; i < 4; i++) {
      const matchId = matchIds[i];
      for (const slug of Object.keys(participantIds)) {
        const p = participantIds[slug];
        await client.query(
          `INSERT INTO match_participation (match_id, participant_id) VALUES ($1, $2)`,
          [matchId, p.creator]
        );
        const partnerId = i < 2 ? p.player1 : p.player2;
        await client.query(
          `INSERT INTO match_participation (match_id, participant_id) VALUES ($1, $2)`,
          [matchId, partnerId]
        );
      }
    }
    console.log(`40 match participations created (10 per match).`);

    // 5. Maps (3 per match = 12 total)
    const mapIds: string[][] = [];
    for (let i = 0; i < 4; i++) {
      const matchId = matchIds[i];
      const matchNum = i + 1;
      const mapRowIds: string[] = [];
      for (let j = 1; j <= 3; j++) {
        let status = 'PENDING';
        let startedAt: Date | null = null;
        let completedAt: Date | null = null;

        if (i === 0) {
          status = 'COMPLETED';
          startedAt = twoHoursAgo;
          completedAt = oneHourAgo;
        } else if (i === 1) {
          if (j === 1) {
            status = 'COMPLETED';
            startedAt = oneHourAgo;
            completedAt = new Date(now.getTime() - 20 * 60 * 1000);
          } else if (j === 2) {
            status = 'ACTIVE';
            startedAt = new Date(now.getTime() - 10 * 60 * 1000);
          }
        }

        const { rows: [map] } = await client.query(
          `INSERT INTO map (match_id, map_index, code, status, started_at, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [matchId, j, `P${matchNum}M${j}`, status, startedAt, completedAt]
        );
        mapRowIds.push(map.id);
      }
      mapIds.push(mapRowIds);
    }
    console.log(`12 maps created.`);

    // 6. Update current match and map in tournament
    await client.query(
      `UPDATE tournament SET current_match_id = $1, current_map_id = $2 WHERE id = $3`,
      [matchIds[1], mapIds[1][1], tournamentId]
    );

    // 7. Seed realistic results for completed maps (P1M1, P1M2, P1M3, P2M1)
    const p1Pilots = [
      participantIds.vetel.creator,
      participantIds.caramelo.creator,
      participantIds.vetel.player1,
      participantIds.miwell.player1,
      participantIds.miwell.creator,
      participantIds.sora.creator,
      participantIds.caramelo.player1,
      participantIds.barra.creator,
      participantIds.sora.player1,
      participantIds.barra.player1,
    ];

    const mapFinishes = [
      [0, 2, 1, 3, 5, 4, 6, 7, 8, 9], // Map 1
      [1, 6, 0, 4, 3, 2, 7, 5, 8, 9], // Map 2
      [4, 3, 0, 1, 5, 2, 6, 7, 9, 8], // Map 3
      [0, 1, 4, 2, 6, 3, 5, 7, 8, 9], // Map 4
    ];

    const completedMapIds = [mapIds[0][0], mapIds[0][1], mapIds[0][2], mapIds[1][0]];

    for (let mIdx = 0; mIdx < completedMapIds.length; mIdx++) {
      const targetMapId = completedMapIds[mIdx];
      const finishOrder = mapFinishes[mIdx];

      for (let pos = 0; pos < 10; pos++) {
        const participantId = p1Pilots[finishOrder[pos]];
        const points = POINTS_TABLE[pos];

        await client.query(
          `INSERT INTO map_result (map_id, participant_id, position, status, points)
           VALUES ($1, $2, $3, $4, $5)`,
          [targetMapId, participantId, pos + 1, 'FINISHED', points]
        );
      }
    }
    console.log(`Results inserted for 4 maps.`);

    await client.query('COMMIT');

    // 8. Snapshots
    for (const targetMapId of completedMapIds) {
      await createRankingSnapshot(tournamentId, targetMapId);
    }
    console.log(`Ranking snapshots created for 4 maps.`);
    console.log('Seed completed successfully with official creators and realistic scores.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
