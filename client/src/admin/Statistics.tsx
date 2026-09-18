import { useEffect, useState, useCallback } from 'react';
import { api, TeamStats, ParticipantStats } from '../api';
import { getSocket } from '../socket';
import { useRefetchOnReconnect } from './useSocket';

export default function Statistics() {
  const [teams, setTeams] = useState<TeamStats[]>([]);
  const [participants, setParticipants] = useState<ParticipantStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([
        api.getStatisticsTeams(),
        api.getStatisticsParticipants(),
      ]);
      setTeams(t);
      setParticipants(p);
      setError(null);
    } catch (err) {
      console.error('Statistics load error:', err);
      setError('No se pudieron cargar las estadísticas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const socket = getSocket();
    socket.on('competition.updated', loadData);
    socket.on('ranking.updated', loadData);
    socket.on('map.completed', loadData);
    socket.on('result.updated', loadData);
    socket.on('match.completed', loadData);

    return () => {
      socket.off('competition.updated', loadData);
      socket.off('ranking.updated', loadData);
      socket.off('map.completed', loadData);
      socket.off('result.updated', loadData);
      socket.off('match.completed', loadData);
    };
  }, [loadData]);

  useRefetchOnReconnect(loadData);

  if (loading) return <div className="loading">Cargando estadísticas...</div>;
  if (error) return <div className="error-message">{error}</div>;

  const hasResults = teams.some(t => t.mapsPlayed > 0);

  const matchNumbers = new Set<number>();
  for (const t of teams) {
    for (const mp of t.pointsByMatch) {
      matchNumbers.add(mp.matchNumber);
    }
  }
  const sortedMatchNumbers = [...matchNumbers].sort((a, b) => a - b);

  const sortedParticipants = [...participants].sort(
    (a, b) => b.totalPoints - a.totalPoints || a.participantName.localeCompare(b.participantName)
  );

  return (
    <div>
      <h1 className="page-title">Estadísticas</h1>

      {!hasResults ? (
        <div className="card">
          <div className="stat-label" style={{ padding: '24px 0', textAlign: 'center' }}>
            No hay resultados de competición todavía. Las estadísticas aparecerán cuando se dispute el primer mapa.
          </div>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-title">Clasificación por equipos</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Equipo</th>
                    <th style={{ textAlign: 'right' }}>Puntos</th>
                    <th style={{ textAlign: 'right' }}>Mapas</th>
                    <th style={{ textAlign: 'right' }}>Ganados</th>
                    {sortedMatchNumbers.map(n => (
                      <th key={n} style={{ textAlign: 'right' }}>P{n}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teams.map(t => {
                    const matchPointsMap = new Map(
                      t.pointsByMatch.map(mp => [mp.matchNumber, mp.points])
                    );
                    return (
                      <tr key={t.teamId}>
                        <td style={{ fontWeight: 700, width: '40px' }}>{t.globalPosition}</td>
                        <td>
                          {t.teamColor && (
                            <span className="team-color" style={{ background: t.teamColor }} />
                          )}
                          {t.teamName}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '16px' }}>
                          {t.totalPoints}
                        </td>
                        <td style={{ textAlign: 'right' }}>{t.mapsPlayed}</td>
                        <td style={{ textAlign: 'right' }}>{t.mapsWon}</td>
                        {sortedMatchNumbers.map(n => (
                          <td key={n} style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                            {matchPointsMap.get(n) ?? '—'}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Clasificación individual</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Jugador</th>
                    <th>Tipo</th>
                    <th>Equipo</th>
                    <th style={{ textAlign: 'right' }}>Puntos</th>
                    <th style={{ textAlign: 'right' }}>Mapas</th>
                    <th style={{ textAlign: 'right' }}>Media</th>
                    <th style={{ textAlign: 'right' }}>Mejor</th>
                    <th style={{ textAlign: 'right' }}>DNFs</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedParticipants.map((p, i) => (
                    <tr key={p.participantId}>
                      <td style={{ fontWeight: 700, width: '40px' }}>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{p.participantName}</td>
                      <td>
                        <span style={{
                          fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em',
                          color: p.participantType === 'CREATOR' ? 'var(--accent)' : 'var(--text-muted)',
                        }}>
                          {p.participantType.replace('_', ' ')}
                        </span>
                      </td>
                      <td>{p.teamName}</td>
                      <td style={{ textAlign: 'right', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '16px' }}>
                        {p.totalPoints}
                      </td>
                      <td style={{ textAlign: 'right' }}>{p.mapsPlayed}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {p.averagePointsPerMap !== null ? p.averagePointsPerMap.toFixed(1) : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {p.bestPosition !== null ? p.bestPosition : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: p.dnfCount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {p.dnfCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
