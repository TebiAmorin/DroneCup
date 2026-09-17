import { useState, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import type { CompetitionState } from './useCompetition';
import { SectionHead, TeamDot } from './components';
import { CREATORS, getAvatarBySlug, type CreatorSlug } from './assets';

type StreamMode = 'theater' | 'duo' | 'grid';

const CREATOR_SLUGS: CreatorSlug[] = ['vetel', 'caramelo', 'miwell', 'sora', 'barra'];

function TwitchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}

function TheaterIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function DuoIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="9" height="16" rx="2" ry="2" />
      <rect x="13" y="4" width="9" height="16" rx="2" ry="2" />
    </svg>
  );
}

function GridIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function ChatIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ExternalLinkIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export default function StreamsPage() {
  const { teams, rankings, matches } = useOutletContext<CompetitionState>();

  const [mode, setMode] = useState<StreamMode>('theater');
  const [activeSlug, setActiveSlug] = useState<CreatorSlug>('vetel');
  const [secondarySlug, setSecondarySlug] = useState<CreatorSlug>('caramelo');
  const [showChat, setShowChat] = useState<boolean>(false);

  const parentDomain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  const liveMatch = matches.find(m => m.status === 'LIVE');

  // Encontrar el equipo del creador activo
  const activeTeam = useMemo(() => {
    return teams.find(t => {
      const slugNormalized = t.slug.toLowerCase();
      if (activeSlug === 'sora') return slugNormalized === 'soramusic' || slugNormalized === 'sora';
      return slugNormalized === activeSlug;
    });
  }, [teams, activeSlug]);

  const activeRank = rankings.find(r => r.teamId === activeTeam?.id);
  const activeCreatorData = CREATORS[activeSlug];
  const activeAvatar = getAvatarBySlug(activeSlug);
  const activeP1 = activeTeam?.participants?.find(p => p.type === 'PLAYER_1');
  const activeP2 = activeTeam?.participants?.find(p => p.type === 'PLAYER_2');

  const chipText = liveMatch
    ? `EN DIRECTO · Partida ${liveMatch.matchNumber}`
    : '5 Canales Oficiales';

  return (
    <div className="pub-page pub-streams-page">
      <SectionHead
        title="Directos del Torneo"
        chip={chipText}
        subtitle="Sigue las carreras desde la perspectiva de los capitanes con visualización en alta definición y chat"
      />

      {/* ── BARRA SUPERIOR DE MODOS Y CONTROLES ── */}
      <div className="pub-streams-control-bar">
        {/* Selector de modo de vista */}
        <div className="pub-stream-modes-group" role="tablist" aria-label="Modo de reproducción">
          <button
            type="button"
            className={`pub-sm-btn${mode === 'theater' ? ' active' : ''}`}
            onClick={() => setMode('theater')}
            title="Modo Teatro: Stream principal con selector táctico"
          >
            <TheaterIcon />
            <span>Enfoque</span>
          </button>
          <button
            type="button"
            className={`pub-sm-btn${mode === 'duo' ? ' active' : ''}`}
            onClick={() => setMode('duo')}
            title="Modo Dúo: 2 streams simultáneos cara a cara"
          >
            <DuoIcon />
            <span>Dúo</span>
          </button>
          <button
            type="button"
            className={`pub-sm-btn${mode === 'grid' ? ' active' : ''}`}
            onClick={() => setMode('grid')}
            title="Modo Mosaico: 5 streams de los capitanes a la vez"
          >
            <GridIcon />
            <span>Mosaico (5)</span>
          </button>
        </div>

        {/* Botón de Chat (activo en modo teatro) */}
        {mode === 'theater' && (
          <button
            type="button"
            className={`pub-chat-toggle-btn${showChat ? ' active' : ''}`}
            onClick={() => setShowChat(prev => !prev)}
            title={showChat ? 'Ocultar chat de Twitch' : 'Mostrar chat de Twitch'}
          >
            <ChatIcon />
            <span>Chat de Twitch</span>
          </button>
        )}
      </div>

      {/* ── SELECTOR RÁPIDO DE CREADORES (ENFOQUE O DÚO) ── */}
      <div className="pub-stream-creator-bar" role="tablist" aria-label="Seleccionar creador">
        <span className="pub-scb-label">
          {mode === 'duo' ? 'Stream Principal:' : 'Seleccionar Capitán:'}
        </span>
        <div className="pub-scb-tabs">
          {CREATOR_SLUGS.map(slug => {
            const creator = CREATORS[slug];
            const isSelected = activeSlug === slug;
            const cAvatar = getAvatarBySlug(slug);
            const teamMatch = teams.find(t => {
              const s = t.slug.toLowerCase();
              return slug === 'sora' ? s === 'soramusic' || s === 'sora' : s === slug;
            });
            const teamR = rankings.find(r => r.teamId === teamMatch?.id);

            return (
              <button
                key={slug}
                type="button"
                className={`pub-sc-tab${isSelected ? ' active' : ''}`}
                style={{ '--c-color': creator.color } as any}
                onClick={() => setActiveSlug(slug)}
                role="tab"
                aria-selected={isSelected}
              >
                {cAvatar && <img src={cAvatar} alt={creator.name} className="pub-sc-avatar" />}
                <span className="pub-sc-name">{creator.name}</span>
                {teamR && (
                  <span className="pub-sc-rank">#{teamR.rank}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── ZONA DE REPRODUCCIÓN SEGÚN MODO ── */}
      {mode === 'theater' && (
        <div className="pub-theater-layout">
          <div className="pub-theater-main-wrap">
            {/* Contenedor del reproductor */}
            <div className={`pub-theater-stage${showChat ? ' with-chat' : ''}`}>
              <div className="pub-theater-player">
                <iframe
                  src={`https://player.twitch.tv/?channel=${activeCreatorData.twitch}&parent=${parentDomain}&muted=false`}
                  allowFullScreen
                  title={`Stream de ${activeCreatorData.name}`}
                  className="pub-twitch-iframe"
                />
              </div>

              {/* Chat integrado opcional */}
              {showChat && (
                <div className="pub-theater-chat">
                  <div className="pub-chat-header">
                    <TwitchIcon size={12} />
                    <span>Chat de {activeCreatorData.name}</span>
                  </div>
                  <iframe
                    src={`https://www.twitch.tv/embed/${activeCreatorData.twitch}/chat?parent=${parentDomain}&darkpopout`}
                    title={`Chat de ${activeCreatorData.name}`}
                    className="pub-twitch-chat-iframe"
                  />
                </div>
              )}
            </div>

            {/* Ficha de telemetría del creador en pantalla */}
            <div className="pub-stream-pilot-card" style={{ borderLeft: `4px solid ${activeCreatorData.color}` }}>
              <div className="pub-spc-left">
                {activeAvatar && (
                  <img
                    src={activeAvatar}
                    alt={activeCreatorData.name}
                    className="pub-spc-avatar"
                    style={{ borderColor: activeCreatorData.color }}
                  />
                )}
                <div className="pub-spc-info">
                  <div className="pub-spc-title-row">
                    <h3 className="pub-spc-name">{activeCreatorData.name}</h3>
                    <span className="pub-spc-team">{activeTeam?.name ?? `Team ${activeCreatorData.name}`}</span>
                    {activeRank && (
                      <span className="pub-spc-rank-badge">#{activeRank.rank} General</span>
                    )}
                  </div>
                  <div className="pub-spc-pilots">
                    <span className="pub-spc-rot-label">Pilotos Comunitarios:</span>
                    <span className="pub-spc-p">{activeP1?.name ?? 'Piloto 1'} (M1-6)</span>
                    <span className="pub-spc-sep">·</span>
                    <span className="pub-spc-p">{activeP2?.name ?? 'Piloto 2'} (M7-12)</span>
                  </div>
                </div>
              </div>

              <div className="pub-spc-right">
                {activeRank && (
                  <div className="pub-spc-pts-block">
                    <span className="pub-spc-pts-val" style={{ color: activeCreatorData.color }}>
                      {activeRank.totalPoints}
                    </span>
                    <span className="pub-spc-pts-lbl">Puntos Equipo</span>
                  </div>
                )}
                <a
                  href={`https://www.twitch.tv/${activeCreatorData.twitch}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pub-spc-twitch-btn"
                >
                  <TwitchIcon size={14} />
                  <span>Abrir en Twitch</span>
                  <ExternalLinkIcon size={12} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === 'duo' && (
        <div className="pub-duo-layout">
          {/* Selector para el segundo stream */}
          <div className="pub-duo-secondary-bar">
            <span className="pub-scb-label">Segundo Stream:</span>
            <div className="pub-scb-tabs">
              {CREATOR_SLUGS.filter(s => s !== activeSlug).map(slug => {
                const creator = CREATORS[slug];
                const isSelected = secondarySlug === slug;
                const cAvatar = getAvatarBySlug(slug);

                return (
                  <button
                    key={slug}
                    type="button"
                    className={`pub-sc-tab${isSelected ? ' active' : ''}`}
                    style={{ '--c-color': creator.color } as any}
                    onClick={() => setSecondarySlug(slug)}
                  >
                    {cAvatar && <img src={cAvatar} alt={creator.name} className="pub-sc-avatar" />}
                    <span className="pub-sc-name">{creator.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pub-duo-grid">
            {/* Stream 1 */}
            <div className="pub-duo-cell">
              <div className="pub-duo-cell-head" style={{ borderLeft: `3px solid ${activeCreatorData.color}` }}>
                <span className="pub-dh-title">{activeCreatorData.name}</span>
                <a
                  href={`https://www.twitch.tv/${activeCreatorData.twitch}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pub-dh-link"
                >
                  <TwitchIcon size={12} /> twitch.tv/{activeCreatorData.twitch}
                </a>
              </div>
              <div className="pub-duo-player">
                <iframe
                  src={`https://player.twitch.tv/?channel=${activeCreatorData.twitch}&parent=${parentDomain}&muted=false`}
                  allowFullScreen
                  title={`Stream de ${activeCreatorData.name}`}
                  className="pub-twitch-iframe"
                />
              </div>
            </div>

            {/* Stream 2 */}
            <div className="pub-duo-cell">
              <div className="pub-duo-cell-head" style={{ borderLeft: `3px solid ${CREATORS[secondarySlug].color}` }}>
                <span className="pub-dh-title">{CREATORS[secondarySlug].name}</span>
                <a
                  href={`https://www.twitch.tv/${CREATORS[secondarySlug].twitch}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pub-dh-link"
                >
                  <TwitchIcon size={12} /> twitch.tv/{CREATORS[secondarySlug].twitch}
                </a>
              </div>
              <div className="pub-duo-player">
                <iframe
                  src={`https://player.twitch.tv/?channel=${CREATORS[secondarySlug].twitch}&parent=${parentDomain}&muted=true`}
                  allowFullScreen
                  title={`Stream de ${CREATORS[secondarySlug].name}`}
                  className="pub-twitch-iframe"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === 'grid' && (
        <div className="pub-grid-layout">
          <div className="pub-grid-streams">
            {CREATOR_SLUGS.map(slug => {
              const creator = CREATORS[slug];
              const cAvatar = getAvatarBySlug(slug);

              return (
                <div key={slug} className="pub-grid-cell" style={{ borderTop: `3px solid ${creator.color}` }}>
                  <div className="pub-gc-head">
                    <div className="pub-gc-left">
                      {cAvatar && <img src={cAvatar} alt={creator.name} className="pub-gc-avatar" />}
                      <span className="pub-gc-name">{creator.name}</span>
                    </div>
                    <div className="pub-gc-actions">
                      <button
                        type="button"
                        className="pub-gc-focus-btn"
                        onClick={() => {
                          setActiveSlug(slug);
                          setMode('theater');
                        }}
                        title="Enfocar este stream en grande"
                      >
                        Enfocar
                      </button>
                      <a
                        href={`https://www.twitch.tv/${creator.twitch}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pub-gc-link"
                      >
                        <TwitchIcon size={12} />
                      </a>
                    </div>
                  </div>
                  <div className="pub-gc-player">
                    <iframe
                      src={`https://player.twitch.tv/?channel=${creator.twitch}&parent=${parentDomain}&muted=true`}
                      allowFullScreen
                      title={`Stream de ${creator.name}`}
                      className="pub-twitch-iframe"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ENLACES DIRECTOS A LOS CANALES DE TWITCH ── */}
      <div className="pub-streams-links-section">
        <span className="pub-slinks-label">Canales Oficiales en Twitch</span>
        <div className="pub-slinks-grid">
          {CREATOR_SLUGS.map(slug => {
            const creator = CREATORS[slug];
            const avatar = getAvatarBySlug(slug);
            const team = teams.find(t => {
              const s = t.slug.toLowerCase();
              return slug === 'sora' ? s === 'soramusic' || s === 'sora' : s === slug;
            });

            return (
              <a
                key={slug}
                className="pub-slink-card"
                href={`https://www.twitch.tv/${creator.twitch}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ borderLeft: `3px solid ${creator.color}` }}
              >
                {avatar && <img src={avatar} alt={creator.name} className="pub-sl-avatar" />}
                <div className="pub-sl-info">
                  <span className="pub-sl-name">{creator.name}</span>
                  <span className="pub-sl-team">{team?.name ?? `Team ${creator.name}`}</span>
                </div>
                <div className="pub-sl-badge">
                  <TwitchIcon size={13} />
                  <span>En vivo</span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

