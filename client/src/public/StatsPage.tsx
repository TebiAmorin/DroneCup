import { useState, useEffect, useCallback } from 'react';
import { api, TeamStats, ParticipantStats, ProgressionResponse } from '../api';
import { getSocket } from '../socket';
import { SectionHead, LoadingState } from './components';
import StatsTeamSelector from './StatsTeamSelector';
import StatsKPIHeader from './StatsKPIHeader';
import PointsProgressionChart from './PointsProgressionChart';
import MatchPointsChart from './MatchPointsChart';
import MapPerformanceTable from './MapPerformanceTable';
import ParticipantStatsSection from './ParticipantStatsSection';

export default function StatsPage() {
  const [teams, setTeams] = useState<TeamStats[]>([]);
  const [participants, setParticipants] = useState<ParticipantStats[]>([]);
  const [progression, setProgression] = useState<ProgressionResponse | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const [tData, pData, progData] = await Promise.all([
        api.getStatisticsTeams(),
        api.getStatisticsParticipants(),
        api.getStatisticsProgression(),
      ]);

      setTeams(tData);
      setParticipants(pData);
      setProgression(progData);
      setError(null);
    } catch (err) {
      console.error('Failed to load statistics', err);
      setError('No se pudieron cargar las estadísticas de competición en este momento.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    const socket = getSocket();
    socket.emit('join', 'competition');

    const handleUpdate = () => {
      fetchStats();
    };

    socket.on('competition.updated', handleUpdate);
    socket.on('map.completed', handleUpdate);
    socket.on('result.updated', handleUpdate);
    socket.on('ranking.updated', handleUpdate);
    socket.on('match.completed', handleUpdate);
    socket.on('connect', fetchStats);

    return () => {
      socket.off('competition.updated', handleUpdate);
      socket.off('map.completed', handleUpdate);
      socket.off('result.updated', handleUpdate);
      socket.off('ranking.updated', handleUpdate);
      socket.off('match.completed', handleUpdate);
      socket.off('connect', fetchStats);
    };
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="pub-page pub-stats-page">
        <SectionHead
          title="Estadísticas del Torneo"
          chip="Telemetría Oficial"
          subtitle="Análisis de rendimiento por escuadra, curvas de progresión acumulada y métricas de pilotos"
        />
        <LoadingState />
      </div>
    );
  }

  if (error || teams.length === 0) {
    return (
      <div className="pub-page pub-stats-page">
        <SectionHead
          title="Estadísticas del Torneo"
          chip="Telemetría Oficial"
          subtitle="Análisis de rendimiento por escuadra, curvas de progresión acumulada y métricas de pilotos"
        />
        <div className="pub-chart-empty">
          <p className="pub-ce-text">{error || 'No hay datos de torneo disponibles aún.'}</p>
        </div>
      </div>
    );
  }

  const completedMapsCount = teams.reduce((max, t) => Math.max(max, t.mapsPlayed), 0);
  const chipLabel = completedMapsCount > 0
    ? `${completedMapsCount} de 12 Mapas Disputados`
    : '5 Escuadras Oficiales';

  return (
    <div className="pub-page pub-stats-page">
      <SectionHead
        title="Estadísticas del Torneo"
        chip={chipLabel}
        subtitle="Análisis táctico de rendimiento por escuadra, curvas de progresión acumulada y telemetría de pilotos"
      />

      {/* ── SELECTOR DE EQUIPO ── */}
      <StatsTeamSelector
        teams={teams}
        selectedTeamId={selectedTeamId}
        onSelectTeam={setSelectedTeamId}
      />

      {/* ── KPI HEADER ── */}
      <StatsKPIHeader
        selectedTeamId={selectedTeamId}
        teams={teams}
        participants={participants}
      />

      {/* ── 1. EVOLUCIÓN DE PUNTOS POR EQUIPO (GRÁFICA ACUMULADA) ── */}
      <PointsProgressionChart
        teams={teams}
        teamProgression={progression?.teams ?? []}
        selectedTeamId={selectedTeamId}
        onSelectTeam={setSelectedTeamId}
      />

      {/* ── 2. PUNTOS POR MATCH (BARRAS AGRUPADAS) ── */}
      <MatchPointsChart
        teams={teams}
        selectedTeamId={selectedTeamId}
        onSelectTeam={setSelectedTeamId}
      />

      {/* ── 3. RENDIMIENTO POR MAPA (TELEMETRÍA DE CARRERA) ── */}
      <MapPerformanceTable
        teams={teams}
        participants={participants}
        selectedTeamId={selectedTeamId}
        onSelectTeam={setSelectedTeamId}
      />

      {/* ── 4. ESTADÍSTICAS INDIVIDUALES DE PILOTOS ── */}
      <ParticipantStatsSection
        participants={participants}
        teams={teams}
        selectedTeamId={selectedTeamId}
      />
    </div>
  );
}
