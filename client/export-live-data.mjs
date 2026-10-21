/**
 * Export real data from the running local PostgreSQL backend
 * directly into client/public/api/*.json
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:3001/api';
const OUT_DIR = path.resolve('public/api');

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

async function fetchJson(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function writeJson(relPath, data) {
  const fullPath = path.join(OUT_DIR, relPath);
  ensureDir(path.dirname(fullPath));
  writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Saved: public/api/${relPath}`);
}

async function main() {
  ensureDir(OUT_DIR);

  console.log('1. Exporting Tournament...');
  const tournament = await fetchJson('/tournament');
  writeJson('tournament.json', tournament);

  console.log('2. Exporting Teams...');
  const teams = await fetchJson('/teams');
  writeJson('teams.json', teams);

  const slugIndex = {};
  for (const team of teams) {
    slugIndex[team.slug] = team.id;
    try {
      const detail = await fetchJson(`/teams/${team.id}`);
      writeJson(`teams/${team.id}.json`, detail);
    } catch (e) {
      console.warn(`Could not fetch team ${team.id}:`, e.message);
    }
  }
  writeJson('team-slug-index.json', slugIndex);

  console.log('3. Exporting Participants...');
  const participants = await fetchJson('/participants');
  writeJson('participants.json', participants);

  console.log('4. Exporting Matches and Maps...');
  const matches = await fetchJson('/matches');
  writeJson('matches.json', matches);

  for (const match of matches) {
    try {
      const matchDetail = await fetchJson(`/matches/${match.id}`);
      writeJson(`matches/${match.id}.json`, matchDetail);

      if (matchDetail.maps && Array.isArray(matchDetail.maps)) {
        for (const map of matchDetail.maps) {
          try {
            const mapDetail = await fetchJson(`/maps/${map.id}`);
            writeJson(`maps/${map.id}.json`, mapDetail);
          } catch (e) {
            console.warn(`Could not fetch map ${map.id}:`, e.message);
          }
        }
      }
    } catch (e) {
      console.warn(`Could not fetch match ${match.id}:`, e.message);
    }
  }

  console.log('5. Exporting Rankings...');
  const rankings = await fetchJson('/rankings');
  writeJson('rankings.json', rankings);

  console.log('6. Exporting Statistics...');
  const statsTeams = await fetchJson('/statistics/teams');
  writeJson('statistics/teams.json', statsTeams);

  for (const team of teams) {
    try {
      const ts = await fetchJson(`/statistics/teams/${team.id}`);
      writeJson(`statistics/teams/${team.id}.json`, ts);
    } catch (e) {
      console.warn(`Could not fetch stats for team ${team.id}:`, e.message);
    }
  }

  const statsParticipants = await fetchJson('/statistics/participants');
  writeJson('statistics/participants.json', statsParticipants);

  for (const p of participants) {
    try {
      const ps = await fetchJson(`/statistics/participants/${p.id}`);
      writeJson(`statistics/participants/${p.id}.json`, ps);
    } catch (e) {
      console.warn(`Could not fetch stats for participant ${p.id}:`, e.message);
    }
  }

  try {
    const progression = await fetchJson('/statistics/progression');
    writeJson('statistics/progression.json', progression);
  } catch (e) {
    console.warn('Could not fetch progression stats:', e.message);
  }

  console.log('7. Exporting Health & Auth fallback...');
  writeJson('health.json', {
    status: 'ok',
    mode: 'static',
    timestamp: new Date().toISOString(),
  });
  writeJson('auth/validate.json', { valid: true });

  console.log('DONE! Real database data exported to client/public/api/');
}

main().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
