import { useState, useEffect, useCallback } from 'react';
import { api, type TeamData } from '../api';
import { useRefetchOnReconnect } from './useSocket';
import { useAdminToast, AdminToast } from './AdminToast';

const REGISTRATION_TYPES = [
  { value: '', label: '— Sin tipo —' },
  { value: 'google_forms', label: 'Google Forms' },
  { value: 'typeform', label: 'Typeform' },
  { value: 'external', label: 'Enlace externo' },
];

const REGISTRATION_PLATFORMS = [
  { value: '', label: '— Sin plataforma —' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'discord', label: 'Discord' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'google_forms', label: 'Google Forms' },
  { value: 'typeform', label: 'Typeform' },
  { value: 'external', label: 'Enlace externo' },
];

interface CreatorForm {
  registrationUrl: string;
  registrationType: string;
  registrationPlatform: string;
  communityNote: string;
}

export default function Creators() {
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forms, setForms] = useState<Record<string, CreatorForm>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const { toast, showToast, dismissToast } = useAdminToast();

  const loadTeams = useCallback(async () => {
    try {
      const data = await api.getTeams();
      setTeams(data);
      const initial: Record<string, CreatorForm> = {};
      for (const t of data) {
        initial[t.id] = {
          registrationUrl: t.registrationUrl ?? '',
          registrationType: t.registrationType ?? '',
          registrationPlatform: t.registrationPlatform ?? '',
          communityNote: t.communityNote ?? '',
        };
      }
      setForms(initial);
      setError('');
    } catch {
      setError('Error al cargar equipos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeams(); }, [loadTeams]);
  useRefetchOnReconnect(loadTeams);

  function updateField(teamId: string, field: keyof CreatorForm, value: string) {
    setForms(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], [field]: value },
    }));
  }

  function hasChanges(team: TeamData): boolean {
    const form = forms[team.id];
    if (!form) return false;
    return (
      form.registrationUrl !== (team.registrationUrl ?? '') ||
      form.registrationType !== (team.registrationType ?? '') ||
      form.registrationPlatform !== (team.registrationPlatform ?? '') ||
      form.communityNote !== (team.communityNote ?? '')
    );
  }

  async function handleSave(team: TeamData) {
    const form = forms[team.id];
    if (!form) return;

    setSaving(prev => ({ ...prev, [team.id]: true }));
    try {
      const payload: Record<string, string | null> = {};
      if (form.registrationUrl !== (team.registrationUrl ?? '')) {
        payload.registrationUrl = form.registrationUrl || null;
      }
      if (form.registrationType !== (team.registrationType ?? '')) {
        payload.registrationType = form.registrationType || null;
      }
      if (form.registrationPlatform !== (team.registrationPlatform ?? '')) {
        payload.registrationPlatform = form.registrationPlatform || null;
      }
      if (form.communityNote !== (team.communityNote ?? '')) {
        payload.communityNote = form.communityNote || null;
      }

      if (Object.keys(payload).length === 0) return;

      await api.updateTeamRegistration(team.id, payload);
      showToast('success', `${team.name} actualizado correctamente`);
      await loadTeams();
    } catch (err: any) {
      const msg = err?.error?.message || 'Error al guardar cambios';
      showToast('error', msg);
    } finally {
      setSaving(prev => ({ ...prev, [team.id]: false }));
    }
  }

  if (loading) return <div className="admin-loading">Cargando creadores…</div>;
  if (error) return <div className="admin-error">{error}</div>;

  return (
    <div className="admin-page">
      <AdminToast toast={toast} onDismiss={dismissToast} />
      <div className="admin-page-header">
        <h1>Creadores</h1>
        <p className="admin-page-desc">Configuración de inscripción de cada creador.</p>
      </div>

      <div className="admin-creators-grid">
        {teams.map(team => {
          const form = forms[team.id];
          if (!form) return null;
          const changed = hasChanges(team);
          const isSaving = saving[team.id] ?? false;

          return (
            <div
              key={team.id}
              className="admin-creator-card"
              style={{ borderTopColor: team.color ?? 'var(--border)' }}
            >
              <div className="admin-creator-header">
                <span
                  className="admin-creator-dot"
                  style={{ background: team.color ?? 'var(--text-muted)' }}
                />
                <h3 className="admin-creator-name">{team.name}</h3>
                <span className="admin-creator-slug">/{team.slug}</span>
              </div>

              <div className="admin-creator-fields">
                <label className="admin-field-label">
                  URL de inscripción
                  <input
                    type="url"
                    className="admin-field-input"
                    value={form.registrationUrl}
                    onChange={e => updateField(team.id, 'registrationUrl', e.target.value)}
                    placeholder="https://..."
                  />
                </label>

                <label className="admin-field-label">
                  Tipo de inscripción
                  <select
                    className="admin-field-input"
                    value={form.registrationType}
                    onChange={e => updateField(team.id, 'registrationType', e.target.value)}
                  >
                    {REGISTRATION_TYPES.map(rt => (
                      <option key={rt.value} value={rt.value}>{rt.label}</option>
                    ))}
                  </select>
                </label>

                <label className="admin-field-label">
                  Plataforma
                  <select
                    className="admin-field-input"
                    value={form.registrationPlatform}
                    onChange={e => updateField(team.id, 'registrationPlatform', e.target.value)}
                  >
                    {REGISTRATION_PLATFORMS.map(rp => (
                      <option key={rp.value} value={rp.value}>{rp.label}</option>
                    ))}
                  </select>
                </label>

                <label className="admin-field-label">
                  Nota de comunidad
                  <textarea
                    className="admin-field-input admin-field-textarea"
                    value={form.communityNote}
                    onChange={e => updateField(team.id, 'communityNote', e.target.value)}
                    placeholder="Instrucciones para la comunidad..."
                    rows={2}
                    maxLength={500}
                  />
                  <span className="admin-field-counter">{form.communityNote.length}/500</span>
                </label>
              </div>

              <div className="admin-creator-actions">
                <button
                  className="btn btn-primary admin-creator-save"
                  disabled={!changed || isSaving}
                  onClick={() => handleSave(team)}
                >
                  {isSaving ? 'Guardando…' : 'Guardar'}
                </button>
                {changed && (
                  <span className="admin-creator-unsaved">Cambios sin guardar</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
