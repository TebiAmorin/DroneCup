import { useState, useMemo } from 'react';
import { TeamStats, ProgressionTeam } from '../api';
import { getTeamColor } from './assets';

interface PointsProgressionChartProps {
  teams: TeamStats[];
  teamProgression: ProgressionTeam[];
  selectedTeamId: string;
  onSelectTeam?: (teamId: string) => void;
}

interface HoveredPoint {
  teamName: string;
  teamColor: string;
  matchNumber: number;
  mapIndex: number;
  mapCode: string;
  cumulativePoints: number;
  stepPoints: number;
  cx: number;
  cy: number;
}

export default function PointsProgressionChart({
  teams,
  teamProgression,
  selectedTeamId,
  onSelectTeam,
}: PointsProgressionChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null);

  // Extract all distinct completed maps in chronological order
  const distinctMaps = useMemo(() => {
    const mapDict = new Map<string, { mapId: string; mapCode: string; matchNumber: number; mapIndex: number }>();
    for (const tp of teamProgression) {
      for (const p of tp.progression) {
        if (!mapDict.has(p.mapId)) {
          mapDict.set(p.mapId, {
            mapId: p.mapId,
            mapCode: p.mapCode,
            matchNumber: p.matchNumber,
            mapIndex: p.mapIndex,
          });
        }
      }
    }
    return Array.from(mapDict.values()).sort((a, b) => {
      if (a.matchNumber !== b.matchNumber) return a.matchNumber - b.matchNumber;
      return a.mapIndex - b.mapIndex;
    });
  }, [teamProgression]);

  // If no maps completed yet, show clean empty state
  if (distinctMaps.length === 0) {
    return (
      <div className="pub-stats-card pub-chart-card">
        <div className="pub-chart-header">
          <div className="pub-chart-title-block">
            <h3 className="pub-chart-title">Evolución Acumulada de Puntos</h3>
            <p className="pub-chart-subtitle">Progresión oficial carrera a carrera a lo largo del torneo</p>
          </div>
        </div>
        <div className="pub-chart-empty">
          <div className="pub-ce-icon">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
          </div>
          <p className="pub-ce-text">Sin carreras finalizadas aún</p>
          <span className="pub-ce-sub">La progresión y gráficas se generarán en tiempo real tras la conclusión del primer mapa.</span>
        </div>
      </div>
    );
  }

  // Dimensions
  const svgWidth = 840;
  const svgHeight = 340;
  const padLeft = 55;
  const padRight = 45;
  const padTop = 30;
  const padBottom = 45;

  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  // Max cumulative points for Y axis scaling
  const maxPtsRaw = Math.max(
    ...teamProgression.flatMap(t => t.progression.map(p => p.cumulativePoints)),
    30
  );
  // Round up to nice interval (e.g. nearest 25 or 50)
  const stepY = maxPtsRaw > 150 ? 50 : maxPtsRaw > 80 ? 25 : 15;
  const maxY = Math.ceil(maxPtsRaw / stepY) * stepY;
  const yTicks = [0, maxY * 0.25, maxY * 0.5, maxY * 0.75, maxY].map(v => Math.round(v));

  // Coordinate mappers
  const getX = (mapIndexInList: number) => {
    if (distinctMaps.length === 1) return padLeft + plotWidth / 2;
    return padLeft + (mapIndexInList / (distinctMaps.length - 1)) * plotWidth;
  };

  const getY = (points: number) => {
    return padTop + plotHeight - (points / maxY) * plotHeight;
  };

  return (
    <div className="pub-stats-card pub-chart-card">
      <div className="pub-chart-header">
        <div className="pub-chart-title-block">
          <div className="pub-chart-badge">Gráfica Oficial</div>
          <h3 className="pub-chart-title">Evolución de Puntos por Equipo</h3>
          <p className="pub-chart-subtitle">
            Curva acumulada mapa a mapa desde la Partida 1 hasta la gran final
          </p>
        </div>
        {selectedTeamId !== 'ALL' && onSelectTeam && (
          <button
            type="button"
            className="pub-chart-reset-btn"
            onClick={() => onSelectTeam('ALL')}
          >
            Ver todos los equipos
          </button>
        )}
      </div>

      <div className="pub-chart-svg-wrap">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="pub-chart-svg"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          {/* Y Axis Grid lines */}
          {yTicks.map(val => {
            const y = getY(val);
            return (
              <g key={`y-${val}`} className="pub-grid-line-grp">
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="pub-axis-label y"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* X Axis Map labels & vertical guideline */}
          {distinctMaps.map((m, idx) => {
            const x = getX(idx);
            return (
              <g key={m.mapId} className="pub-grid-x-grp">
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={svgHeight - padBottom}
                  stroke="rgba(255, 255, 255, 0.04)"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={svgHeight - padBottom + 18}
                  textAnchor="middle"
                  className="pub-axis-label x"
                >
                  {m.mapCode}
                </text>
                <text
                  x={x}
                  y={svgHeight - padBottom + 30}
                  textAnchor="middle"
                  className="pub-axis-sub x"
                >
                  M{m.matchNumber}
                </text>
              </g>
            );
          })}

          {/* Team Progression Lines */}
          {teamProgression.map((tp, teamIdx) => {
            const teamMeta = teams.find(t => t.teamId === tp.teamId);
            const teamColor = getTeamColor({ ...teamMeta, ...tp }, teamIdx);
            const isFocused = selectedTeamId === 'ALL' || selectedTeamId === tp.teamId;
            const isDimmed = selectedTeamId !== 'ALL' && selectedTeamId !== tp.teamId;

            // Map each completed map to team's progression point
            const pointsList: { x: number; y: number; p: (typeof tp.progression)[0]; stepPts: number }[] = [];
            let prevCum = 0;

            distinctMaps.forEach((dm, dmIdx) => {
              const progPoint = tp.progression.find(p => p.mapId === dm.mapId);
              if (progPoint) {
                const x = getX(dmIdx);
                const y = getY(progPoint.cumulativePoints);
                const stepPts = progPoint.cumulativePoints - prevCum;
                prevCum = progPoint.cumulativePoints;
                pointsList.push({ x, y, p: progPoint, stepPts });
              }
            });

            if (pointsList.length === 0) return null;

            const pathD = pointsList.reduce((acc, pt, i) => {
              return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
            }, '');

            return (
              <g
                key={tp.teamId}
                className={`pub-team-line-grp${isDimmed ? ' dimmed' : ''}${isFocused ? ' focused' : ''}`}
              >
                {/* Under-glow stroke for focused team */}
                {isFocused && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke={teamColor}
                    strokeWidth="8"
                    strokeOpacity="0.18"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Main line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={teamColor}
                  strokeWidth={isFocused ? (selectedTeamId === tp.teamId ? '3.5' : '2.5') : '1.5'}
                  strokeOpacity={isDimmed ? '0.22' : '1'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="pub-prog-line"
                />

                {/* Data Points */}
                {pointsList.map(pt => {
                  const isPointHovered =
                    hoveredPoint?.teamName === tp.teamName &&
                    hoveredPoint?.mapCode === pt.p.mapCode;

                  return (
                    <circle
                      key={pt.p.mapId}
                      cx={pt.x}
                      cy={pt.y}
                      r={isPointHovered ? 6 : isFocused ? 4 : 3}
                      fill={teamColor}
                      stroke="#06090d"
                      strokeWidth={isPointHovered ? 2.5 : 1.5}
                      className="pub-prog-dot"
                      onMouseEnter={() => {
                        setHoveredPoint({
                          teamName: tp.teamName,
                          teamColor,
                          matchNumber: pt.p.matchNumber,
                          mapIndex: pt.p.mapIndex,
                          mapCode: pt.p.mapCode,
                          cumulativePoints: pt.p.cumulativePoints,
                          stepPoints: pt.stepPts,
                          cx: pt.x,
                          cy: pt.y,
                        });
                      }}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Active Hover vertical line & Tooltip inside SVG */}
          {hoveredPoint && (
            <g className="pub-chart-hover-overlay">
              <line
                x1={hoveredPoint.cx}
                y1={padTop}
                x2={hoveredPoint.cx}
                y2={svgHeight - padBottom}
                stroke="rgba(255, 255, 255, 0.3)"
                strokeDasharray="3 3"
                strokeWidth="1.5"
              />
              <circle
                cx={hoveredPoint.cx}
                cy={hoveredPoint.cy}
                r="7"
                fill={hoveredPoint.teamColor}
                stroke="#fff"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* HTML Tooltip overlay for perfect CSS typography & accessibility */}
        {hoveredPoint && (
          <div
            className="pub-chart-tooltip"
            style={{
              left: `${(hoveredPoint.cx / svgWidth) * 100}%`,
              top: `${(hoveredPoint.cy / svgHeight) * 100}%`,
            }}
          >
            <div className="pub-ct-head">
              <span className="pub-ct-dot" style={{ background: hoveredPoint.teamColor }} />
              <strong className="pub-ct-team">{hoveredPoint.teamName}</strong>
            </div>
            <div className="pub-ct-match">
              Partida {hoveredPoint.matchNumber} · Mapa {hoveredPoint.mapIndex} ({hoveredPoint.mapCode})
            </div>
            <div className="pub-ct-score">
              <span className="pub-ct-val">{hoveredPoint.cumulativePoints} pts</span>
              <span className="pub-ct-label">Acumulados</span>
            </div>
            {hoveredPoint.stepPoints > 0 && (
              <div className="pub-ct-gain">+{hoveredPoint.stepPoints} pts en esta carrera</div>
            )}
          </div>
        )}
      </div>

      {/* Legend below the chart */}
      <div className="pub-chart-legend">
        {teamProgression.map((tp, idx) => {
          const teamMeta = teams.find(t => t.teamId === tp.teamId);
          const color = getTeamColor({ ...teamMeta, ...tp }, idx);
          const isSelected = selectedTeamId === tp.teamId;
          const lastPoint = tp.progression[tp.progression.length - 1];

          return (
            <button
              key={tp.teamId}
              type="button"
              className={`pub-cl-item${isSelected ? ' active' : ''}`}
              onClick={() => onSelectTeam && onSelectTeam(isSelected ? 'ALL' : tp.teamId)}
              title={`Filtrar por ${tp.teamName}`}
            >
              <span className="pub-cl-line" style={{ background: color }} />
              <span className="pub-cl-name">{tp.teamName}</span>
              {lastPoint && (
                <span className="pub-cl-pts">{lastPoint.cumulativePoints} pts</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
