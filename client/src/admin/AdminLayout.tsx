import { useState, useEffect } from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import { getAdminSecret, setAdminSecret, clearAdminSecret } from '../api';
import './admin.css';

export default function AdminLayout() {
  const [hasSecret, setHasSecret] = useState(false);
  const [input, setInput] = useState('');

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
      <div className="admin-layout">
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', gap: 16, padding: 20, background: 'var(--bg-primary)'
        }}>
          <h2 style={{ color: 'var(--text-primary)', fontFamily: "'Rajdhani', sans-serif", fontSize: 24, margin: 0 }}>
            Admin — Drone Cup
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0, textAlign: 'center', maxWidth: 360 }}>
            Introduce la clave de administración para acceder al panel.
          </p>
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Admin secret"
              autoFocus
              style={{
                padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', borderRadius: 4, fontSize: 14, width: 240,
              }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!input.trim()}
            >
              Entrar
            </button>
          </form>
          <Link to="/" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none', marginTop: 12 }}>
            ← Volver a la web
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div style={{ padding: '0 20px 16px', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Torneo R6</div>
          <h2 style={{ padding: 0, border: 'none', margin: '4px 0 0 0', fontSize: 15, color: 'var(--text-primary)' }}>Wasteland Drone Cup</h2>
        </div>
        <nav>
          <NavLink to="/admin" end className={({ isActive }) => isActive ? 'active' : ''}>
            Panel general
          </NavLink>
          <NavLink to="/admin/matches" className={({ isActive }) => isActive ? 'active' : ''}>
            Partidas
          </NavLink>
          <NavLink to="/admin/teams" className={({ isActive }) => isActive ? 'active' : ''}>
            Equipos
          </NavLink>
          <NavLink to="/admin/participants" className={({ isActive }) => isActive ? 'active' : ''}>
            Participantes
          </NavLink>
        </nav>
        <div style={{ marginTop: 'auto', padding: '16px 20px 0', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleLogout}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12,
              cursor: 'pointer', padding: '4px 0', marginBottom: 8, textAlign: 'left', width: '100%',
            }}
          >
            Cerrar sesión admin
          </button>
          <Link to="/" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            ← Web pública
          </Link>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
