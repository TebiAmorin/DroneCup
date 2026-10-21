/**
 * Generate static JSON data files for the DroneCup application.
 * This replaces the PostgreSQL database with pre-computed JSON files
 * so the frontend can be deployed as a fully static site.
 *
 * Run: node generate-static-data.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';

// ── IDs ─────────────────────────────────────────────
const tournamentId = randomUUID();

const TEAMS = [
  { name: 'Barra',     slug: 'barra',     color: '#f5c842' },
  { name: 'Caramelo',  slug: 'caramelo',  color: '#ef4444' },
  { name: 'Miwell',    slug: 'miwell',    color: '#a855f7' },
  { name: 'SoraMusic', slug: 'sora',      color: '#22c55e' },
  { name: 'Vetel',     slug: 'vetel',     color: '#38bdf8' },
];

const PARTICIPANTS_TEMPLATE = {
  barra:     { creator: 'Barra',       player1: 'BarraGhost',   player2: 'BarraStorm' },
  caramelo:  { creator: 'Caramelo',    player1: 'CaraLion',     player2: 'CaraShadow' },
  miwell:    { creator: 'Miwell',      player1: 'MiwellDragon', player2: 'MiwellFox' },
  sora:      { creator: 'SoraMusic',   player1: 'SoraBlaze',    player2: 'SoraWind' },
  vetel:     { creator: 'Vetel',       player1: 'VetelAce',     player2: 'VetelNova' },
};

const POINTS_TABLE = { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 };

// ── Generate UUIDs ──────────────────────────────────
const teamIds = {};
const participantIds = {};
const matchIds = [];
const mapIds = [];

for (const t of TEAMS) {
  teamIds[t.slug] = randomUUID();
  participantIds[t.slug] = {
    creator: randomUUID(),
    player1: randomUUID(),
    player2: randomUUID(),
  };
}

for (let i = 0; i < 4; i++) matchIds.push(randomUUID());
for (let i = 0; i < 4; i++) {
  mapIds.push([randomUUID(), randomUUID(), randomUUID()]);
}

// ── Timestamps ──────────────────────────────────────
const eventDate = new Date('2026-06-15T16:00:00Z');
function ts(hoursOffset = 0) {
  return new Date(eventDate.getTime() + hoursOffset * 60 * 60 * 1000).toISOString();
}

// ── Build structured data ───────────────────────────

// Tournament
const tournament = {
  id: tournamentId,
  name: 'Wasteland Drone Cup',
  status: 'COMPLETED',
  currentMatchId: null,
  currentMapId: null,
  tournamentReady: true,
  confirmedParticipants: 15,
  totalParticipants: 15,
};

// Teams (full data with registration info)
const teams = TEAMS.map(t => ({
  id: teamIds[t.slug],
  tournamentId,
  name: t.name,
  slug: t.slug,
  color: t.color,
  logoUrl: null,
  registrationUrl: null,
  registrationType: null,
  registrationPlatform: null,
  registrationStatus: 'completed',
  communityNote: null,
  qualifierDate: '2026-06-10',
  qualifierStartTime: '18:00',
  qualifierEndTime: '22:00',
  qualifierFormat: 'Clasificatorio abierto – mejores tiempos',
  qualifierRequirements: 'Cuenta de Ubisoft activa',
  qualifierHowToParticipate: 'Sigue al creador para más información',
  participants: [],
}));

// Participants
const allParticipants = [];
for (const t of TEAMS) {
  const p = PARTICIPANTS_TEMPLATE[t.slug];
  const pIds = participantIds[t.slug];
  const teamId = teamIds[t.slug];

  const creator = { id: pIds.creator, teamId, name: p.creator, slug: p.creator.toLowerCase(), type: 'CREATOR', confirmed: true, teamName: t.name };
  const p1 = { id: pIds.player1, teamId, name: p.player1, slug: p.player1.toLowerCase(), type: 'PLAYER_1', confirmed: true, teamName: t.name };
  const p2 = { id: pIds.player2, teamId, name: p.player2, slug: p.player2.toLowerCase(), type: 'PLAYER_2', confirmed: true, teamName: t.name };

  allParticipants.push(creator, p1, p2);

  const teamObj = teams.find(tt => tt.slug === t.slug);
  teamObj.participants = [creator, p1, p2];
}

// Matches (all COMPLETED)
const matches = [];
for (let i = 0; i < 4; i++) {
  matches.push({
    id: matchIds[i],
    tournamentId,
    matchNumber: i + 1,
    phase: 'MAIN',
    status: 'COMPLETED',
    startedAt: ts(i * 1.5),
    completedAt: ts((i + 1) * 1.5),
  });
}

// Match participations: Match 1-2 → Creator + P1, Match 3-4 → Creator + P2
function getMatchParticipants(matchIndex) {
  const result = [];
  for (const t of TEAMS) {
    const pIds = participantIds[t.slug];
    result.push(pIds.creator);
    result.push(matchIndex < 2 ? pIds.player1 : pIds.player2);
  }
  return result;
}

// Maps (3 per match, all COMPLETED)
const allMaps = [];
for (let i = 0; i < 4; i++) {
  for (let j = 0; j < 3; j++) {
    allMaps.push({
      id: mapIds[i][j],
      matchId: matchIds[i],
      mapIndex: j + 1,
      code: `P${i + 1}M${j + 1}`,
      status: 'COMPLETED',
      startedAt: ts(i * 1.5 + j * 0.4),
      completedAt: ts(i * 1.5 + (j + 1) * 0.4),
      matchNumber: i + 1,
      phase: 'MAIN',
    });
  }
}

// ── Realistic race results ──────────────────────────
// Finish orders per map (index in participants array for that match)
// 10 participants per match, indices 0-9 correspond to: 
// team0_creator, team0_partner, team1_creator, team1_partner, ...

const finishOrders = [
  // Match 1 (Creator + P1)
  [2, 0, 4, 3, 1, 6, 8, 5, 7, 9],  // P1M1 - Vetel domina
  [0, 4, 2, 6, 1, 3, 8, 5, 9, 7],  // P1M2 - Caramelo remonta
  [4, 2, 0, 6, 3, 8, 1, 5, 9, 7],  // P1M3 - Miwell victoria
  // Match 2 (Creator + P1)
  [2, 4, 0, 8, 6, 1, 3, 5, 9, 7],  // P2M1 - Vetel y Miwell top
  [6, 0, 4, 2, 8, 3, 1, 5, 7, 9],  // P2M2 - SoraMusic sube
  [0, 2, 6, 4, 1, 8, 3, 5, 9, 7],  // P2M3 - Caramelo y Vetel
  // Match 3 (Creator + P2)
  [4, 0, 6, 2, 8, 1, 3, 5, 7, 9],  // P3M1 - Miwell P2 fuerte
  [2, 6, 0, 4, 8, 3, 1, 5, 9, 7],  // P3M2 - Vetel consistente
  [6, 4, 2, 0, 8, 1, 3, 5, 7, 9],  // P3M3 - SoraMusic sorprende
  // Match 4 (Creator + P2)
  [0, 2, 4, 6, 1, 8, 3, 5, 9, 7],  // P4M1 - Caramelo cierra fuerte
  [2, 0, 6, 4, 8, 1, 3, 5, 7, 9],  // P4M2 - Vetel y Caramelo
  [4, 6, 0, 2, 8, 3, 1, 5, 9, 7],  // P4M3 - Gran final Miwell
];

// Generate results for all 12 maps
const allResults = [];
for (let matchIdx = 0; matchIdx < 4; matchIdx++) {
  const matchParticipantIds = getMatchParticipants(matchIdx);
  
  for (let mapIdx = 0; mapIdx < 3; mapIdx++) {
    const globalMapIdx = matchIdx * 3 + mapIdx;
    const finishOrder = finishOrders[globalMapIdx];
    const mapId = mapIds[matchIdx][mapIdx];

    for (let pos = 0; pos < 10; pos++) {
      const pId = matchParticipantIds[finishOrder[pos]];
      const points = POINTS_TABLE[pos + 1];
      allResults.push({
        mapId,
        participantId: pId,
        position: pos + 1,
        status: 'FINISHED',
        points,
      });
    }
  }
}

// ── Helper: find participant info ───────────────────
function findParticipant(pId) {
  return allParticipants.find(p => p.id === pId);
}

function findTeam(teamId) {
  return teams.find(t => t.id === teamId);
}

// ── Build API responses ─────────────────────────────

// 1. /api/tournament
const tournamentResponse = tournament;

// 2. /api/teams (list with participants)
const teamsResponse = teams;

// 3. /api/teams/:id (individual team)
const teamDetailResponses = {};
for (const t of teams) {
  teamDetailResponses[t.id] = t;
}

// 4. /api/matches (list)
const matchesResponse = matches;

// 5. /api/matches/:id (match detail with maps and participants)
const matchDetailResponses = {};
for (let i = 0; i < 4; i++) {
  const matchParticipantIds = getMatchParticipants(i);
  const participants = matchParticipantIds.map(pId => {
    const p = findParticipant(pId);
    const t = findTeam(p.teamId);
    return { id: p.id, name: p.name, type: p.type, teamName: t.name, teamSlug: t.slug, teamColor: t.color };
  });

  const maps = allMaps.filter(m => m.matchId === matchIds[i]).map(m => ({
    id: m.id,
    mapIndex: m.mapIndex,
    code: m.code,
    status: m.status,
    startedAt: m.startedAt,
    completedAt: m.completedAt,
  }));

  matchDetailResponses[matchIds[i]] = {
    ...matches[i],
    maps,
    participants,
  };
}

// 6. /api/maps/:id (map detail with results)
const mapDetailResponses = {};
for (const map of allMaps) {
  const mapResults = allResults.filter(r => r.mapId === map.id).map(r => {
    const p = findParticipant(r.participantId);
    const t = findTeam(p.teamId);
    return {
      participantId: r.participantId,
      participantName: p.name,
      participantType: p.type,
      teamName: t.name,
      teamSlug: t.slug,
      teamColor: t.color,
      position: r.position,
      status: r.status,
      points: r.points,
    };
  });

  mapDetailResponses[map.id] = {
    ...map,
    results: mapResults,
  };
}

// 7. /api/rankings
// Calculate team totals
const teamTotals = {};
for (const t of TEAMS) {
  const tId = teamIds[t.slug];
  const pIds = [participantIds[t.slug].creator, participantIds[t.slug].player1, participantIds[t.slug].player2];
  let total = 0;
  for (const r of allResults) {
    if (pIds.includes(r.participantId)) total += r.points;
  }
  teamTotals[tId] = total;
}

const teamRankings = Object.entries(teamTotals)
  .sort(([, a], [, b]) => b - a)
  .map(([tId, totalPoints], idx) => {
    const t = findTeam(tId);
    return { rank: idx + 1, teamId: tId, teamName: t.name, teamSlug: t.slug, teamColor: t.color, totalPoints };
  });

// Individual rankings
const individualTotals = {};
for (const p of allParticipants) {
  let total = 0;
  for (const r of allResults) {
    if (r.participantId === p.id) total += r.points;
  }
  individualTotals[p.id] = total;
}

const individualRankings = Object.entries(individualTotals)
  .filter(([, pts]) => pts > 0)
  .sort(([, a], [, b]) => b - a)
  .map(([pId, totalPoints], idx) => {
    const p = findParticipant(pId);
    const t = findTeam(p.teamId);
    return {
      rank: idx + 1,
      participantId: pId,
      participantName: p.name,
      participantType: p.type,
      teamId: t.id,
      teamName: t.name,
      totalPoints,
    };
  });

const rankingsResponse = { teams: teamRankings, individuals: individualRankings, hasResults: true };

// 8. /api/participants
const participantsResponse = allParticipants;

// 9. /api/statistics/teams
function getTeamStatistics() {
  const stats = [];
  for (const t of TEAMS) {
    const tId = teamIds[t.slug];
    const pIds = [participantIds[t.slug].creator, participantIds[t.slug].player1, participantIds[t.slug].player2];

    const teamResults = allResults.filter(r => pIds.includes(r.participantId));

    // Points by map
    const pointsByMap = [];
    for (const map of allMaps) {
      const mapTeamResults = teamResults.filter(r => r.mapId === map.id);
      if (mapTeamResults.length > 0) {
        const pts = mapTeamResults.reduce((sum, r) => sum + r.points, 0);
        pointsByMap.push({
          mapId: map.id,
          mapCode: map.code,
          matchNumber: map.matchNumber,
          mapIndex: map.mapIndex,
          points: pts,
        });
      }
    }

    // Points by match
    const pointsByMatch = [];
    for (let i = 0; i < 4; i++) {
      const matchMapIds = mapIds[i];
      let pts = 0;
      for (const r of teamResults) {
        if (matchMapIds.includes(r.mapId)) pts += r.points;
      }
      if (pts > 0) {
        pointsByMatch.push({ matchId: matchIds[i], matchNumber: i + 1, points: pts });
      }
    }

    // Progression
    const progression = [];
    let cumulative = 0;
    for (const map of allMaps) {
      const mapTeamResults = teamResults.filter(r => r.mapId === map.id);
      if (mapTeamResults.length > 0) {
        cumulative += mapTeamResults.reduce((sum, r) => sum + r.points, 0);
        progression.push({
          mapId: map.id,
          mapCode: map.code,
          matchNumber: map.matchNumber,
          mapIndex: map.mapIndex,
          cumulativePoints: cumulative,
        });
      }
    }

    // Maps won (team member got 1st)
    let mapsWon = 0;
    for (const map of allMaps) {
      const first = allResults.find(r => r.mapId === map.id && r.position === 1);
      if (first && pIds.includes(first.participantId)) mapsWon++;
    }

    const totalPoints = teamTotals[tId];

    stats.push({
      teamId: tId,
      teamName: t.name,
      teamSlug: t.slug,
      teamColor: t.color,
      totalPoints,
      globalPosition: 0, // will be set below
      mapsPlayed: 12,
      mapsWon,
      pointsByMatch,
      pointsByMap,
      progression,
    });
  }

  stats.sort((a, b) => b.totalPoints - a.totalPoints);
  stats.forEach((s, i) => s.globalPosition = i + 1);
  return stats;
}

// 10. /api/statistics/participants
function getParticipantStatistics() {
  const stats = [];
  for (const p of allParticipants) {
    const pResults = allResults.filter(r => r.participantId === p.id);
    if (pResults.length === 0) continue;

    const t = findTeam(p.teamId);

    const positions = pResults.filter(r => r.status === 'FINISHED').map(r => r.position);
    const bestPosition = positions.length > 0 ? Math.min(...positions) : null;
    const totalPoints = pResults.reduce((sum, r) => sum + r.points, 0);
    const mapsPlayed = pResults.length;
    const averagePointsPerMap = mapsPlayed > 0 ? Math.round((totalPoints / mapsPlayed) * 100) / 100 : null;
    const dnfCount = pResults.filter(r => r.status === 'DNF').length;

    // Position counts
    const posCountMap = {};
    for (const r of pResults) {
      if (r.status === 'DNF') {
        posCountMap['DNF'] = (posCountMap['DNF'] || 0) + 1;
      } else {
        posCountMap[r.position] = (posCountMap[r.position] || 0) + 1;
      }
    }
    const positionCounts = Object.entries(posCountMap).map(([pos, count]) => ({
      position: pos === 'DNF' ? 'DNF' : parseInt(pos),
      count,
    }));

    // Points by map
    const pointsByMap = [];
    for (const map of allMaps) {
      const r = pResults.find(rr => rr.mapId === map.id);
      if (r) {
        pointsByMap.push({
          mapId: map.id,
          mapCode: map.code,
          matchNumber: map.matchNumber,
          mapIndex: map.mapIndex,
          points: r.points,
        });
      }
    }

    // Progression
    const progression = [];
    let cumulative = 0;
    for (const map of allMaps) {
      const r = pResults.find(rr => rr.mapId === map.id);
      if (r) {
        cumulative += r.points;
        progression.push({
          mapId: map.id,
          mapCode: map.code,
          matchNumber: map.matchNumber,
          mapIndex: map.mapIndex,
          cumulativePoints: cumulative,
        });
      }
    }

    stats.push({
      participantId: p.id,
      participantName: p.name,
      participantType: p.type,
      teamId: t.id,
      teamName: t.name,
      totalPoints,
      mapsPlayed,
      averagePointsPerMap,
      bestPosition,
      positionCounts,
      dnfCount,
      pointsByMap,
      progression,
    });
  }

  return stats;
}

// 11. /api/statistics/progression
function getProgressionResponse() {
  const teamStats = getTeamStatistics();
  const participantStats = getParticipantStatistics();
  return {
    teams: teamStats.map(t => ({
      teamId: t.teamId,
      teamName: t.teamName,
      teamColor: t.teamColor,
      progression: t.progression,
    })),
    participants: participantStats
      .filter(p => p.progression.length > 0)
      .map(p => ({
        participantId: p.participantId,
        participantName: p.participantName,
        participantType: p.participantType,
        teamId: p.teamId,
        teamName: p.teamName,
        progression: p.progression,
      })),
  };
}

// ── Write all files ─────────────────────────────────
const outDir = 'public/api';
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// Static sub-directories
const dirs = ['teams', 'matches', 'maps', 'statistics', 'statistics/teams', 'statistics/participants', 'auth'];
for (const d of dirs) {
  const path = `${outDir}/${d}`;
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function writeJson(path, data) {
  writeFileSync(`${outDir}/${path}`, JSON.stringify(data, null, 2));
  console.log(`  ✓ ${outDir}/${path}`);
}

console.log('\n🏁 Generating static data for Wasteland Drone Cup...\n');

// Core endpoints
writeJson('tournament.json', tournamentResponse);
writeJson('teams.json', teamsResponse);
writeJson('matches.json', matchesResponse);
writeJson('rankings.json', rankingsResponse);
writeJson('participants.json', participantsResponse);

// Team details
for (const [id, data] of Object.entries(teamDetailResponses)) {
  writeJson(`teams/${id}.json`, data);
}

// Match details
for (const [id, data] of Object.entries(matchDetailResponses)) {
  writeJson(`matches/${id}.json`, data);
}

// Map details
for (const [id, data] of Object.entries(mapDetailResponses)) {
  writeJson(`maps/${id}.json`, data);
}

// Statistics
const teamStats = getTeamStatistics();
const participantStats = getParticipantStatistics();
writeJson('statistics/teams.json', teamStats);
writeJson('statistics/participants.json', participantStats);
writeJson('statistics/progression.json', getProgressionResponse());

// Individual team stats
for (const ts of teamStats) {
  writeJson(`statistics/teams/${ts.teamId}.json`, ts);
}

// Individual participant stats
for (const ps of participantStats) {
  writeJson(`statistics/participants/${ps.participantId}.json`, ps);
}

// Index files for lookup by slug (teams) and match (participants)
const teamSlugIndex = {};
for (const t of teams) {
  teamSlugIndex[t.slug] = t.id;
}
writeJson('team-slug-index.json', teamSlugIndex);

// Auth validation (always return valid: false for static)
writeJson('auth/validate.json', { valid: false });

// Health
writeJson('health.json', { status: 'ok', mode: 'static', timestamp: new Date().toISOString() });

console.log(`\n✅ Static data generated successfully!`);
console.log(`   Total teams: ${teams.length}`);
console.log(`   Total participants: ${allParticipants.length}`);
console.log(`   Total matches: ${matches.length}`);
console.log(`   Total maps: ${allMaps.length}`);
console.log(`   Total results: ${allResults.length}`);
console.log(`   Team rankings: ${teamRankings.map(r => `${r.rank}. ${r.teamName} (${r.totalPoints}pts)`).join(', ')}`);
console.log('');
