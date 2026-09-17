import { RankingTeam, MapResultData } from '../api';

export function StatusBadge({ status }: { status: string }) {
  const cls = status === 'LIVE' ? 'live' : status === 'COMPLETED' ? 'completed' : 'upcoming';
  return (
    <span className={`pub-status pub-status--${cls}`}>
      {status === 'LIVE' && <span className="pub-live-dot" />}
      {status}
    </span>
  );
}

export function TeamDot({ color }: { color: string | null }) {
  return <span className="pub-team-dot" style={{ background: color || '#3d556d' }} />;
}

export function SectionHead({ title, chip, subtitle }: { title: string; chip?: string; subtitle?: string }) {
  return (
    <div className="pub-sec-head-wrap">
      <div className="pub-sec-head">
        <h2>{title}</h2>
        {chip && <span className="pub-chip">{chip}</span>}
        <span className="pub-rule" />
      </div>
      {subtitle && <p className="pub-sec-subtitle">{subtitle}</p>}
    </div>
  );
}

export function LoadingState() {
  return <div className="pub-loading">Cargando...</div>;
}

export function EmptyState({ message }: { message: string }) {
  return <div className="pub-empty">{message}</div>;
}

export function MedalIcon({ position }: { position: number | null }) {
  if (position === 1) return <span className="pub-podium-num gold">1</span>;
  if (position === 2) return <span className="pub-podium-num silver">2</span>;
  if (position === 3) return <span className="pub-podium-num bronze">3</span>;
  return null;
}

export function PositionClass(position: number | null): string {
  if (position === 1) return 'gold';
  if (position === 2) return 'silver';
  if (position === 3) return 'bronze';
  return '';
}

export function MapResultTable({ results }: { results: MapResultData[] }) {
  const sorted = [...results].sort((a, b) => {
    if (a.status === 'DNF' && b.status !== 'DNF') return 1;
    if (a.status !== 'DNF' && b.status === 'DNF') return -1;
    return (a.position ?? 99) - (b.position ?? 99);
  });

  return (
    <div className="pub-map-results">
      {sorted.map(r => (
        <div key={r.participantId} className="pub-map-result-row">
          <span className={`pub-map-pos ${PositionClass(r.position)}`}>
            {r.status === 'DNF' ? '—' : r.position}
          </span>
          <TeamDot color={null} />
          <span className="pub-map-name">{r.participantName}</span>
          {r.status === 'DNF' ? (
            <span className="pub-map-dnf">DNF · 0 pts</span>
          ) : (
            <span className="pub-map-pts">{r.points} pts</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function RankingTable({ rankings, onTeamClick }: { rankings: RankingTeam[]; onTeamClick?: (slug: string) => void }) {
  return (
    <table className="pub-rank-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Equipo</th>
          <th className="r">Puntos</th>
        </tr>
      </thead>
      <tbody>
        {rankings.map(t => (
          <tr
            key={t.teamId}
            className={`pub-rk-row${t.rank === 1 ? ' leader' : ''}`}
            onClick={() => onTeamClick?.(t.teamSlug)}
          >
            <td className="pub-rk-num">{t.rank}</td>
            <td>
              <div className="pub-rk-name-wrap">
                <TeamDot color={t.teamColor} />
                <span className="pub-rk-name">{t.teamName}</span>
                {t.rank === 1 && <span className="pub-leader-badge">Líder</span>}
              </div>
            </td>
            <td className="pub-rk-pts">{t.totalPoints}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
