import { useParams } from 'react-router-dom';
import { useRef, useEffect } from 'react';
import { useCreatorOverlay } from './useCreatorOverlay';
import { getTeamColor } from '../public/assets';
import './overlay.css';

function useFlashOnChange(value: number | null, elRef: React.RefObject<HTMLSpanElement | null>, className: string) {
  const prevRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;
    if (prev === null || value === null || prev === value) return;

    const el = elRef.current;
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);

    const onEnd = () => el.classList.remove(className);
    el.addEventListener('animationend', onEnd, { once: true });
    return () => el.removeEventListener('animationend', onEnd);
  }, [value, elRef, className]);
}

export default function CreatorOverlay() {
  const { slug = '' } = useParams<{ slug: string }>();
  const data = useCreatorOverlay(slug);
  const teamColor = data.team ? getTeamColor(data.team) : (slug ? getTeamColor({ slug }) : '#e05520');

  const ptsElRef = useRef<HTMLSpanElement>(null);
  const posElRef = useRef<HTMLSpanElement>(null);

  useFlashOnChange(data.loading ? null : data.teamPoints, ptsElRef, 'ov-flash');
  useFlashOnChange(data.loading ? null : (data.teamRank?.rank ?? null), posElRef, 'ov-flash-pos');

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
        <div className="ov-accent" />

        <div className="ov-content">
          {matchLabel && (
            <div className="ov-header">
              <span className="ov-match-label">{matchLabel}</span>
            </div>
          )}

          <div className="ov-rank-block">
            <span ref={posElRef} className="ov-position">{positionDisplay}</span>
            <span ref={ptsElRef} className="ov-team-pts">{data.teamPoints} <span className="ov-pts-unit">PTS</span></span>
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

          <div className="ov-tech-line ov-tech-line--corner" />
        </div>

        <div className="ov-bottom-edge" />
      </div>
    </div>
  );
}
