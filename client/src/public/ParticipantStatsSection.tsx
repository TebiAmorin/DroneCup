import { useState, useMemo } from 'react';
import { ParticipantStats, TeamStats } from '../api';
import { getTeamColor } from './assets';

interface ParticipantStatsSectionProps {
  participants: ParticipantStats[];
  teams: TeamStats[];
  selectedTeamId: string;
}

type RoleFilter = 'ALL' | 'CREATOR' | 'PLAYER_1' | 'PLAYER_2';

function Sparkline({ progression, color }: { progression: ParticipantStats['progression']; color: string }) {
  if (!progression || progression.length < 2) {
    if (progression && progression.length === 1) {
      return (
        <div className="pub-sparkline-wrap single">
          <span className="pub-sparkline-dot-single" style={{ background: color }} />
          <span className="pub-sparkline-pts-single">{progression[0].cumulativePoints} pts</span>
        </div>
      );
    }
    return <span className="pub-sparkline-empty">—</span>;
  }

  const width = 110;
  const height = 30;
  const pad = 4;

  const points = progression.map(p => p.cumulativePoints);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min > 0 ? max - min : 1;

  const coords = points.map((val, idx) => {
    const x = pad + (idx / (points.length - 1)) * (width - 2 * pad);
    const y = height - pad - ((val - min) / range) * (height - 2 * pad);
    return `${x},${y}`;
  });

  const polylineStr = coords.join(' ');

  return (
    <div className="pub-sparkline-wrap" title={`Progresión: ${points.join(' → ')} pts`}>
      <svg width={width} height={height} className="pub-sparkline-svg">
        <polyline
          points={polylineStr}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((_, idx) => {
          const [cx, cy] = coords[idx].split(',');
          return (
            <circle
              key={idx}
              cx={cx}
              cy={cy}
              r="2.5"
              fill={color}
              stroke="#0c1119"
              strokeWidth="1"
            />
          );
        })}
      </svg>
    </div>
  );
}

export default function ParticipantStatsSection({
  participants,
  teams,
  selectedTeamId,
}: ParticipantStatsSectionProps) {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');

  // Filter by selected team if team is selected
  const teamFiltered = useMemo(() => {
    if (selectedTeamId !== 'ALL') {
      return participants.filter(p => p.teamId === selectedTeamId);
    }
    return participants;
  }, [participants, selectedTeamId]);

  // Filter by role if in global view
  const displayParticipants = useMemo(() => {
    if (selectedTeamId !== 'ALL') return teamFiltered;
    if (roleFilter === 'ALL') return teamFiltered;
    return teamFiltered.filter(p => p.participantType === roleFilter);
  }, [teamFiltered, roleFilter, selectedTeamId]);

  return (
    <div className="pub-stats-card pub-part-stats-card">
      <div className="pub-chart-header">
        <div className="pub-chart-title-block">
          <div className="pub-chart-badge">Rendimiento Individual</div>
          <h3 className="pub-chart-title">Estadísticas de Pilotos</h3>
          <p className="pub-chart-subtitle">
            Telemetría individual, puestos alcanzados, promedio por mapa y curva de progresión de cada corredor
          </p>
        </div>

        {selectedTeamId === 'ALL' && (
          <div className="pub-part-filter-group" role="tablist" aria-label="Filtrar por rol">
            <button
              type="button"
              className={`pub-pf-btn${roleFilter === 'ALL' ? ' active' : ''}`}
              onClick={() => setRoleFilter('ALL')}
            >
              Todos ({participants.length})
            </button>
            <button
              type="button"
              className={`pub-pf-btn${roleFilter === 'CREATOR' ? ' active' : ''}`}
              onClick={() => setRoleFilter('CREATOR')}
            >
              Capitanes
            </button>
            <button
              type="button"
              className={`pub-pf-btn${roleFilter === 'PLAYER_1' ? ' active' : ''}`}
              onClick={() => setRoleFilter('PLAYER_1')}
            >
              Piloto 1 (M1-6)
            </button>
            <button
              type="button"
              className={`pub-pf-btn${roleFilter === 'PLAYER_2' ? ' active' : ''}`}
              onClick={() => setRoleFilter('PLAYER_2')}
            >
              Piloto 2 (M7-12)
            </button>
          </div>
        )}
      </div>

      <div className="pub-part-grid">
        {displayParticipants.map((p, idx) => {
          const team = teams.find(t => t.teamId === p.teamId);
          const color = getTeamColor({ ...team, teamSlug: team?.teamSlug, teamName: p.teamName }, idx);

          const roleLabel =
            p.participantType === 'CREATOR'
              ? 'Capitán'
              : p.participantType === 'PLAYER_1'
              ? 'Piloto 1'
              : 'Piloto 2';

          const roleTag =
            p.participantType === 'CREATOR'
              ? '12 Mapas'
              : p.participantType === 'PLAYER_1'
              ? 'Mapas 1-6'
              : 'Mapas 7-12';

          const roleClass = p.participantType.toLowerCase().replace('_', '-');

          // Position counts breakdown (e.g. 1st, 2nd, 3rd)
          const topFinishes = p.positionCounts.filter(pc => typeof pc.position === 'number' && pc.position <= 3 && pc.count > 0);

          return (
            <div
              key={p.participantId}
              className="pub-part-card"
              style={{ borderTop: `3px solid ${color}` }}
            >
              <div className="pub-part-card-head">
                <div className="pub-part-card-pilot">
                  <span className="pub-part-card-dot" style={{ background: color }} />
                  <div className="pub-part-card-identity">
                    <h4 className="pub-part-card-name">{p.participantName}</h4>
                    <span className="pub-part-card-team">{p.teamName}</span>
                  </div>
                </div>

                <div className="pub-part-role-badges">
                  <span className={`pub-part-role-badge ${roleClass}`}>{roleLabel}</span>
                  <span className="pub-part-rot-tag">{roleTag}</span>
                </div>
              </div>

              {/* Main metrics grid */}
              <div className="pub-part-metrics-grid">
                <div className="pub-part-metric">
                  <span className="pub-part-metric-val highlight" style={{ color }}>
                    {p.totalPoints}
                  </span>
                  <span className="pub-part-metric-lbl">Puntos Totales</span>
                </div>

                <div className="pub-part-metric">
                  <span className="pub-part-metric-val">{p.mapsPlayed}</span>
                  <span className="pub-part-metric-lbl">Mapas Jugados</span>
                </div>

                <div className="pub-part-metric">
                  <span className="pub-part-metric-val">
                    {p.averagePointsPerMap !== null ? p.averagePointsPerMap : '—'}
                  </span>
                  <span className="pub-part-metric-lbl">Promedio / Mapa</span>
                </div>

                <div className="pub-part-metric">
                  <span className={`pub-part-metric-val${p.bestPosition === 1 ? ' gold' : p.bestPosition === 2 ? ' silver' : p.bestPosition === 3 ? ' bronze' : ''}`}>
                    {p.bestPosition !== null ? `${p.bestPosition}.º` : '—'}
                  </span>
                  <span className="pub-part-metric-lbl">Mejor Posición</span>
                </div>

                <div className="pub-part-metric">
                  <span className={`pub-part-metric-val${p.dnfCount > 0 ? ' dnf' : ''}`}>
                    {p.dnfCount}
                  </span>
                  <span className="pub-part-metric-lbl">DNFs</span>
                </div>
              </div>

              {/* Sparkline progression */}
              <div className="pub-part-prog-row">
                <span className="pub-part-prog-lbl">Curva de Puntos:</span>
                <Sparkline progression={p.progression} color={color} />
              </div>

              {/* Podiums / Top Finishes */}
              {topFinishes.length > 0 && (
                <div className="pub-part-podiums-row">
                  <span className="pub-part-pod-lbl">Podios:</span>
                  <div className="pub-part-pod-chips">
                    {topFinishes.map(tf => (
                      <span
                        key={tf.position}
                        className={`pub-part-pod-chip pos-${tf.position}`}
                      >
                        {tf.count}x {tf.position}.º
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
