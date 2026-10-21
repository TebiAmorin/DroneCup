/**
 * Apply the real creator & community participant names and adjust team assignments
 * so that the leaderboard correctly reflects:
 *  1. Barra (442 pts) - Barra, s7tier, kikimaton
 *  2. Vetel (294 pts) - Vetel, littlemonty, nemessys
 *  3. Caramelo (202 pts) - Caramelo, voltrexa, redlucky
 *  4. Sora (174 pts) - SoraMusic, nix, nei
 *  5. Miwell (100 pts) - Miwell, johnyhipster, fost
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';

const API_DIR = path.resolve('public/api');

// Team slot mapping (Slot 1 to 5 based on points achieved in test)
// Slot 1: was Barra (442) -> remains Barra
// Slot 2: was Caramelo (294) -> now Vetel
// Slot 3: was Miwell (202) -> now Caramelo
// Slot 4: was SoraMusic (174) -> remains SoraMusic
// Slot 5: was Vetel (100) -> now Miwell

const TEAMS_BY_SLOT_ID = {
  // Slot 1 ID
  '9ef76b14-e0f9-42b0-a574-18b397285228': {
    name: 'Barra',
    slug: 'barra',
    color: '#ef4444',
    registrationUrl: 'https://discord.gg/barra',
    registrationPlatform: 'discord',
    communityNote: 'Formulario disponible en su servidor',
  },
  // Slot 2 ID
  'd7213635-7820-4352-b543-3ffc20b11878': {
    name: 'Vetel',
    slug: 'vetel',
    color: '#38bdf8',
    registrationUrl: 'https://discord.gg/vetel',
    registrationPlatform: 'discord',
    communityNote: 'Inscripciones en el canal #drone-cup',
  },
  // Slot 3 ID
  '3efcb850-00aa-4a58-b3b9-091fcb5e32c1': {
    name: 'Caramelo',
    slug: 'caramelo',
    color: '#f5c842',
    registrationUrl: 'https://twitter.com/CarameloOficial',
    registrationPlatform: 'twitter',
    communityNote: 'Draft y plazas abiertas en su post de X',
  },
  // Slot 4 ID
  '5da730b7-3981-42cd-801f-4048df75504b': {
    name: 'SoraMusic',
    slug: 'sora',
    color: '#a855f7',
    registrationUrl: 'https://twitter.com/soramusicr6',
    registrationPlatform: 'twitter',
    communityNote: 'Responde al tweet oficial fijado',
  },
  // Slot 5 ID
  '0a92676a-460f-4dff-85f1-1f449940d6ea': {
    name: 'Miwell',
    slug: 'miwell',
    color: '#22c55e',
    registrationUrl: 'https://www.twitch.tv/DonMiwell',
    registrationPlatform: 'twitch',
    communityNote: 'Clasificatorio en directo durante su stream',
  },
};

// Participant mapping by ID
const PARTICIPANTS_BY_ID = {
  // Barra team (Slot 1)
  '3209785a-2635-4529-98d9-917b61d002ca': { name: 'Barra', slug: 'barra', type: 'CREATOR', teamSlotId: '9ef76b14-e0f9-42b0-a574-18b397285228' },
  '6b7dddd4-5636-4f3d-80a0-0c48dd2cb3cc': { name: 's7tier', slug: 's7tier', type: 'PLAYER_1', teamSlotId: '9ef76b14-e0f9-42b0-a574-18b397285228' },
  'b86fecc8-eb9c-47b3-8d00-839a5e085bf9': { name: 'kikimaton', slug: 'kikimaton', type: 'PLAYER_2', teamSlotId: '9ef76b14-e0f9-42b0-a574-18b397285228' },

  // Vetel team (Slot 2, was 294 pts)
  '4b11e3d7-d15a-4520-8478-a05e2066fae7': { name: 'Vetel', slug: 'vetel', type: 'CREATOR', teamSlotId: 'd7213635-7820-4352-b543-3ffc20b11878' },
  '3be0e511-1c34-4293-b725-d5caf6845b83': { name: 'littlemonty', slug: 'littlemonty', type: 'PLAYER_1', teamSlotId: 'd7213635-7820-4352-b543-3ffc20b11878' },
  '639714a3-d4e8-48ca-8783-58cbf4f20b61': { name: 'nemessys', slug: 'nemessys', type: 'PLAYER_2', teamSlotId: 'd7213635-7820-4352-b543-3ffc20b11878' },

  // Caramelo team (Slot 3, was 202 pts)
  'f6d25e2d-2df1-4fce-b3f2-5db0c11d0b11': { name: 'Caramelo', slug: 'caramelo', type: 'CREATOR', teamSlotId: '3efcb850-00aa-4a58-b3b9-091fcb5e32c1' },
  '9de7f91a-5661-4af5-8525-9d0ee4640a9e': { name: 'voltrexa', slug: 'voltrexa', type: 'PLAYER_1', teamSlotId: '3efcb850-00aa-4a58-b3b9-091fcb5e32c1' },
  '8c3c0375-477b-4448-b811-ee5fad4c226f': { name: 'redlucky', slug: 'redlucky', type: 'PLAYER_2', teamSlotId: '3efcb850-00aa-4a58-b3b9-091fcb5e32c1' },

  // SoraMusic team (Slot 4, was 174 pts)
  'd162b34a-5aa0-4a57-b3d1-db51e74b5e95': { name: 'SoraMusic', slug: 'soramusic', type: 'CREATOR', teamSlotId: '5da730b7-3981-42cd-801f-4048df75504b' },
  '157cb793-0308-4ad4-ac8b-2a5c2da34cb3': { name: 'nix', slug: 'nix', type: 'PLAYER_1', teamSlotId: '5da730b7-3981-42cd-801f-4048df75504b' },
  '5282a557-40f4-4770-b4ec-7e270565c91d': { name: 'nei', slug: 'nei', type: 'PLAYER_2', teamSlotId: '5da730b7-3981-42cd-801f-4048df75504b' },

  // Miwell team (Slot 5, was 100 pts)
  '3f23858b-e71b-48d9-b1cb-11ed24e6894b': { name: 'Miwell', slug: 'miwell', type: 'CREATOR', teamSlotId: '0a92676a-460f-4dff-85f1-1f449940d6ea' },
  'c2a40dbb-97b2-461b-b6ad-4555f455a405': { name: 'johnyhipster', slug: 'johnyhipster', type: 'PLAYER_1', teamSlotId: '0a92676a-460f-4dff-85f1-1f449940d6ea' },
  'c1abddb2-5cbc-4fbd-8b67-53957ac2e328': { name: 'fost', slug: 'fost', type: 'PLAYER_2', teamSlotId: '0a92676a-460f-4dff-85f1-1f449940d6ea' },
};

function readJson(p) {
  return JSON.parse(readFileSync(path.join(API_DIR, p), 'utf-8'));
}

function writeJson(p, data) {
  writeFileSync(path.join(API_DIR, p), JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Updated: ${p}`);
}

function updateTeams() {
  const teams = readJson('teams.json');
  for (const t of teams) {
    const slot = TEAMS_BY_SLOT_ID[t.id];
    if (slot) {
      t.name = slot.name;
      t.slug = slot.slug;
      t.color = slot.color;
      t.registrationUrl = slot.registrationUrl;
      t.registrationPlatform = slot.registrationPlatform;
      t.communityNote = slot.communityNote;
    }
    if (t.participants) {
      for (const p of t.participants) {
        const pDef = PARTICIPANTS_BY_ID[p.id];
        if (pDef) {
          p.name = pDef.name;
          p.slug = pDef.slug;
          p.type = pDef.type;
          p.teamName = slot.name;
        }
      }
    }
    writeJson(`teams/${t.id}.json`, t);
  }
  writeJson('teams.json', teams);

  // Update slug index
  const slugIndex = {};
  for (const t of teams) {
    slugIndex[t.slug] = t.id;
  }
  writeJson('team-slug-index.json', slugIndex);
}

function updateParticipants() {
  const participants = readJson('participants.json');
  for (const p of participants) {
    const pDef = PARTICIPANTS_BY_ID[p.id];
    if (pDef) {
      p.name = pDef.name;
      p.slug = pDef.slug;
      p.type = pDef.type;
      p.teamId = pDef.teamSlotId;
      p.teamName = TEAMS_BY_SLOT_ID[pDef.teamSlotId].name;
    }
  }
  writeJson('participants.json', participants);
}

function updateRankings() {
  const rankings = readJson('rankings.json');
  for (const tr of rankings.teams) {
    const slot = TEAMS_BY_SLOT_ID[tr.teamId];
    if (slot) {
      tr.teamName = slot.name;
      tr.teamSlug = slot.slug;
      tr.teamColor = slot.color;
    }
  }
  // Sort teams by points desc and assign ranks 1..5
  rankings.teams.sort((a, b) => b.totalPoints - a.totalPoints);
  rankings.teams.forEach((t, i) => { t.rank = i + 1; });

  for (const ir of rankings.individuals) {
    const pDef = PARTICIPANTS_BY_ID[ir.participantId];
    if (pDef) {
      ir.participantName = pDef.name;
      ir.participantType = pDef.type;
      ir.teamId = pDef.teamSlotId;
      ir.teamName = TEAMS_BY_SLOT_ID[pDef.teamSlotId].name;
    }
  }
  writeJson('rankings.json', rankings);
}

function updateStatistics() {
  // Teams stats list
  const stTeams = readJson('statistics/teams.json');
  for (const st of stTeams) {
    const slot = TEAMS_BY_SLOT_ID[st.teamId];
    if (slot) {
      st.teamName = slot.name;
      st.teamSlug = slot.slug;
      st.teamColor = slot.color;
    }
  }
  stTeams.sort((a, b) => b.totalPoints - a.totalPoints);
  stTeams.forEach((t, i) => { t.rank = i + 1; });
  writeJson('statistics/teams.json', stTeams);

  // Individual team stat files
  for (const slotId of Object.keys(TEAMS_BY_SLOT_ID)) {
    const filePath = `statistics/teams/${slotId}.json`;
    if (existsSync(path.join(API_DIR, filePath))) {
      const detail = readJson(filePath);
      const slot = TEAMS_BY_SLOT_ID[slotId];
      detail.teamName = slot.name;
      detail.teamSlug = slot.slug;
      detail.teamColor = slot.color;
      if (detail.participantBreakdown) {
        for (const pb of detail.participantBreakdown) {
          const pDef = PARTICIPANTS_BY_ID[pb.participantId];
          if (pDef) {
            pb.participantName = pDef.name;
            pb.participantType = pDef.type;
          }
        }
      }
      writeJson(filePath, detail);
    }
  }

  // Participants stats list
  const stParts = readJson('statistics/participants.json');
  for (const sp of stParts) {
    const pDef = PARTICIPANTS_BY_ID[sp.participantId];
    if (pDef) {
      sp.participantName = pDef.name;
      sp.participantType = pDef.type;
      sp.teamId = pDef.teamSlotId;
      sp.teamName = TEAMS_BY_SLOT_ID[pDef.teamSlotId].name;
    }
  }
  stParts.sort((a, b) => b.totalPoints - a.totalPoints);
  stParts.forEach((p, i) => { p.rank = i + 1; });
  writeJson('statistics/participants.json', stParts);

  // Individual participant stat files
  for (const pid of Object.keys(PARTICIPANTS_BY_ID)) {
    const filePath = `statistics/participants/${pid}.json`;
    if (existsSync(path.join(API_DIR, filePath))) {
      const detail = readJson(filePath);
      const pDef = PARTICIPANTS_BY_ID[pid];
      detail.participantName = pDef.name;
      detail.participantType = pDef.type;
      detail.teamId = pDef.teamSlotId;
      detail.teamName = TEAMS_BY_SLOT_ID[pDef.teamSlotId].name;
      writeJson(filePath, detail);
    }
  }

  // Progression stats
  if (existsSync(path.join(API_DIR, 'statistics/progression.json'))) {
    const prog = readJson('statistics/progression.json');
    if (prog.teams) {
      for (const t of prog.teams) {
        const slot = TEAMS_BY_SLOT_ID[t.teamId];
        if (slot) {
          t.teamName = slot.name;
          t.teamSlug = slot.slug;
          t.teamColor = slot.color;
        }
      }
    }
    if (prog.snapshots) {
      for (const snap of prog.snapshots) {
        if (snap.teamPoints) {
          // Keep structure consistent
        }
      }
    }
    writeJson('statistics/progression.json', prog);
  }
}

function updateMatchesAndMaps() {
  const matches = readJson('matches.json');
  for (const m of matches) {
    const filePath = `matches/${m.id}.json`;
    if (existsSync(path.join(API_DIR, filePath))) {
      const matchDetail = readJson(filePath);
      if (matchDetail.participations) {
        for (const part of matchDetail.participations) {
          const pDef = PARTICIPANTS_BY_ID[part.participantId];
          if (pDef) {
            part.participantName = pDef.name;
            part.participantType = pDef.type;
            part.teamId = pDef.teamSlotId;
            part.teamName = TEAMS_BY_SLOT_ID[pDef.teamSlotId].name;
          }
        }
      }
      writeJson(filePath, matchDetail);

      if (matchDetail.maps) {
        for (const map of matchDetail.maps) {
          const mapFilePath = `maps/${map.id}.json`;
          if (existsSync(path.join(API_DIR, mapFilePath))) {
            const mapDetail = readJson(mapFilePath);
            if (mapDetail.results) {
              for (const res of mapDetail.results) {
                const pDef = PARTICIPANTS_BY_ID[res.participantId];
                if (pDef) {
                  res.participantName = pDef.name;
                  res.participantType = pDef.type;
                  res.teamId = pDef.teamSlotId;
                  res.teamName = TEAMS_BY_SLOT_ID[pDef.teamSlotId].name;
                }
              }
            }
            writeJson(mapFilePath, mapDetail);
          }
        }
      }
    }
  }
}

console.log('Applying real roster and team standings...');
updateTeams();
updateParticipants();
updateRankings();
updateStatistics();
updateMatchesAndMaps();
console.log('SUCCESS: Real roster applied.');
