import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { CompetitionState } from './useCompetition';
import { api, MatchDetail, MapDetail } from '../api';
import { getSocket } from '../socket';
import { SectionHead, StatusBadge, LoadingState, EmptyState, MapResultTable } from './components';

interface CompletedMap {
  map: MapDetail;
  matchNumber: number;
}

export default function Results() {
  const { matches, loading: compLoading } = useOutletContext<CompetitionState>();
  const [completedMaps, setCompletedMaps] = useState<CompletedMap[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchResults = async () => {
    try {
      const completedMatches = matches.filter(m => m.status === 'COMPLETED' || m.status === 'LIVE');
      const details = await Promise.all(completedMatches.map(m => api.getMatch(m.id)));
      const maps: CompletedMap[] = [];
      for (const d of details) {
        for (const mp of d.maps) {
          if (mp.status === 'COMPLETED') {
            const mapDetail = await api.getMap(mp.id);
            maps.push({ map: mapDetail, matchNumber: d.matchNumber });
          }
        }
      }
      maps.sort((a, b) => {
        if (a.map.completedAt && b.map.completedAt) {
          return new Date(b.map.completedAt).getTime() - new Date(a.map.completedAt).getTime();
        }
        return b.map.mapIndex - a.map.mapIndex;
      });
      setCompletedMaps(maps);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!compLoading) fetchResults();
  }, [matches, compLoading]);

  useEffect(() => {
    const socket = getSocket();
    const refresh = () => { fetchResults(); };
    socket.on('map.completed', refresh);
    socket.on('result.updated', refresh);
    socket.on('connect', refresh);
    return () => {
      socket.off('map.completed', refresh);
      socket.off('result.updated', refresh);
      socket.off('connect', refresh);
    };
  }, [matches]);

  if (compLoading || loading) return <LoadingState />;

  return (
    <div className="pub-page">
      <SectionHead title="RESULTS" chip={`${completedMaps.length} MAPS`} />
      {completedMaps.length === 0 ? (
        <EmptyState message="No completed maps yet. Results will appear here after the first map is completed." />
      ) : (
        <div className="pub-results-list">
          {completedMaps.map(({ map, matchNumber }) => (
            <div key={map.id} className="pub-result-card">
              <div className="pub-result-header">
                <span className="pub-result-code">{map.code}</span>
                <span className="pub-result-match">MATCH {matchNumber}</span>
                <StatusBadge status="COMPLETED" />
              </div>
              <div className="pub-result-body">
                <MapResultTable results={map.results} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
