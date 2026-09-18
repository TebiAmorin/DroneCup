import { useEffect, useState, useCallback } from 'react';
import { api, MatchData, MatchDetail } from '../api';
import { getSocket } from '../socket';
import { useRefetchOnReconnect } from './useSocket';
import { useAdminToast, AdminToast } from './AdminToast';
import ResultEntry from './ResultEntry';

export default function Matches() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [resetConfirm, setResetConfirm] = useState<{ id: string; number: number } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [mapResetConfirm, setMapResetConfirm] = useState<{ mapId: string; mapCode: string; mapIndex: number; matchNumber: number; matchId: string; totalMaps: number } | null>(null);
  const [mapResetLoading, setMapResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, showToast, dismissToast } = useAdminToast();

  const loadMatches = useCallback(async () => {
    try {
      const data = await api.getMatches();
      setMatches(data);
      setError(null);
    } catch (err) {
      console.error('Matches load error:', err);
      setError('No se pudieron cargar las partidas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useRefetchOnReconnect(loadMatches);

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
      showToast('success', 'Partida iniciada correctamente.');
      await loadMatches();
      await loadMatchDetail(id);
    } catch (err: unknown) {
      const apiErr = err as { error?: { message?: string } };
      showToast('error', apiErr?.error?.message || 'No se pudo iniciar la partida.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResetMatch() {
    if (!resetConfirm) return;
    setResetLoading(true);
    try {
      const result = await api.resetMatch(resetConfirm.id);
      setResetConfirm(null);
      if (result.noop) {
        showToast('success', `Match ${resetConfirm.number} ya estaba en UPCOMING.`);
      } else {
        showToast('success', `Match ${resetConfirm.number} reseteado correctamente.`);
      }
      await loadMatches();
      if (expanded === resetConfirm.id) {
        await loadMatchDetail(resetConfirm.id);
      }
    } catch (err: unknown) {
      console.error('Reset match error:', err);
      const apiErr = err as { error?: { message?: string } };
      showToast('error', apiErr?.error?.message || 'No se pudo resetear el match.');
    } finally {
      setResetLoading(false);
    }
  }

  async function handleResetMap() {
    if (!mapResetConfirm) return;
    setMapResetLoading(true);
    try {
      const result = await api.resetMap(mapResetConfirm.mapId);
      const mc = mapResetConfirm;
      setMapResetConfirm(null);
      if (result.noop) {
        showToast('success', `Mapa ${mc.mapCode} ya estaba en PENDING.`);
      } else {
        const affectedCount = result.affectedMaps.length;
        showToast('success', `Mapa ${mc.mapCode} reseteado${affectedCount > 1 ? ` (${affectedCount} mapas afectados)` : ''}.`);
      }
      await loadMatches();
      if (expanded === mc.matchId) {
        await loadMatchDetail(mc.matchId);
      }
    } catch (err: unknown) {
      console.error('Reset map error:', err);
      const apiErr = err as { error?: { message?: string } };
      showToast('error', apiErr?.error?.message || 'No se pudo resetear el mapa.');
    } finally {
      setMapResetLoading(false);
    }
  }

  if (loading) return <div className="loading">Cargando partidas...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div>
      <h1 className="page-title">Partidas</h1>

      <AdminToast toast={toast} onDismiss={dismissToast} />

      {matches.map(match => {
        const isExpanded = expanded === match.id;
        const hasLiveMatch = matches.some(m => m.status === 'LIVE');

        return (
          <div className="card" key={match.id}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap', gap: '10px' }}
              onClick={() => handleExpand(match.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '20px', fontWeight: 700 }}>
                  Partida {match.matchNumber}
                </span>
                <span className={`status-badge ${match.status.toLowerCase()}`}>{match.status}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {match.phase} · {match.matchNumber <= 2 ? 'Capitán + Piloto 1 (Partidas 1–2)' : 'Capitán + Piloto 2 (Partidas 3–4)'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {match.status === 'UPCOMING' && (
                  <button
                    className="btn btn-primary"
                    disabled={actionLoading || hasLiveMatch}
                    onClick={e => { e.stopPropagation(); handleStartMatch(match.id); }}
                  >
                    Iniciar partida
                  </button>
                )}
                {(match.status === 'LIVE' || match.status === 'COMPLETED') && (
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={actionLoading || resetLoading}
                    onClick={e => { e.stopPropagation(); setResetConfirm({ id: match.id, number: match.matchNumber }); }}
                  >
                    Resetear partida
                  </button>
                )}
                <span style={{ color: 'var(--text-muted)', fontSize: '18px', marginLeft: '4px' }}>
                  {isExpanded ? '▲' : '▼'}
                </span>
              </div>
            </div>

            {isExpanded && matchDetail && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <div className="card-title">Mapas de la Partida</div>
                <div className="map-pills" style={{ marginBottom: '16px' }}>
                  {matchDetail.maps.map(map => (
                    <span key={map.id} className={`map-pill ${map.status.toLowerCase()}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {map.code} — {map.status}
                      {(map.status === 'ACTIVE' || map.status === 'COMPLETED') && (
                        <button
                          className="btn-map-reset"
                          disabled={mapResetLoading}
                          onClick={e => {
                            e.stopPropagation();
                            setMapResetConfirm({
                              mapId: map.id,
                              mapCode: map.code,
                              mapIndex: map.mapIndex,
                              matchNumber: match.matchNumber,
                              matchId: match.id,
                              totalMaps: matchDetail.maps.length,
                            });
                          }}
                          title="Resetear este mapa"
                        >
                          ↺
                        </button>
                      )}
                    </span>
                  ))}
                </div>

                <div className="card-title">Pilotos en Competición</div>
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

      {resetConfirm && (
        <div className="confirm-dialog-overlay" onClick={() => { if (!resetLoading) setResetConfirm(null); }}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>¿Resetear Partida {resetConfirm.number}?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, marginBottom: '8px' }}>
              Esta acción eliminará todos los resultados registrados en sus mapas y devolverá la partida a estado UPCOMING.
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, marginBottom: '8px' }}>
              La clasificación se recalculará automáticamente.
            </p>
            <p style={{ color: 'var(--warning)', fontSize: '12px', fontWeight: 600 }}>
              Esta acción no se puede deshacer automáticamente.
            </p>
            <div className="dialog-actions">
              <button
                className="btn btn-secondary"
                disabled={resetLoading}
                onClick={() => setResetConfirm(null)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                disabled={resetLoading}
                onClick={handleResetMatch}
              >
                {resetLoading ? 'Reseteando...' : 'Resetear partida'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mapResetConfirm && (() => {
        const laterCount = mapResetConfirm.totalMaps - mapResetConfirm.mapIndex;
        return (
          <div className="confirm-dialog-overlay" onClick={() => { if (!mapResetLoading) setMapResetConfirm(null); }}>
            <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
              <h3>¿Resetear Mapa {mapResetConfirm.mapCode}?</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, marginBottom: '8px' }}>
                Se eliminarán los resultados de este mapa{laterCount > 0 ? ` y ${laterCount === 1 ? 'del mapa posterior' : `de los ${laterCount} mapas posteriores`}` : ''} de la Partida {mapResetConfirm.matchNumber}.
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, marginBottom: '8px' }}>
                El progreso posterior del match se perderá y la clasificación será recalculada.
              </p>
              <p style={{ color: 'var(--warning)', fontSize: '12px', fontWeight: 600 }}>
                Esta acción no se puede deshacer automáticamente.
              </p>
              <div className="dialog-actions">
                <button
                  className="btn btn-secondary"
                  disabled={mapResetLoading}
                  onClick={() => setMapResetConfirm(null)}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-danger"
                  disabled={mapResetLoading}
                  onClick={handleResetMap}
                >
                  {mapResetLoading ? 'Reseteando...' : 'Resetear mapa'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
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
