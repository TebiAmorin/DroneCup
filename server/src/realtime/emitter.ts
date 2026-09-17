import type { Server as SocketServer } from 'socket.io';
import type { TeamRankingRow } from '../engine/ranking.js';

let io: SocketServer | null = null;

export function setIO(server: SocketServer) {
  io = server;
}

export function getIO(): SocketServer | null {
  return io;
}

export function emitCompetitionUpdated(payload: {
  tournamentId: string;
  status: string;
  currentMatchId: string | null;
  currentMapId: string | null;
}) {
  io?.to('competition').emit('competition.updated', payload);
}

export function emitMatchStarted(payload: {
  matchId: string;
  matchNumber: number;
  phase: string;
  status: string;
  currentMapId: string;
  currentMapCode: string;
}) {
  io?.to('competition').emit('match.started', payload);
}

export function emitMatchCompleted(payload: {
  matchId: string;
  matchNumber: number;
  phase: string;
  ranked: TeamRankingRow[];
}) {
  io?.to('competition').emit('match.completed', payload);
}

export function emitMapStarted(payload: {
  mapId: string;
  matchId: string;
  mapCode: string;
  mapIndex: number;
}) {
  io?.to('competition').emit('map.started', payload);
}

export function emitMapCompleted(payload: {
  mapId: string;
  mapCode: string;
  results: { participantId: string; position: number | null; status: string; points: number }[];
}) {
  io?.to('competition').emit('map.completed', payload);
}

export function emitResultUpdated(payload: {
  mapId: string;
  mapCode: string;
  results: { participantId: string; position: number | null; status: string; points: number }[];
}) {
  io?.to('competition').emit('result.updated', payload);
}

export function emitRankingUpdated(ranked: TeamRankingRow[]) {
  io?.to('competition').emit('ranking.updated', ranked);
}
