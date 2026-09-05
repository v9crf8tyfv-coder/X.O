'use client';

import { useState, type CSSProperties } from 'react';
import { PANEL_SECTIONS, ACCESS_LEVELS, type PanelSectionDef } from '@/lib/panelSections';

/**
 * Config d'accès (Fondateurs) : définit, pour chaque catégorie du panel,
 * le grade minimum requis pour y accéder. Enregistré côté serveur (app_config).
 */
export default function AccessSection({ initial }: { initial: Record<string, number> }) {
  const [access, setAccess] = useState<Record<string, number>>(initial || {});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Toutes les catégories sauf le Profil (toujours ouvert) et « Accès » (toujours Fonda).
  const rows: PanelSectionDef[] = PANEL_SECTIONS.filter((s) => s.id !== 'profil' && !s.founderOnly);
  const levelOf = (s: PanelSectionDef) => access[s.id] ?? s.defaultLevel;

  function setLevel(id: string, lvl: number) {
    setAccess((a) => ({ ...a, [id]: lvl }));
  }

  async function save() {
    setSaving(true);
    setMsg('');
    try {
      const r = await fetch('/api/panel-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access }),
      });
      setMsg(r.ok ? 'Enregistré. Les membres verront le changement à leur prochaine ouverture du panel.' : 'Échec de l’enregistrement.');
    } catch {
      setMsg('Échec de l’enregistrement.');
    } finally {
      setSaving(false);
    }
  }

  const muted = 'var(--muted, #8a8a94)';
  const sel: CSSProperties = {
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.14)',
    borderRadius: 8, color: '#e8e8ec', padding: '8px 10px', font: 'inherit',
  };

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Accès aux catégories</h2>
      <p style={{ color: muted, marginTop: 0 }}>
        Réservé aux Fondateurs. Choisis, pour chaque catégorie, le grade minimum qui peut y accéder.
        La catégorie « Accès » reste toujours réservée aux Fondateurs.
      </p>

      <div style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, overflow: 'hidden' }}>
        {rows.map((s, i) => (
          <div
            key={s.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,.07)',
            }}
          >
            <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              {s.icon && <span aria-hidden="true">{s.icon}</span>}
              <span style={{ fontWeight: 600 }}>{s.label}</span>
              {s.soon && <span style={{ color: muted, fontSize: 12 }}>(bientôt)</span>}
              {s.extraGrade === 'modo_x' && <span style={{ color: muted, fontSize: 12 }}>· + Modérateur X</span>}
            </span>
            <select style={sel} value={levelOf(s)} onChange={(e) => setLevel(s.id, Number(e.target.value))}>
              {ACCESS_LEVELS.map((l) => (
                <option key={l.level} value={l.level}>{l.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{ background: '#7c5cff', color: '#fff', border: 0, borderRadius: 10, padding: '11px 20px', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {msg && <span style={{ color: muted, fontSize: 13 }}>{msg}</span>}
      </div>
    </div>
  );
}
