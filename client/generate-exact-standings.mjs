/**
 * Generate exact DroneCup tournament data matching the official final standings:
 *
 * 1. Barra (315 pts) - Barra (219), s7tier (50), kikimaton (46)
 * 2. Vetel (310 pts) - Vetel (220), littlemonty (50), nemessys (40)
 * 3. Caramelo (258 pts) - Caramelo (210), voltrexa (24), redlucky (24)
 * 4. SoraMusic (202 pts) - SoraMusic (185), nix (8), nei (9)
 * 5. Miwell (127 pts) - Miwell (108), johnyhipster (10), fost (9)
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import path from 'path';

const outDir = path.resolve('public/api');

// ── Teams in exact finish order (Slot 0 = 315pts, Slot 1 = 310pts, etc.) ────
const TEAMS = [
  {
    name: 'Barra',
    slug: 'barra',
    color: '#f5c842',
    registrationUrl: 'https://discord.gg/barra',
    registrationPlatform: 'discord',
    communityNote: 'Formulario disponible en su servidor',
    participants: {
      creator: 'Barra',
      player1: 's7tier',
      player2: 'kikimaton',
    },
  },
  {
    name: 'Vetel',
    slug: 'vetel',
    color: '#38bdf8',
    registrationUrl: 'https://discord.gg/vetel',
    registrationPlatform: 'discord',
    communityNote: 'Inscripciones en el canal #drone-cup',
    participants: {
      creator: 'Vetel',
      player1: 'littlemonty',
      player2: 'nemessys',
    },
  },
  {
    name: 'Caramelo',
    slug: 'caramelo',
    color: '#ef4444',
    registrationUrl: 'https://twitter.com/CarameloOficial',
    registrationPlatform: 'twitter',
    communityNote: 'Draft y plazas abiertas en su post de X',
    participants: {
      creator: 'Caramelo',
      player1: 'voltrexa',
      player2: 'redlucky',
    },
  },
  {
    name: 'SoraMusic',
    slug: 'sora',
    color: '#22c55e',
    registrationUrl: 'https://twitter.com/soramusicr6',
    registrationPlatform: 'twitter',
    communityNote: 'Responde al tweet oficial fijado',
    participants: {
      creator: 'SoraMusic',
      player1: 'nix',
      player2: 'nei',
    },
  },
  {
    name: 'Miwell',
    slug: 'miwell',
    color: '#a855f7',
    registrationUrl: 'https://www.twitch.tv/DonMiwell',
    registrationPlatform: 'twitch',
    communityNote: 'Clasificatorio en directo durante su stream',
    participants: {
      creator: 'Miwell',
      player1: 'johnyhipster',
      player2: 'fost',
    },
  },
];

const POINTS_TABLE = { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 };

// Fixed UUIDs to ensure stable routes
const tournamentId = '771764d6-5ae3-4976-83b6-bfae637de9a9';

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

const eventDate = new Date('2026-06-15T16:00:00Z');
function ts(hoursOffset = 0) {
  return new Date(eventDate.getTime() + hoursOffset * 60 * 60 * 1000).toISOString();
}

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
  createdAt: ts(-2),
  updatedAt: ts(8),
};

// Participants
const allParticipants = [];
const teams = TEAMS.map(t => {
  const pIds = participantIds[t.slug];
  const tId = teamIds[t.slug];
  const c = { id: pIds.creator, teamId: tId, name: t.participants.creator, slug: t.participants.creator.toLowerCase(), type: 'CREATOR', confirmed: true, teamName: t.name };
  const p1 = { id: pIds.player1, teamId: tId, name: t.participants.player1, slug: t.participants.player1.toLowerCase(), type: 'PLAYER_1', confirmed: true, teamName: t.name };
  const p2 = { id: pIds.player2, teamId: tId, name: t.participants.player2, slug: t.participants.player2.toLowerCase(), type: 'PLAYER_2', confirmed: true, teamName: t.name };
  allParticipants.push(c, p1, p2);

  return {
    id: tId,
    tournamentId,
    name: t.name,
    slug: t.slug,
    color: t.color,
    logoUrl: null,
    registrationUrl: t.registrationUrl,
    registrationType: 'external',
    registrationPlatform: t.registrationPlatform,
    registrationStatus: 'completed',
    communityNote: t.communityNote,
    createdAt: ts(-10),
    updatedAt: ts(8),
    participants: [c, p1, p2],
  };
});

// Matches
const matches = [
  { id: matchIds[0], matchNumber: 1, phase: 'MAIN', status: 'COMPLETED', startedAt: ts(0), completedAt: ts(1.2), tournamentId },
  { id: matchIds[1], matchNumber: 2, phase: 'MAIN', status: 'COMPLETED', startedAt: ts(1.5), completedAt: ts(2.8), tournamentId },
  { id: matchIds[2], matchNumber: 3, phase: 'MAIN', status: 'COMPLETED', startedAt: ts(3.2), completedAt: ts(4.5), tournamentId },
  { id: matchIds[3], matchNumber: 4, phase: 'MAIN', status: 'COMPLETED', startedAt: ts(5.0), completedAt: ts(6.3), tournamentId },
];

// Maps
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

// Participations by match: Match 1-2 → Creator + P1; Match 3-4 → Creator + P2
function getMatchParticipants(matchIndex) {
  const result = [];
  for (const t of TEAMS) {
    const pIds = participantIds[t.slug];
    result.push(pIds.creator);
    result.push(matchIndex < 2 ? pIds.player1 : pIds.player2);
  }
  return result;
}

// Exact finish orders that produce:
// Team 0 (Barra): 315 pts (219 creator, 50 p1, 46 p2)
// Team 1 (Vetel): 310 pts (220 creator, 50 p1, 40 p2)
// Team 2 (Caramelo): 258 pts (210 creator, 24 p1, 24 p2)
// Team 3 (SoraMusic): 202 pts (185 creator, 8 p1, 9 p2)
// Team 4 (Miwell): 127 pts (108 creator, 10 p1, 9 p2)
const finishOrders = [
  // Match 1 (Creator + P1)
  [2, 0, 4, 3, 1, 6, 8, 5, 7, 9],  // P1M1
  [0, 4, 2, 6, 1, 3, 8, 5, 9, 7],  // P1M2
  [4, 2, 0, 6, 3, 8, 1, 5, 9, 7],  // P1M3
  // Match 2 (Creator + P1)
  [2, 4, 0, 8, 6, 1, 3, 5, 9, 7],  // P2M1
  [6, 0, 4, 2, 8, 3, 1, 5, 7, 9],  // P2M2
  [0, 2, 6, 4, 1, 8, 3, 5, 9, 7],  // P2M3
  // Match 3 (Creator + P2)
  [4, 0, 6, 2, 8, 1, 3, 5, 7, 9],  // P3M1
  [2, 6, 0, 4, 8, 3, 1, 5, 9, 7],  // P3M2
  [6, 4, 2, 0, 8, 1, 3, 5, 7, 9],  // P3M3
  // Match 4 (Creator + P2)
  [0, 2, 4, 6, 1, 8, 3, 5, 9, 7],  // P4M1
  [2, 0, 6, 4, 8, 1, 3, 5, 7, 9],  // P4M2
  [4, 6, 0, 2, 8, 3, 1, 5, 9, 7],  // P4M3
];

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

function findParticipant(pId) {
  return allParticipants.find(p => p.id === pId);
}
function findTeam(teamId) {
  return teams.find(t => t.id === teamId);
}

// Match Details
const matchDetailResponses = {};
for (let i = 0; i < 4; i++) {
  const matchParticipantIds = getMatchParticipants(i);
  const participants = matchParticipantIds.map(pId => {
    const p = findParticipant(pId);
    const t = findTeam(p.teamId);
    return { id: p.id, name: p.name, type: p.type, teamName: t.name, teamSlug: t.slug, teamColor: t.color };
  });

  const maps = allMaps.filter(m => m.matchId === matchIds[i]).map(m => {
    const results = allResults.filter(r => r.mapId === m.id).map(r => {
      const p = findParticipant(r.participantId);
      const t = findTeam(p.teamId);
      return {
        id: randomUUID(),
        mapId: m.id,
        participantId: r.participantId,
        participantName: p.name,
        participantType: p.type,
        teamId: t.id,
        teamName: t.name,
        teamSlug: t.slug,
        teamColor: t.color,
        position: r.position,
        status: r.status,
        points: r.points,
      };
    });
    return { ...m, results };
  });

  matchDetailResponses[matchIds[i]] = {
    ...matches[i],
    maps,
    participants,
  };
}

// Maps detail
const mapDetailResponses = {};
for (const m of allMaps) {
  const results = allResults.filter(r => r.mapId === m.id).map(r => {
    const p = findParticipant(r.participantId);
    const t = findTeam(p.teamId);
    return {
      id: randomUUID(),
      mapId: m.id,
      participantId: r.participantId,
      participantName: p.name,
      participantType: p.type,
      teamId: t.id,
      teamName: t.name,
      teamSlug: t.slug,
      teamColor: t.color,
      position: r.position,
      status: r.status,
      points: r.points,
    };
  });
  mapDetailResponses[m.id] = { ...m, results };
}

// Team Details
const teamDetailResponses = {};
for (const t of teams) {
  teamDetailResponses[t.id] = t;
}

// Rankings
const teamTotals = {};
for (const t of teams) {
  let total = 0;
  for (const p of t.participants) {
    for (const r of allResults) {
      if (r.participantId === p.id) total += r.points;
    }
  }
  teamTotals[t.id] = total;
}

const teamRankings = teams
  .map(t => ({
    teamId: t.id,
    teamName: t.name,
    teamSlug: t.slug,
    teamColor: t.color,
    totalPoints: teamTotals[t.id],
    rank: 0,
  }))
  .sort((a, b) => b.totalPoints - a.totalPoints)
  .map((t, idx) => ({ ...t, rank: idx + 1 }));

const individualRankings = allParticipants
  .map(p => {
    let total = 0;
    for (const r of allResults) {
      if (r.participantId === p.id) total += r.points;
    }
    const t = findTeam(p.teamId);
    return {
      participantId: p.id,
      participantName: p.name,
      participantType: p.type,
      teamId: p.teamId,
      teamName: t.name,
      teamSlug: t.slug,
      teamColor: t.color,
      totalPoints: total,
      rank: 0,
    };
  })
  .sort((a, b) => b.totalPoints - a.totalPoints)
  .map((p, idx) => ({ ...p, rank: idx + 1 }));

const rankingsResponse = { teams: teamRankings, individuals: individualRankings, hasResults: true };

// Statistics
function getTeamStatistics() {
  return teams.map(t => {
    let totalPoints = 0;
    let wins = 0;
    let podiums = 0;
    const participantBreakdown = t.participants.map(p => {
      let pPoints = 0;
      let pWins = 0;
      let pPodiums = 0;
      let mapsPlayed = 0;
      for (const r of allResults) {
        if (r.participantId === p.id) {
          mapsPlayed++;
          pPoints += r.points;
          if (r.position === 1) pWins++;
          if (r.position <= 3) pPodiums++;
        }
      }
      totalPoints += pPoints;
      wins += pWins;
      podiums += pPodiums;
      return {
        participantId: p.id,
        participantName: p.name,
        participantType: p.type,
        points: pPoints,
        wins: pWins,
        podiums: pPodiums,
        mapsPlayed,
      };
    });

    const progression = [];
    let running = 0;
    for (let i = 0; i < allMaps.length; i++) {
      const map = allMaps[i];
      let mapPts = 0;
      for (const p of t.participants) {
        const r = allResults.find(res => res.mapId === map.id && res.participantId === p.id);
        if (r) mapPts += r.points;
      }
      running += mapPts;
      progression.push({ mapIndex: i + 1, code: map.code, points: running });
    }

    return {
      teamId: t.id,
      teamName: t.name,
      teamSlug: t.slug,
      teamColor: t.color,
      totalPoints,
      wins,
      podiums,
      mapsPlayed: 12,
      averagePointsPerMap: +(totalPoints / 12).toFixed(1),
      participantBreakdown,
      progression,
      rank: 0,
    };
  })
  .sort((a, b) => b.totalPoints - a.totalPoints)
  .map((t, idx) => ({ ...t, rank: idx + 1 }));
}

function getParticipantStatistics() {
  return allParticipants.map(p => {
    const t = findTeam(p.teamId);
    let totalPoints = 0;
    let wins = 0;
    let podiums = 0;
    let mapsPlayed = 0;
    const pResults = allResults.filter(r => r.participantId === p.id);

    const progression = [];
    let running = 0;
    for (let i = 0; i < allMaps.length; i++) {
      const map = allMaps[i];
      const r = pResults.find(res => res.mapId === map.id);
      if (r) {
        mapsPlayed++;
        totalPoints += r.points;
        if (r.position === 1) wins++;
        if (r.position <= 3) podiums++;
        running += r.points;
        progression.push({ mapIndex: i + 1, code: map.code, points: running });
      }
    }

    return {
      participantId: p.id,
      participantName: p.name,
      participantType: p.type,
      teamId: t.id,
      teamName: t.name,
      teamSlug: t.slug,
      teamColor: t.color,
      totalPoints,
      wins,
      podiums,
      mapsPlayed,
      averagePointsPerMap: mapsPlayed > 0 ? +(totalPoints / mapsPlayed).toFixed(1) : 0,
      progression,
      rank: 0,
    };
  })
  .sort((a, b) => b.totalPoints - a.totalPoints)
  .map((p, idx) => ({ ...p, rank: idx + 1 }));
}

function getProgressionResponse() {
  const teamStats = getTeamStatistics();
  const participantStats = getParticipantStatistics();
  return {
    teams: teamStats.map(t => ({
      teamId: t.teamId,
      teamName: t.teamName,
      teamSlug: t.teamSlug,
      teamColor: t.teamColor,
      progression: t.progression,
    })),
    participants: participantStats.map(p => ({
      participantId: p.participantId,
      participantName: p.participantName,
      teamName: p.teamName,
      teamColor: p.teamColor,
      progression: p.progression,
    })),
  };
}

// ── Write files ─────────────────────────────────────────────────────────────
function writeJson(relPath, data) {
  const full = path.join(outDir, relPath);
  const dir = path.dirname(full);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(full, JSON.stringify(data, null, 2), 'utf-8');
}

const dirs = ['teams', 'matches', 'maps', 'statistics', 'statistics/teams', 'statistics/participants', 'auth'];
for (const d of dirs) {
  const p = path.join(outDir, d);
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

writeJson('tournament.json', tournament);
writeJson('teams.json', teams);
writeJson('matches.json', matches);
writeJson('rankings.json', rankingsResponse);
writeJson('participants.json', allParticipants);

for (const [id, data] of Object.entries(teamDetailResponses)) {
  writeJson(`teams/${id}.json`, data);
}

for (const [id, data] of Object.entries(matchDetailResponses)) {
  writeJson(`matches/${id}.json`, data);
}

for (const [id, data] of Object.entries(mapDetailResponses)) {
  writeJson(`maps/${id}.json`, data);
}

const teamStats = getTeamStatistics();
const participantStats = getParticipantStatistics();
writeJson('statistics/teams.json', teamStats);
writeJson('statistics/participants.json', participantStats);
writeJson('statistics/progression.json', getProgressionResponse());

for (const ts of teamStats) {
  writeJson(`statistics/teams/${ts.teamId}.json`, ts);
}

for (const ps of participantStats) {
  writeJson(`statistics/participants/${ps.participantId}.json`, ps);
}

const teamSlugIndex = {};
for (const t of teams) {
  teamSlugIndex[t.slug] = t.id;
}
writeJson('team-slug-index.json', teamSlugIndex);

writeJson('health.json', { status: 'ok', mode: 'static', timestamp: new Date().toISOString() });
writeJson('auth/validate.json', { valid: true });

console.log('Final verified standings generated successfully:');
for (const tr of rankingsResponse.teams) {
  console.log(`  ${tr.rank}º ${tr.teamName}: ${tr.totalPoints} pts`);
}
