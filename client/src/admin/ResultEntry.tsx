import { useEffect, useState, useMemo } from 'react';
import { api, MapDetail } from '../api';
import { SCORING_TABLE } from '@shared/types';

interface Props {
  matchId: string;
  mapId: string;
  onResultConfirmed: () => void;
}

interface ParticipantResult {
  participantId: string;
  participantName: string;
  participantType: string;
  teamName: string;
  value: string; // '1'-'10', 'DNF', or ''
}

export default function ResultEntry({ matchId, mapId, onResultConfirmed }: Props) {
  const [mapDetail, setMapDetail] = useState<MapDetail | null>(null);
  const [participants, setParticipants] = useState<ParticipantResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);
      try {
        const [map, matchParticipants] = await Promise.all([
          api.getMap(mapId),
          api.getParticipants({ match: matchId }),
        ]);
        if (cancelled) return;
        setMapDetail(map);

        if (map.results && map.results.length > 0) {
          setParticipants(
            map.results.map(r => ({
              participantId: r.participantId,
              participantName: r.participantName,
              participantType: r.participantType,
              teamName: r.teamName,
              value: r.status === 'DNF' ? 'DNF' : String(r.position),
            }))
          );
        } else {
          setParticipants(
            matchParticipants.map(p => ({
              participantId: p.id,
              participantName: p.name,
              participantType: p.type,
              teamName: p.teamName,
              value: '',
            }))
          );
        }
      } catch {
        if (!cancelled) setError('Failed to load map data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [mapId, matchId]);

  const validation = useMemo(() => {
    const errors: string[] = [];
    const unassigned = participants.filter(p => p.value === '');
    if (unassigned.length > 0) {
      errors.push(`${unassigned.length} participant${unassigned.length > 1 ? 's' : ''} still need a result`);
    }

    const positions = participants
      .filter(p => p.value !== '' && p.value !== 'DNF')
      .map(p => parseInt(p.value));

    const dupes = positions.filter((v, i) => positions.indexOf(v) !== i);
    if (dupes.length > 0) {
      const unique = [...new Set(dupes)];
      unique.forEach(d => errors.push(`Position ${d} is already assigned`));
    }

    const finishedCount = positions.length;
    const dnfCount = participants.filter(p => p.value === 'DNF').length;
    if (unassigned.length === 0 && finishedCount + dnfCount !== 10) {
      errors.push(`Expected 10 participants, got ${finishedCount + dnfCount}`);
    }

    const maxPos = Math.max(...positions, 0);
    if (maxPos > 10) {
      errors.push(`Position cannot exceed 10`);
    }

    return { valid: errors.length === 0 && unassigned.length === 0, errors };
  }, [participants]);

  const usedPositions = useMemo(() => {
    return new Set(
      participants
        .filter(p => p.value !== '' && p.value !== 'DNF')
        .map(p => parseInt(p.value))
    );
  }, [participants]);

  function handleChange(idx: number, value: string) {
    setParticipants(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], value };
      return next;
    });
    setSuccessMsg(null);
  }

  function handleQuickPos(idx: number, posStr: string) {
    setParticipants(prev => {
      const next = [...prev];
      // Toggle if already selected
      if (next[idx].value === posStr) {
        next[idx] = { ...next[idx], value: '' };
      } else {
        next[idx] = { ...next[idx], value: posStr };
      }
      return next;
    });
    setSuccessMsg(null);
  }

  function handleMarkUnassignedDnf() {
    setParticipants(prev =>
      prev.map(p => (p.value === '' ? { ...p, value: 'DNF' } : p))
    );
    setSuccessMsg(null);
  }

  function handleClearAll() {
    setParticipants(prev => prev.map(p => ({ ...p, value: '' })));
    setSuccessMsg(null);
  }

  async function handleSubmit() {
    if (!mapDetail) return;
    setSubmitting(true);
    setError(null);

    const results = participants.map(p => ({
      participantId: p.participantId,
      position: p.value === 'DNF' ? null : parseInt(p.value),
      status: p.value === 'DNF' ? 'DNF' : 'FINISHED',
    }));

    try {
      const isCorrection = mapDetail.status === 'COMPLETED';
      if (isCorrection) {
        await api.correctResults(mapId, results);
      } else {
        await api.confirmResults(mapId, results);
      }
      setShowConfirm(false);
      setSuccessMsg(`${mapDetail.code} resultados ${isCorrection ? 'corregidos' : 'confirmados'} con éxito`);
      onResultConfirmed();
    } catch (err: unknown) {
      const apiErr = err as { error?: { message?: string } };
      setError(apiErr?.error?.message || 'Error al enviar resultados');
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="card"><div className="loading">Cargando mapa...</div></div>;

  if (!mapDetail) return null;

  const isCorrection = mapDetail.status === 'COMPLETED';
  const unassignedCount = participants.filter(p => p.value === '').length;

  return (
    <div className="card admin-control-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="card-title" style={{ marginBottom: '4px' }}>
            {isCorrection ? 'CONTROL ROOM — CORRECCIÓN DE RESULTADOS' : 'CONTROL ROOM — ENTRADA RÁPIDA DE RESULTADOS'}
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '24px', fontWeight: 700, letterSpacing: '0.04em' }}>
              {mapDetail.code}
            </span>
            <span className={`status-badge ${mapDetail.status.toLowerCase()}`}>
              {mapDetail.status === 'COMPLETED' ? '● FINALIZADO' : mapDetail.status === 'ACTIVE' ? '● EN CURSO' : mapDetail.status}
            </span>
          </div>
        </div>

        {/* Quick batch helper actions */}
        <div className="admin-quick-actions">
          {unassignedCount > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleMarkUnassignedDnf}
              title="Asignar DNF a todos los participantes sin posición"
            >
              ⚡ Restantes como DNF ({unassignedCount})
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleClearAll}
          >
            Limpiar Todo
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {successMsg && <div className="success-message">{successMsg}</div>}

      <div className="result-form">
        <div className="result-row result-row-head">
          <div className="row-num">#</div>
          <div className="col-label">PILOTO / EQUIPO</div>
          <div className="col-label">SELECTOR RÁPIDO DE POSICIÓN (1 CLIC)</div>
          <div className="col-label hide-on-tablet">DROPDOWN</div>
          <div className="col-label" style={{ textAlign: 'right' }}>PUNTOS</div>
        </div>

        {participants.map((p, i) => {
          const points = p.value === 'DNF' ? 0
            : p.value === '' ? null
            : (SCORING_TABLE[parseInt(p.value)] ?? 0);

          return (
            <div className={`result-row ${p.value ? 'has-value' : ''}`} key={p.participantId}>
              <div className="row-num">{i + 1}</div>
              <div className="participant-info">
                <span className="participant-name">{p.participantName}</span>
                <span className="participant-meta">
                  <span className="team-pill">{p.teamName}</span>
                  <span className="role-tag">{p.participantType.replace('_', ' ')}</span>
                </span>
              </div>

              {/* 1-Click Position Buttons */}
              <div className="pos-btn-pad">
                {Array.from({ length: 10 }, (_, n) => n + 1).map(pos => {
                  const posStr = String(pos);
                  const isSelected = p.value === posStr;
                  const isTaken = usedPositions.has(pos) && !isSelected;
                  return (
                    <button
                      key={pos}
                      type="button"
                      disabled={isTaken}
                      className={`pos-btn pos-${pos} ${isSelected ? 'active' : ''}`}
                      onClick={() => handleQuickPos(i, posStr)}
                      title={isTaken ? `Posición ${pos} ya asignada` : `Asignar P${pos}`}
                    >
                      {pos}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={`pos-btn pos-dnf ${p.value === 'DNF' ? 'active' : ''}`}
                  onClick={() => handleQuickPos(i, 'DNF')}
                  title="Marcar como No Terminado (DNF)"
                >
                  DNF
                </button>
              </div>

              {/* Secondary Select Dropdown */}
              <div className="hide-on-tablet">
                <select
                  value={p.value}
                  onChange={e => handleChange(i, e.target.value)}
                  className="admin-select-sm"
                >
                  <option value="">—</option>
                  {Array.from({ length: 10 }, (_, n) => n + 1).map(pos => (
                    <option
                      key={pos}
                      value={String(pos)}
                      disabled={usedPositions.has(pos) && p.value !== String(pos)}
                    >
                      P{pos} ({SCORING_TABLE[pos]} pts)
                    </option>
                  ))}
                  <option value="DNF">DNF (0 pts)</option>
                </select>
              </div>

              <div className={`points-display ${points !== null ? 'has-pts' : ''}`}>
                {points === null ? '—' : `${points} PTS`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="confirm-bar">
        <div className={`validation-info ${validation.errors.length > 0 ? 'has-errors' : 'is-valid'}`}>
          {validation.valid
            ? '✓ Todos los 10 pilotos asignados — Listo para confirmar'
            : `⚠ ${validation.errors[0]}`}
        </div>
        <button
          className={`btn ${isCorrection ? 'btn-danger' : 'btn-primary'}`}
          disabled={!validation.valid || submitting}
          onClick={() => setShowConfirm(true)}
        >
          {isCorrection ? 'CORREGIR RESULTADOS' : 'CONFIRMAR RESULTADOS DEL MAPA'}
        </button>
      </div>

      {showConfirm && (
        <div className="confirm-dialog-overlay" onClick={() => setShowConfirm(false)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>{isCorrection ? 'Confirm Correction' : 'Confirm Map Results'}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
              {isCorrection
                ? `This will recalculate all rankings and snapshots for ${mapDetail.code}. This action affects historical data.`
                : `Submit results for ${mapDetail.code}? This will advance the competition state.`}
            </p>
            <table className="ranking-table" style={{ marginBottom: '16px' }}>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Participant</th>
                  <th>Team</th>
                  <th style={{ textAlign: 'right' }}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {[...participants]
                  .sort((a, b) => {
                    if (a.value === 'DNF') return 1;
                    if (b.value === 'DNF') return -1;
                    return parseInt(a.value) - parseInt(b.value);
                  })
                  .map(p => (
                    <tr key={p.participantId}>
                      <td>{p.value === 'DNF' ? 'DNF' : p.value}</td>
                      <td>{p.participantName}</td>
                      <td>{p.teamName}</td>
                      <td style={{ textAlign: 'right' }}>
                        {p.value === 'DNF' ? 0 : SCORING_TABLE[parseInt(p.value)] ?? 0}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)} disabled={submitting}>
                Cancel
              </button>
              <button
                className={`btn ${isCorrection ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : isCorrection ? 'Confirm Correction' : 'Confirm Results'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
