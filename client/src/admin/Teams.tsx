import { useEffect, useState } from 'react';
import { api, TeamData } from '../api';

export default function Teams() {
  const [teams, setTeams] = useState<(TeamData & { participants?: { id: string; name: string; slug: string; type: string }[] })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const list = await api.getTeams();
        const detailed = await Promise.all(list.map(t => api.getTeam(t.id)));
        setTeams(detailed);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      <h1 className="page-title">Teams</h1>

      <div className="grid-2">
        {teams.map(team => (
          <div className="card" key={team.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              {team.color && (
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: team.color, flexShrink: 0,
                }} />
              )}
              <div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '20px', fontWeight: 700 }}>
                  {team.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{team.slug}</div>
              </div>
            </div>

            {team.participants && team.participants.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {team.participants.map(p => (
                  <div key={p.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '6px',
                    border: '1px solid var(--border)',
                  }}>
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                    <span style={{
                      fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em',
                      color: p.type === 'CREATOR' ? 'var(--accent)' : 'var(--text-muted)',
                    }}>
                      {p.type.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
