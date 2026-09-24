import { useParams, useNavigate, useOutletContext, Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import type { CompetitionState } from './useCompetition';
import { api, ParticipantData, MapDetail } from '../api';
import { getSocket } from '../socket';
import { SectionHead, StatusBadge, LoadingState, EmptyState, MapResultTable, TeamDot } from './components';
import { getAvatarBySlug, getCreatorBySlug, getTeamColor, getParticipantDisplay } from './assets';

interface TeamResults {
  map: MapDetail;
  matchNumber: number;
}

function TwitchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}

function TrophyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function ArrowLeftIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function ChevronIcon({ isOpen, size = 13 }: { isOpen: boolean; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        display: 'inline-block',
        transition: 'transform 0.2s ease',
        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function TeamDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { teams, rankings, individuals, matches, loading: compLoading, hasResults } = useOutletContext<CompetitionState>();
  const navigate = useNavigate();

  const team = teams.find(t => t.slug === slug);
  const rank = rankings.find(r => r.teamId === team?.id);
  const avatar = slug ? getAvatarBySlug(slug) : undefined;
  const creatorData = slug ? getCreatorBySlug(slug) : undefined;
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [teamResults, setTeamResults] = useState<TeamResults[]>([]);
  const [loading, setLoading] = useState(true);

  // Control para desplegar/ocultar clasificaciones completas de carrera
  const [expandedMapTable, setExpandedMapTable] = useState<Record<string, boolean>>({});

  const fetchTeamData = async () => {
    if (!team) return;
    try {
      const teamDetail = await api.getTeam(team.id);
      setParticipants(teamDetail.participants || []);

      const activeMatches = matches.filter(m => m.status === 'COMPLETED' || m.status === 'LIVE');
      const results: TeamResults[] = [];
      for (const m of activeMatches) {
        const detail = await api.getMatch(m.id);
        for (const mp of detail.maps) {
          if (mp.status === 'COMPLETED') {
            const mapDetail = await api.getMap(mp.id);
            const hasTeamResult = mapDetail.results.some(r =>
              (teamDetail.participants || []).some(p => p.id === r.participantId)
            );
            if (hasTeamResult) {
              results.push({ map: mapDetail, matchNumber: detail.matchNumber });
            }
          }
        }
      }
      results.sort((a, b) => {
        if (a.matchNumber !== b.matchNumber) {
          return a.matchNumber - b.matchNumber;
        }
        return a.map.mapIndex - b.map.mapIndex;
      });
      setTeamResults(results);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!compLoading && team) fetchTeamData();
  }, [team, compLoading, matches]);

  useEffect(() => {
    const socket = getSocket();
    const refresh = () => { if (team) fetchTeamData(); };
    socket.on('map.completed', refresh);
    socket.on('result.updated', refresh);
    socket.on('ranking.updated', refresh);
    socket.on('connect', refresh);
    return () => {
      socket.off('map.completed', refresh);
      socket.off('result.updated', refresh);
      socket.off('ranking.updated', refresh);
      socket.off('connect', refresh);
    };
  }, [team]);

  const creator = participants.find(p => p.type === 'CREATOR');
  const player1 = participants.find(p => p.type === 'PLAYER_1');
  const player2 = participants.find(p => p.type === 'PLAYER_2');
  const teamColor = team ? getTeamColor(team) : (slug ? getTeamColor({ slug }) : 'var(--accent)');

  const creatorDisp = getParticipantDisplay(creator || (creatorData ? { name: creatorData.name } : (team ? { name: team.name } : null)));
  const p1Disp = getParticipantDisplay(player1);
  const p2Disp = getParticipantDisplay(player2);
  const hasValidRank = Boolean(hasResults && typeof rank?.rank === 'number' && rank.rank > 0);

  // Desglose de puntos individuales desde useCompetition
  const creatorIndiv = individuals?.find(i => i.participantId === creator?.id);
  const p1Indiv = individuals?.find(i => i.participantId === player1?.id);
  const p2Indiv = individuals?.find(i => i.participantId === player2?.id);

  // Estadísticas globales de mapa para este equipo
  const teamParticipantIds = participants.map(p => p.id);

  const victoriesCount = teamResults.filter(({ map }) =>
    map.results.some(r => teamParticipantIds.includes(r.participantId) && r.position === 1)
  ).length;

  const podiumsCount = teamResults.filter(({ map }) =>
    map.results.some(r => teamParticipantIds.includes(r.participantId) && r.position && r.position <= 3)
  ).length;

  const avgPointsPerMap = teamResults.length > 0
    ? ((rank?.totalPoints ?? 0) / teamResults.length).toFixed(1)
    : '0';

  const toggleFullTable = (mapId: string) => {
    setExpandedMapTable(prev => ({ ...prev, [mapId]: !prev[mapId] }));
  };

  interface MatchGroup {
    matchNumber: number;
    totalPoints: number;
    maps: Array<{
      map: MapDetail;
      teamMapPoints: number;
      hasWin: boolean;
      hasPodium: boolean;
      myParticipants: Array<MapDetail['results'][0]>;
    }>;
  }

  const matchGroups: MatchGroup[] = useMemo(() => {
    const uniqueMatchNums = Array.from(new Set(teamResults.map(r => r.matchNumber))).sort((a, b) => a - b);

    return uniqueMatchNums.map(mNum => {
      const matchEntries = teamResults
        .filter(r => r.matchNumber === mNum)
        .sort((a, b) => a.map.mapIndex - b.map.mapIndex);

      let totalPoints = 0;
      const maps = matchEntries.map(({ map }) => {
        const myParticipants = map.results.filter(r => teamParticipantIds.includes(r.participantId));
        const teamMapPoints = myParticipants.reduce((sum, r) => sum + r.points, 0);
        totalPoints += teamMapPoints;
        const hasWin = myParticipants.some(r => r.position === 1);
        const hasPodium = myParticipants.some(r => r.position !== null && r.position <= 3);

        return {
          map,
          teamMapPoints,
          hasWin,
          hasPodium,
          myParticipants,
        };
      });

      return {
        matchNumber: mNum,
        totalPoints,
        maps,
      };
    });
  }, [teamResults, teamParticipantIds]);

  if (compLoading || loading) return <LoadingState />;
  if (!team) return <EmptyState message="Equipo no encontrado." />;

  return (
    <div className="pub-page pub-team-detail-page">
      {/* ── BARRA SUPERIOR: NAVEGACIÓN Y SELECTOR RÁPIDO ENTRE EQUIPOS ── */}
      <div className="pub-td-top-bar">
        <button onClick={() => navigate('/teams')} className="pub-td-back-btn">
          <ArrowLeftIcon />
          <span>Todos los Equipos</span>
        </button>

        <div className="pub-team-switcher" role="tablist" aria-label="Cambio rápido de equipo">
          {teams.map(t => {
            const isCurrent = t.slug === slug;
            const cData = getCreatorBySlug(t.slug);
            const cColor = getTeamColor(t);
            const cAvatar = getAvatarBySlug(t.slug);

            return (
              <button
                key={t.id}
                type="button"
                className={`pub-ts-tab${isCurrent ? ' active' : ''}`}
                style={{ '--t-color': cColor } as any}
                onClick={() => navigate(`/teams/${t.slug}`)}
                role="tab"
                aria-selected={isCurrent}
              >
                {cAvatar ? (
                  <img src={cAvatar} alt={t.name} className="pub-ts-avatar" />
                ) : (
                  <TeamDot color={cColor} />
                )}
                <span className="pub-ts-name">{t.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── HÉROE DE IDENTIDAD DEL EQUIPO ── */}
      <div className="pub-team-profile-hero" style={{ '--team-color': teamColor } as any}>
        <div className="pub-tph-top-stripe" style={{ background: teamColor }} />

        <div className="pub-tph-main">
          <div className="pub-tph-identity">
            <div className="pub-tph-avatar-wrap">
              {avatar ? (
                <img
                  className="pub-tph-avatar"
                  src={avatar}
                  alt={team.name}
                  style={{ borderColor: teamColor }}
                />
              ) : (
                <div className="pub-tph-avatar-placeholder" style={{ borderColor: teamColor, color: teamColor }}>
                  {team.name.charAt(0)}
                </div>
              )}
            </div>

            <div className="pub-tph-meta">
              <span className="pub-tph-eyebrow">Escuadra Oficial Drone Cup</span>
              <h1 className="pub-tph-title">{team.name}</h1>
              <div className="pub-tph-captain-tag">
                <span>Capitán: <strong>{creator?.name ?? creatorData?.name ?? team.name}</strong></span>
              </div>

              <div className="pub-tph-actions">
                {creatorData && (
                  <a
                    className="pub-tph-twitch-btn"
                    href={`https://www.twitch.tv/${creatorData.twitch}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <TwitchIcon size={14} />
                    <span>twitch.tv/{creatorData.twitch}</span>
                  </a>
                )}
                <Link to="/streams" className="pub-tph-streams-btn">
                  Ver Streams en Vivo →
                </Link>
              </div>
            </div>
          </div>

          {/* 5 Métricas clave de competición */}
          <div className="pub-tph-stats-grid">
            <div className="pub-tph-stat-card">
              <span className="pub-tph-stat-val highlight" style={{ color: teamColor }}>
                {hasResults ? (rank?.totalPoints ?? 0) : '—'}
              </span>
              <span className="pub-tph-stat-lbl">Puntos Totales</span>
            </div>

            <div className="pub-tph-stat-card">
              <span className="pub-tph-stat-val">{hasValidRank ? `#${rank?.rank}` : '—'}</span>
              <span className="pub-tph-stat-lbl">Posición General</span>
            </div>

            <div className="pub-tph-stat-card">
              <span className="pub-tph-stat-val">
                {victoriesCount > 0 ? (
                  <span className="pub-val-gold"><TrophyIcon size={16} /> {victoriesCount}</span>
                ) : (
                  '0'
                )}
              </span>
              <span className="pub-tph-stat-lbl">Victorias (1.º)</span>
            </div>

            <div className="pub-tph-stat-card">
              <span className="pub-tph-stat-val">{podiumsCount}</span>
              <span className="pub-tph-stat-lbl">Podios (Top 3)</span>
            </div>

            <div className="pub-tph-stat-card">
              <span className="pub-tph-stat-val">{avgPointsPerMap}</span>
              <span className="pub-tph-stat-lbl">Media Pts / Mapa</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── ALINEACIÓN OFICIAL & TELEMETRÍA INDIVIDUAL ── */}
      <div className="pub-team-section-wrap">
        <SectionHead
          title="Alineación Oficial de la Comunidad"
          chip="3 Pilotos Oficiales"
          subtitle="Rotación oficial por tramo de partidas y puntos individuales aportados"
        />

        <div className="pub-team-roster-grid">
          {/* Tarjeta Capitán */}
          <div className="pub-trc-member-card" style={{ borderLeft: `3px solid ${teamColor}` }}>
            <div className="pub-trm-head">
              <span className="pub-trm-role cap">CAPITÁN</span>
              {hasResults && creatorDisp.isAvailable && creatorIndiv?.rank ? (
                <span className="pub-trm-rank">#{creatorIndiv.rank} Individual</span>
              ) : (
                <span className="pub-trm-rank tbd">—</span>
              )}
            </div>
            <h3 className={`pub-trm-name ${!creatorDisp.isAvailable ? 'pub-trm-tbd' : ''}`}>
              {creatorDisp.name}
            </h3>
            <div className="pub-trm-schedule">
              Disputa las 4 Partidas Oficiales (12 Mapas)
            </div>
            <div className="pub-trm-stats">
              <div className="pub-trm-stat">
                <span className="pub-trm-stat-v" style={{ color: creatorDisp.isAvailable ? teamColor : 'var(--ink-tertiary)' }}>
                  {hasResults && creatorDisp.isAvailable ? (creatorIndiv?.totalPoints ?? 0) : '—'}
                </span>
                <span className="pub-trm-stat-l">Puntos Aportados</span>
              </div>
              {creatorData ? (
                <a
                  href={`https://www.twitch.tv/${creatorData.twitch}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pub-trm-twitch"
                >
                  <TwitchIcon size={12} /> Directo
                </a>
              ) : (
                <span className="pub-trm-status-badge">Confirmado</span>
              )}
            </div>
          </div>

          {/* Tarjeta Piloto 1 */}
          <div className="pub-trc-member-card" style={{ borderLeft: `3px solid ${teamColor}` }}>
            <div className="pub-trm-head">
              <span className="pub-trm-role p1">PLAYER 1</span>
              {hasResults && p1Disp.isAvailable && p1Indiv?.rank ? (
                <span className="pub-trm-rank">#{p1Indiv.rank} Individual</span>
              ) : (
                <span className="pub-trm-rank tbd">—</span>
              )}
            </div>
            <h3 className={`pub-trm-name ${!p1Disp.isAvailable ? 'pub-trm-tbd' : ''}`}>
              {p1Disp.name}
            </h3>
            <div className="pub-trm-schedule">
              Partidas 1 y 2 · Mapas 1 a 6 de competición
            </div>
            <div className="pub-trm-stats">
              <div className="pub-trm-stat">
                <span className="pub-trm-stat-v" style={{ color: p1Disp.isAvailable ? teamColor : 'var(--ink-tertiary)' }}>
                  {hasResults && p1Disp.isAvailable ? (p1Indiv?.totalPoints ?? 0) : '—'}
                </span>
                <span className="pub-trm-stat-l">Puntos Aportados</span>
              </div>
              <span className={`pub-trm-status-badge ${!p1Disp.isAvailable ? 'tbd' : ''}`}>
                {p1Disp.isAvailable ? 'Rotación Inicial' : 'Por Determinar'}
              </span>
            </div>
          </div>

          {/* Tarjeta Piloto 2 */}
          <div className="pub-trc-member-card" style={{ borderLeft: `3px solid ${teamColor}` }}>
            <div className="pub-trm-head">
              <span className="pub-trm-role p2">PLAYER 2</span>
              {hasResults && p2Disp.isAvailable && p2Indiv?.rank ? (
                <span className="pub-trm-rank">#{p2Indiv.rank} Individual</span>
              ) : (
                <span className="pub-trm-rank tbd">—</span>
              )}
            </div>
            <h3 className={`pub-trm-name ${!p2Disp.isAvailable ? 'pub-trm-tbd' : ''}`}>
              {p2Disp.name}
            </h3>
            <div className="pub-trm-schedule">
              Partidas 3 y 4 · Mapas 7 a 12 de competición
            </div>
            <div className="pub-trm-stats">
              <div className="pub-trm-stat">
                <span className="pub-trm-stat-v" style={{ color: p2Disp.isAvailable ? teamColor : 'var(--ink-tertiary)' }}>
                  {hasResults && p2Disp.isAvailable ? (p2Indiv?.totalPoints ?? 0) : '—'}
                </span>
                <span className="pub-trm-stat-l">Puntos Aportados</span>
              </div>
              <span className={`pub-trm-status-badge ${!p2Disp.isAvailable ? 'tbd' : ''}`}>
                {p2Disp.isAvailable ? 'Rotación Final' : 'Por Determinar'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RENDIMIENTO POR PARTIDA Y MAPA ── */}
      <div className="pub-team-section-wrap">
        <SectionHead
          title="Rendimiento por Partida y Mapa"
          chip={`${teamResults.length} Mapas Disputados`}
          subtitle="Resultados cronológicos de los pilotos del equipo en cada carrera oficial"
        />

        {matchGroups.length === 0 ? (
          <EmptyState message="Aún no hay resultados registrados para este equipo en el torneo." />
        ) : (
          <div className="pub-td-matches-container">
            {matchGroups.map(group => (
              <div key={group.matchNumber} className="pub-td-match-group">
                {/* ── NIVEL 1: CABECERA DE PARTIDA (PUNTOS TOTALES DE LA PARTIDA) ── */}
                <div className="pub-td-mg-header">
                  <div className="pub-td-mg-title-wrap">
                    <span className="pub-td-mg-badge">PARTIDA {group.matchNumber}</span>
                    <span className="pub-td-mg-sub">
                      {group.maps.length} {group.maps.length === 1 ? 'mapa disputado' : 'mapas disputados'}
                    </span>
                  </div>
                  <div className="pub-td-mg-points">
                    <span className="pub-td-mg-pts-val">+{group.totalPoints}</span>
                    <span className="pub-td-mg-pts-lbl">PTS PARTIDA {group.matchNumber}</span>
                  </div>
                </div>

                {/* ── NIVEL 2: MAPAS DE LA PARTIDA ── */}
                <div className="pub-td-mg-maps-list">
                  {group.maps.map(({ map, teamMapPoints, hasWin, hasPodium, myParticipants }) => {
                    const isFullTableOpen = !!expandedMapTable[map.id];

                    return (
                      <div
                        key={map.id}
                        className={`pub-team-race-card${hasWin ? ' victory' : hasPodium ? ' podium' : ''}`}
                        style={{ borderLeft: `4px solid ${teamColor}` }}
                      >
                        {/* Cabecera del Mapa */}
                        <div className="pub-tr-head">
                          <div className="pub-tr-title-wrap">
                            <span className="pub-tr-map-num">Mapa {map.mapIndex}</span>
                            <span className="pub-tr-code">{map.code}</span>
                          </div>

                          <div className="pub-tr-badges">
                            {hasWin && (
                              <span className="pub-tr-badge victory">
                                <TrophyIcon size={12} /> Victoria de Mapa
                              </span>
                            )}
                            {hasPodium && !hasWin && (
                              <span className="pub-tr-badge podium">
                                Podio de Carrera
                              </span>
                            )}
                            <div className="pub-tr-total-points">
                              <strong>+{teamMapPoints}</strong> <small>pts equipo</small>
                            </div>
                          </div>
                        </div>

                        {/* Participantes de este equipo en este mapa */}
                        <div className="pub-tr-drones-grid">
                          {myParticipants.map(dron => {
                            const isGold = dron.position === 1;
                            const isSilver = dron.position === 2;
                            const isBronze = dron.position === 3;
                            const isDNF = dron.status === 'DNF';
                            const isCreator = dron.participantType === 'CREATOR';
                            const roleLabel = isCreator
                              ? 'Capitán'
                              : group.matchNumber <= 2
                              ? 'Piloto 1'
                              : 'Piloto 2';

                            return (
                              <div key={dron.participantId} className="pub-tr-drone-item">
                                <div className={`pub-tr-drone-pos ${isGold ? 'gold' : isSilver ? 'silver' : isBronze ? 'bronze' : 'default'}`}>
                                  {isDNF ? 'DNF' : `${dron.position}.º`}
                                </div>
                                <div className="pub-tr-drone-info">
                                  <span className="pub-tr-drone-name">{dron.participantName}</span>
                                  <span className="pub-tr-drone-role">{roleLabel}</span>
                                </div>
                                <div className="pub-tr-drone-pts">
                                  {isDNF ? (
                                    <span className="pub-tr-dnf">0 pts</span>
                                  ) : (
                                    <span><strong>+{dron.points}</strong> pts</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Desplegable de la tabla completa de llegada general */}
                        <div className="pub-tr-full-table-toggle">
                          <button
                            type="button"
                            className="pub-tr-toggle-btn"
                            onClick={() => toggleFullTable(map.id)}
                          >
                            <span>{isFullTableOpen ? 'Ocultar llegada general' : 'Ver llegada general (10 pilotos)'}</span>
                            <ChevronIcon isOpen={isFullTableOpen} />
                          </button>

                          {isFullTableOpen && (
                            <div className="pub-tr-expanded-table">
                              <MapResultTable results={map.results} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

