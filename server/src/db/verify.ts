import { pool } from './pool.js';

async function verify() {
  const checks: { label: string; query: string; expected: number }[] = [
    { label: 'Tournaments', query: 'SELECT count(*) FROM tournament', expected: 1 },
    { label: 'Teams', query: 'SELECT count(*) FROM team', expected: 5 },
    { label: 'Participants', query: 'SELECT count(*) FROM participant', expected: 15 },
    { label: 'Creators', query: `SELECT count(*) FROM participant WHERE type = 'CREATOR'`, expected: 5 },
    { label: 'Player 1s', query: `SELECT count(*) FROM participant WHERE type = 'PLAYER_1'`, expected: 5 },
    { label: 'Player 2s', query: `SELECT count(*) FROM participant WHERE type = 'PLAYER_2'`, expected: 5 },
    { label: 'Matches', query: 'SELECT count(*) FROM match', expected: 4 },
    { label: 'MAIN matches', query: `SELECT count(*) FROM match WHERE phase = 'MAIN'`, expected: 4 },
    { label: 'Maps', query: 'SELECT count(*) FROM map', expected: 12 },
    { label: 'Match participations', query: 'SELECT count(*) FROM match_participation', expected: 40 },
  ];

  let allPassed = true;

  for (const c of checks) {
    const { rows } = await pool.query(c.query);
    const actual = parseInt(rows[0].count, 10);
    const ok = actual === c.expected;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${c.label}: ${actual} (expected ${c.expected})`);
    if (!ok) allPassed = false;
  }

  // Check participations per match
  const { rows: matchParts } = await pool.query(`
    SELECT m.match_number, count(mp.id)::int as participant_count
    FROM match m
    JOIN match_participation mp ON mp.match_id = m.id
    GROUP BY m.match_number
    ORDER BY m.match_number
  `);
  for (const row of matchParts) {
    const ok = row.participant_count === 10;
    console.log(`${ok ? 'PASS' : 'FAIL'} Match ${row.match_number} participations: ${row.participant_count} (expected 10)`);
    if (!ok) allPassed = false;
  }

  // Check rotation: Match 1-2 have CREATOR+PLAYER_1, Match 3-4 have CREATOR+PLAYER_2
  const { rows: rotationCheck } = await pool.query(`
    SELECT m.match_number, p.type, count(*)::int as cnt
    FROM match m
    JOIN match_participation mp ON mp.match_id = m.id
    JOIN participant p ON p.id = mp.participant_id
    GROUP BY m.match_number, p.type
    ORDER BY m.match_number, p.type
  `);
  for (const row of rotationCheck) {
    const matchNum = row.match_number;
    const pType = row.type;
    let expectedCount = 0;
    if (pType === 'CREATOR') expectedCount = 5;
    else if (pType === 'PLAYER_1' && matchNum <= 2) expectedCount = 5;
    else if (pType === 'PLAYER_2' && matchNum >= 3) expectedCount = 5;

    const ok = row.cnt === expectedCount;
    console.log(`${ok ? 'PASS' : 'FAIL'} Match ${matchNum} ${pType}: ${row.cnt} (expected ${expectedCount})`);
    if (!ok) allPassed = false;
  }

  // Check maps per match
  const { rows: mapCounts } = await pool.query(`
    SELECT m.match_number, count(map.id)::int as map_count
    FROM match m
    JOIN map ON map.match_id = m.id
    GROUP BY m.match_number
    ORDER BY m.match_number
  `);
  for (const row of mapCounts) {
    const ok = row.map_count === 3;
    console.log(`${ok ? 'PASS' : 'FAIL'} Match ${row.match_number} maps: ${row.map_count} (expected 3)`);
    if (!ok) allPassed = false;
  }

  // Check map codes
  const { rows: maps } = await pool.query(`
    SELECT map.code, m.match_number, map.map_index
    FROM map
    JOIN match m ON m.id = map.match_id
    ORDER BY m.match_number, map.map_index
  `);
  for (const row of maps) {
    const expectedCode = `P${row.match_number}M${row.map_index}`;
    const ok = row.code === expectedCode;
    console.log(`${ok ? 'PASS' : 'FAIL'} Map code: ${row.code} (expected ${expectedCode})`);
    if (!ok) allPassed = false;
  }

  console.log(allPassed ? '\nAll checks passed.' : '\nSome checks FAILED.');
  await pool.end();
  process.exit(allPassed ? 0 : 1);
}

verify();
