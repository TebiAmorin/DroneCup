import { useParams } from 'react-router-dom';
import { useCreatorOverlay } from './useCreatorOverlay';
import { getTeamColor } from '../public/assets';
import './overlay.css';

export default function CreatorOverlay() {
  const { slug = '' } = useParams<{ slug: string }>();
  const data = useCreatorOverlay(slug);
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
        <div className="ov-error">EQUIPO NO ENCONTRADO: {slug}</div>
      </div>
    );
  }

  const positionDisplay = data.teamRank?.rank != null ? `${data.teamRank.rank}º` : '—';
  const matchLabel = data.currentMatch ? `PARTIDA ${data.currentMatch.matchNumber}` : null;
  const companionName = data.companion?.name ?? 'POR DETERMINAR';
  const companionPts = data.companion?.points ?? 0;

  return (
    <div className="ov-root" style={{ '--ov-team': teamColor } as React.CSSProperties}>
      <div className="ov-plate">
        {/* Top accent stripe — team color with angular cut */}
        <div className="ov-accent" />

        {/* Main content body */}
        <div className="ov-content">
          {matchLabel && (
            <div className="ov-header">
              <span className="ov-match-label">{matchLabel}</span>
            </div>
          )}

          <div className="ov-rank-block">
            <span className="ov-position">{positionDisplay}</span>
            <span className="ov-team-pts">{data.teamPoints} <span className="ov-pts-unit">PTS</span></span>
          </div>

          <div className="ov-divider" />

          <div className="ov-individuals">
            <div className="ov-individual-row creator">
              <span className="ov-ind-name">{data.creatorName ?? slug.toUpperCase()}</span>
              <span className="ov-ind-pts">{data.creatorPoints} <span className="ov-pts-unit">PTS</span></span>
            </div>
            <div className="ov-individual-row companion">
              <span className="ov-ind-name">{companionName}</span>
              <span className="ov-ind-pts">{companionPts} <span className="ov-pts-unit">PTS</span></span>
            </div>
          </div>

          {/* Decorative corner tick */}
          <div className="ov-tech-line ov-tech-line--corner" />
        </div>

        {/* Bottom edge accent */}
        <div className="ov-bottom-edge" />
      </div>
    </div>
  );
}
