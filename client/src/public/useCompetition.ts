import { useState, useEffect, useCallback } from 'react';
import { api, TournamentData, MatchData, MatchDetail, RankingTeam, RankingIndividual, MapDetail, TeamData } from '../api';
import { getSocket } from '../socket';

export interface CompetitionState {
  tournament: TournamentData | null;
  matches: MatchData[];
  rankings: RankingTeam[];
  individuals: RankingIndividual[];
  teams: TeamData[];
  loading: boolean;
}

export function useCompetition(): CompetitionState & { refresh: () => void } {
  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [rankings, setRankings] = useState<RankingTeam[]>([]);
  const [individuals, setIndividuals] = useState<RankingIndividual[]>([]);
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);

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
      console.error('Failed to fetch competition state', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('join', 'competition');
    fetchAll();

    const onCompetitionUpdated = () => { fetchAll(); };
    const onMatchStarted = () => { fetchAll(); };
    const onMatchCompleted = () => { fetchAll(); };
    const onMapStarted = () => { fetchAll(); };
    const onMapCompleted = () => { fetchAll(); };
    const onResultUpdated = () => { fetchAll(); };
    const onRankingUpdated = (data: RankingTeam[]) => {
      setRankings(data);
      fetchAll();
    };

    socket.on('competition.updated', onCompetitionUpdated);
    socket.on('match.started', onMatchStarted);
    socket.on('match.completed', onMatchCompleted);
    socket.on('map.started', onMapStarted);
    socket.on('map.completed', onMapCompleted);
    socket.on('result.updated', onResultUpdated);
    socket.on('ranking.updated', onRankingUpdated);

    socket.on('connect', fetchAll);

    return () => {
      socket.off('competition.updated', onCompetitionUpdated);
      socket.off('match.started', onMatchStarted);
      socket.off('match.completed', onMatchCompleted);
      socket.off('map.started', onMapStarted);
      socket.off('map.completed', onMapCompleted);
      socket.off('result.updated', onResultUpdated);
      socket.off('ranking.updated', onRankingUpdated);
      socket.off('connect', fetchAll);
    };
  }, [fetchAll]);

  return { tournament, matches, rankings, individuals, teams, loading, refresh: fetchAll };
}

export function useMatchDetail(matchId: string | null): { match: MatchDetail | null; loading: boolean } {
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMatch = useCallback(async () => {
    if (!matchId) { setMatch(null); return; }
    setLoading(true);
    try {
      const m = await api.getMatch(matchId);
      setMatch(m);
    } catch { setMatch(null); }
    finally { setLoading(false); }
  }, [matchId]);

  useEffect(() => {
    fetchMatch();
    const socket = getSocket();
    const refresh = () => { fetchMatch(); };
    socket.on('map.completed', refresh);
    socket.on('map.started', refresh);
    socket.on('result.updated', refresh);
    socket.on('match.started', refresh);
    socket.on('connect', refresh);
    return () => {
      socket.off('map.completed', refresh);
      socket.off('map.started', refresh);
      socket.off('result.updated', refresh);
      socket.off('match.started', refresh);
      socket.off('connect', refresh);
    };
  }, [fetchMatch]);

  return { match, loading };
}

export function useMapDetail(mapId: string | null): { map: MapDetail | null; loading: boolean } {
  const [map, setMap] = useState<MapDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mapId) { setMap(null); return; }
    setLoading(true);
    api.getMap(mapId).then(setMap).catch(() => setMap(null)).finally(() => setLoading(false));
  }, [mapId]);

  return { map, loading };
}
