import { useEffect, useState, useCallback } from 'react';
import { api, MatchData, MatchDetail } from '../api';
import { getSocket } from '../socket';
import ResultEntry from './ResultEntry';

export default function Matches() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadMatches = useCallback(async () => {
    try {
      const data = await api.getMatches();
      setMatches(data);
      setError(null);
    } catch {
      setError('Failed to load matches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatches();

    const socket = getSocket();
    socket.on('match.started', loadMatches);
    socket.on('match.completed', loadMatches);
    socket.on('map.completed', () => {
      loadMatches();
      if (expanded) loadMatchDetail(expanded);
    });
    socket.on('map.started', () => {
      if (expanded) loadMatchDetail(expanded);
    });

    return () => {
      socket.off('match.started', loadMatches);
      socket.off('match.completed', loadMatches);
      socket.off('map.completed');
      socket.off('map.started');
    };
  }, [loadMatches, expanded]);

  async function loadMatchDetail(id: string) {
    try {
      const detail = await api.getMatch(id);
      setMatchDetail(detail);
    } catch {
      setMatchDetail(null);
    }
  }

  async function handleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
      setMatchDetail(null);
      return;
    }
    setExpanded(id);
    await loadMatchDetail(id);
  }

  async function handleStartMatch(id: string) {
    setActionLoading(true);
    try {
      await api.startMatch(id);
      showToast('success', 'Match started successfully');
      await loadMatches();
      await loadMatchDetail(id);
    } catch (err: unknown) {
      const apiErr = err as { error?: { message?: string } };
      showToast('error', apiErr?.error?.message || 'Failed to start match');
    } finally {
      setActionLoading(false);
    }
  }

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div>
      <h1 className="page-title">Matches</h1>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      {matches.map(match => {
        const isExpanded = expanded === match.id;
        const hasLiveMatch = matches.some(m => m.status === 'LIVE');

        return (
          <div className="card" key={match.id}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => handleExpand(match.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '20px', fontWeight: 700 }}>
                  Match {match.matchNumber}
                </span>
                <span className={`status-badge ${match.status.toLowerCase()}`}>{match.status}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {match.phase} · {match.matchNumber <= 2 ? 'Creator + Player 1' : 'Creator + Player 2'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {match.status === 'UPCOMING' && (
                  <button
                    className="btn btn-primary"
                    disabled={actionLoading || hasLiveMatch}
                    onClick={e => { e.stopPropagation(); handleStartMatch(match.id); }}
                  >
                    Start Match
                  </button>
                )}
                <span style={{ color: 'var(--text-muted)', fontSize: '18px' }}>
                  {isExpanded ? '▲' : '▼'}
                </span>
              </div>
            </div>

            {isExpanded && matchDetail && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <div className="card-title">Maps</div>
                <div className="map-pills" style={{ marginBottom: '16px' }}>
                  {matchDetail.maps.map(map => (
                    <span key={map.id} className={`map-pill ${map.status.toLowerCase()}`}>
                      {map.code} — {map.status}
                    </span>
                  ))}
                </div>

                <div className="card-title">Participants</div>
                <div className="match-participants" style={{ marginBottom: '16px' }}>
                  {matchDetail.participants.map(p => (
                    <span
                      key={p.id}
                      className={`participant-chip ${p.type === 'CREATOR' ? 'creator' : 'player'}`}
                    >
                      {p.name} ({p.teamName}) — {p.type.replace('_', ' ')}
                    </span>
                  ))}
                </div>

                {/* Result entry for active maps */}
                {matchDetail.maps
                  .filter(map => map.status === 'ACTIVE')
                  .map(map => (
                    <ResultEntry
                      key={map.id}
                      matchId={match.id}
                      mapId={map.id}
                      onResultConfirmed={async () => {
                        await loadMatches();
                        await loadMatchDetail(match.id);
                      }}
                    />
                  ))}

                {/* View/correct completed map results */}
                {matchDetail.maps
                  .filter(map => map.status === 'COMPLETED')
                  .map(map => (
                    <CompletedMap key={map.id} mapId={map.id} matchId={match.id} onCorrected={async () => {
                      await loadMatches();
                      await loadMatchDetail(match.id);
                    }} />
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CompletedMap({ mapId, matchId, onCorrected }: { mapId: string; matchId: string; onCorrected: () => void }) {
  const [showResults, setShowResults] = useState(false);
  const [editing, setEditing] = useState(false);
  const [mapDetail, setMapDetail] = useState<import('../api').MapDetail | null>(null);

  async function loadMap() {
    const data = await api.getMap(mapId);
    setMapDetail(data);
  }

  useEffect(() => {
    if (showResults && !mapDetail) loadMap();
  }, [showResults]);

  return (
    <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="map-pill completed">{mapDetail?.code || '...'}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>COMPLETED</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => { setShowResults(!showResults); setEditing(false); }}>
            {showResults ? 'Hide' : 'View Results'}
          </button>
          {showResults && (
            <button className="btn btn-secondary" onClick={() => setEditing(!editing)}>
              {editing ? 'Cancel Edit' : 'Edit Results'}
            </button>
          )}
        </div>
      </div>

      {showResults && !editing && mapDetail && (
        <table className="ranking-table" style={{ marginTop: '12px' }}>
          <thead>
            <tr>
              <th>Pos</th>
              <th>Participant</th>
              <th>Team</th>
              <th>Type</th>
              <th style={{ textAlign: 'right' }}>Pts</th>
            </tr>
          </thead>
          <tbody>
            {mapDetail.results.map(r => (
              <tr key={r.participantId}>
                <td>{r.status === 'DNF' ? 'DNF' : r.position}</td>
                <td>{r.participantName}</td>
                <td>{r.teamName}</td>
                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{r.participantType.replace('_', ' ')}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showResults && editing && (
        <div style={{ marginTop: '12px' }}>
          <ResultEntry
            matchId={matchId}
            mapId={mapId}
            onResultConfirmed={() => {
              setEditing(false);
              loadMap();
              onCorrected();
            }}
          />
        </div>
      )}
    </div>
  );
}
