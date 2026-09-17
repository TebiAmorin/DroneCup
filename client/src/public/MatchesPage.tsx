import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import type { CompetitionState } from './useCompetition';
import { api, MatchDetail, MapDetail, TeamData, ParticipantData } from '../api';
import { getSocket } from '../socket';
import { SectionHead, StatusBadge, TeamDot, LoadingState } from './components';
import { getAvatarBySlug, getCreatorBySlug } from './assets';

export default function MatchesPage() {
  const { matches, teams, loading } = useOutletContext<CompetitionState>();
  const navigate = useNavigate();

  const [selectedFilter, setSelectedFilter] = useState<'all' | '1' | '2' | '3' | '4'>('all');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, MatchDetail>>({});
  const [mapDetails, setMapDetails] = useState<Record<string, MapDetail>>({});

  const initialExpandDone = useRef(false);

  const completedMatches = matches.filter(m => m.status === 'COMPLETED');
  const liveMatch = matches.find(m => m.status === 'LIVE');
  const nextMatch = liveMatch || matches.find(m => m.status === 'UPCOMING') || matches[0];

  // Auto-expand live match or first match ONLY once on initial mount
  useEffect(() => {
    if (matches.length > 0 && !initialExpandDone.current) {
      initialExpandDone.current = true;
      const target = liveMatch ? liveMatch.id : (completedMatches[0]?.id || matches[0]?.id);
      if (target) {
        setExpandedMatchId(target);
      }
    }
  }, [matches, liveMatch, completedMatches]);

  const fetchMatchDetail = useCallback(async (id: string) => {
    try {
      const d = await api.getMatch(id);
      setDetails(prev => ({ ...prev, [id]: d }));
      // Pre-fetch completed map details
      for (const mp of d.maps) {
        if (mp.status === 'COMPLETED') {
          api.getMap(mp.id).then(md => {
            setMapDetails(mPrev => ({ ...mPrev, [mp.id]: md }));
          }).catch(() => {});
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Pre-fetch details for live match, completed matches, or currently expanded match
  useEffect(() => {
    matches.forEach(m => {
      if (m.status === 'LIVE' || m.status === 'COMPLETED' || expandedMatchId === m.id) {
        fetchMatchDetail(m.id);
      }
    });
  }, [matches, expandedMatchId, fetchMatchDetail]);

  // Realtime updates
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => {
      matches.forEach(m => {
        if (expandedMatchId === m.id || m.status === 'LIVE') {
          fetchMatchDetail(m.id);
        }
      });
    };
    socket.on('map.completed', refresh);
    socket.on('map.started', refresh);
    socket.on('result.updated', refresh);
    socket.on('match.started', refresh);
    socket.on('match.completed', refresh);
    socket.on('connect', refresh);

    return () => {
      socket.off('map.completed', refresh);
      socket.off('map.started', refresh);
      socket.off('result.updated', refresh);
      socket.off('match.started', refresh);
      socket.off('match.completed', refresh);
      socket.off('connect', refresh);
    };
  }, [matches, expandedMatchId, fetchMatchDetail]);

  if (loading) return <LoadingState />;

  const toggleMatch = (id: string) => {
    setExpandedMatchId(prev => {
      const next = prev === id ? null : id;
      if (next) {
        fetchMatchDetail(next);
      }
      return next;
    });
  };

  const filteredMatches = matches.filter(m => {
    if (selectedFilter === 'all') return true;
    return m.matchNumber.toString() === selectedFilter;
  });

  const spotlightMatch = liveMatch || nextMatch;
  const spotlightDetail = spotlightMatch ? details[spotlightMatch.id] : null;
  const activeSpotlightMap = spotlightDetail?.maps.find(mp => mp.status === 'ACTIVE') || spotlightDetail?.maps[0];

  const chipText = liveMatch
    ? `EN DIRECTO · Partida ${liveMatch.matchNumber}`
    : `${completedMatches.length}/4 Partidas completadas`;

  return (
    <div className="pub-page pub-matches-page">
      <SectionHead
        title="Partidas del Torneo"
        chip={chipText}
        subtitle="Calendario oficial, rotación de pilotos comunitarios y resultados por mapa"
      />

      {/* ── SPOTLIGHT HERO: PARTIDA Y MAPA ACTIVO ── */}
      {spotlightMatch && (
        <div className={`pub-matches-spotlight ${liveMatch ? 'live' : 'upcoming'}`}>
          <div className="pub-ms-spot-header">
            <div className="pub-ms-spot-left">
              <span className="pub-ms-eyebrow">
                {liveMatch ? 'EN DIRECTO AHORA' : 'FOCO DE COMPETICIÓN'}
              </span>
              <h2 className="pub-ms-spot-title">
                Partida {spotlightMatch.matchNumber}
                {activeSpotlightMap && (
                  <span className="pub-ms-spot-map">
                    · Mapa {activeSpotlightMap.mapIndex} ({activeSpotlightMap.code})
                  </span>
                )}
              </h2>
              <div className="pub-ms-spot-rotation">
                <span className="pub-ms-rot-tag">
                  Rotación: Capitán + {spotlightMatch.matchNumber <= 2 ? 'Piloto 1' : 'Piloto 2'}
                </span>
                <span className="pub-ms-rot-scope">
                  {spotlightMatch.matchNumber <= 2 ? 'Mapas 1 a 6 en juego' : 'Mapas 7 a 12 en juego'}
                </span>
              </div>
            </div>

            <div className="pub-ms-spot-right">
              {liveMatch ? (
                <div className="pub-ms-live-badge">
                  <span className="pub-live-dot" /> EN CURSO
                </div>
              ) : (
                <StatusBadge status={spotlightMatch.status} />
              )}
              <Link to="/streams" className="pub-ms-stream-link">
                Ver Streams en Vivo →
              </Link>
            </div>
          </div>

          {/* 5 DUPLAS ACTIVAS EN PISTA */}
          <div className="pub-ms-duos-section">
            <span className="pub-ms-duos-label">
              Duplas en Pista · 10 Drones compitiendo por mapa
            </span>
            <div className="pub-ms-duos-grid">
              {teams.map(t => {
                const creatorData = getCreatorBySlug(t.slug);
                const teamColor = t.color || creatorData?.color || '#3b82f6';
                const avatar = getAvatarBySlug(t.slug);
                const isP1 = spotlightMatch.matchNumber <= 2;
                const activePilot = t.participants?.find(p => p.type === (isP1 ? 'PLAYER_1' : 'PLAYER_2'));
                const creator = t.participants?.find(p => p.type === 'CREATOR');

                return (
                  <div
                    key={t.id}
                    className="pub-ms-duo-card"
                    style={{ borderLeft: `3px solid ${teamColor}` }}
                    onClick={() => navigate(`/teams/${t.slug}`)}
                  >
                    <div className="pub-ms-duo-avatar-wrap">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={t.name}
                          className="pub-ms-duo-avatar"
                          style={{ borderColor: teamColor }}
                        />
                      ) : (
                        <TeamDot color={teamColor} />
                      )}
                    </div>
                    <div className="pub-ms-duo-info">
                      <span className="pub-ms-duo-team">{t.name}</span>
                      <div className="pub-ms-duo-members">
                        <span className="pub-duo-cap">{creator?.name ?? creatorData?.name ?? t.name}</span>
                        <span className="pub-duo-sep">+</span>
                        <span className="pub-duo-pilot">{activePilot?.name ?? (isP1 ? 'Piloto 1' : 'Piloto 2')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── BARRA DE FILTRO POR PARTIDAS ── */}
      <div className="pub-matches-tabs-bar">
        <div className="pub-match-filter-tabs" role="tablist" aria-label="Filtrar por partida">
          <button
            type="button"
            className={`pub-mf-tab${selectedFilter === 'all' ? ' active' : ''}`}
            onClick={() => setSelectedFilter('all')}
            role="tab"
            aria-selected={selectedFilter === 'all'}
          >
            <span>Todas (4)</span>
          </button>
          {[1, 2, 3, 4].map(num => {
            const m = matches.find(match => match.matchNumber === num);
            const isLive = m?.status === 'LIVE';

            return (
              <button
                key={num}
                type="button"
                className={`pub-mf-tab${selectedFilter === num.toString() ? ' active' : ''}`}
                onClick={() => {
                  setSelectedFilter(num.toString() as any);
                  if (m) {
                    setExpandedMatchId(m.id);
                    fetchMatchDetail(m.id);
                  }
                }}
                role="tab"
                aria-selected={selectedFilter === num.toString()}
              >
                <span>Partida {num}</span>
                {isLive && <span className="pub-live-dot" style={{ marginLeft: 6 }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── LISTADO DE PARTIDAS ── */}
      <div className="pub-matches-list">
        {filteredMatches.map(m => (
          <MatchCardRow
            key={m.id}
            match={m}
            isOpen={expandedMatchId === m.id}
            detail={details[m.id]}
            mapDetails={mapDetails}
            teams={teams}
            onToggle={() => toggleMatch(m.id)}
          />
        ))}
      </div>
    </div>
  );
}

function MatchCardRow({
  match,
  isOpen,
  detail,
  mapDetails,
  teams,
  onToggle,
}: {
  match: { id: string; matchNumber: number; phase: string; status: string };
  isOpen: boolean;
  detail?: MatchDetail;
  mapDetails: Record<string, MapDetail>;
  teams: TeamData[];
  onToggle: () => void;
}) {
  const mapsCompleted = detail?.maps.filter(mp => mp.status === 'COMPLETED').length ?? 0;
  const totalMaps = detail?.maps.length ?? 3;
  const isP1 = match.matchNumber <= 2;
  const mapRange = match.matchNumber === 1 ? '1 a 3' : match.matchNumber === 2 ? '4 a 6' : match.matchNumber === 3 ? '7 a 9' : '10 a 12';

  // Determine initial selected map tab: active map if exists, otherwise first map
  const defaultMapId = useMemo(() => {
    if (!detail || !detail.maps || detail.maps.length === 0) return 'all';
    const active = detail.maps.find(mp => mp.status === 'ACTIVE');
    if (active) return active.id;
    return detail.maps[0]?.id || 'all';
  }, [detail]);

  const [selectedMapId, setSelectedMapId] = useState<string | 'all' | null>(null);

  const activeTab = selectedMapId ?? defaultMapId;

  const visibleMaps = useMemo(() => {
    if (!detail || !detail.maps) return [];
    if (activeTab === 'all') return detail.maps;
    const filtered = detail.maps.filter(mp => mp.id === activeTab);
    return filtered.length > 0 ? filtered : detail.maps;
  }, [detail, activeTab]);

  return (
    <div className={`pub-match-card ${match.status.toLowerCase()}${isOpen ? ' open' : ''}`}>
      {/* Cabecera del Acordeón */}
      <div className="pub-match-header" onClick={onToggle}>
        <div className="pub-match-num-badge">
          P{match.matchNumber}
        </div>

        <div className="pub-match-info">
          <div className="pub-match-title-row">
            <span className="pub-match-title">Partida {match.matchNumber}</span>
            <span className="pub-match-phase-tag">{match.phase === 'MAIN' ? 'Fase Principal' : 'Desempate'}</span>
          </div>
          <div className="pub-match-sub">
            Mapas {mapRange} · Alineación: <strong>Capitán + {isP1 ? 'Piloto 1' : 'Piloto 2'}</strong>
          </div>
        </div>

        {/* Pips de progreso de mapas */}
        <div className="pub-match-pips" title={`${mapsCompleted}/${totalMaps} mapas completados`}>
          {Array.from({ length: totalMaps }).map((_, i) => {
            const mp = detail?.maps[i];
            const isDonePip = i < mapsCompleted;
            const isActivePip = mp?.status === 'ACTIVE';

            return (
              <span
                key={i}
                className={`pub-pip${isDonePip ? ' done' : ''}${isActivePip ? ' active' : ''}`}
              />
            );
          })}
          <span className="pub-pip-counter">{mapsCompleted}/{totalMaps}</span>
        </div>

        <StatusBadge status={match.status} />

        <div className="pub-match-expand-btn">
          <CaretIcon isOpen={isOpen} />
        </div>
      </div>

      {/* Cuerpo desplegable de la partida */}
      {isOpen && (
        <div className="pub-match-body open">
          {detail ? (
            <>
              {/* PAREJAS PARTICIPANTES DE LA PARTIDA */}
              <div className="pub-match-pairs-wrap">
                <span className="pub-m-section-label">Alineación Oficial de la Partida</span>
                <div className="pub-match-pairs-grid">
                  {teams.map(t => {
                    const creatorData = getCreatorBySlug(t.slug);
                    const teamColor = t.color || creatorData?.color || '#3b82f6';
                    const p1 = t.participants?.find(p => p.type === 'PLAYER_1');
                    const p2 = t.participants?.find(p => p.type === 'PLAYER_2');
                    const activePilot = isP1 ? p1 : p2;
                    const creator = t.participants?.find(p => p.type === 'CREATOR');

                    return (
                      <div key={t.id} className="pub-m-pair-item" style={{ borderLeft: `3px solid ${teamColor}` }}>
                        <span className="pub-m-pair-team">{t.name}</span>
                        <div className="pub-m-pair-names">
                          <span>{creator?.name ?? creatorData?.name ?? t.name}</span>
                          <span className="pub-m-pair-sep">/</span>
                          <span className="pub-m-pair-p">{activePilot?.name ?? (isP1 ? 'Piloto 1' : 'Piloto 2')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* MAPAS DE LA PARTIDA Y SELECTOR DE MAPA */}
              <div className="pub-maps-section">
                <div className="pub-maps-section-header">
                  <div className="pub-msh-title-box">
                    <span className="pub-m-section-label">Mapas de la Partida</span>
                    <span className="pub-msh-desc">Selecciona un mapa para ver sus resultados o consulta todos</span>
                  </div>

                  <div className="pub-match-map-tabs" role="tablist" aria-label="Filtro de mapas de la partida">
                    {detail.maps.map(mp => {
                      const isSelected = activeTab === mp.id;
                      const isLive = mp.status === 'ACTIVE';
                      const isDone = mp.status === 'COMPLETED';
                      const globalNum = (match.matchNumber - 1) * 3 + mp.mapIndex;

                      return (
                        <button
                          key={mp.id}
                          type="button"
                          className={`pub-mm-tab${isSelected ? ' active' : ''}${isLive ? ' tab-live' : ''}`}
                          onClick={() => setSelectedMapId(mp.id)}
                          role="tab"
                          aria-selected={isSelected}
                        >
                          <span className="pub-mm-num">M{globalNum}</span>
                          <span className="pub-mm-label">Mapa {mp.mapIndex}</span>
                          <span className="pub-mm-code">{mp.code}</span>
                          <span className={`pub-mm-badge ${isLive ? 'live' : isDone ? 'done' : 'pending'}`}>
                            {isLive ? 'En vivo' : isDone ? 'Fin' : 'Pendiente'}
                          </span>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      className={`pub-mm-tab pub-mm-tab-all${activeTab === 'all' ? ' active' : ''}`}
                      onClick={() => setSelectedMapId('all')}
                      role="tab"
                      aria-selected={activeTab === 'all'}
                    >
                      <span className="pub-mm-label">Todos ({detail.maps.length})</span>
                    </button>
                  </div>
                </div>

                {/* MAPAS VISIBLES */}
                <div className="pub-maps-list">
                  {visibleMaps.map(mp => (
                    <MapDetailCard
                      key={mp.id}
                      mapData={mp}
                      mapDetail={mapDetails[mp.id]}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="pub-loading-inline">Cargando detalles de la partida...</div>
          )}
        </div>
      )}
    </div>
  );
}

function MapDetailCard({
  mapData,
  mapDetail,
}: {
  mapData: { id: string; mapIndex: number; code: string; status: string };
  mapDetail?: MapDetail;
}) {
  const isCompleted = mapData.status === 'COMPLETED';
  const isActive = mapData.status === 'ACTIVE';

  // Calculate team scores for this map
  const teamScores = useMemo(() => {
    if (!mapDetail || !mapDetail.results || mapDetail.results.length === 0) return [];

    const mapPointsByTeam: Record<string, { teamName: string; teamSlug?: string; teamColor?: string; totalPoints: number; positions: (number | string)[] }> = {};

    mapDetail.results.forEach(r => {
      const tName = r.teamName;
      if (!mapPointsByTeam[tName]) {
        mapPointsByTeam[tName] = {
          teamName: tName,
          teamSlug: r.teamSlug,
          teamColor: r.teamColor || undefined,
          totalPoints: 0,
          positions: [],
        };
      }
      mapPointsByTeam[tName].totalPoints += r.points;
      mapPointsByTeam[tName].positions.push(r.status === 'DNF' ? 'DNF' : `${r.position}.º`);
    });

    return Object.values(mapPointsByTeam).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [mapDetail]);

  return (
    <div className={`pub-map-card ${mapData.status.toLowerCase()}`}>
      <div className="pub-map-card-head">
        <div className="pub-map-head-left">
          <span className="pub-map-tag">MAPA {mapData.mapIndex}</span>
          <span className="pub-map-code-title">{mapData.code}</span>
        </div>
        <StatusBadge status={mapData.status} />
      </div>

      {isCompleted && mapDetail && mapDetail.results.length > 0 && (
        <div className="pub-map-card-content">
          {/* RESUMEN DE PUNTOS DEL MAPA POR EQUIPO */}
          <div className="pub-map-team-summary">
            <span className="pub-mts-title">Puntos de Equipo en este Mapa (Suma de los 2 Drones)</span>
            <div className="pub-mts-grid">
              {teamScores.map(ts => {
                const creatorData = getCreatorBySlug(ts.teamName.toLowerCase());
                const color = ts.teamColor || creatorData?.color || '#3b82f6';

                return (
                  <div key={ts.teamName} className="pub-mts-card" style={{ borderLeft: `3px solid ${color}` }}>
                    <div className="pub-mts-team">{ts.teamName}</div>
                    <div className="pub-mts-val">
                      <strong>+{ts.totalPoints}</strong> <small>pts</small>
                    </div>
                    <div className="pub-mts-pos">
                      {ts.positions.join(' & ')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TABLA DETALLADA DE POSICIONES 1 A 10 */}
          <div className="pub-map-results-wrap">
            <span className="pub-mts-title">Llegada Cronometrada (10 Pilotos)</span>
            <div className="pub-map-table-grid">
              {mapDetail.results.map(r => {
                const isPodium1 = r.position === 1;
                const isPodium2 = r.position === 2;
                const isPodium3 = r.position === 3;
                const isDNF = r.status === 'DNF';
                const creatorData = getCreatorBySlug(r.teamName.toLowerCase());
                const color = r.teamColor || creatorData?.color || '#3b82f6';
                const isCreator = r.participantType === 'CREATOR';

                return (
                  <div
                    key={r.participantId}
                    className={`pub-map-res-row${isPodium1 ? ' podium-1' : isPodium2 ? ' podium-2' : isPodium3 ? ' podium-3' : ''}`}
                    style={{ borderLeft: `3px solid ${color}` }}
                  >
                    <div className={`pub-map-res-pos ${isPodium1 ? 'pos-gold' : isPodium2 ? 'pos-silver' : isPodium3 ? 'pos-bronze' : 'pos-default'}`}>
                      {isDNF ? 'DNF' : `${r.position}.º`}
                    </div>

                    <div className="pub-map-res-pilot">
                      <span className="pub-mrp-name">{r.participantName}</span>
                      <span className="pub-mrp-role">{isCreator ? 'Capitán' : 'Piloto'}</span>
                    </div>

                    <div className="pub-map-res-team">
                      <TeamDot color={color} />
                      <span>{r.teamName}</span>
                    </div>

                    <div className="pub-map-res-pts">
                      {isDNF ? (
                        <span className="pub-map-dnf">0 pts</span>
                      ) : (
                        <span className="pub-map-pts-val"><strong>{r.points}</strong> pts</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isActive && (
        <div className="pub-map-active-state">
          <span className="pub-live-dot" />
          <span>Mapa en curso en este momento. Los resultados se confirmarán y sincronizarán automáticamente al finalizar la carrera.</span>
        </div>
      )}

      {!isCompleted && !isActive && (
        <div className="pub-map-pending-state">
          <span>Mapa pendiente de inicio. Se disputará según el orden de la partida.</span>
        </div>
      )}
    </div>
  );
}

function CaretIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        display: 'block',
        transition: 'transform 0.2s ease',
        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
        color: 'var(--ink-tertiary)',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

