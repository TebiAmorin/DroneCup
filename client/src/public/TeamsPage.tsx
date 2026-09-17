import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { CompetitionState } from './useCompetition';
import { api } from '../api';
import { SectionHead, TeamDot, LoadingState, EmptyState } from './components';
import { getAvatarBySlug, getCreatorBySlug } from './assets';

function TwitchIcon({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}

function TrophyIcon({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function ChevronRightIcon({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default function TeamsPage() {
  const { teams, rankings, individuals, matches, loading } = useOutletContext<CompetitionState>();
  const navigate = useNavigate();

  // Telemetría de mapas completados: cálculo de victorias y podios por equipo
  const [teamStats, setTeamStats] = useState<Record<string, { victories: number; podiums: number; mapsRaced: number }>>({});

  useEffect(() => {
    let isCurrent = true;
    async function calculateMapStats() {
      try {
        const completedMatches = matches.filter(m => m.status === 'COMPLETED' || m.status === 'LIVE');
        const stats: Record<string, { victories: number; podiums: number; mapsRaced: number }> = {};
        teams.forEach(t => {
          stats[t.id] = { victories: 0, podiums: 0, mapsRaced: 0 };
        });

        for (const m of completedMatches) {
          const detail = await api.getMatch(m.id);
          for (const mp of detail.maps) {
            if (mp.status === 'COMPLETED') {
              const mapDetail = await api.getMap(mp.id);
              for (const t of teams) {
                const teamPIds = (t.participants || []).map(p => p.id);
                const resultsInMap = mapDetail.results.filter(r => teamPIds.includes(r.participantId));
                if (resultsInMap.length > 0) {
                  stats[t.id].mapsRaced += 1;
                  if (resultsInMap.some(r => r.position === 1)) {
                    stats[t.id].victories += 1;
                  }
                  if (resultsInMap.some(r => r.position && r.position <= 3)) {
                    stats[t.id].podiums += 1;
                  }
                }
              }
            }
          }
        }
        if (isCurrent) setTeamStats(stats);
      } catch { /* ignore */ }
    }

    if (teams.length > 0 && matches.length > 0) {
      calculateMapStats();
    }
    return () => { isCurrent = false; };
  }, [teams, matches]);

  // Ordenar equipos según ranking oficial
  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      const rA = rankings.find(r => r.teamId === a.id)?.rank ?? 99;
      const rB = rankings.find(r => r.teamId === b.id)?.rank ?? 99;
      return rA - rB;
    });
  }, [teams, rankings]);

  if (loading) return <LoadingState />;
  if (teams.length === 0) return <EmptyState message="Aún no hay equipos registrados." />;

  return (
    <div className="pub-page pub-teams-page">
      <SectionHead
        title="Equipos del Torneo"
        chip="5 Comunidades · 15 Pilotos"
        subtitle="5 Creadores oficiales y 10 pilotos comunitarios en carreras por 10.000 Créditos R6"
      />

      {/* ── BANNER DE FORMATO Y ESTRUCTURA DE EQUIPOS ── */}
      <div className="pub-teams-format-hero">
        <div className="pub-tfh-col">
          <div className="pub-tfh-num">5</div>
          <div className="pub-tfh-info">
            <span className="pub-tfh-title">Escuadras Oficiales</span>
            <span className="pub-tfh-sub">Comunidades de Vetel, Caramelo, Miwell, SoraMusic y Barra</span>
          </div>
        </div>

        <div className="pub-tfh-sep" />

        <div className="pub-tfh-col">
          <div className="pub-tfh-num">1+2</div>
          <div className="pub-tfh-info">
            <span className="pub-tfh-title">Rotación de Pilotos</span>
            <span className="pub-tfh-sub">Capitán (12 mapas) + Piloto 1 (Mapas 1-6) + Piloto 2 (Mapas 7-12)</span>
          </div>
        </div>

        <div className="pub-tfh-sep" />

        <div className="pub-tfh-col">
          <div className="pub-tfh-num">2x</div>
          <div className="pub-tfh-info">
            <span className="pub-tfh-title">Puntuación Combinada</span>
            <span className="pub-tfh-sub">2 Drones por equipo sumando puntos en cada carrera</span>
          </div>
        </div>
      </div>

      {/* ── PARRILLA DE TARJETAS ESPORTS ── */}
      <div className="pub-teams-esports-grid">
        {sortedTeams.map(team => {
          const rank = rankings.find(r => r.teamId === team.id);
          const creatorData = getCreatorBySlug(team.slug);
          const teamColor = team.color || creatorData?.color || '#3b82f6';
          const avatar = getAvatarBySlug(team.slug);
          const participants = team.participants ?? [];
          const creator = participants.find(p => p.type === 'CREATOR');
          const p1 = participants.find(p => p.type === 'PLAYER_1');
          const p2 = participants.find(p => p.type === 'PLAYER_2');

          const creatorIndiv = individuals.find(i => i.participantId === creator?.id);
          const p1Indiv = individuals.find(i => i.participantId === p1?.id);
          const p2Indiv = individuals.find(i => i.participantId === p2?.id);

          const stats = teamStats[team.id] || { victories: 0, podiums: 0, mapsRaced: 0 };
          const isRank1 = rank?.rank === 1;
          const isRank2 = rank?.rank === 2;
          const isRank3 = rank?.rank === 3;

          return (
            <div
              key={team.id}
              className={`pub-team-esport-card${isRank1 ? ' rank-lead' : ''}`}
              style={{ '--team-color': teamColor } as any}
              onClick={() => navigate(`/teams/${team.slug}`)}
            >
              {/* Franja de identidad cromática */}
              <div className="pub-tec-stripe" style={{ background: teamColor }} />

              <div className="pub-tec-inner">
                {/* Cabecera del equipo */}
                <div className="pub-tec-head">
                  <div className="pub-tec-avatar-wrap">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={team.name}
                        className="pub-tec-avatar"
                        style={{ borderColor: teamColor }}
                      />
                    ) : (
                      <div className="pub-tec-avatar-placeholder" style={{ borderColor: teamColor }}>
                        {team.name.charAt(0)}
                      </div>
                    )}
                  </div>

                  <div className="pub-tec-identity">
                    <div className="pub-tec-title-row">
                      <h3 className="pub-tec-name" style={{ color: '#fff' }}>
                        {team.name}
                      </h3>
                      {creatorData && (
                        <a
                          href={`https://www.twitch.tv/${creatorData.twitch}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pub-tec-twitch-btn"
                          onClick={e => e.stopPropagation()}
                          title={`Canal de Twitch de ${creatorData.name}`}
                          aria-label={`Twitch de ${creatorData.name}`}
                        >
                          <TwitchIcon size={14} />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Posición grande a la derecha de la cabecera */}
                  <div className={`pub-tec-rank-huge ${isRank1 ? 'gold' : isRank2 ? 'silver' : isRank3 ? 'bronze' : 'default'}`}>
                    #{rank?.rank ?? '—'}
                  </div>
                </div>

                {/* Métricas rápidas de competición */}
                <div className="pub-tec-metrics-row">
                  <div className="pub-tec-metric">
                    <span className="pub-tem-val" style={{ color: teamColor }}>
                      {rank?.totalPoints ?? 0}
                    </span>
                    <span className="pub-tem-lbl">Puntos</span>
                  </div>

                  <div className="pub-tec-metric">
                    <span className="pub-tem-val">
                      {stats.victories > 0 ? (
                        <span className="pub-tem-gold">
                          <TrophyIcon size={14} /> {stats.victories}
                        </span>
                      ) : (
                        '0'
                      )}
                    </span>
                    <span className="pub-tem-lbl">Victorias (1.º)</span>
                  </div>

                  <div className="pub-tec-metric">
                    <span className="pub-tem-val">{stats.podiums}</span>
                    <span className="pub-tem-lbl">Podios (Top 3)</span>
                  </div>
                </div>

                <div className="pub-tec-divider" />

                {/* Desglose de Alineación y Puntos Aportados */}
                <div className="pub-tec-roster">
                  <span className="pub-tec-roster-title">Alineación & Puntos</span>

                  {/* Capitán */}
                  <div className="pub-tec-member">
                    <div className="pub-tem-left">
                      <TeamDot color={teamColor} />
                      <span className="pub-tem-role-badge cap">Capitán</span>
                      <span className="pub-tem-name">{creator?.name ?? creatorData?.name ?? team.name}</span>
                    </div>
                    <div className="pub-tem-right">
                      <span className="pub-tem-pts">{creatorIndiv?.totalPoints ?? 0} pts</span>
                      {creatorIndiv?.rank && (
                        <span className="pub-tem-subrank">#{creatorIndiv.rank} Ind.</span>
                      )}
                    </div>
                  </div>

                  {/* Piloto 1 */}
                  <div className="pub-tec-member">
                    <div className="pub-tem-left">
                      <TeamDot color={teamColor} />
                      <span className="pub-tem-role-badge p1">Piloto 1</span>
                      <span className="pub-tem-name">{p1?.name ?? 'Piloto 1'}</span>
                    </div>
                    <div className="pub-tem-right">
                      <span className="pub-tem-pts">{p1Indiv?.totalPoints ?? 0} pts</span>
                      {p1Indiv?.rank && (
                        <span className="pub-tem-subrank">#{p1Indiv.rank} Ind.</span>
                      )}
                    </div>
                  </div>

                  {/* Piloto 2 */}
                  <div className="pub-tec-member">
                    <div className="pub-tem-left">
                      <TeamDot color={teamColor} />
                      <span className="pub-tem-role-badge p2">Piloto 2</span>
                      <span className="pub-tem-name">{p2?.name ?? 'Piloto 2'}</span>
                    </div>
                    <div className="pub-tem-right">
                      <span className="pub-tem-pts">{p2Indiv?.totalPoints ?? 0} pts</span>
                      {p2Indiv?.rank && (
                        <span className="pub-tem-subrank">#{p2Indiv.rank} Ind.</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pie de tarjeta con acción */}
                <div className="pub-tec-footer">
                  <span className="pub-tec-action">
                    Ver Ficha de Equipo y Carreras
                    <ChevronRightIcon size={14} />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
