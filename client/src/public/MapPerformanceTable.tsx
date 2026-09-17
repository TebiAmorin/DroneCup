import { useMemo } from 'react';
import { TeamStats, ParticipantStats } from '../api';
import { getTeamColor } from './assets';

interface MapPerformanceTableProps {
  teams: TeamStats[];
  participants: ParticipantStats[];
  selectedTeamId: string;
  onSelectTeam?: (teamId: string) => void;
}

function TrophyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

export default function MapPerformanceTable({
  teams,
  participants,
  selectedTeamId,
  onSelectTeam,
}: MapPerformanceTableProps) {
  // Collect all distinct completed maps across all teams in chronological order
  const distinctMaps = useMemo(() => {
    const mapDict = new Map<string, { mapId: string; mapCode: string; matchNumber: number; mapIndex: number }>();
    for (const t of teams) {
      for (const m of t.pointsByMap) {
        if (!mapDict.has(m.mapId)) {
          mapDict.set(m.mapId, {
            mapId: m.mapId,
            mapCode: m.mapCode,
            matchNumber: m.matchNumber,
            mapIndex: m.mapIndex,
          });
        }
      }
    }
    return Array.from(mapDict.values()).sort((a, b) => {
      if (a.matchNumber !== b.matchNumber) return a.matchNumber - b.matchNumber;
      return a.mapIndex - b.mapIndex;
    });
  }, [teams]);

  if (distinctMaps.length === 0) {
    return (
      <div className="pub-stats-card pub-mperf-card">
        <div className="pub-chart-header">
          <div className="pub-chart-title-block">
            <h3 className="pub-chart-title">Rendimiento por Mapa</h3>
            <p className="pub-chart-subtitle">Desglose táctico de cada carrera individual disputada</p>
          </div>
        </div>
        <div className="pub-chart-empty">
          <span className="pub-ce-text">No hay mapas registrados aún</span>
        </div>
      </div>
    );
  }

  const isTeamView = selectedTeamId !== 'ALL';
  const selectedTeam = teams.find(t => t.teamId === selectedTeamId);
  const teamParticipants = isTeamView ? participants.filter(p => p.teamId === selectedTeamId) : [];

  return (
    <div className="pub-stats-card pub-mperf-card">
      <div className="pub-chart-header">
        <div className="pub-chart-title-block">
          <div className="pub-chart-badge">Telemetría de Carrera</div>
          <h3 className="pub-chart-title">
            {isTeamView && selectedTeam
              ? `Rendimiento de ${selectedTeam.teamName} por Mapa`
              : 'Rendimiento Comparativo por Mapa'}
          </h3>
          <p className="pub-chart-subtitle">
            {isTeamView
              ? 'Resultados, puntos de la escuadra y puntuación de los pilotos en cada trazado'
              : 'Resultados de cada carrera con desglose de puntos por equipo y ganador oficial'}
          </p>
        </div>
      </div>

      <div className="pub-mperf-list">
        {distinctMaps.map(dm => {
          // Find points earned by every team in this map
          const scoresOnThisMap = teams.map((t, idx) => {
            const mData = t.pointsByMap.find(m => m.mapId === dm.mapId);
            const pts = mData ? mData.points : 0;
            const color = getTeamColor(t, idx);
            return {
              teamId: t.teamId,
              teamName: t.teamName,
              color,
              points: pts,
            };
          });

          // Determine highest team score on this map (map winner)
          const maxPts = Math.max(...scoresOnThisMap.map(s => s.points));
          const mapWinners = scoresOnThisMap.filter(s => s.points === maxPts && maxPts > 0);
          const singleWinner = mapWinners.length === 1 ? mapWinners[0] : null;

          if (isTeamView && selectedTeam) {
            const thisTeamEntry = scoresOnThisMap.find(s => s.teamId === selectedTeamId);
            const teamPts = thisTeamEntry ? thisTeamEntry.points : 0;
            const didWin = singleWinner?.teamId === selectedTeamId;

            // Relevant pilots of this team who scored in this map
            const pilotPerformances = teamParticipants
              .map(p => {
                const pMap = p.pointsByMap.find(m => m.mapId === dm.mapId);
                return {
                  pilot: p,
                  points: pMap?.points ?? null,
                };
              })
              .filter(pp => pp.points !== null);

            return (
              <div key={dm.mapId} className={`pub-mperf-row${didWin ? ' won' : ''}`}>
                <div className="pub-mperf-col-map">
                  <span className="pub-mperf-match-tag">Partida {dm.matchNumber}</span>
                  <strong className="pub-mperf-code">{dm.mapCode}</strong>
                  <span className="pub-mperf-map-idx">Mapa {dm.mapIndex}</span>
                </div>

                <div className="pub-mperf-col-team-pts">
                  <span className="pub-mperf-pts-val">{teamPts}</span>
                  <span className="pub-mperf-pts-lbl">Puntos Escuadra</span>
                </div>

                <div className="pub-mperf-col-status">
                  {didWin ? (
                    <span className="pub-mperf-badge win">
                      <TrophyIcon /> Victoria de Mapa
                    </span>
                  ) : singleWinner ? (
                    <span className="pub-mperf-badge defeat">
                      Ganó: <strong style={{ color: singleWinner.color }}>{singleWinner.teamName}</strong> ({singleWinner.points} pts)
                    </span>
                  ) : (
                    <span className="pub-mperf-badge neutral">Empate de líderes</span>
                  )}
                </div>

                <div className="pub-mperf-col-pilots">
                  <span className="pub-mperf-pilots-title">Pilotos en Carrera:</span>
                  <div className="pub-mperf-pilots-list">
                    {pilotPerformances.map(({ pilot, points }) => (
                      <span key={pilot.participantId} className="pub-mperf-pilot-chip">
                        <span className="pub-mperf-pilot-role">
                          {pilot.participantType === 'CREATOR'
                            ? 'Capitán'
                            : pilot.participantType === 'PLAYER_1'
                            ? 'P1'
                            : 'P2'}
                        </span>
                        <strong className="pub-mperf-pilot-name">{pilot.participantName}</strong>
                        <span className="pub-mperf-pilot-pts">+{points} pts</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          // Global view (ALL teams)
          const totalPointsOnMap = scoresOnThisMap.reduce((sum, s) => sum + s.points, 0);

          return (
            <div key={dm.mapId} className="pub-mperf-row global">
              <div className="pub-mperf-col-map">
                <span className="pub-mperf-match-tag">Partida {dm.matchNumber}</span>
                <strong className="pub-mperf-code">{dm.mapCode}</strong>
                <span className="pub-mperf-map-idx">Mapa {dm.mapIndex}</span>
              </div>

              <div className="pub-mperf-col-winner">
                {singleWinner ? (
                  <div
                    className="pub-mperf-winner-box"
                    style={{ borderLeft: `3px solid ${singleWinner.color}` }}
                  >
                    <span className="pub-mperf-wb-label">Ganador de Mapa</span>
                    <strong className="pub-mperf-wb-name" style={{ color: singleWinner.color }}>
                      {singleWinner.teamName}
                    </strong>
                    <span className="pub-mperf-wb-pts">+{singleWinner.points} pts</span>
                  </div>
                ) : (
                  <div className="pub-mperf-winner-box neutral">
                    <span className="pub-mperf-wb-label">Ganador de Mapa</span>
                    <strong className="pub-mperf-wb-name">Liderazgo compartido</strong>
                  </div>
                )}
              </div>

              <div className="pub-mperf-col-bars">
                <span className="pub-mperf-bars-label">
                  Distribución de Puntos ({totalPointsOnMap} pts totales):
                </span>
                <div className="pub-mperf-teams-bar-grid">
                  {scoresOnThisMap.map(s => {
                    return (
                      <div
                        key={s.teamId}
                        className="pub-mperf-team-stat"
                        onClick={() => onSelectTeam && onSelectTeam(s.teamId)}
                        title={`Filtrar estadísticas por ${s.teamName}`}
                      >
                        <div className="pub-mperf-ts-top">
                          <span className="pub-mperf-ts-dot" style={{ background: s.color }} />
                          <span className="pub-mperf-ts-name">{s.teamName}</span>
                          <strong className="pub-mperf-ts-pts">{s.points} pts</strong>
                        </div>
                        <div className="pub-mperf-ts-meter">
                          <div
                            className="pub-mperf-ts-meter-fill"
                            style={{
                              width: `${maxPts > 0 ? Math.round((s.points / maxPts) * 100) : 0}%`,
                              background: s.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
