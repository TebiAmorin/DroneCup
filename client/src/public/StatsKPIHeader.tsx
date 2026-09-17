import { TeamStats, ParticipantStats } from '../api';

interface StatsKPIHeaderProps {
  selectedTeamId: string;
  teams: TeamStats[];
  participants: ParticipantStats[];
}

function TrophyIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function UsersIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function FlagIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function TargetIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export default function StatsKPIHeader({ selectedTeamId, teams, participants }: StatsKPIHeaderProps) {
  const isGlobal = selectedTeamId === 'ALL';
  const selectedTeam = teams.find(t => t.teamId === selectedTeamId);

  if (isGlobal) {
    const totalTeams = teams.length;
    const totalParticipants = participants.length;
    const maxMapsPlayed = teams.reduce((max, t) => Math.max(max, t.mapsPlayed), 0);
    const totalPointsDistributed = teams.reduce((sum, t) => sum + t.totalPoints, 0);

    return (
      <div className="pub-stats-kpi-grid">
        <div className="pub-stats-kpi-card">
          <div className="pub-stats-kpi-top">
            <span className="pub-stats-kpi-lbl">Equipos Oficiales</span>
            <span className="pub-stats-kpi-icon"><UsersIcon /></span>
          </div>
          <div className="pub-stats-kpi-val">{totalTeams}</div>
          <div className="pub-stats-kpi-sub">{totalTeams} Escuadras Comunitarias</div>
        </div>

        <div className="pub-stats-kpi-card">
          <div className="pub-stats-kpi-top">
            <span className="pub-stats-kpi-lbl">Pilotos en Roster</span>
            <span className="pub-stats-kpi-icon"><TargetIcon /></span>
          </div>
          <div className="pub-stats-kpi-val">{totalParticipants}</div>
          <div className="pub-stats-kpi-sub">Capitanes y Pilotos Comunitarios</div>
        </div>

        <div className="pub-stats-kpi-card">
          <div className="pub-stats-kpi-top">
            <span className="pub-stats-kpi-lbl">Mapas Disputados</span>
            <span className="pub-stats-kpi-icon"><FlagIcon /></span>
          </div>
          <div className="pub-stats-kpi-val">{maxMapsPlayed} <span className="pub-stats-kpi-unit">/ 12</span></div>
          <div className="pub-stats-kpi-sub">
            {maxMapsPlayed === 12 ? 'Torneo Finalizado' : `${12 - maxMapsPlayed} restantes`}
          </div>
        </div>

        <div className="pub-stats-kpi-card highlight">
          <div className="pub-stats-kpi-top">
            <span className="pub-stats-kpi-lbl">Puntos Distribuidos</span>
            <span className="pub-stats-kpi-icon"><TrophyIcon /></span>
          </div>
          <div className="pub-stats-kpi-val">{totalPointsDistributed} <span className="pub-stats-kpi-unit">pts</span></div>
          <div className="pub-stats-kpi-sub">Puntuación Total Acumulada</div>
        </div>
      </div>
    );
  }

  // Team Context
  if (!selectedTeam) return null;

  const positionLabel = `#${selectedTeam.globalPosition}`;
  const isPodium = selectedTeam.globalPosition <= 3;
  const posClass = selectedTeam.globalPosition === 1 ? 'gold' : selectedTeam.globalPosition === 2 ? 'silver' : selectedTeam.globalPosition === 3 ? 'bronze' : '';

  return (
    <div className="pub-stats-kpi-grid">
      <div className={`pub-stats-kpi-card${isPodium ? ' ' + posClass : ''}`}>
        <div className="pub-stats-kpi-top">
          <span className="pub-stats-kpi-lbl">Posición General</span>
          <span className="pub-stats-kpi-icon"><TrophyIcon /></span>
        </div>
        <div className="pub-stats-kpi-val">{positionLabel}</div>
        <div className="pub-stats-kpi-sub">En la Clasificación Oficial</div>
      </div>

      <div className="pub-stats-kpi-card highlight">
        <div className="pub-stats-kpi-top">
          <span className="pub-stats-kpi-lbl">Puntos de Escuadra</span>
          <span className="pub-stats-kpi-icon"><TargetIcon /></span>
        </div>
        <div className="pub-stats-kpi-val">{selectedTeam.totalPoints} <span className="pub-stats-kpi-unit">pts</span></div>
        <div className="pub-stats-kpi-sub">Puntuación Total Acumulada</div>
      </div>

      <div className="pub-stats-kpi-card">
        <div className="pub-stats-kpi-top">
          <span className="pub-stats-kpi-lbl">Mapas Jugados</span>
          <span className="pub-stats-kpi-icon"><FlagIcon /></span>
        </div>
        <div className="pub-stats-kpi-val">{selectedTeam.mapsPlayed} <span className="pub-stats-kpi-unit">/ 12</span></div>
        <div className="pub-stats-kpi-sub">Carreras Disputadas</div>
      </div>

      <div className="pub-stats-kpi-card">
        <div className="pub-stats-kpi-top">
          <span className="pub-stats-kpi-lbl">Victorias de Mapa</span>
          <span className="pub-stats-kpi-icon"><TrophyIcon /></span>
        </div>
        <div className="pub-stats-kpi-val">{selectedTeam.mapsWon}</div>
        <div className="pub-stats-kpi-sub">Mejor Puntuación de Mapa</div>
      </div>
    </div>
  );
}
