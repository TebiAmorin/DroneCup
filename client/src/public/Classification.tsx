import { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import type { CompetitionState } from './useCompetition';
import { SectionHead, TeamDot, LoadingState } from './components';
import {
  SCORING_TABLE,
  TWITCH_ICON_SVG,
  getAvatarBySlug,
  getCreatorBySlug,
  getTeamColor,
} from './assets';
import { api, TeamStats } from '../api';
import { getSocket } from '../socket';

type MatchFilter = 'OVERALL' | 1 | 2 | 3 | 4;

export default function Classification() {
  const { rankings, individuals, matches, teams, loading } = useOutletContext<CompetitionState>();
  const navigate = useNavigate();

  const [matchFilter, setMatchFilter] = useState<MatchFilter>('OVERALL');
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);

  const loadData = useCallback(async () => {
    try {
      const statsData = await api.getStatisticsTeams();
      setTeamStats(statsData);
    } catch (err) {
      console.error('Failed to load stats for classification', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    const socket = getSocket();
    const refresh = () => loadData();

    socket.on('map.completed', refresh);
    socket.on('result.updated', refresh);
    socket.on('ranking.updated', refresh);
    socket.on('competition.updated', refresh);
    socket.on('match.completed', refresh);

    return () => {
      socket.off('map.completed', refresh);
      socket.off('result.updated', refresh);
      socket.off('ranking.updated', refresh);
      socket.off('competition.updated', refresh);
      socket.off('match.completed', refresh);
    };
  }, [loadData]);

  const completedMatches = matches.filter(m => m.status === 'COMPLETED');
  const liveMatch = matches.find(m => m.status === 'LIVE');
  const totalMatches = matches.length || 4;
  const completedCount = completedMatches.length;

  const isTournamentStarted =
    rankings.some(r => r.totalPoints > 0) || liveMatch !== undefined || completedCount > 0;
  const leader = rankings[0];
  const leaderPoints = leader?.totalPoints ?? 0;
  const leaderStats = teamStats.find(ts => ts.teamId === leader?.teamId);
  const leaderAvgPts =
    completedCount > 0 && leaderPoints > 0
      ? (leaderPoints / completedCount).toFixed(1)
      : '—';
  const isTieForFirst =
    rankings.length >= 2 && leaderPoints > 0 && leaderPoints === rankings[1]?.totalPoints;

  const chipText = liveMatch
    ? 'EN DIRECTO'
    : isTournamentStarted
    ? `${completedCount}/${totalMatches} Partidas`
    : 'FASE PREVIA';

  // Compute displayed rows based on active match filter
  const isMatchSpecific = matchFilter !== 'OVERALL';
  const selectedMatchNum = typeof matchFilter === 'number' ? matchFilter : null;

  // Has the selected match been played with recorded points?
  const isSelectedMatchPlayed =
    selectedMatchNum !== null &&
    teamStats.some(ts => ts.pointsByMatch.some(p => p.matchNumber === selectedMatchNum));

  interface DisplayRow {
    teamId: string;
    teamName: string;
    teamSlug: string;
    teamColor: string;
    officialRank: number;
    posDisplay: string;
    pointsDisplay: number | null;
    gapText: string | null;
    stats?: TeamStats;
    team?: (typeof teams)[0];
    creatorData?: ReturnType<typeof getCreatorBySlug>;
    playedMatchesCount: number;
    avgPointsPerMatch: string;
    matchPointsList: Array<{ matchNumber: number; points: number | null }>;
  }

  const displayRows: DisplayRow[] = useMemo(() => {
    if (matchFilter === 'OVERALL') {
      // 1. OVERALL: Preserves exact ranking order from /api/rankings. DO NOT RE-SORT!
      return rankings.map((t, idx) => {
        const stats = teamStats.find(ts => ts.teamId === t.teamId);
        const team = teams.find(te => te.id === t.teamId);
        const creatorData = getCreatorBySlug(t.teamSlug);
        const teamColor = getTeamColor(
          { ...t, slug: t.teamSlug, name: t.teamName, color: t.teamColor || creatorData?.color },
          idx
        );

        // Gap strictly derived from official rankings
        const prevPoints = idx > 0 ? rankings[idx - 1].totalPoints : null;
        const gap = prevPoints !== null ? prevPoints - t.totalPoints : null;
        const gapText = gap === null ? null : gap === 0 ? '= 0' : `-${gap}`;

        const playedMatches = stats?.pointsByMatch ?? [];
        const playedMatchesCount = playedMatches.length;
        const avgPointsPerMatch =
          playedMatchesCount > 0 ? (t.totalPoints / playedMatchesCount).toFixed(1) : '—';
        const matchPointsList = [1, 2, 3, 4].map(mNum => {
          const entry = playedMatches.find(p => p.matchNumber === mNum);
          return {
            matchNumber: mNum,
            points: entry !== undefined ? entry.points : null,
          };
        });

        return {
          teamId: t.teamId,
          teamName: t.teamName,
          teamSlug: t.teamSlug,
          teamColor,
          officialRank: t.rank,
          posDisplay: String(t.rank).padStart(2, '0'),
          pointsDisplay: t.totalPoints,
          gapText,
          stats,
          team,
          creatorData,
          playedMatchesCount,
          avgPointsPerMatch,
          matchPointsList,
        };
      });
    } else {
      const matchNum = matchFilter;

      // 2. UNPLAYED MATCH (Partida 3, Partida 4, etc.):
      if (!isSelectedMatchPlayed) {
        return rankings.map((t, idx) => {
          const stats = teamStats.find(ts => ts.teamId === t.teamId);
          const team = teams.find(te => te.id === t.teamId);
          const creatorData = getCreatorBySlug(t.teamSlug);
          const teamColor = getTeamColor(
            { ...t, slug: t.teamSlug, name: t.teamName, color: t.teamColor || creatorData?.color },
            idx
          );

          const playedMatches = stats?.pointsByMatch ?? [];
          const playedMatchesCount = playedMatches.length;
          const avgPointsPerMatch =
            playedMatchesCount > 0 ? (t.totalPoints / playedMatchesCount).toFixed(1) : '—';
          const matchPointsList = [1, 2, 3, 4].map(mNum => {
            const entry = playedMatches.find(p => p.matchNumber === mNum);
            return {
              matchNumber: mNum,
              points: entry !== undefined ? entry.points : null,
            };
          });

          return {
            teamId: t.teamId,
            teamName: t.teamName,
            teamSlug: t.teamSlug,
            teamColor,
            officialRank: t.rank,
            posDisplay: '—',
            pointsDisplay: null, // Renders as "—"
            gapText: null, // No gap in unplayed matches
            stats,
            team,
            creatorData,
            playedMatchesCount,
            avgPointsPerMatch,
            matchPointsList,
          };
        });
      }

      // 3. PLAYED MATCH (Partida 1, Partida 2, etc.):
      // Extract points earned in this match from pointsByMatch
      const rowsWithMatchPts = rankings.map((t, idx) => {
        const stats = teamStats.find(ts => ts.teamId === t.teamId);
        const team = teams.find(te => te.id === t.teamId);
        const creatorData = getCreatorBySlug(t.teamSlug);
        const teamColor = getTeamColor(
          { ...t, slug: t.teamSlug, name: t.teamName, color: t.teamColor || creatorData?.color },
          idx
        );
        const matchEntry = stats?.pointsByMatch.find(p => p.matchNumber === matchNum);
        const matchPts = matchEntry !== undefined ? matchEntry.points : 0;

        const playedMatches = stats?.pointsByMatch ?? [];
        const playedMatchesCount = playedMatches.length;
        const avgPointsPerMatch =
          playedMatchesCount > 0 ? (t.totalPoints / playedMatchesCount).toFixed(1) : '—';
        const matchPointsList = [1, 2, 3, 4].map(mNum => {
          const entry = playedMatches.find(p => p.matchNumber === mNum);
          return {
            matchNumber: mNum,
            points: entry !== undefined ? entry.points : null,
          };
        });

        return {
          teamId: t.teamId,
          teamName: t.teamName,
          teamSlug: t.teamSlug,
          teamColor,
          officialRank: t.rank,
          matchPts,
          stats,
          team,
          creatorData,
          playedMatchesCount,
          avgPointsPerMatch,
          matchPointsList,
        };
      });

      // Sort descending by match points for comparison
      const sorted = [...rowsWithMatchPts].sort((a, b) => b.matchPts - a.matchPts);

      // Compute match positions, handling ties accurately
      let currentMatchRank = 1;
      return sorted.map((r, idx) => {
        if (idx > 0 && r.matchPts < sorted[idx - 1].matchPts) {
          currentMatchRank = idx + 1;
        }

        const posDisplay = String(currentMatchRank).padStart(2, '0');

        return {
          teamId: r.teamId,
          teamName: r.teamName,
          teamSlug: r.teamSlug,
          teamColor: r.teamColor,
          officialRank: r.officialRank,
          posDisplay,
          pointsDisplay: r.matchPts,
          gapText: null,
          stats: r.stats,
          team: r.team,
          creatorData: r.creatorData,
          playedMatchesCount: r.playedMatchesCount,
          avgPointsPerMatch: r.avgPointsPerMatch,
          matchPointsList: r.matchPointsList,
        };
      });
    }
  }, [rankings, teamStats, teams, matchFilter, isSelectedMatchPlayed]);

  if (loading) return <LoadingState />;

  return (
    <div className="pub-page pub-clas-page">
      {/* ── CABECERA EDITORIAL DE COMPETICIÓN (MASTHEAD HERO) ── */}
      <div className="pub-clas-hero">
        <div className="pub-ch-header">
          <div className="pub-ch-eyebrow-row">
            <span className="pub-ch-eyebrow">DRONE CUP · TORNEO OFICIAL</span>
            <span className={`pub-ch-chip${liveMatch ? ' live' : ''}`}>{chipText}</span>
          </div>
          <h1 className="pub-ch-title">Clasificación General</h1>
          <p className="pub-ch-subtitle">
            Wasteland Drone Cup · Puntuaciones oficiales de escuadras y rendimiento por partida en tiempo real
          </p>
        </div>

        {/* KPIs Dinámicos de Competición */}
        <div className="pub-ch-kpi-bar">
          <div className="pub-chk-card">
            <span className="pub-chk-label">LÍDER DEL TORNEO</span>
            <span className="pub-chk-val highlight">{leader ? leader.teamName : '—'}</span>
            <span className="pub-chk-sub">Puesto #1 Oficial</span>
          </div>

          <div className="pub-chk-card">
            <span className="pub-chk-label">PUNTOS DEL LÍDER</span>
            <span className="pub-chk-val gold">
              {leaderPoints} <small>PTS</small>
            </span>
            <span className="pub-chk-sub">
              {isTieForFirst ? 'Empate en primera posición' : 'Puntuación acumulada oficial'}
            </span>
          </div>

          <div className="pub-chk-card">
            <span className="pub-chk-label">ESTADO DE COMPETICIÓN</span>
            <span className="pub-chk-val">
              {completedCount} / {totalMatches} <small>PARTIDAS</small>
            </span>
            <span className="pub-chk-sub">
              {liveMatch ? `Partida ${liveMatch.matchNumber} en juego` : isTournamentStarted ? 'Rondas completadas' : 'Fase previa'}
            </span>
          </div>

          <div className="pub-chk-card">
            <span className="pub-chk-label">RENDIMIENTO LÍDER</span>
            <span className="pub-chk-val">
              {leaderAvgPts} <small>PTS / PARTIDA</small>
            </span>
            <span className="pub-chk-sub">
              {leaderStats ? `${leaderStats.mapsWon} mapas ganados` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* ── ALERTA DE DESEMPATE (SI APLICA SEGÚN REGLAMENTO) ── */}
      {isTieForFirst && (
        <div className="pub-tie-alert">
          <div className="pub-tie-icon">
            <AlertIcon />
          </div>
          <div className="pub-tie-content">
            <span className="pub-tie-title">EMPATE DETECTADO · DESEMPATE REQUERIDO</span>
            <p className="pub-tie-text">
              Al existir empate a puntos en la primera posición, se requerirá una{' '}
              <strong>fase de desempate (Tiebreaker)</strong> según lo planificado por la organización.
            </p>
          </div>
        </div>
      )}

      {/* ── ESTRUCTURA EN 2 COLUMNAS: CLASIFICACIÓN PROTAGONISTA + SIDEBAR DE REGLAS ── */}
      <div className="pub-clas-grid-layout">
        {/* ══════════════════════════════════════════════════════
            COLUMNA PRINCIPAL: RANKING OFICIAL POR EQUIPOS
           ══════════════════════════════════════════════════════ */}
        <div className="pub-clas-main-col">
          {/* ── BARRA SUPERIOR DE FILTRO: Overall | Partida 1 | Partida 2 | Partida 3 | Partida 4 ── */}
          <div className="pub-clas-controls-bar">
            <div className="pub-match-filter-tabs" role="tablist" aria-label="Filtrar por partida">
              <button
                type="button"
                className={`pub-mf-tab${matchFilter === 'OVERALL' ? ' active' : ''}`}
                onClick={() => setMatchFilter('OVERALL')}
                role="tab"
                aria-selected={matchFilter === 'OVERALL'}
              >
                <span>Overall</span>
              </button>
              {[1, 2, 3, 4].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`pub-mf-tab${matchFilter === num ? ' active' : ''}`}
                  onClick={() => setMatchFilter(num as 1 | 2 | 3 | 4)}
                  role="tab"
                  aria-selected={matchFilter === num}
                >
                  <span>Partida {num}</span>
                </button>
              ))}
            </div>

            <div className="pub-clas-status-pill">
              {liveMatch ? (
                <span className="pub-csp-live">
                  <span className="pub-live-dot" /> Partida {liveMatch.matchNumber} en juego
                </span>
              ) : (
                <span className="pub-csp-meta">
                  {matchFilter === 'OVERALL'
                    ? 'Clasificación General (Acumulada Oficial)'
                    : isSelectedMatchPlayed
                    ? `Rendimiento en Partida ${matchFilter} (Puntos de Ronda)`
                    : `Partida ${matchFilter} · Pendiente`}
                </span>
              )}
            </div>
          </div>

          {/* Aviso contextual cuando el torneo aún no ha comenzado o la partida está pendiente */}
          {!isTournamentStarted && matchFilter === 'OVERALL' && (
            <div className="pub-clas-pre-notice">
              <span className="pub-cpn-dot" />
              <span>
                <strong>Torneo en fase previa:</strong> Todos los equipos inician con 0 puntos. Las
                puntuaciones se actualizarán en tiempo real con cada resultado confirmado.
              </span>
            </div>
          )}

          {isMatchSpecific && !isSelectedMatchPlayed && (
            <div className="pub-clas-pre-notice pending">
              <span className="pub-cpn-dot pending" />
              <span>
                <strong>Partida {matchFilter} pendiente:</strong> Las puntuaciones de esta ronda se
                computarán una vez disputado el primero mapa de la Partida {matchFilter}.
              </span>
            </div>
          )}

          {/* ── TABLA EDITORIAL DE CLASIFICACIÓN (TEAM RANKING) ── */}
          <div className="pub-table-responsive-wrap">
            <table className="pub-rank-table">
              <thead>
                <tr>
                  <th className="pub-th-pos">
                    {matchFilter === 'OVERALL' ? '#' : `# Partida ${matchFilter}`}
                  </th>
                  <th className="pub-th-team">Equipo</th>
                  <th className="r pub-th-pts">
                    {matchFilter === 'OVERALL' ? 'Puntos' : `Puntos Partida ${matchFilter}`}
                  </th>
                  <th className="pub-th-expand" />
                </tr>
              </thead>
              <tbody>
                {displayRows.map(r => {
                  const isExpanded = expandedTeam === r.teamId;

                  // Roster participants for this team
                  const participants = r.team?.participants ?? [];
                  const creator = participants.find(p => p.type === 'CREATOR');
                  const p1 = participants.find(p => p.type === 'PLAYER_1');
                  const p2 = participants.find(p => p.type === 'PLAYER_2');

                  const avatar = getAvatarBySlug(r.teamSlug);
                  const creatorName = creator?.name ?? r.creatorData?.name ?? r.teamName;

                  // Individual pilot points
                  const creatorIndiv = individuals.find(i => i.participantId === creator?.id);
                  const p1Indiv = individuals.find(i => i.participantId === p1?.id);
                  const p2Indiv = individuals.find(i => i.participantId === p2?.id);

                  return (
                    <Fragment key={r.teamId}>
                      <tr
                        className={`pub-rk-row expandable${isExpanded ? ' open' : ''}`}
                        style={{
                          ['--team-color' as any]: r.teamColor,
                          borderLeft: `4px solid ${r.teamColor}`,
                        }}
                        onClick={() => setExpandedTeam(isExpanded ? null : r.teamId)}
                      >
                        {/* 1. POSICIÓN: dígitos limpios oficial o de ronda, o — si pendiente */}
                        <td className="pub-rk-num-cell">
                          <span className="pub-rk-pos-num">{r.posDisplay}</span>
                        </td>

                        {/* 2. EQUIPO: Avatar + Nombre + Enlace a perfil + Twitch icon + Sub-estadísticas */}
                        <td>
                          <div className="pub-rk-team-cell">
                            <div className="pub-rk-name-wrap">
                              {avatar ? (
                                <img
                                  src={avatar}
                                  alt={r.teamName}
                                  className="pub-rk-avatar"
                                  style={{
                                    borderColor: r.teamColor,
                                  }}
                                />
                              ) : (
                                <TeamDot color={r.teamColor} />
                              )}
                              <div className="pub-rk-team-col">
                                <div className="pub-rk-title-row">
                                  <span
                                    className="pub-rk-name"
                                    onClick={e => {
                                      e.stopPropagation();
                                      navigate(`/teams/${r.teamSlug}`);
                                    }}
                                  >
                                    {r.teamName}
                                  </span>

                                  {r.creatorData && (
                                    <a
                                      className="pub-row-twitch-link hide-sm"
                                      href={`https://www.twitch.tv/${r.creatorData.twitch}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      title={`Canal de Twitch de ${creatorName}`}
                                      aria-label={`Twitch de ${creatorName}`}
                                    >
                                      <TwitchSvg />
                                    </a>
                                  )}
                                </div>

                                {/* Información secundaria útil: Partidas jugadas, media y desglose P1..P4 */}
                                <div className="pub-rk-substats">
                                  <span className="pub-rk-sub-meta">
                                    {r.playedMatchesCount > 0
                                      ? `${r.playedMatchesCount} ${r.playedMatchesCount === 1 ? 'Partida' : 'Partidas'} · Media: ${r.avgPointsPerMatch} pts`
                                      : '0 Partidas disputadas'}
                                  </span>
                                  <div className="pub-rk-rounds-breakdown">
                                    {r.matchPointsList.map(mp => {
                                      const isFilterActive = matchFilter === mp.matchNumber;
                                      const isPlayed = mp.points !== null;

                                      return (
                                        <span
                                          key={mp.matchNumber}
                                          className={`pub-rk-round-tag${isFilterActive ? ' active' : ''}${isPlayed ? ' played' : ' pending'}`}
                                          title={`Partida ${mp.matchNumber}: ${isPlayed ? `${mp.points} pts` : 'Pendiente'}`}
                                        >
                                          <span className="pub-rt-lbl">P{mp.matchNumber}</span>
                                          <strong className="pub-rt-val">{isPlayed ? mp.points : '—'}</strong>
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 3. PUNTOS TOTALES / MATCH + GAP RELATIVO */}
                        <td className="pub-rk-pts">
                          <div className="pub-rk-pts-block">
                            {r.pointsDisplay !== null ? (
                              <div className="pub-rk-pts-main">
                                <span className="pub-pts-number">{r.pointsDisplay}</span>
                                <span className="pub-pts-label">PTS</span>
                              </div>
                            ) : (
                              <div className="pub-rk-pts-main pending">
                                <span className="pub-pts-number" style={{ color: 'var(--ink-tertiary)' }}>—</span>
                                <span className="pub-pts-label">PENDIENTE</span>
                              </div>
                            )}
                            {r.gapText && (
                              <span className="pub-rk-gap-val" title="Diferencia con el puesto anterior en la clasificación general">
                                {r.gapText}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Caret para desplegar roster */}
                        <td className="pub-expand-td">
                          <CaretIcon isOpen={isExpanded} />
                        </td>
                      </tr>

                      {/* 5. ROSTER DESPLEGABLE: INFORMACIÓN SECUNDARIA DEL EQUIPO */}
                      <tr className={`pub-expand-detail${isExpanded ? ' open' : ''}`}>
                        <td colSpan={4}>
                          <div className="pub-expand-inner">
                            <div className="pub-expand-header">
                              <span className="pub-eh-title">
                                Roster y Aportación Individual · {r.teamName}
                              </span>
                              <Link
                                to={`/teams/${r.teamSlug}`}
                                className="pub-eh-team-link"
                                onClick={e => e.stopPropagation()}
                              >
                                Ver ficha completa de escuadra →
                              </Link>
                            </div>

                            <div className="pub-expand-members-grid">
                              <div
                                className="pub-em-card cap"
                                style={{ borderLeft: `3px solid ${r.teamColor}` }}
                              >
                                <div className="pub-em-role-tag">CREATOR</div>
                                <div className="pub-em-row">
                                  <span className="pub-em-name">{creatorName}</span>
                                  <span className="pub-em-pts">
                                    {creatorIndiv?.totalPoints ?? 0} <small>PTS</small>
                                  </span>
                                </div>
                                <div className="pub-em-meta">
                                  <span>12 Mapas (Partidas 1 a 4)</span>
                                </div>
                              </div>

                              <div className="pub-em-card p1">
                                <div className="pub-em-role-tag">PLAYER 1</div>
                                <div className="pub-em-row">
                                  <span className="pub-em-name">{p1?.name ?? 'Piloto 1'}</span>
                                  <span className="pub-em-pts">
                                    {p1Indiv?.totalPoints ?? 0} <small>PTS</small>
                                  </span>
                                </div>
                                <div className="pub-em-meta">
                                  <span>Mapas 1-6 (Partidas 1 y 2)</span>
                                </div>
                              </div>

                              <div className="pub-em-card p2">
                                <div className="pub-em-role-tag">PLAYER 2</div>
                                <div className="pub-em-row">
                                  <span className="pub-em-name">{p2?.name ?? 'Piloto 2'}</span>
                                  <span className="pub-em-pts">
                                    {p2Indiv?.totalPoints ?? 0} <small>PTS</small>
                                  </span>
                                </div>
                                <div className="pub-em-meta">
                                  <span>Mapas 7-12 (Partidas 3 y 4)</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            COLUMNA LATERAL (DESKTOP) / INFERIOR (MÓVIL): REGLAS Y FORMATO
           ══════════════════════════════════════════════════════ */}
        <aside className="pub-clas-side-col">
          {/* 1. SISTEMA OFICIAL DE PUNTUACIÓN POR MAPA */}
          <div className="pub-side-card pub-side-scoring">
            <div className="pub-side-card-header">
              <div>
                <span className="pub-side-eyebrow">REGLAMENTO OFICIAL</span>
                <h3 className="pub-side-title">Puntos por Posición</h3>
              </div>
              <span className="pub-side-chip">Por Mapa</span>
            </div>

            <div className="pub-side-scoring-list">
              {SCORING_TABLE.map(item => (
                <div key={item.label} className={`pub-side-pos-pill ${item.tier}`}>
                  <span className="pub-spp-pos">{item.shortLabel}</span>
                  <span className="pub-spp-pts">
                    <strong>{item.points}</strong> pts
                  </span>
                </div>
              ))}
            </div>

            <div className="pub-side-rules-list">
              <div className="pub-srl-item">
                <span className="pub-srl-bullet">▸</span>
                <div>
                  <strong>Suma por equipo:</strong> Puntúan los 2 drones del equipo en cada mapa
                  (máx. <strong>43 pts</strong>).
                </div>
              </div>
              <div className="pub-srl-item">
                <span className="pub-srl-bullet">▸</span>
                <div>
                  <strong>Sin empates en mapa:</strong> Cada dron recibe una posición cronometrada
                  única o DNF (0 pts).
                </div>
              </div>
              <div className="pub-srl-item">
                <span className="pub-srl-bullet">▸</span>
                <div>
                  <strong>Fase de desempate:</strong> En caso de empate en la primera posición general,
                  se disputará una fase de desempate (Tiebreaker).
                </div>
              </div>
            </div>
          </div>

          {/* 2. PROGRESO Y ROTACIONES DE PARTIDAS */}
          <div className="pub-side-card pub-side-tracker">
            <div className="pub-side-card-header">
              <div>
                <span className="pub-side-eyebrow">ESTRUCTURA DE PARTIDAS</span>
                <h3 className="pub-side-title">Progreso y Rotación</h3>
              </div>
              <span className="pub-side-chip">{completedCount}/4</span>
            </div>

            <div className="pub-side-matches-list">
              {[1, 2, 3, 4].map(num => {
                const m = matches.find(match => match.matchNumber === num);
                const isDone = m?.status === 'COMPLETED';
                const isLive = m?.status === 'LIVE';
                const rotationPilot = num <= 2 ? 'Piloto 1' : 'Piloto 2';
                const mapRange =
                  num === 1 ? '1-3' : num === 2 ? '4-6' : num === 3 ? '7-9' : '10-12';

                return (
                  <div
                    key={num}
                    className={`pub-side-match-item${isDone ? ' done' : ''}${isLive ? ' live' : ''}`}
                  >
                    <div className="pub-smi-left">
                      <span className="pub-smi-num">P{num}</span>
                      <div className="pub-smi-info">
                        <span className="pub-smi-maps">Mapas {mapRange}</span>
                        <span className="pub-smi-pilot">
                          Capitán + <strong>{rotationPilot}</strong>
                        </span>
                      </div>
                    </div>
                    <span className={`pub-smi-tag ${isLive ? 'live' : isDone ? 'done' : 'upcoming'}`}>
                      {isLive ? 'En vivo' : isDone ? 'Finalizada' : 'Pendiente'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. PREMIO OFICIAL */}
          <div className="pub-side-card pub-side-prize">
            <span className="pub-side-eyebrow">PREMIO AL CAMPEÓN</span>
            <div className="pub-side-prize-val">
              10.000 <small>Créditos R6</small>
            </div>
            <p className="pub-side-prize-desc">
              Bolsa oficial de créditos de Rainbow Six Siege para el equipo campeón al finalizar los
              12 mapas de competición.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function TwitchSvg() {
  return (
    <span
      dangerouslySetInnerHTML={{ __html: TWITCH_ICON_SVG }}
      style={{ display: 'inline-flex', width: 13, height: 13, verticalAlign: 'middle' }}
    />
  );
}

function AlertIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block' }}
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CaretIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        display: 'inline-block',
        transition: 'transform 0.2s ease',
        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
        color: 'var(--ink-tertiary)',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
