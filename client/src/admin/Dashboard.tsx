import { useEffect, useState, useCallback } from 'react';
import { api, TournamentData, MatchData, RankingTeam } from '../api';
import { getSocket } from '../socket';
import ResultEntry from './ResultEntry';

export default function Dashboard() {
  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [rankings, setRankings] = useState<RankingTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [t, m, r] = await Promise.all([
        api.getTournament(),
        api.getMatches(),
        api.getRankings(),
      ]);
      setTournament(t);
      setMatches(m);
      setRankings(r.teams);
      setError(null);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const socket = getSocket();
    socket.on('competition.updated', loadData);
    socket.on('ranking.updated', (ranked: RankingTeam[]) => setRankings(ranked));
    socket.on('match.started', loadData);
    socket.on('match.completed', loadData);
    socket.on('map.completed', loadData);
    socket.on('result.updated', loadData);

    return () => {
      socket.off('competition.updated', loadData);
      socket.off('ranking.updated');
      socket.off('match.started', loadData);
      socket.off('match.completed', loadData);
      socket.off('map.completed', loadData);
      socket.off('result.updated', loadData);
    };
  }, [loadData]);

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!tournament) return <div className="error-message">No tournament found</div>;

  const liveMatch = matches.find(m => m.status === 'LIVE');
  const currentMatch = liveMatch || matches.find(m => m.status === 'UPCOMING');

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      <div className="grid-3">
        <div className="card">
          <div className="card-title">Tournament</div>
          <div className="stat-value">{tournament.name}</div>
          <span className={`status-badge ${tournament.status.toLowerCase()}`}>
            {tournament.status}
          </span>
        </div>
        <div className="card">
          <div className="card-title">Current Match</div>
          {liveMatch ? (
            <>
              <div className="stat-value">Match {liveMatch.matchNumber}</div>
              <span className="status-badge live">LIVE</span>
            </>
          ) : (
            <div className="stat-label">No active match</div>
          )}
        </div>
        <div className="card">
          <div className="card-title">Progress</div>
          <div className="stat-value">
            {matches.filter(m => m.status === 'COMPLETED').length} / {matches.length}
          </div>
          <div className="stat-label">Matches completed</div>
        </div>
      </div>

      {liveMatch && tournament.currentMapId && (
        <ResultEntry
          matchId={liveMatch.id}
          mapId={tournament.currentMapId}
          onResultConfirmed={loadData}
        />
      )}

      <div className="card">
        <div className="card-title">Current Classification</div>
        {rankings.length > 0 ? (
          <table className="ranking-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Team</th>
                <th style={{ textAlign: 'right' }}>Points</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map(r => (
                <tr key={r.teamId}>
                  <td style={{ fontWeight: 700, width: '40px' }}>{r.rank}</td>
                  <td>
                    {r.teamColor && <span className="team-color" style={{ background: r.teamColor }} />}
                    {r.teamName}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px' }}>
                    {r.totalPoints}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="stat-label">No results yet</div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Matches Overview</div>
        <div className="grid-2">
          {matches.map(m => (
            <div key={m.id} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '16px' }}>
                  Match {m.matchNumber}
                </span>
                <span className={`status-badge ${m.status.toLowerCase()}`}>{m.status}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {m.phase} · {m.matchNumber <= 2 ? 'Creator + Player 1' : 'Creator + Player 2'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
