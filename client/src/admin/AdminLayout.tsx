import { useState, useEffect } from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import { getAdminSecret, setAdminSecret, clearAdminSecret } from '../api';
import { useSocketStatus } from './useSocket';
import type { ConnectionStatus } from './useSocket';
import { ASSETS } from '../public/assets';
import './admin.css';

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'Conectado',
  reconnecting: 'Reconectando…',
  disconnected: 'Desconectado',
};

export default function AdminLayout() {
  const [hasSecret, setHasSecret] = useState(false);
  const [input, setInput] = useState('');
  const socketStatus = useSocketStatus();

  useEffect(() => {
    setHasSecret(!!getAdminSecret());
  }, []);

  function handleSave() {
    if (input.trim()) {
      setAdminSecret(input.trim());
      setHasSecret(true);
      setInput('');
    }
  }

  function handleLogout() {
    clearAdminSecret();
    setHasSecret(false);
  }

  if (!hasSecret) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <div className="admin-login-header">
            <img
              src={ASSETS.r6Emblem}
              alt="Rainbow Six Siege"
              className="admin-login-emblem"
            />
            <span className="admin-login-eyebrow">Operación del Torneo</span>
            <h1 className="admin-login-title">
              Wasteland <em>Drone Cup</em>
            </h1>
            <div className="admin-login-badge">Panel de Administración</div>
          </div>

          <form
            className="admin-login-form"
            onSubmit={e => {
              e.preventDefault();
              handleSave();
            }}
          >
            <div className="admin-login-field">
              <label htmlFor="admin-secret-input" className="admin-login-label">
                Clave de Administración
              </label>
              <input
                id="admin-secret-input"
                type="password"
                className="admin-login-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Introduce la clave de acceso..."
                autoFocus
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary admin-login-btn"
              disabled={!input.trim()}
            >
              Entrar al Panel
            </button>
          </form>

          <div className="admin-login-footer">
            <Link to="/" className="admin-login-back-link">
              ← Volver a la web pública
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <div className="admin-sidebar-brand-row">
            <img src={ASSETS.r6Emblem} alt="R6" className="admin-sidebar-emblem" />
            <div>
              <div className="admin-sidebar-eyebrow">Operación R6</div>
              <h2 className="admin-sidebar-title">
                Drone Cup <em>Admin</em>
              </h2>
            </div>
          </div>
        </div>

        <nav className="admin-nav">
          <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="admin-nav-icon">⬢</span> Panel general
          </NavLink>
          <NavLink to="/admin/matches" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="admin-nav-icon">⚔</span> Partidas
          </NavLink>
          <NavLink to="/admin/teams" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="admin-nav-icon">🛡</span> Equipos
          </NavLink>
          <NavLink to="/admin/participants" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="admin-nav-icon">👤</span> Participantes
          </NavLink>
          <NavLink to="/admin/statistics" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="admin-nav-icon">📊</span> Estadísticas
          </NavLink>
          <NavLink to="/admin/export" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="admin-nav-icon">📥</span> Exportar
          </NavLink>
        </nav>

        <div className="admin-sidebar-footer">
          <div className={`admin-conn admin-conn-${socketStatus}`}>
            <span className="admin-conn-dot" />
            <span className="admin-conn-label">{STATUS_LABELS[socketStatus]}</span>
          </div>
          <button onClick={handleLogout} className="admin-logout-btn">
            Cerrar sesión admin
          </button>
          <Link to="/" className="admin-public-link">
            ← Web pública
          </Link>
        </div>
      </aside>

      <main className="admin-main">
        {socketStatus !== 'connected' && (
          <div className="admin-stale-banner">
            Los datos mostrados pueden estar desactualizados —{' '}
            {socketStatus === 'reconnecting'
              ? 'reconectando con el servidor…'
              : 'sin conexión con el servidor'}
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
