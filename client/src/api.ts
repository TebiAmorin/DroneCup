const BASE = '/api';

export function getAdminSecret(): string | null {
  try { return sessionStorage.getItem('admin_secret'); } catch { return null; }
}

export function setAdminSecret(secret: string) {
  try { sessionStorage.setItem('admin_secret', secret); } catch { /* noop */ }
}

export function clearAdminSecret() {
  try { sessionStorage.removeItem('admin_secret'); } catch { /* noop */ }
}

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

export interface TournamentData {
  id: string;
  name: string;
  status: string;
  currentMatchId: string | null;
  currentMapId: string | null;
}

export interface TeamData {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  participants?: ParticipantData[];
}

export interface ParticipantData {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  type: 'CREATOR' | 'PLAYER_1' | 'PLAYER_2';
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

export async function validateSecret(token: string): Promise<boolean> {
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

export const api = {
  getTournament: () => request<TournamentData>('/tournament'),
  getTeams: () => request<TeamData[]>('/teams'),
  getTeam: (id: string) => request<TeamData & { participants: ParticipantData[] }>(`/teams/${id}`),
  getMatches: () => request<MatchData[]>('/matches'),
  getMatch: (id: string) => request<MatchDetail>(`/matches/${id}`),
  startMatch: (id: string) => authedRequest<{ success: boolean }>(`/matches/${id}/start`, { method: 'POST' }),
  getMap: (id: string) => request<MapDetail>(`/maps/${id}`),
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
  getRankings: () => request<{ teams: RankingTeam[]; individuals: RankingIndividual[]; hasResults?: boolean }>('/rankings'),
  getParticipants: (query?: Record<string, string>) => {
    const qs = query ? '?' + new URLSearchParams(query).toString() : '';
    return request<ParticipantData[]>(`/participants${qs}`);
  },
  updateParticipant: (id: string, name: string) =>
    authedRequest<{ success: boolean; participant: ParticipantData }>(`/participants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
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
  getStatisticsTeams: () => request<TeamStats[]>('/statistics/teams'),
  getStatisticsTeam: (id: string) => request<TeamStats>(`/statistics/teams/${id}`),
  getStatisticsParticipants: () => request<ParticipantStats[]>('/statistics/participants'),
  getStatisticsParticipant: (id: string) => request<ParticipantStats>(`/statistics/participants/${id}`),
  getStatisticsProgression: () => request<ProgressionResponse>('/statistics/progression'),
};
