import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { useCompetition } from './useCompetition';
import { ASSETS } from './assets';
import { trackPageView } from '../analytics';
import './public.css';

const ALL_NAV_ITEMS = [
  { to: '/', label: 'Inicio', gated: false },
  { to: '/classification', label: 'Clasificación', gated: true },
  { to: '/matches', label: 'Partidas', gated: true },
  { to: '/teams', label: 'Equipos', gated: false },
  { to: '/stats', label: 'Estadísticas', gated: true },
  { to: '/streams', label: 'Streams', gated: false },
];

const GATED_PATHS = ['/classification', '/matches', '/stats', '/statistics'];

export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const comp = useCompetition();
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
    trackPageView(location.pathname);
  }, [location.pathname]);

  const { tournamentReady, loading: compLoading } = comp;
  const isLive = comp.matches.some(m => m.status === 'LIVE');
  const completedCount = comp.matches.filter(m => m.status === 'COMPLETED').length;
  const totalMatches = comp.matches.length || 4;

  const navItems = useMemo(
    () => ALL_NAV_ITEMS.filter(item => !item.gated || tournamentReady),
    [tournamentReady]
  );

  const isGatedRoute = GATED_PATHS.includes(location.pathname);
  if (!compLoading && !tournamentReady && isGatedRoute) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="pub">
      <header className="pub-header">
        <div className="pub-header-main">
          <NavLink to="/" className="pub-brand-link" aria-label="Inicio Wasteland Drone Cup">
            <img
              className="pub-r6-emblem"
              src={ASSETS.r6Emblem}
              alt="Rainbow Six Siege"
            />
            <div className="pub-title-block">
              <span className="pub-title-eyebrow">Rainbow Six · Torneo Oficial</span>
              <h1 className="pub-brand-title">
                Wasteland <em>Drone Cup</em>
              </h1>
            </div>
            {isLive && (
              <span className="pub-header-live-badge">
                <span className="pub-live-dot" /> EN DIRECTO
              </span>
            )}
          </NavLink>

          <button
            className={`pub-ham${menuOpen ? ' open' : ''}`}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
          >
            <span /><span /><span />
          </button>
        </div>

        <nav className="pub-tab-nav">
          <div className="pub-tab-inner">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `pub-tab-btn${isActive ? ' active' : ''}`}
              >
                {item.label}
                {item.to === '/streams' && isLive && (
                  <span className="pub-tab-live-dot" />
                )}
              </NavLink>
            ))}
          </div>
        </nav>

      </header>

      {/* Mobile drawer — outside header to avoid backdrop-filter containing block */}
      <nav className={`pub-mobile-nav${menuOpen ? ' open' : ''}`}>
        <div className="pub-mobile-nav-header">
          <span>Wasteland Drone Cup</span>
          <button className="pub-mobile-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `pub-mobile-link${isActive ? ' active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            {item.label}
            {item.to === '/streams' && isLive && <span className="pub-live-dot" />}
          </NavLink>
        ))}
        <div className="pub-mobile-status">
          {isLive ? (
            <span><span className="pub-live-dot" /> En directo ahora</span>
          ) : (
            <span>{completedCount}/{totalMatches} partidas completadas</span>
          )}
        </div>
      </nav>

      <div className="pub-wrap">
        <Outlet context={comp} />
        <footer className="pub-footer">
          <div className="pub-footer-top">
            <div className="pub-footer-brand">
              <img src={ASSETS.r6Emblem} alt="R6" className="pub-footer-emblem" />
              <div>
                <strong>Wasteland Drone Cup</strong>
                <p>Competición de drones de Rainbow Six Siege · 5 Equipos · 10 Pilotos</p>
              </div>
            </div>
            <div className="pub-footer-links">
              <NavLink to="/">Inicio</NavLink>
              {tournamentReady && <NavLink to="/classification">Clasificación</NavLink>}
              {tournamentReady && <NavLink to="/matches">Partidas</NavLink>}
              <NavLink to="/teams">Equipos</NavLink>
              {tournamentReady && <NavLink to="/stats">Estadísticas</NavLink>}
              <NavLink to="/streams">Directos</NavLink>
            </div>
          </div>
          <div className="pub-footer-bottom">
            <span>© 2026 Wasteland Drone Cup. Rainbow Six Siege y Ubisoft son marcas registradas de Ubisoft Entertainment.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
