import { TeamStats } from '../api';
import { getTeamColor } from './assets';

interface StatsTeamSelectorProps {
  teams: TeamStats[];
  selectedTeamId: string;
  onSelectTeam: (teamId: string) => void;
}

export default function StatsTeamSelector({ teams, selectedTeamId, onSelectTeam }: StatsTeamSelectorProps) {
  return (
    <div className="pub-stats-team-selector-bar" role="tablist" aria-label="Filtrar por equipo">
      <span className="pub-stsb-label">Filtrar por Escuadra:</span>
      <div className="pub-stsb-tabs">
        <button
          type="button"
          className={`pub-sts-tab${selectedTeamId === 'ALL' ? ' active' : ''}`}
          onClick={() => onSelectTeam('ALL')}
          role="tab"
          aria-selected={selectedTeamId === 'ALL'}
        >
          <span className="pub-sts-dot all" />
          <span className="pub-sts-name">Todos los Equipos</span>
        </button>

        {teams.map((team, idx) => {
          const isSelected = selectedTeamId === team.teamId;
          const color = getTeamColor(team, idx);

          return (
            <button
              key={team.teamId}
              type="button"
              className={`pub-sts-tab${isSelected ? ' active' : ''}`}
              style={{ '--team-color': color } as React.CSSProperties}
              onClick={() => onSelectTeam(team.teamId)}
              role="tab"
              aria-selected={isSelected}
            >
              <span className="pub-sts-dot" style={{ background: color }} />
              <span className="pub-sts-name">{team.teamName}</span>
              <span className="pub-sts-rank">#{team.globalPosition}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
