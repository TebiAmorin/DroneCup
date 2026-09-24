export default function NormativaPage() {
  const pointsScale = [
    { pos: '1.º', pts: '25 pts', podium: 'gold' },
    { pos: '2.º', pts: '18 pts', podium: 'silver' },
    { pos: '3.º', pts: '15 pts', podium: 'bronze' },
    { pos: '4.º', pts: '12 pts' },
    { pos: '5.º', pts: '10 pts' },
    { pos: '6.º', pts: '8 pts' },
    { pos: '7.º', pts: '6 pts' },
    { pos: '8.º', pts: '4 pts' },
    { pos: '9.º', pts: '2 pts' },
    { pos: '10.º', pts: '1 pt' },
    { pos: 'DNF', pts: '0 pts' },
  ];

  return (
    <div className="pub-editorial-page">
      <div className="pub-editorial-header">
        <span className="pub-editorial-eyebrow">REGLAMENTO OFICIAL DE COMPETICIÓN</span>
        <h1 className="pub-editorial-title">NORMATIVA</h1>
        <div className="pub-editorial-circuit">DRONE CUP · WASTELAND CIRCUIT</div>
      </div>

      <div className="pub-normativa-grid">
        {/* 01 — Formato General de la Competición */}
        <section className="pub-editorial-section">
          <div className="pub-norm-sec-head">
            <span className="pub-norm-num">01</span>
            <h2>Formato General de la Competición</h2>
          </div>
          <div className="pub-editorial-card">
            <div className="pub-format-kpis">
              <div className="pub-format-kpi">
                <span className="pub-kpi-val">4</span>
                <span className="pub-kpi-lbl">Partidas en total</span>
              </div>
              <div className="pub-format-kpi">
                <span className="pub-kpi-val">3</span>
                <span className="pub-kpi-lbl">Mapas por partida</span>
              </div>
              <div className="pub-format-kpi">
                <span className="pub-kpi-val highlight">12</span>
                <span className="pub-kpi-lbl">Mapas de competición en total</span>
              </div>
            </div>
            <ul className="pub-norm-list">
              <li>El torneo consta de <strong>4 partidas oficiales</strong> disputadas de forma sucesiva.</li>
              <li>Cada partida está compuesta por <strong>3 mapas de carreras de drones</strong>.</li>
              <li><strong>Cada mapa cuenta individualmente para la clasificación</strong> y los puntos obtenidos se acumulan durante toda la competición.</li>
              <li>El recorrido total de la competición comprende <strong>12 mapas oficiales</strong>, todos ellos con impacto en la clasificación general.</li>
            </ul>
          </div>
        </section>

        {/* 02 — Participantes y Rotación */}
        <section className="pub-editorial-section">
          <div className="pub-norm-sec-head">
            <span className="pub-norm-num">02</span>
            <h2>Participantes y Rotación</h2>
          </div>
          <div className="pub-editorial-card">
            <ul className="pub-norm-list">
              <li><strong>5 equipos / 5 comunidades</strong> creadoras compiten por el título.</li>
              <li>Cada equipo está integrado por <strong>3 pilotos oficiales</strong>: <strong>Capitán/Creador, Piloto 1 y Piloto 2</strong>.</li>
              <li>El <strong>Capitán</strong> compite durante las <strong>4 partidas completas (12 mapas)</strong>.</li>
              <li>El <strong>Piloto 1</strong> compite en las <strong>Partidas 1 y 2 (Mapas 1 al 6)</strong>.</li>
              <li>El <strong>Piloto 2</strong> compite en las <strong>Partidas 3 y 4 (Mapas 7 al 12)</strong>.</li>
              <li>En cada mapa compiten exactamente <strong>2 pilotos por equipo</strong>, sumando un total de <strong>10 drones en pista simultáneamente</strong>.</li>
            </ul>

            <div className="pub-rotation-scheme">
              <div className="pub-rot-item">
                <span className="pub-rot-badge cap">CAPITÁN</span>
                <span className="pub-rot-desc">Partidas 1, 2, 3 y 4 · 12 mapas</span>
              </div>
              <div className="pub-rot-item">
                <span className="pub-rot-badge p1">PILOTO 1</span>
                <span className="pub-rot-desc">Partidas 1 y 2 · Mapas 1 al 6</span>
              </div>
              <div className="pub-rot-item">
                <span className="pub-rot-badge p2">PILOTO 2</span>
                <span className="pub-rot-desc">Partidas 3 y 4 · Mapas 7 al 12</span>
              </div>
            </div>
          </div>
        </section>

        {/* 03 — Clasificación y Puntuación */}
        <section className="pub-editorial-section">
          <div className="pub-norm-sec-head">
            <span className="pub-norm-num">03</span>
            <h2>Clasificación y Puntuación</h2>
          </div>
          <div className="pub-editorial-card">
            <p className="pub-norm-intro">
              La puntuación se asigna en cada mapa según la posición final obtenida:
            </p>
            <div className="pub-points-table-grid">
              {pointsScale.map((p, idx) => (
                <div key={idx} className={`pub-pts-chip${p.podium ? ` ${p.podium}` : ''}`}>
                  <span className="pub-pts-pos">{p.pos}</span>
                  <span className="pub-pts-val">{p.pts}</span>
                </div>
              ))}
            </div>
            <div className="pub-norm-note">
              Los puntos obtenidos por los <strong>dos pilotos de un equipo en cada mapa</strong> se suman directamente al marcador general de la comunidad.
            </div>
            <p style={{ marginTop: '14px', fontSize: '13px', color: 'var(--ink-secondary)', lineHeight: '1.5' }}>
              La clasificación principal corresponde a las comunidades. La clasificación individual se muestra como información secundaria.
            </p>
          </div>
        </section>

        {/* 04 — Resultados y Validación */}
        <section className="pub-editorial-section">
          <div className="pub-norm-sec-head">
            <span className="pub-norm-num">04</span>
            <h2>Resultados y Validación</h2>
          </div>
          <div className="pub-editorial-card">
            <ul className="pub-norm-list">
              <li>Los resultados de cada mapa son registrados por la organización.</li>
              <li>La puntuación correspondiente a cada posición se calcula según el sistema oficial de competición.</li>
              <li>La clasificación general se actualiza en tiempo real en la plataforma del torneo.</li>
              <li>Los resultados pueden ser corregidos por la organización cuando sea necesario.</li>
            </ul>
          </div>
        </section>

        {/* 05 — Criterios de Desempate */}
        <section className="pub-editorial-section">
          <div className="pub-norm-sec-head">
            <span className="pub-norm-num">05</span>
            <h2>Criterios de Desempate</h2>
          </div>
          <div className="pub-editorial-card">
            <p className="pub-norm-intro">
              En caso de que dos o más equipos terminen con la misma puntuación, se valorarán <strong>las posiciones obtenidas por los equipos en las diferentes partidas</strong> para determinar el desempate.
            </p>
            <div className="pub-norm-note" style={{ marginTop: '16px' }}>
              Si después de valorar las posiciones obtenidas en las partidas el empate continúa, se disputará <strong>una partida adicional de desempate</strong>.
            </div>
            <p style={{ marginTop: '14px', fontSize: '13px', color: 'var(--ink-secondary)', fontStyle: 'italic', lineHeight: '1.5' }}>
              La partida adicional de desempate será comunicada y definida por la organización cuando sea necesaria.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
