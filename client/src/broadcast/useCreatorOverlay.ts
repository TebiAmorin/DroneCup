import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, TournamentData, MatchData, MatchDetail, RankingTeam, RankingIndividual, TeamData } from '../api';
import { getSocket } from '../socket';

export interface CompanionInfo {
  name: string;
  points: number;
}

export interface CreatorOverlayData {
  team: TeamData | null;
  teamRank: RankingTeam | null;
  creatorName: string | null;
  creatorPoints: number;
  companion: CompanionInfo | null;
  currentMatch: MatchData | null;
  teamPoints: number;
  loading: boolean;
  connected: boolean;
}

export function useCreatorOverlay(slug: string): CreatorOverlayData {
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [rankings, setRankings] = useState<RankingTeam[]>([]);
  const [individuals, setIndividuals] = useState<RankingIndividual[]>([]);
  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
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

  const currentMatch = useMemo(() => {
    const live = matches.find(m => m.status === 'LIVE');
    if (live) return live;
    const upcoming = matches.filter(m => m.status === 'PENDING' || m.status === 'DRAFT');
    if (upcoming.length > 0) return upcoming[0];
    const completed = matches.filter(m => m.status === 'COMPLETED');
    if (completed.length > 0) return completed[completed.length - 1];
    return null;
  }, [matches]);

  useEffect(() => {
    if (!currentMatch) { setMatchDetail(null); return; }
    api.getMatch(currentMatch.id).then(setMatchDetail).catch(() => setMatchDetail(null));
  }, [currentMatch?.id]);

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

  const creatorPoints = useMemo(() => {
    if (!creatorP) return 0;
    return individuals.find(i => i.participantId === creatorP.id)?.totalPoints ?? 0;
  }, [creatorP, individuals]);

  const companion = useMemo((): CompanionInfo | null => {
    if (!team || !currentMatch) return null;

    const p1 = participants.find(p => p.type === 'PLAYER_1');
    const p2 = participants.find(p => p.type === 'PLAYER_2');

    if (matchDetail) {
      const inMatch = matchDetail.participants.find(
        p => (p.teamSlug?.toLowerCase() === team.slug.toLowerCase()
          || p.teamName?.toLowerCase() === team.name.toLowerCase())
          && p.type !== 'CREATOR'
      );
      if (inMatch) {
        const pts = individuals.find(i => i.participantId === inMatch.id)?.totalPoints ?? 0;
        return { name: inMatch.name, points: pts };
      }
    }

    const mn = currentMatch.matchNumber;
    const fallback = mn <= 2 ? (p1 || p2) : (p2 || p1);
    if (!fallback) return null;
    const pts = individuals.find(i => i.participantId === fallback.id)?.totalPoints ?? 0;
    return { name: fallback.name, points: pts };
  }, [team, currentMatch, matchDetail, participants, individuals]);

  const teamPoints = teamRank?.totalPoints ?? 0;

  return {
    team, teamRank, creatorName: creatorP?.name ?? null,
    creatorPoints, companion, currentMatch, teamPoints, loading, connected,
  };
}
