import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, TournamentData, MatchData, RankingTeam, RankingIndividual, TeamData } from '../api';
import { getSocket } from '../socket';

export interface CreatorOverlayData {
  team: TeamData | null;
  teamRank: RankingTeam | null;
  creator: { id: string; name: string; points: number } | null;
  player1: { id: string; name: string; points: number } | null;
  player2: { id: string; name: string; points: number } | null;
  tournament: TournamentData | null;
  liveMatch: MatchData | null;
  loading: boolean;
  connected: boolean;
}

export function useCreatorOverlay(slug: string): CreatorOverlayData {
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [rankings, setRankings] = useState<RankingTeam[]>([]);
  const [individuals, setIndividuals] = useState<RankingIndividual[]>([]);
  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [t, m, r, te] = await Promise.all([
        api.getTournament(),
        api.getMatches(),
        api.getRankings(),
        api.getTeams(),
      ]);
      setTournament(t);
      setMatches(m);
      setRankings(r.teams);
      setIndividuals(r.individuals || []);
      setTeams(te);
    } catch (e) {
      console.error('[overlay] fetch error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('join', 'competition');
    fetchAll();

    const refresh = () => { fetchAll(); };

    socket.on('competition.updated', refresh);
    socket.on('match.started', refresh);
    socket.on('match.completed', refresh);
    socket.on('map.started', refresh);
    socket.on('map.completed', refresh);
    socket.on('result.updated', refresh);
    socket.on('ranking.updated', refresh);
    socket.on('connect', () => { setConnected(true); refresh(); });
    socket.on('disconnect', () => { setConnected(false); });

    setConnected(socket.connected);

    return () => {
      socket.off('competition.updated', refresh);
      socket.off('match.started', refresh);
      socket.off('match.completed', refresh);
      socket.off('map.started', refresh);
      socket.off('map.completed', refresh);
      socket.off('result.updated', refresh);
      socket.off('ranking.updated', refresh);
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [fetchAll]);

  const normalizedSlug = slug.toLowerCase();

  const team = useMemo(() => {
    return teams.find(t => {
      const s = t.slug.toLowerCase();
      if (normalizedSlug === 'soramusic' || normalizedSlug === 'sora') {
        return s === 'soramusic' || s === 'sora';
      }
      return s === normalizedSlug;
    }) ?? null;
  }, [teams, normalizedSlug]);

  const teamRank = useMemo(() => {
    if (!team) return null;
    return rankings.find(r => r.teamId === team.id) ?? null;
  }, [rankings, team]);

  const participants = team?.participants ?? [];

  const creatorP = participants.find(p => p.type === 'CREATOR');
  const player1P = participants.find(p => p.type === 'PLAYER_1');
  const player2P = participants.find(p => p.type === 'PLAYER_2');

  const findPoints = (participantId: string | undefined) => {
    if (!participantId) return 0;
    return individuals.find(i => i.participantId === participantId)?.totalPoints ?? 0;
  };

  const creator = creatorP ? { id: creatorP.id, name: creatorP.name, points: findPoints(creatorP.id) } : null;
  const player1 = player1P ? { id: player1P.id, name: player1P.name, points: findPoints(player1P.id) } : null;
  const player2 = player2P ? { id: player2P.id, name: player2P.name, points: findPoints(player2P.id) } : null;

  const liveMatch = matches.find(m => m.status === 'LIVE') ?? null;

  return { team, teamRank, creator, player1, player2, tournament, liveMatch, loading, connected };
}
