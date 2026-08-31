'use client';

import { useEffect, useState } from 'react';

/** Gère les Responsables support (accès au support du site officiel). Fonda/co-fonda. */
export default function SupportStaffSection() {
  const [staff, setStaff] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/support-staff');
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Accès refusé.');
      setStaff((await r.json()).staff || []);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    const pseudo = input.trim();
    if (!pseudo) return;
    setError('');
    const r = await fetch('/api/support-staff', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pseudo }),
    });
    if (r.ok) { setStaff((await r.json()).staff || []); setInput(''); }
    else setError((await r.json().catch(() => ({}))).error || 'Échec de l’ajout.');
  }
  async function del(pseudo: string) {
    if (!confirm(`Retirer ${pseudo} des Responsables support ?`)) return;
    const r = await fetch(`/api/support-staff?pseudo=${encodeURIComponent(pseudo)}`, { method: 'DELETE' });
    if (r.ok) setStaff((await r.json()).staff || []);
    else setError((await r.json().catch(() => ({}))).error || 'Échec de la suppression.');
  }

  return (
    <div className="launcher-sec">
      <h2 style={{ marginBottom: 6 }}>Support — Responsables</h2>
      <p style={{ color: 'var(--muted, #8a8a94)', marginBottom: 18 }}>
        Ces pseudos ont accès au <strong>support du site officiel</strong> (répondre aux tickets), en plus des
        Fondateurs et du grade Responsable.
      </p>

      {error && (
        <div style={{ background: 'rgba(220,60,60,.14)', border: '1px solid rgba(220,60,60,.4)', color: '#ffb4b4', padding: '10px 14px', borderRadius: 10, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="lchr-card">
        <h3>Responsables support <span className="lchr-count">{staff.length}</span></h3>
        {loading ? (
          <p className="lchr-hint">Chargement…</p>
        ) : staff.length ? (
          <ul className="lchr-list">
            {staff.map((p) => (
              <li key={p}><span>{p}</span><button className="lchr-x" onClick={() => del(p)}>Retirer</button></li>
            ))}
          </ul>
        ) : (
          <p className="lchr-hint">Aucun pour l’instant (les Fondateurs et Responsables ont déjà accès).</p>
        )}
        <div className="lchr-add" style={{ marginTop: 12 }}>
          <input
            className="btn-sec"
            style={{ flex: 1, minWidth: 160 }}
            placeholder="Pseudo Minecraft"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          />
          <button className="btn-accent" onClick={add}>Ajouter</button>
        </div>
      </div>
    </div>
  );
}
