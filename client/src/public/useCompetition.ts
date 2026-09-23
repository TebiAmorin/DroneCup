import { useState, useEffect, useCallback, useRef } from 'react';
import { api, TournamentData, MatchData, MatchDetail, RankingTeam, RankingIndividual, MapDetail, TeamData } from '../api';
import { getSocket } from '../socket';

export interface CompetitionState {
  tournament: TournamentData | null;
  matches: MatchData[];
  rankings: RankingTeam[];
  individuals: RankingIndividual[];
  teams: TeamData[];
  hasResults: boolean;
  loading: boolean;
}

const DEDUP_WINDOW_MS = 2000;

export function useCompetition(): CompetitionState & { refresh: () => void } {
  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [rankings, setRankings] = useState<RankingTeam[]>([]);
  const [individuals, setIndividuals] = useState<RankingIndividual[]>([]);
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [hasResults, setHasResults] = useState(false);
  const [loading, setLoading] = useState(true);

  const inflightRef = useRef(false);
  const pendingRef = useRef(false);
  const lastFetchRef = useRef(0);

  const fetchAll = useCallback(async () => {
    if (inflightRef.current) {
      pendingRef.current = true;
      return;
    }
    inflightRef.current = true;
    pendingRef.current = false;
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
      setHasResults(r.hasResults ?? r.teams.some(t => t.totalPoints > 0));
      setTeams(te);
      lastFetchRef.current = Date.now();
    } catch (e) {
      console.error('Failed to fetch competition state', e);
    } finally {
      setLoading(false);
      inflightRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        fetchAll();
      }
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('join', 'competition');
    fetchAll();

    const onEvent = () => { fetchAll(); };
    const onRankingUpdated = (data: RankingTeam[]) => {
      setRankings(data);
    };
    const onConnect = () => {
      if (Date.now() - lastFetchRef.current < DEDUP_WINDOW_MS) return;
      fetchAll();
    };

    socket.on('competition.updated', onEvent);
    socket.on('match.started', onEvent);
    socket.on('match.completed', onEvent);
    socket.on('map.started', onEvent);
    socket.on('map.completed', onEvent);
    socket.on('result.updated', onEvent);
    socket.on('ranking.updated', onRankingUpdated);
    socket.on('connect', onConnect);

    return () => {
      socket.off('competition.updated', onEvent);
      socket.off('match.started', onEvent);
      socket.off('match.completed', onEvent);
      socket.off('map.started', onEvent);
      socket.off('map.completed', onEvent);
      socket.off('result.updated', onEvent);
      socket.off('ranking.updated', onRankingUpdated);
      socket.off('connect', onConnect);
    };
  }, [fetchAll]);

  return { tournament, matches, rankings, individuals, teams, hasResults, loading, refresh: fetchAll };
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
