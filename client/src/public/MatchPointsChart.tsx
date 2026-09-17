import { useState } from 'react';
import { TeamStats } from '../api';
import { getTeamColor } from './assets';

interface MatchPointsChartProps {
  teams: TeamStats[];
  selectedTeamId: string;
  onSelectTeam?: (teamId: string) => void;
}

export default function MatchPointsChart({ teams, selectedTeamId, onSelectTeam }: MatchPointsChartProps) {
  const [hoveredBar, setHoveredBar] = useState<{ matchNumber: number; teamName: string; points: number } | null>(null);

  const matches = [1, 2, 3, 4];

  // Find max match score across tournament for bar height normalisation
  const maxScoreInAnyMatch = Math.max(
    ...teams.flatMap(t => t.pointsByMatch.map(p => p.points)),
    40
  );

  return (
    <div className="pub-stats-card pub-match-bars-card">
      <div className="pub-chart-header">
        <div className="pub-chart-title-block">
          <div className="pub-chart-badge">Rendimiento por Ronda</div>
          <h3 className="pub-chart-title">Puntos por Match</h3>
          <p className="pub-chart-subtitle">
            Comparativa directa de puntuación obtenida por cada escuadra en las 4 partidas principales
          </p>
        </div>
      </div>

      <div className="pub-mb-grid">
        {matches.map(matchNum => {
          // Team points for this match
          const teamPoints = teams.map((team, idx) => {
            const entry = team.pointsByMatch.find(p => p.matchNumber === matchNum);
            const pts = entry ? entry.points : 0;
            const color = getTeamColor(team, idx);
            return {
              teamId: team.teamId,
              teamName: team.teamName,
              color,
              points: pts,
            };
          });

          const totalPointsInMatch = teamPoints.reduce((acc, t) => acc + t.points, 0);
          const isMatchPlayed = totalPointsInMatch > 0;

          // Match Winner / Leader
          const topScore = Math.max(...teamPoints.map(t => t.points));
          const leaders = teamPoints.filter(t => t.points === topScore && topScore > 0);
          const singleLeader = leaders.length === 1 ? leaders[0] : null;

          return (
            <div key={matchNum} className="pub-mb-match-col">
              <div className="pub-mb-col-head">
                <div className="pub-mb-col-title-wrap">
                  <span className="pub-mb-match-tag">Partida {matchNum}</span>
                  <span className="pub-mb-match-status">
                    {isMatchPlayed ? `${totalPointsInMatch} pts disputados` : 'Pendiente'}
                  </span>
                </div>

                {isMatchPlayed && singleLeader && (
                  <div
                    className="pub-mb-leader-chip"
                    style={{ '--leader-color': singleLeader.color } as React.CSSProperties}
                  >
                    <span className="pub-mb-leader-dot" style={{ background: singleLeader.color }} />
                    <span className="pub-mb-leader-text">
                      Líder: <strong>{singleLeader.teamName}</strong> ({singleLeader.points} pts)
                    </span>
                  </div>
                )}
              </div>

              {isMatchPlayed ? (
                <div className="pub-mb-bars-stage">
                  {teamPoints.map(tp => {
                    const isSelected = selectedTeamId === tp.teamId;
                    const isDimmed = selectedTeamId !== 'ALL' && selectedTeamId !== tp.teamId;
                    const isHovered =
                      hoveredBar?.matchNumber === matchNum && hoveredBar?.teamName === tp.teamName;

                    // Height percentage (clamp at min 6% so label is visible, max 100%)
                    const heightPct =
                      tp.points > 0
                        ? Math.max(8, Math.round((tp.points / maxScoreInAnyMatch) * 100))
                        : 0;

                    return (
                      <div
                        key={tp.teamId}
                        className={`pub-mb-bar-col${isDimmed ? ' dimmed' : ''}${isSelected ? ' focused' : ''}`}
                        onClick={() => onSelectTeam && onSelectTeam(isSelected ? 'ALL' : tp.teamId)}
                        onMouseEnter={() =>
                          setHoveredBar({ matchNumber: matchNum, teamName: tp.teamName, points: tp.points })
                        }
                        onMouseLeave={() => setHoveredBar(null)}
                      >
                        <div className="pub-mb-bar-track">
                          <div
                            className="pub-mb-bar-fill"
                            style={{
                              height: `${heightPct}%`,
                              background: tp.color,
                              boxShadow: isSelected || isHovered ? `0 0 12px ${tp.color}66` : 'none',
                            }}
                          >
                            {tp.points > 0 && (
                              <span className="pub-mb-bar-val">{tp.points}</span>
                            )}
                          </div>
                        </div>
                        <span
                          className="pub-mb-bar-name"
                          title={tp.teamName}
                          style={{ color: isSelected ? tp.color : 'inherit' }}
                        >
                          {tp.teamName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="pub-mb-col-empty">
                  <span className="pub-mb-pending-dash">—</span>
                  <span className="pub-mb-pending-text">Carrera no iniciada</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
