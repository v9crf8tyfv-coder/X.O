'use client';

import { useCallback, useEffect, useState } from 'react';

interface Blk {
  id: string;
  world: string;
  x: number; y: number; z: number;
  cmd: string;
  type: string;
  breaking: boolean;
}

const DIM: Record<string, string> = { overworld: 'Overworld', the_nether: 'Nether', the_end: 'End' };
const TYPE: Record<string, { label: string; color: string }> = {
  impulse: { label: 'Impulsion', color: '#d9a441' },
  repeat: { label: 'Répétition', color: '#e0533d' },
  chain: { label: 'Chaîne', color: '#4a9bd4' },
};

export default function CmdBlocksSection() {
  const [blocks, setBlocks] = useState<Blk[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/cmdblocks', { cache: 'no-store' });
      if (!r.ok) { setBlocks([]); return; }
      const d = await r.json();
      setBlocks(Array.isArray(d.blocks) ? d.blocks : []);
    } catch { setBlocks([]); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // rafraîchit tout seul (le mod publie toutes les 10s)
    return () => clearInterval(t);
  }, [load]);

  async function broke(id: string) {
    if (!confirm('Casser ce command block en jeu ? (utile si une commande à répétition lag le serveur)')) return;
    setBusy(id);
    try {
      await fetch('/api/cmdblocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ break: id }),
      });
      await load();
    } finally { setBusy(null); }
  }

  return (
    <div className="launcher-sec">
      <h2>Command blocks</h2>
      <p className="lchr-hint">
        Chaque command block <b>chargé</b> (donc actif) apparaît ici. En cas de commande à répétition
        qui fait lag le serveur, clique <b>Broke</b> pour le casser directement en jeu.
      </p>

      <div className="lchr-card">
        <h3>
          Détectés <span className="lchr-count">{blocks?.length ?? 0}</span>
          <button className="btn-sec" style={{ marginLeft: 'auto', padding: '6px 12px' }} onClick={load}>
            Rafraîchir
          </button>
        </h3>

        {blocks === null ? (
          <p className="lchr-hint">Chargement…</p>
        ) : blocks.length === 0 ? (
          <p className="lchr-hint">Aucun command block chargé détecté pour l’instant.</p>
        ) : (
          <ul className="lchr-list">
            {blocks.map((b) => {
              const t = TYPE[b.type] ?? TYPE.impulse;
              return (
                <li key={b.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: t.color, border: `1px solid ${t.color}`, borderRadius: 6, padding: '1px 7px' }}>
                        {t.label}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--muted, #9a97a8)' }}>
                        {DIM[b.world] ?? b.world} · {b.x} {b.y} {b.z}
                      </span>
                    </div>
                    <code style={{ display: 'block', fontSize: 13, wordBreak: 'break-word', whiteSpace: 'pre-wrap', opacity: b.cmd ? 1 : 0.5 }}>
                      {b.cmd ? (b.cmd.startsWith('/') ? b.cmd : '/' + b.cmd) : '(aucune commande)'}
                    </code>
                  </div>
                  <button
                    className="btn-sec"
                    style={{ padding: '8px 16px', color: '#fff', background: b.breaking ? '#6b6b6b' : '#c0392b', borderColor: 'transparent', whiteSpace: 'nowrap' }}
                    disabled={busy === b.id || b.breaking}
                    onClick={() => broke(b.id)}
                  >
                    {b.breaking ? 'Cassage…' : busy === b.id ? '…' : 'Broke'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
