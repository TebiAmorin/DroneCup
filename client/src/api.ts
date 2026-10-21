/**
 * API client with automatic static-data fallback.
 *
 * When the backend is unreachable (e.g. Render DB disabled)
 * every request transparently fetches pre-built JSON files from /api/*.json.
 * This lets the site run as a fully static portfolio without any server.
 */

const BASE = '/api';

// ── Static-mode flag ────────────────────────────────
// We try one real request; if it fails we flip this forever.
let _staticMode: boolean | null = null;

async function detectStaticMode(): Promise<boolean> {
  if (_staticMode !== null) return _staticMode;
  try {
    const res = await fetch(`${BASE}/health`, { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      // If the health endpoint returns mode: 'static', we're serving pre-built JSON
      if (data.mode === 'static') {
        _staticMode = true;
      } else {
        _staticMode = false;
      }
    } else {
      _staticMode = true;
    }
  } catch {
    _staticMode = true;
  }
  if (_staticMode) {
    console.info('[DroneCup] Running in static mode — serving pre-built data.');
  }
  return _staticMode;
}

// Kick off detection immediately so it resolves early.
const staticModePromise = detectStaticMode();

// ── Admin secret helpers (only used in live mode) ───
export function getAdminSecret(): string | null {
  try { return sessionStorage.getItem('admin_secret'); } catch { return null; }
}

export function setAdminSecret(secret: string) {
  try { sessionStorage.setItem('admin_secret', secret); } catch { /* noop */ }
}

export function clearAdminSecret() {
  try { sessionStorage.removeItem('admin_secret'); } catch { /* noop */ }
}

// ── Static data fetcher ─────────────────────────────
async function fetchStatic<T>(jsonPath: string): Promise<T> {
  const url = `${BASE}/${jsonPath}`;
  const res = await fetch(url);
  if (!res.ok) throw { error: { code: 'STATIC_NOT_FOUND', message: `Static file not found: ${url}` } };
  return res.json() as Promise<T>;
}

// ── Live request helpers ────────────────────────────
async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data as T;
}

function authHeaders(): HeadersInit {
  const secret = getAdminSecret();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['Authorization'] = `Bearer ${secret}`;
  return headers;
}

async function authedRequest<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data as T;
}

// ── Interfaces (unchanged) ──────────────────────────
export interface TournamentData {
  id: string;
  name: string;
  status: string;
  currentMatchId: string | null;
  currentMapId: string | null;
  tournamentReady?: boolean;
  confirmedParticipants?: number;
  totalParticipants?: number;
}

export interface TeamData {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  registrationUrl?: string | null;
  registrationType?: string | null;
  registrationPlatform?: string | null;
  registrationStatus?: string | null;
  communityNote?: string | null;
  qualifierDate?: string | null;
  qualifierStartTime?: string | null;
  qualifierEndTime?: string | null;
  qualifierFormat?: string | null;
  qualifierRequirements?: string | null;
  qualifierHowToParticipate?: string | null;
  participants?: ParticipantData[];
}

export interface ParticipantData {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  type: 'CREATOR' | 'PLAYER_1' | 'PLAYER_2';
  confirmed: boolean;
  teamName: string;
}

export interface MatchData {
  id: string;
  matchNumber: number;
  phase: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface MatchDetail extends MatchData {
  maps: MapData[];
  participants: {
    id: string;
    name: string;
    type: string;
    teamName: string;
    teamSlug?: string;
    teamColor?: string | null;
  }[];
}

export interface MapData {
  id: string;
  mapIndex: number;
  code: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface MapDetail extends MapData {
  matchId: string;
  matchNumber: number;
  phase: string;
  results: MapResultData[];
}

export interface MapResultData {
  participantId: string;
  participantName: string;
  participantType: string;
  teamName: string;
  teamSlug?: string;
  teamColor?: string | null;
  position: number | null;
  status: string;
  points: number;
}

export interface RankingTeam {
  rank: number;
  teamId: string;
  teamName: string;
  teamSlug: string;
  teamColor: string | null;
  totalPoints: number;
}

export interface RankingIndividual {
  rank: number;
  participantId: string;
  participantName: string;
  participantType: 'CREATOR' | 'PLAYER_1' | 'PLAYER_2';
  teamId: string;
  teamName: string;
  totalPoints: number;
}

export interface MapPoints {
  mapId: string;
  mapCode: string;
  matchNumber: number;
  mapIndex: number;
  points: number;
}

export interface MatchPoints {
  matchId: string;
  matchNumber: number;
  points: number;
}

export interface ProgressionPoint {
  mapId: string;
  mapCode: string;
  matchNumber: number;
  mapIndex: number;
  cumulativePoints: number;
}

export interface TeamStats {
  teamId: string;
  teamName: string;
  teamSlug: string;
  teamColor: string | null;
  totalPoints: number;
  globalPosition: number;
  mapsPlayed: number;
  mapsWon: number;
  pointsByMatch: MatchPoints[];
  pointsByMap: MapPoints[];
  progression: ProgressionPoint[];
}

export interface PositionCount {
  position: number | 'DNF';
  count: number;
}

export interface ParticipantStats {
  participantId: string;
  participantName: string;
  participantType: 'CREATOR' | 'PLAYER_1' | 'PLAYER_2';
  teamId: string;
  teamName: string;
  totalPoints: number;
  mapsPlayed: number;
  averagePointsPerMap: number | null;
  bestPosition: number | null;
  positionCounts: PositionCount[];
  dnfCount: number;
  pointsByMap: MapPoints[];
  progression: ProgressionPoint[];
}

export interface ProgressionTeam {
  teamId: string;
  teamName: string;
  teamColor: string | null;
  progression: ProgressionPoint[];
}

export interface ProgressionParticipant {
  participantId: string;
  participantName: string;
  participantType: 'CREATOR' | 'PLAYER_1' | 'PLAYER_2';
  teamId: string;
  teamName: string;
  progression: ProgressionPoint[];
}

export interface ProgressionResponse {
  teams: ProgressionTeam[];
  participants: ProgressionParticipant[];
}

// ── Auth validation ─────────────────────────────────
export async function validateSecret(token: string): Promise<boolean> {
  const isStatic = await staticModePromise;
  if (isStatic) return false; // Admin auth is disabled in static mode.

  try {
    const res = await fetch(`${BASE}/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.valid === true;
  } catch {
    return false;
  }
}

// ── API object ──────────────────────────────────────
// Each method first checks if we're in static mode, and if so
// serves from pre-built JSON files. Otherwise calls the live backend.

export const api = {
  getTournament: async (): Promise<TournamentData> => {
    if (await staticModePromise) return fetchStatic<TournamentData>('tournament.json');
    return request<TournamentData>('/tournament');
  },

  getTeams: async (): Promise<TeamData[]> => {
    if (await staticModePromise) return fetchStatic<TeamData[]>('teams.json');
    return request<TeamData[]>('/teams');
  },

  getTeam: async (id: string): Promise<TeamData & { participants: ParticipantData[] }> => {
    if (await staticModePromise) return fetchStatic<TeamData & { participants: ParticipantData[] }>(`teams/${id}.json`);
    return request<TeamData & { participants: ParticipantData[] }>(`/teams/${id}`);
  },

  getMatches: async (): Promise<MatchData[]> => {
    if (await staticModePromise) return fetchStatic<MatchData[]>('matches.json');
    return request<MatchData[]>('/matches');
  },

  getMatch: async (id: string): Promise<MatchDetail> => {
    if (await staticModePromise) return fetchStatic<MatchDetail>(`matches/${id}.json`);
    return request<MatchDetail>(`/matches/${id}`);
  },

  startMatch: (id: string) =>
    authedRequest<{ success: boolean }>(`/matches/${id}/start`, { method: 'POST' }),

  getMap: async (id: string): Promise<MapDetail> => {
    if (await staticModePromise) return fetchStatic<MapDetail>(`maps/${id}.json`);
    return request<MapDetail>(`/maps/${id}`);
  },

  confirmResults: (mapId: string, results: { participantId: string; position: number | null; status: string }[]) =>
    authedRequest<{ success: boolean; ranked: RankingTeam[] }>(`/maps/${mapId}/results`, {
      method: 'POST',
      body: JSON.stringify({ results }),
    }),

  correctResults: (mapId: string, results: { participantId: string; position: number | null; status: string }[]) =>
    authedRequest<{ success: boolean; ranked: RankingTeam[] }>(`/maps/${mapId}/results`, {
      method: 'PUT',
      body: JSON.stringify({ results }),
    }),

  getRankings: async (): Promise<{ teams: RankingTeam[]; individuals: RankingIndividual[]; hasResults?: boolean }> => {
    if (await staticModePromise) return fetchStatic<{ teams: RankingTeam[]; individuals: RankingIndividual[]; hasResults?: boolean }>('rankings.json');
    return request<{ teams: RankingTeam[]; individuals: RankingIndividual[]; hasResults?: boolean }>('/rankings');
  },

  getParticipants: async (query?: Record<string, string>): Promise<ParticipantData[]> => {
    if (await staticModePromise) {
      // In static mode, load all participants and filter client-side
      const all = await fetchStatic<ParticipantData[]>('participants.json');
      if (!query) return all;
      return all.filter(p => {
        if (query.team && p.teamId !== query.team) return false;
        if (query.type && p.type !== query.type) return false;
        return true;
      });
    }
    const qs = query ? '?' + new URLSearchParams(query).toString() : '';
    return request<ParticipantData[]>(`/participants${qs}`);
  },

  updateParticipant: (id: string, name: string) =>
    authedRequest<{ success: boolean; participant: ParticipantData }>(`/participants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  confirmParticipant: (id: string, name: string) =>
    authedRequest<{ success: boolean; participant: ParticipantData }>(`/participants/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  resetParticipant: (id: string) =>
    authedRequest<{ success: boolean; participant: ParticipantData }>(`/participants/${id}/reset`, {
      method: 'POST',
    }),

  resetMatch: (id: string) =>
    authedRequest<{ success: boolean; matchId: string; status: string; noop?: boolean; ranked?: RankingTeam[] }>(
      `/matches/${id}/reset`,
      { method: 'POST' }
    ),

  resetMap: (id: string) =>
    authedRequest<{ success: boolean; mapId: string; matchId: string; matchStatus: string; affectedMaps: string[]; noop?: boolean; ranked?: RankingTeam[] }>(
      `/maps/${id}/reset`,
      { method: 'POST' }
    ),

  getStatisticsTeams: async (): Promise<TeamStats[]> => {
    if (await staticModePromise) return fetchStatic<TeamStats[]>('statistics/teams.json');
    return request<TeamStats[]>('/statistics/teams');
  },

  getStatisticsTeam: async (id: string): Promise<TeamStats> => {
    if (await staticModePromise) return fetchStatic<TeamStats>(`statistics/teams/${id}.json`);
    return request<TeamStats>(`/statistics/teams/${id}`);
  },

  getStatisticsParticipants: async (): Promise<ParticipantStats[]> => {
    if (await staticModePromise) return fetchStatic<ParticipantStats[]>('statistics/participants.json');
    return request<ParticipantStats[]>('/statistics/participants');
  },

  getStatisticsParticipant: async (id: string): Promise<ParticipantStats> => {
    if (await staticModePromise) return fetchStatic<ParticipantStats>(`statistics/participants/${id}.json`);
    return request<ParticipantStats>(`/statistics/participants/${id}`);
  },

  getStatisticsProgression: async (): Promise<ProgressionResponse> => {
    if (await staticModePromise) return fetchStatic<ProgressionResponse>('statistics/progression.json');
    return request<ProgressionResponse>('/statistics/progression');
  },

  updateTeamRegistration: (id: string, data: { registrationUrl?: string | null; registrationType?: string | null; registrationPlatform?: string | null; registrationStatus?: string | null; communityNote?: string | null; qualifierDate?: string | null; qualifierStartTime?: string | null; qualifierEndTime?: string | null; qualifierFormat?: string | null; qualifierRequirements?: string | null; qualifierHowToParticipate?: string | null }) =>
    authedRequest<{ success: boolean; team: TeamData }>(`/teams/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};
