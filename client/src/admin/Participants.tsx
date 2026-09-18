import { useEffect, useState, useCallback } from 'react';
import { api, ParticipantData, MatchData } from '../api';
import { useRefetchOnReconnect } from './useSocket';

export default function Participants() {
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [filterType, setFilterType] = useState('');
  const [filterMatch, setFilterMatch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadParticipants = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([
        api.getParticipants(),
        api.getMatches(),
      ]);
      setParticipants(p);
      setMatches(m);
      setError(null);
    } catch (err) {
      console.error('Participants load error:', err);
      setError('No se pudieron cargar los participantes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadParticipants(); }, [loadParticipants]);
  useRefetchOnReconnect(loadParticipants);

  useEffect(() => {
    async function filter() {
      const query: Record<string, string> = {};
      if (filterType) query.type = filterType;
      if (filterMatch) query.match = filterMatch;
      try {
        const p = await api.getParticipants(Object.keys(query).length > 0 ? query : undefined);
        setParticipants(p);
        setError(null);
      } catch (err) {
        console.error('Participants filter error:', err);
        setError('No se pudieron filtrar los participantes.');
      }
    }
    filter();
  }, [filterType, filterMatch]);

  if (loading) return <div className="loading">Cargando participantes...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div>
      <h1 className="page-title">Participantes</h1>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 700 }}>
              Rol / Tipo
            </label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{
                padding: '8px 12px', background: 'var(--bg-secondary)',
                border: '1px solid var(--border)', borderRadius: '4px',
                color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'inherit',
              }}
            >
              <option value="">Todos los roles</option>
              <option value="CREATOR">Capitán</option>
              <option value="PLAYER_1">Piloto 1</option>
              <option value="PLAYER_2">Piloto 2</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 700 }}>
              Partida
            </label>
            <select
              value={filterMatch}
              onChange={e => setFilterMatch(e.target.value)}
              style={{
                padding: '8px 12px', background: 'var(--bg-secondary)',
                border: '1px solid var(--border)', borderRadius: '4px',
                color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'inherit',
              }}
            >
              <option value="">Todas las partidas</option>
              {matches.map(m => (
                <option key={m.id} value={m.id}>Partida {m.matchNumber}</option>
              ))}
            </select>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {participants.length} participantes registrados
          </div>
        </div>
      </div>

      <div className="card">
        <table className="ranking-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Equipo</th>
              <th>Rol Oficial</th>
              <th>Identificador</th>
            </tr>
          </thead>
          <tbody>
            {participants.map(p => {
              const roleLabel =
                p.type === 'CREATOR'
                  ? 'Capitán'
                  : p.type === 'PLAYER_1'
                  ? 'Piloto 1'
                  : 'Piloto 2';

              return (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600, fontSize: '14px' }}>{p.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.teamName}</td>
                  <td>
                    <span style={{
                      fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em',
                      fontWeight: 700,
                      color: p.type === 'CREATOR' ? 'var(--accent)' : 'var(--text-muted)',
                    }}>
                      {roleLabel}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'monospace' }}>{p.slug}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
