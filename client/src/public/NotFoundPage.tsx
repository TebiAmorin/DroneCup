import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="pub-404-container">
      <div className="pub-404-card">
        <div className="pub-404-telemetry-tag">// ERROR DE TELEMETRÍA //</div>
        <div className="pub-404-glitch-num">404</div>
        <h1 className="pub-404-title">SEÑAL PERDIDA</h1>
        <p className="pub-404-desc">Esta ruta no existe en el circuito.</p>
        <div className="pub-404-actions">
          <Link to="/" className="pub-404-btn">
            VOLVER AL INICIO
          </Link>
        </div>
      </div>
    </div>
  );
}
