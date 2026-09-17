import { useEffect, useState } from 'react';
import { api, ParticipantData, MatchData } from '../api';

export default function Participants() {
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [filterType, setFilterType] = useState('');
  const [filterMatch, setFilterMatch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [p, m] = await Promise.all([
          api.getParticipants(),
          api.getMatches(),
        ]);
        setParticipants(p);
        setMatches(m);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function filter() {
      const query: Record<string, string> = {};
      if (filterType) query.type = filterType;
      if (filterMatch) query.match = filterMatch;
      try {
        const p = await api.getParticipants(Object.keys(query).length > 0 ? query : undefined);
        setParticipants(p);
      } catch {
        // ignore
      }
    }
    filter();
  }, [filterType, filterMatch]);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      <h1 className="page-title">Participants</h1>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Type
            </label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{
                padding: '6px 10px', background: 'var(--bg-secondary)',
                border: '1px solid var(--border)', borderRadius: '4px',
                color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'inherit',
              }}
            >
              <option value="">All</option>
              <option value="CREATOR">Creator</option>
              <option value="PLAYER_1">Player 1</option>
              <option value="PLAYER_2">Player 2</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Match
            </label>
            <select
              value={filterMatch}
              onChange={e => setFilterMatch(e.target.value)}
              style={{
                padding: '6px 10px', background: 'var(--bg-secondary)',
                border: '1px solid var(--border)', borderRadius: '4px',
                color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'inherit',
              }}
            >
              <option value="">All</option>
              {matches.map(m => (
                <option key={m.id} value={m.id}>Match {m.matchNumber}</option>
              ))}
            </select>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {participants.length} participants
          </div>
        </div>
      </div>

      <div className="card">
        <table className="ranking-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Team</th>
              <th>Type</th>
              <th>Slug</th>
            </tr>
          </thead>
          <tbody>
            {participants.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td>{p.teamName}</td>
                <td>
                  <span style={{
                    fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: p.type === 'CREATOR' ? 'var(--accent)' : 'var(--text-muted)',
                  }}>
                    {p.type.replace('_', ' ')}
                  </span>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{p.slug}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
