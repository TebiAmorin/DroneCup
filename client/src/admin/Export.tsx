const EXPORTS = [
  {
    title: 'Clasificación de equipos',
    description: 'Posición, equipo, puntos totales, mapas jugados y ganados.',
    format: 'CSV',
    url: '/api/export/teams.csv',
    filename: 'clasificacion_equipos.csv',
  },
  {
    title: 'Clasificación individual',
    description: 'Posición, jugador, tipo, equipo, puntos, mapas y promedio.',
    format: 'CSV',
    url: '/api/export/participants.csv',
    filename: 'clasificacion_individual.csv',
  },
  {
    title: 'Resultados por mapa',
    description: 'Resultados detallados de cada mapa completado.',
    format: 'CSV',
    url: '/api/export/results-by-map.csv',
    filename: 'resultados_por_mapa.csv',
  },
  {
    title: 'Resultados por partida',
    description: 'Puntos totales de cada equipo desglosados por partida.',
    format: 'CSV',
    url: '/api/export/results-by-match.csv',
    filename: 'resultados_por_partida.csv',
  },
  {
    title: 'Exportación completa',
    description: 'Todos los datos del torneo: equipos, participantes, resultados, rankings y estadísticas.',
    format: 'JSON',
    url: '/api/export/consolidated.json',
    filename: 'drone_cup_export.json',
  },
];

export default function Export() {
  return (
    <div>
      <h1 className="page-title">Exportar datos</h1>

      <div className="grid-2">
        {EXPORTS.map(exp => (
          <div className="card" key={exp.url}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div className="card-title" style={{ margin: 0 }}>{exp.title}</div>
              <span style={{
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--text-muted)',
                background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: '2px',
              }}>
                {exp.format}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              {exp.description}
            </p>
            <a
              href={exp.url}
              download={exp.filename}
              className="btn btn-primary btn-sm"
              style={{ textDecoration: 'none' }}
            >
              Descargar
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
