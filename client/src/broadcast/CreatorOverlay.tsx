import { useParams } from 'react-router-dom';
import { useCreatorOverlay } from './useCreatorOverlay';
import { getAvatarBySlug, getCreatorBySlug, getTeamColor } from '../public/assets';
import './overlay.css';

export default function CreatorOverlay() {
  const { slug = '' } = useParams<{ slug: string }>();
  const data = useCreatorOverlay(slug);
  const creatorData = getCreatorBySlug(slug);
  const avatar = getAvatarBySlug(slug);
  const teamColor = data.team ? getTeamColor(data.team) : (slug ? getTeamColor({ slug }) : '#e05520');

  if (data.loading) {
    return (
      <div className="ov-root">
        <div className="ov-loading">CARGANDO DATOS...</div>
      </div>
    );
  }

  if (!data.team) {
    return (
      <div className="ov-root">
        <div className="ov-error">
          EQUIPO NO ENCONTRADO: {slug}
        </div>
      </div>
    );
  }

  const globalPosition = data.teamRank?.rank ?? '—';
  const teamPoints = data.teamRank?.totalPoints ?? 0;

  return (
    <div className="ov-root" style={{ '--ov-team': teamColor } as React.CSSProperties}>
      <div className="ov-frame">

        {/* Panel lateral derecho — centrado vertical */}
        <div className="ov-panel">
          {/* Cabecera: avatar + nombre + posición global */}
          <div className="ov-team-header">
            {avatar && (
              <img
                src={avatar}
                alt={data.team.name}
                className="ov-team-avatar"
              />
            )}
            <div className="ov-team-info">
              <div className="ov-team-name">{data.team.name}</div>
              <div className="ov-team-label">DRONE CUP</div>
            </div>
            <span className="ov-team-rank">{globalPosition}º</span>
          </div>

          {/* Pilotos con puntos individuales */}
          {data.creator && (
            <div className="ov-pilot-row">
              <span className="ov-pilot-role">CAP</span>
              <span className="ov-pilot-name">{data.creator.name}</span>
              <span className="ov-pilot-pts">{data.creator.points}</span>
            </div>
          )}
          {data.player1 && (
            <div className="ov-pilot-row">
              <span className="ov-pilot-role">P1</span>
              <span className="ov-pilot-name">{data.player1.name}</span>
              <span className="ov-pilot-pts">{data.player1.points}</span>
            </div>
          )}
          {data.player2 && (
            <div className="ov-pilot-row">
              <span className="ov-pilot-role">P2</span>
              <span className="ov-pilot-name">{data.player2.name}</span>
              <span className="ov-pilot-pts">{data.player2.points}</span>
            </div>
          )}

          {/* Total del equipo */}
          <div className="ov-team-total">
            <span className="ov-total-label">EQUIPO</span>
            <span className="ov-total-pts">{teamPoints} PTS</span>
          </div>
        </div>

        {/* Badge live debajo del panel */}
        {data.liveMatch && (
          <div className="ov-live-badge">
            <span className="ov-footer-title">WASTELAND DRONE CUP</span>
            <span className="ov-footer-live">
              EN DIRECTO · PARTIDA {data.liveMatch.matchNumber}
            </span>
          </div>
        )}
      </div>

      <div className={`ov-connection ${data.connected ? 'ok' : 'lost'}`}>
        {data.connected ? 'LIVE' : 'RECONECTANDO...'}
      </div>
    </div>
  );
}
