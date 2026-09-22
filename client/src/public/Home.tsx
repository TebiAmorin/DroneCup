import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import type { CompetitionState } from './useCompetition';
import { useMatchDetail } from './useCompetition';
import {
  ASSETS,
  CREATORS,
  SCORING_TABLE,
  type CreatorSlug,
  getAvatarBySlug,
  getCreatorBySlug,
  getTeamColor,
} from './assets';
import { StatusBadge, TeamDot, RankingTable, LoadingState } from './components';
import { trackEvent } from '../analytics';

const CREATOR_ENTRIES = Object.entries(CREATORS) as [CreatorSlug, typeof CREATORS[CreatorSlug]][];

export default function Home() {
  const { matches, rankings, teams, hasResults, loading } = useOutletContext<CompetitionState>();
  const navigate = useNavigate();
  const liveMatch = matches.find(m => m.status === 'LIVE');
  const { match: liveDetail } = useMatchDetail(liveMatch?.id ?? null);
  const isLive = !!liveMatch;
  const completedMatches = matches.filter(m => m.status === 'COMPLETED');
  const totalMatches = matches.length || 4;
  const completedCount = completedMatches.length;

  const leader = hasResults && rankings.length > 0 ? rankings[0] : null;
  const leaderColor = leader ? getTeamColor(leader) : undefined;
  const activeMap = liveDetail?.maps.find(mp => mp.status === 'ACTIVE') || liveDetail?.maps[0];

  if (loading) return <LoadingState />;

  return (
    <div className="pub-home">
      {/* ── UNIFIED HERO DOCK: KEY ART + 4 IMPACT STATS ── */}
      <section className="pub-hero-dock">
        <div className="pub-hero-media">
          <img className="pub-hero-img" src={ASSETS.heroImage} alt="Wasteland Drone Cup" />
          {isLive && (
            <div className="pub-hero-live-badge">
              <span className="pub-live-dot" /> EN DIRECTO AHORA
            </div>
          )}
        </div>

        <div className="pub-impact-stats">
          <div className="pub-stat-card">
            <div className="pub-stat-num">
              {completedCount}
              <span className="pub-stat-denom">/{totalMatches}</span>
            </div>
            <div className="pub-stat-label">
              PARTIDAS
              <span>
                {isLive
                  ? `En curso: Partida ${liveMatch.matchNumber}`
                  : completedCount === totalMatches
                  ? 'Torneo completado'
                  : `${completedCount} completadas`}
              </span>
            </div>
          </div>
          <div className="pub-stat-card">
            <div
              className="pub-stat-num pub-stat-leader-val"
              style={leaderColor ? { color: leaderColor } : undefined}
            >
              {leader ? leader.teamName : '—'}
            </div>
            <div className="pub-stat-label">
              LÍDER
              <span>
                {leader ? `${leader.totalPoints} PTS · Líder del torneo` : 'Por disputar'}
              </span>
            </div>
          </div>
          <div className="pub-stat-card">
            <div className="pub-stat-num">15</div>
            <div className="pub-stat-label">
              PILOTOS
              <span>5 Escuadras · 10 Comunitarios</span>
            </div>
          </div>
          <div className="pub-stat-card highlight">
            <div className="pub-stat-num">+10.000</div>
            <div className="pub-stat-label">
              Credits
              <span>Premio equipo campeón</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── LIVE SHOWCASE EN CURSO (SI APLICA) ── */}
      {isLive && (
        <section className="pub-home-live-showcase">
          <div className="pub-matches-spotlight live">
            <div className="pub-ms-spot-header">
              <div className="pub-ms-spot-left">
                <span className="pub-ms-eyebrow">EN DIRECTO AHORA</span>
                <h2 className="pub-ms-spot-title">
                  Partida {liveMatch.matchNumber}
                  {activeMap && (
                    <span className="pub-ms-spot-map">
                      · Mapa {activeMap.mapIndex} ({activeMap.code})
                    </span>
                  )}
                </h2>
                <div className="pub-ms-spot-rotation">
                  <span className="pub-ms-rot-tag">
                    Rotación: Capitán + {liveMatch.matchNumber <= 2 ? 'Piloto 1' : 'Piloto 2'}
                  </span>
                  <span className="pub-ms-rot-scope">
                    {liveMatch.matchNumber <= 2 ? 'Mapas 1 a 6 en juego' : 'Mapas 7 a 12 en juego'}
                  </span>
                </div>
              </div>

              <div className="pub-ms-spot-right">
                <div className="pub-ms-live-badge">
                  <span className="pub-live-dot" /> EN CURSO
                </div>
                <div className="pub-home-live-links">
                  <Link to="/matches" className="pub-ms-stream-link">
                    Ver Partida →
                  </Link>
                  <Link to="/streams" className="pub-ms-stream-link">
                    Multistream →
                  </Link>
                </div>
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
                  const teamColor = getTeamColor(t);
                  const avatar = getAvatarBySlug(t.slug);
                  const isP1 = liveMatch.matchNumber <= 2;
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
        </section>
      )}

      {/* ── CHAPTER 1: EQUIPOS Y REGISTRO ── */}
      <section id="equipos" className="pub-chapter">
        <div className="pub-chapter-header">
          <div>
            <span className="pub-kicker">Elige tu equipo</span>
            <h2 className="pub-chapter-title">¿Quieres jugar con tu creador favorito?</h2>
            <p className="pub-chapter-desc">
              Infórmate de cómo hacerlo en el botón de inscribirte y participa en este evento.
            </p>
          </div>
        </div>

        <div className="pub-creators-grid">
          {CREATOR_ENTRIES.map(([slug, creator]) => {
            const avatarKey = slug === 'sora' ? 'soramusic' : slug;
            const avatar = ASSETS.avatars[avatarKey as keyof typeof ASSETS.avatars];
            const team = teams.find(t =>
              t.name.toLowerCase() === creator.name.toLowerCase() ||
              t.slug?.toLowerCase() === slug
            );

            return (
              <div
                key={slug}
                className="pub-creator-card"
                onClick={() => team && navigate(`/teams/${team.slug}`)}
                style={{ '--c-accent': creator.color } as React.CSSProperties}
              >
                <div className="pub-creator-media">
                  {avatar && (
                    <img
                      className="pub-creator-img"
                      src={avatar}
                      alt={creator.name}
                    />
                  )}
                  <div className="pub-creator-media-bar" style={{ backgroundColor: creator.color }} />
                </div>

                <div className="pub-creator-info">
                  <h3 className="pub-creator-name">{creator.name}</h3>
                  <span className="pub-creator-sub">2 plazas comunitarias</span>
                </div>

                <div className="pub-card-action">
                  <Link
                    className="pub-btn-register"
                    to={`/streamers/${slug}`}
                    onClick={e => {
                      e.stopPropagation();
                      trackEvent('streamer_card_click', { streamer: slug });
                    }}
                  >
                    Inscribirte
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CHAPTER 2: FORMATO DEL TORNEO ── */}
      <section id="formato" className="pub-chapter">
        <div className="pub-chapter-header">
          <div>
            <span className="pub-kicker">Reglamento y estructura</span>
            <h2 className="pub-chapter-title">Cómo funciona el torneo</h2>
            <p className="pub-chapter-desc">
              Todo lo necesario para entender la competición en 3 secciones directas.
            </p>
          </div>
        </div>

        <div className="pub-format-layout">
          {/* Bloque 1: Cómo participar */}
          <div className="pub-format-card">
            <span className="pub-format-sub">01 · Inscripción y requisitos</span>
            <h3 className="pub-format-head">¿Cómo participar?</h3>
            <p className="pub-format-lead">
              El torneo está abierto a toda la comunidad de Rainbow Six Siege. No se exige rango mínimo ni experiencia competitiva previa.
            </p>
            <div className="pub-steps-grid">
              <div className="pub-step-card">
                <div className="pub-step-num">01</div>
                <h4 className="pub-step-title">Elige tu creador</h4>
                <p className="pub-step-desc">Revisa las fichas de los 5 capitanes, su plataforma de draft y los requisitos de su equipo.</p>
              </div>
              <div className="pub-step-card">
                <div className="pub-step-num">02</div>
                <h4 className="pub-step-title">Postúlate en su red</h4>
                <p className="pub-step-desc">Accede a su convocatoria en Twitter/X, Discord o stream en Twitch mediante el botón de su tarjeta.</p>
              </div>
              <div className="pub-step-card">
                <div className="pub-step-num">03</div>
                <h4 className="pub-step-title">Supera la prueba</h4>
                <p className="pub-step-desc">Demuestra tu habilidad de pilotaje y sé uno de los 2 pilotos elegidos para defender sus colores.</p>
              </div>
            </div>
          </div>

          {/* Bloque 2: Rotación de mapas */}
          <div className="pub-format-card">
            <span className="pub-format-sub">02 · Estructura de partidas</span>
            <h3 className="pub-format-head">Rotación y mapas</h3>
            <p className="pub-format-lead">
              La competición se compone de 4 partidas con 3 mapas cada una (12 mapas en total). En cada mapa compiten 10 drones simultáneos (2 por equipo):
            </p>
            <div className="pub-rotation-summary">
              <div className="pub-rot-block">
                <strong>Partidas 1 y 2 (Mapas 1 al 6)</strong>
                <p>Compite el Capitán + Piloto Comunitario 1 (cada comunitario juega solo 2 partidas).</p>
              </div>
              <div className="pub-rot-block">
                <strong>Partidas 3 y 4 (Mapas 7 al 12)</strong>
                <p>Compite el Capitán + Piloto Comunitario 2 (segundo piloto comunitario del equipo).</p>
              </div>
            </div>
            <p className="pub-format-footnote">
              <strong>Desempate:</strong> En caso de empate en el primer puesto al concluir los 12 mapas, se activará una fase de desempate (Tiebreaker).
            </p>
          </div>

          {/* Bloque 3: Puntuación y premios */}
          <div className="pub-format-card pub-format-card-full">
            <div className="pub-format-prize-row">
              <div>
                <span className="pub-format-sub">03 · Premios y puntuación</span>
                <h3 className="pub-format-head">+10.000 Credits para el equipo campeón</h3>
                <p className="pub-format-lead">
                  Los puntos obtenidos individualmente por el creador y su compañero en cada mapa se acumulan en la clasificación general de su equipo.
                </p>
              </div>
              <div className="pub-prize-pill">
                <span className="pub-prize-amount">+10.000</span>
                <span className="pub-prize-currency">Credits</span>
              </div>
            </div>

            <div className="pub-score-table-wrap">
              <div className="pub-score-table-label">Tabla de puntuación por mapa:</div>
              <div className="pub-score-row">
                {SCORING_TABLE.map(s => (
                  <div key={s.position} className="pub-score-cell">
                    <span className="pub-score-pos">{s.position}º</span>
                    <span className="pub-score-pts">+{s.points}</span>
                  </div>
                ))}
                <div className="pub-score-cell dnf">
                  <span className="pub-score-pos">DNF</span>
                  <span className="pub-score-pts">0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CHAPTER 3: CLASIFICACIÓN (SI HAY RESULTADOS) ── */}
      {hasResults && rankings.length > 0 && (
        <section className="pub-chapter">
          <div className="pub-chapter-header">
            <div>
              <span className="pub-kicker">En tiempo real</span>
              <h2 className="pub-chapter-title">Clasificación general</h2>
            </div>
            <Link to="/classification" className="pub-link">
              Ver tabla detallada →
            </Link>
          </div>
          <div className="pub-ranking-wrapper">
            <RankingTable rankings={rankings} onTeamClick={slug => navigate(`/teams/${slug}`)} />
          </div>
        </section>
      )}

      {/* ── HISTORIAL DE PARTIDAS COMPLETADAS ── */}
      {completedCount > 0 && (
        <section className="pub-chapter">
          <div className="pub-chapter-header">
            <div>
              <span className="pub-kicker">Historial</span>
              <h2 className="pub-chapter-title">Partidas completadas ({completedCount}/{totalMatches})</h2>
            </div>
            <Link to="/matches" className="pub-link">
              Ver todas las partidas →
            </Link>
          </div>
          <div className="pub-completed-matches-grid">
            {completedMatches.map(m => (
              <div key={m.id} className="pub-completed-card" onClick={() => navigate('/matches')}>
                <div className="pub-completed-badge">Finalizada</div>
                <div className="pub-completed-title">Partida {m.matchNumber}</div>
                <div className="pub-completed-phase">{m.phase} · 3 mapas</div>
                <div className="pub-completed-link">Ver resultados →</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
