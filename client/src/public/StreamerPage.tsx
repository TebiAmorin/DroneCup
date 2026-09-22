import { useParams, Link, useNavigate, useOutletContext } from 'react-router-dom';
import type { CompetitionState } from './useCompetition';
import {
  ASSETS,
  CREATORS,
  ICONS,
  type CreatorSlug,
  getCreatorBySlug,
  getTeamColor,
} from './assets';
import { EmptyState } from './components';
import { trackEvent } from '../analytics';

const CREATOR_SLUGS = Object.keys(CREATORS) as CreatorSlug[];

function TwitchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'Twitter / X',
  discord: 'Discord',
  twitch: 'Twitch',
  google_forms: 'Google Forms',
  typeform: 'Typeform',
  external: 'Enlace externo',
};

function getPlatformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function formatQualifierDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} de ${MONTHS_ES[m - 1]} de ${y}`;
}

function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5);
}

function PlatformIcon({ platform, size = 16 }: { platform: string; size?: number }) {
  const svg = platform === 'discord' ? ICONS.discord : platform === 'twitter' ? ICONS.twitter : ICONS.twitch;
  return <span className="pub-sp-platform-icon" dangerouslySetInnerHTML={{ __html: svg }} style={{ width: size, height: size }} />;
}

export default function StreamerPage() {
  const { slug } = useParams<{ slug: string }>();
  const { teams } = useOutletContext<CompetitionState>();
  const navigate = useNavigate();

  const normalizedSlug = slug?.toLowerCase() ?? '';
  const creator = getCreatorBySlug(normalizedSlug);

  if (!creator) {
    return <EmptyState message="Streamer no encontrado." />;
  }

  const creatorSlug = (normalizedSlug === 'soramusic' ? 'sora' : normalizedSlug) as CreatorSlug;
  const avatarKey = creatorSlug === 'sora' ? 'soramusic' : creatorSlug;
  const avatar = ASSETS.avatars[avatarKey as keyof typeof ASSETS.avatars];
  const team = teams.find(t =>
    t.name.toLowerCase() === creator.name.toLowerCase() ||
    t.slug?.toLowerCase() === creatorSlug
  );
  const teamColor = team ? getTeamColor(team) : creator.color;

  const regUrl = team?.registrationUrl ?? creator.registrationUrl;
  const regNote = team?.communityNote ?? creator.communityNote;
  const regPlatform = team?.registrationPlatform ?? creator.registrationPlatform;
  const registrationStatus = team?.registrationStatus ?? 'upcoming';

  const otherCreators = CREATOR_SLUGS.filter(s => s !== creatorSlug);

  return (
    <div className="pub-page pub-streamer-page">
      {/* ── HERO DE IDENTIDAD ── */}
      <section className="pub-sp-hero" style={{ '--sp-color': teamColor } as React.CSSProperties}>
        <div className="pub-sp-hero-stripe" style={{ background: teamColor }} />

        <div className="pub-sp-hero-content">
          <div className="pub-sp-avatar-wrap">
            {avatar ? (
              <img
                src={avatar}
                alt={creator.name}
                className="pub-sp-avatar"
                style={{ borderColor: teamColor }}
              />
            ) : (
              <div className="pub-sp-avatar-placeholder" style={{ borderColor: teamColor }}>
                {creator.name.charAt(0)}
              </div>
            )}
          </div>

          <div className="pub-sp-identity">
            <span className="pub-sp-kicker">Creador Oficial · Wasteland Drone Cup</span>
            <h1 className="pub-sp-name">{creator.name}</h1>
            {team && (
              <p className="pub-sp-team-label">
                Equipo <Link to={`/teams/${team.slug}`} className="pub-sp-team-link" style={{ color: teamColor }}>{team.name}</Link>
              </p>
            )}
            <div className="pub-sp-social">
              <a
                href={`https://www.twitch.tv/${creator.twitch}`}
                target="_blank"
                rel="noopener noreferrer"
                className="pub-sp-twitch-btn"
                style={{ borderColor: `color-mix(in srgb, ${teamColor} 40%, transparent)` }}
              >
                <TwitchIcon size={14} />
                <span>{creator.twitch}</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── CLASIFICATORIO ── */}
      <section className="pub-sp-section">
        <div className="pub-sp-section-header">
          <span className="pub-kicker">Clasificatorio</span>
          <h2 className="pub-chapter-title">Participa con {creator.name}</h2>
          <p className="pub-chapter-desc">
            Cada creador selecciona a 2 pilotos comunitarios para representar a su equipo en la Wasteland Drone Cup.
            Infórmate sobre cómo participar en el clasificatorio de {creator.name}.
          </p>
        </div>

        <div className="pub-sp-qualifier-grid">
          {/* Cómo participar */}
          <div className="pub-sp-info-card">
            <h3 className="pub-sp-info-title">Cómo participar</h3>
            <p className="pub-sp-info-text">
              {regNote}
            </p>
            <div className="pub-sp-info-platform">
              <PlatformIcon platform={regPlatform} />
              <span>Plataforma: {getPlatformLabel(regPlatform)}</span>
            </div>
          </div>

          {/* Quién puede participar */}
          <div className="pub-sp-info-card">
            <h3 className="pub-sp-info-title">Quién puede participar</h3>
            <p className="pub-sp-info-text">
              El torneo está abierto a toda la comunidad de Rainbow Six Siege. No se exige rango mínimo ni experiencia competitiva previa.
            </p>
          </div>

          {/* Fecha y horario */}
          {(team?.qualifierDate || team?.qualifierStartTime) && (
            <div className="pub-sp-info-card">
              <h3 className="pub-sp-info-title">Fecha y horario</h3>
              <p className="pub-sp-info-text">
                {team.qualifierDate && formatQualifierDate(team.qualifierDate)}
                {team.qualifierStartTime && (
                  <>{team.qualifierDate ? ' · ' : ''}{formatTime(team.qualifierStartTime)}{team.qualifierEndTime ? `–${formatTime(team.qualifierEndTime)}` : ''}</>
                )}
              </p>
            </div>
          )}

          {/* Formato */}
          {team?.qualifierFormat && (
            <div className="pub-sp-info-card">
              <h3 className="pub-sp-info-title">Formato</h3>
              <p className="pub-sp-info-text">{team.qualifierFormat}</p>
            </div>
          )}

          {/* Requisitos */}
          {team?.qualifierRequirements && (
            <div className="pub-sp-info-card">
              <h3 className="pub-sp-info-title">Requisitos</h3>
              <p className="pub-sp-info-text">{team.qualifierRequirements}</p>
            </div>
          )}

          {/* Cómo participar (detallado) */}
          {team?.qualifierHowToParticipate && (
            <div className="pub-sp-info-card">
              <h3 className="pub-sp-info-title">Cómo participar</h3>
              <p className="pub-sp-info-text">{team.qualifierHowToParticipate}</p>
            </div>
          )}

          {/* Estructura del equipo */}
          <div className="pub-sp-info-card">
            <h3 className="pub-sp-info-title">Estructura del equipo</h3>
            <p className="pub-sp-info-text">
              Cada equipo lo forman el creador (Capitán) y 2 pilotos comunitarios que rotan entre partidas.
              El Capitán juega los 12 mapas; cada piloto comunitario juega 6.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA INSCRIPCIÓN ── */}
      <section className="pub-sp-cta-section" style={{ '--sp-color': teamColor } as React.CSSProperties}>
        <div className="pub-sp-cta-card">
          <div className="pub-sp-cta-content">
            {registrationStatus === 'open' && (
              <>
                <span className="pub-kicker" style={{ color: teamColor }}>Inscripción abierta</span>
                <h2 className="pub-sp-cta-title">¿Listo para competir?</h2>
                <p className="pub-sp-cta-desc">
                  Accede a la convocatoria de {creator.name} y postúlate como piloto comunitario de su equipo.
                </p>
              </>
            )}
            {registrationStatus === 'upcoming' && (
              <>
                <span className="pub-kicker" style={{ color: teamColor }}>Próximamente</span>
                <h2 className="pub-sp-cta-title">Inscripción aún no disponible</h2>
                <p className="pub-sp-cta-desc">
                  El clasificatorio de {creator.name} todavía no está abierto. Mantente atento a sus redes.
                </p>
              </>
            )}
            {registrationStatus === 'closed' && (
              <>
                <span className="pub-kicker" style={{ color: teamColor }}>Inscripciones cerradas</span>
                <h2 className="pub-sp-cta-title">El periodo de inscripción ha finalizado</h2>
                <p className="pub-sp-cta-desc">
                  Las plazas comunitarias de {creator.name} están en proceso de selección.
                </p>
              </>
            )}
            {registrationStatus === 'completed' && (
              <>
                <span className="pub-kicker" style={{ color: teamColor }}>Equipo completo</span>
                <h2 className="pub-sp-cta-title">El equipo de {creator.name} ya está formado</h2>
                <p className="pub-sp-cta-desc">
                  Los pilotos comunitarios han sido seleccionados. Consulta la ficha del equipo.
                </p>
              </>
            )}
          </div>
          {registrationStatus === 'open' && (
            <>
              <a
                href={regUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="pub-sp-cta-btn"
                style={{ background: teamColor, borderColor: teamColor }}
                onClick={() => trackEvent('registration_click', { streamer: creatorSlug, platform: regPlatform })}
              >
                <PlatformIcon platform={regPlatform} size={18} />
                Inscríbete al clasificatorio
              </a>
              <span className="pub-sp-cta-note">
                Se abrirá en {getPlatformLabel(regPlatform)}
              </span>
            </>
          )}
          {registrationStatus === 'completed' && team && (
            <button
              className="pub-sp-cta-btn"
              style={{ background: teamColor, borderColor: teamColor }}
              onClick={() => navigate(`/teams/${team.slug}`)}
            >
              Ver equipo
            </button>
          )}
        </div>
      </section>

      {/* ── OTROS CREADORES ── */}
      <section className="pub-sp-section">
        <div className="pub-sp-section-header">
          <span className="pub-kicker">Otros equipos</span>
          <h2 className="pub-chapter-title">Explora más creadores</h2>
        </div>

        <div className="pub-sp-others-grid">
          {otherCreators.map(s => {
            const c = CREATORS[s];
            const otherAvatarKey = s === 'sora' ? 'soramusic' : s;
            const otherAvatar = ASSETS.avatars[otherAvatarKey as keyof typeof ASSETS.avatars];

            return (
              <Link
                key={s}
                to={`/streamers/${s}`}
                className="pub-sp-other-card"
                style={{ '--sp-color': c.color } as React.CSSProperties}
              >
                <div className="pub-sp-other-stripe" style={{ background: c.color }} />
                {otherAvatar && (
                  <img src={otherAvatar} alt={c.name} className="pub-sp-other-avatar" style={{ borderColor: c.color }} />
                )}
                <div className="pub-sp-other-info">
                  <span className="pub-sp-other-name">{c.name}</span>
                  <span className="pub-sp-other-sub">Ver clasificatorio →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
