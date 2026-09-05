'use client';

import { useState, type CSSProperties } from 'react';
import { PANEL_SECTIONS, ACCESS_GRADES, type PanelSectionDef } from '@/lib/panelSections';

/**
 * Config d'accès (Fondateurs) : pour chaque catégorie du panel, coche 1 ou plusieurs
 * grades autorisés. Aucun coché = accès par défaut (niveau du grade). Stocké en base.
 */
export default function AccessSection({ initial }: { initial: Record<string, string[]> }) {
  const [access, setAccess] = useState<Record<string, string[]>>(initial || {});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const rows: PanelSectionDef[] = PANEL_SECTIONS.filter((s) => s.id !== 'profil' && !s.founderOnly);
  const gradesOf = (id: string): string[] => access[id] ?? [];

  function toggle(id: string, key: string) {
    setAccess((a) => {
      const cur = a[id] ?? [];
      const next = cur.includes(key) ? cur.filter((g) => g !== key) : [...cur, key];
      return { ...a, [id]: next };
    });
  }
  function clearRow(id: string) {
    setAccess((a) => ({ ...a, [id]: [] }));
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
  const chip = (on: boolean): CSSProperties => ({
    cursor: 'pointer', userSelect: 'none', fontSize: 12.5, padding: '5px 10px', borderRadius: 999,
    border: `1px solid ${on ? '#7c5cff' : 'rgba(255,255,255,.16)'}`,
    background: on ? 'rgba(124,92,255,.18)' : 'transparent', color: on ? '#fff' : '#b9b9c2',
  });

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Accès aux catégories</h2>
      <p style={{ color: muted, marginTop: 0 }}>
        Réservé aux Fondateurs. Coche les grades qui peuvent accéder à chaque catégorie.
        <b> Aucun grade coché = accès par défaut</b> (selon le niveau). Les Fondateurs voient toujours tout.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((s) => {
          const sel = gradesOf(s.id);
          return (
            <div key={s.id} style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '12px 14px', background: 'rgba(255,255,255,.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {s.icon && <span aria-hidden="true">{s.icon}</span>}
                <span style={{ fontWeight: 700, flex: 1 }}>{s.label}</span>
                {s.extraGrade === 'modo_x' && <span style={{ color: muted, fontSize: 12 }}>· Modérateur X toujours autorisé</span>}
                <span style={{ color: muted, fontSize: 12 }}>
                  {sel.length === 0 ? 'défaut' : `${sel.length} grade${sel.length > 1 ? 's' : ''}`}
                </span>
                {sel.length > 0 && (
                  <button onClick={() => clearRow(s.id)} style={{ ...chip(false), padding: '4px 8px' }}>Réinitialiser</button>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ACCESS_GRADES.map((g) => (
                  <button key={g.key} type="button" onClick={() => toggle(s.id, g.key)} style={chip(sel.includes(g.key))}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18 }}>
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
