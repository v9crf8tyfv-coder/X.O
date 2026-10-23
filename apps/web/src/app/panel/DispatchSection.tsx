'use client';

import { useState } from 'react';
import { DISPATCH } from '@xo/shared';

type Side = 'com' | 'rp';

export default function DispatchSection({ myGrades, isAdmin }: { myGrades: string[]; isAdmin: boolean }) {
  const [tag, setTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const sides = (['com', 'rp'] as Side[]).filter(
    (s) => isAdmin || myGrades.includes(DISPATCH[s].managerGrade),
  );

  async function act(side: Side, on: boolean) {
    if (!tag.trim()) { setErr('Entre le pseudo Discord du staff.'); setMsg(''); return; }
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: tag.trim(), side, on }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error ?? 'Erreur.');
      else setMsg(`Rôle ${DISPATCH[side].label} ${on ? 'posé' : 'retiré'} pour ${tag.trim()} (le bot l'applique sous ~5 s).`);
    } catch {
      setErr('Erreur réseau.');
    }
    setBusy(false);
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ margin: '0 0 6px' }}>Dispatching</h2>
      <p style={{ color: 'var(--muted, #8a8f98)', fontSize: 14, margin: '0 0 16px' }}>
        Pose ou retire le rôle d&apos;accès sur le serveur Discord concerné pour un membre du staff.
      </p>

      {sides.length === 0 ? (
        <p style={{ color: 'var(--muted, #8a8f98)' }}>Tu n&apos;as aucun côté à dispatcher.</p>
      ) : (
        <>
          <label style={{ fontSize: 13, fontWeight: 700 }}>Pseudo Discord du staff</label>
          <input
            className="btn-sec"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="ex : xtazzking"
            style={{ display: 'block', width: '100%', padding: '10px 12px', margin: '6px 0 16px' }}
          />

          {sides.map((s) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 10px' }}>
              <span style={{ minWidth: 120, fontWeight: 700 }}>Serveur {DISPATCH[s].label}</span>
              <button className="btn-sec" disabled={busy} onClick={() => act(s, true)}
                style={{ padding: '8px 14px' }}>Donner l&apos;accès</button>
              <button className="btn-sec" disabled={busy} onClick={() => act(s, false)}
                style={{ padding: '8px 14px' }}>Retirer</button>
            </div>
          ))}
        </>
      )}

      {err && <p style={{ color: 'var(--danger, #e0413e)', fontSize: 13, marginTop: 12 }}>{err}</p>}
      {msg && <p style={{ color: 'var(--ok, #3ba55d)', fontSize: 13, marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
