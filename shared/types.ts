// ── Tournament ──────────────────────────────────────
export type TournamentStatus = 'DRAFT' | 'READY' | 'LIVE' | 'COMPLETED';

export interface Tournament {
  id: string;
  name: string;
  status: TournamentStatus;
  currentMatchId: string | null;
  currentMapId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Team ────────────────────────────────────────────
export interface Team {
  id: string;
  tournamentId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Participant ─────────────────────────────────────
export type ParticipantType = 'CREATOR' | 'PLAYER_1' | 'PLAYER_2';

export interface Participant {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  type: ParticipantType;
  createdAt: string;
  updatedAt: string;
}

// ── Match ───────────────────────────────────────────
export type MatchStatus = 'UPCOMING' | 'LIVE' | 'COMPLETED';
export type MatchPhase = 'MAIN' | 'TIEBREAK';

export interface Match {
  id: string;
  tournamentId: string;
  matchNumber: number;
  phase: MatchPhase;
  status: MatchStatus;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Match Participation ─────────────────────────────
export interface MatchParticipation {
  id: string;
  matchId: string;
  participantId: string;
}

// ── Map ─────────────────────────────────────────────
export type MapStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED';

export interface TournamentMap {
  id: string;
  matchId: string;
  mapIndex: number;
  code: string;
  status: MapStatus;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Map Result ──────────────────────────────────────
export type ResultStatus = 'FINISHED' | 'DNF';

export interface MapResult {
  id: string;
  mapId: string;
  participantId: string;
  position: number | null;
  status: ResultStatus;
  points: number;
  createdAt: string;
  updatedAt: string;
}

// ── Scoring ─────────────────────────────────────────
export const SCORING_TABLE: Record<number, number> = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
};

// ── API types ───────────────────────────────────────
export interface TeamRanking {
  rank: number;
  teamId: string;
  teamName: string;
  points: number;
}

export interface ParticipantScore {
  participantId: string;
  participantName: string;
  teamId: string;
  totalPoints: number;
}

export interface MapResultInput {
  participantId: string;
  position: number | null;
  status: ResultStatus;
}

export interface ApiError {
  error: string;
  message: string;
}

// ── Statistics ─────────────────────────────────────
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
  participantType: ParticipantType;
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
