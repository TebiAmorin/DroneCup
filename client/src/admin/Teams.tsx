import { useEffect, useState, useCallback } from 'react';
import { api, TeamData, ParticipantData } from '../api';
import { useRefetchOnReconnect } from './useSocket';
import { useAdminToast, AdminToast } from './AdminToast';

type ParticipantInfo = ParticipantData & { confirmed: boolean };

export default function Teams() {
  const [teams, setTeams] = useState<(TeamData & { participants?: ParticipantInfo[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [confirmDialog, setConfirmDialog] = useState<{ id: string; name: string } | null>(null);
  const { toast, showToast, dismissToast } = useAdminToast();

  const loadTeams = useCallback(async () => {
    try {
      const list = await api.getTeams();
      const detailed = await Promise.all(list.map(t => api.getTeam(t.id)));
      setTeams(detailed);
      setError(null);
    } catch (err) {
      console.error('Teams load error:', err);
      setError('No se pudieron cargar los equipos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeams(); }, [loadTeams]);
  useRefetchOnReconnect(loadTeams);

  function startEdit(p: ParticipantInfo) {
    setEditing({ id: p.id, name: p.name });
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function saveEdit() {
    if (!editing) return;
    const trimmed = editing.name.trim();
    if (trimmed.length < 1 || trimmed.length > 50) {
      showToast('error', 'El nombre debe tener entre 1 y 50 caracteres.');
      return;
    }

    const original = teams.flatMap(t => t.participants || []).find(p => p.id === editing.id);
    if (original && original.name === trimmed) {
      setEditing(null);
      return;
    }

    setEditLoading(true);
    try {
      await api.updateParticipant(editing.id, trimmed);
      setEditing(null);
      showToast('success', 'Nombre actualizado correctamente.');
      await loadTeams();
    } catch (err: unknown) {
      const apiErr = err as { error?: { message?: string } };
      showToast('error', apiErr?.error?.message || 'No se pudo actualizar el nombre.');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleConfirm(p: ParticipantInfo) {
    setActionLoading(prev => ({ ...prev, [p.id]: true }));
    try {
      await api.confirmParticipant(p.id, p.name);
      showToast('success', `${p.name} confirmado correctamente.`);
      await loadTeams();
    } catch (err: unknown) {
      const apiErr = err as { error?: { message?: string } };
      showToast('error', apiErr?.error?.message || 'No se pudo confirmar el participante.');
    } finally {
      setActionLoading(prev => ({ ...prev, [p.id]: false }));
    }
  }

  async function handleReset(id: string) {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    setConfirmDialog(null);
    try {
      await api.resetParticipant(id);
      showToast('success', 'Participante reseteado a POR DETERMINAR.');
      await loadTeams();
    } catch (err: unknown) {
      const apiErr = err as { error?: { message?: string } };
      showToast('error', apiErr?.error?.message || 'No se pudo resetear el participante.');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  }

  if (loading) return <div className="loading">Cargando equipos...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div>
      <h1 className="page-title">Equipos</h1>

      <AdminToast toast={toast} onDismiss={dismissToast} />

      {confirmDialog && (
        <div className="confirm-dialog-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Resetear participante</h3>
            <p>Resetear <strong>{confirmDialog.name}</strong> a POR DETERMINAR?</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
              Se eliminará el nombre y la confirmación. Los resultados existentes no se modificarán.
            </p>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDialog(null)}>
                Cancelar
              </button>
              <button
                className="btn"
                style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626' }}
                onClick={() => handleReset(confirmDialog.id)}
              >
                Confirmar reset
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid-2">
        {teams.map(team => {
          const color = team.color || '#e05520';

          return (
            <div className="card" key={team.id} style={{ borderTop: `3px solid ${color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: color, flexShrink: 0,
                  boxShadow: `0 0 10px ${color}40`,
                }} />
                <div>
                  <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '20px', fontWeight: 700 }}>
                    {team.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{team.slug}</div>
                </div>
              </div>

              {team.participants && team.participants.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {team.participants.map(p => {
                    const isEditing = editing?.id === p.id;
                    const isPlayer = p.type === 'PLAYER_1' || p.type === 'PLAYER_2';
                    const isLoading = actionLoading[p.id] ?? false;
                    const roleLabel =
                      p.type === 'CREATOR'
                        ? 'Capitán'
                        : p.type === 'PLAYER_1'
                        ? 'Piloto 1'
                        : 'Piloto 2';

                    return (
                      <div key={p.id} style={{
                        display: 'flex', flexDirection: 'column', gap: '6px',
                        padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '6px',
                        border: '1px solid var(--border)',
                      }}>
                        {isEditing ? (
                          <div className="participant-edit-row">
                            <input
                              className="participant-edit-input"
                              type="text"
                              value={editing.name}
                              onChange={e => setEditing({ ...editing, name: e.target.value })}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              maxLength={50}
                              disabled={editLoading}
                              autoFocus
                            />
                            <button className="btn btn-primary btn-sm" disabled={editLoading} onClick={saveEdit}>
                              {editLoading ? '...' : 'Guardar'}
                            </button>
                            <button className="btn btn-secondary btn-sm" disabled={editLoading} onClick={cancelEdit}>
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, fontSize: '14px' }}>{p.name}</span>
                              <span style={{
                                fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em',
                                fontWeight: 700,
                                color: p.type === 'CREATOR' ? 'var(--accent)' : 'var(--text-muted)',
                              }}>
                                {roleLabel}
                              </span>
                            </div>

                            {isPlayer && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                                {p.confirmed ? (
                                  <>
                                    <span style={{
                                      fontSize: '11px', fontWeight: 700, color: '#22c55e',
                                      textTransform: 'uppercase', letterSpacing: '0.06em',
                                    }}>
                                      ✓ CONFIRMADO
                                    </span>
                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                                      <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => startEdit(p)}
                                        disabled={isLoading}
                                      >
                                        Editar
                                      </button>
                                      <button
                                        className="btn btn-sm"
                                        style={{ background: 'transparent', color: '#dc2626', borderColor: '#dc2626' }}
                                        onClick={() => setConfirmDialog({ id: p.id, name: p.name })}
                                        disabled={isLoading}
                                      >
                                        Reset
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <span style={{
                                      fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
                                      textTransform: 'uppercase', letterSpacing: '0.06em',
                                    }}>
                                      POR DETERMINAR
                                    </span>
                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                                      <button
                                        className="btn-participant-edit"
                                        onClick={() => startEdit(p)}
                                        title="Editar nombre"
                                        disabled={isLoading}
                                      >
                                        ✎
                                      </button>
                                      <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => handleConfirm(p)}
                                        disabled={isLoading}
                                      >
                                        {isLoading ? '...' : 'Confirmar'}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
