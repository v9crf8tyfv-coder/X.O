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
  const [backup, setBackup] = useState<{ count: number; savedAt: string | null }>({ count: 0, savedAt: null });
  const [restoring, setRestoring] = useState(false);
  const [action, setAction] = useState<'save' | 'restore' | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/cmdblocks', { cache: 'no-store' });
      if (!r.ok) { setBlocks([]); return; }
      const d = await r.json();
      setBlocks(Array.isArray(d.blocks) ? d.blocks : []);
      if (d.backup) setBackup(d.backup);
      setRestoring(!!d.restoring);
    } catch { setBlocks([]); }
  }, []);

  async function doAction(kind: 'save' | 'restore') {
    if (kind === 'restore' && !confirm('Restaurer la sauvegarde ? Tous les command blocks sauvegardés seront reposés en jeu (avec leurs commandes et réglages).')) return;
    if (kind === 'save' && !confirm('Sauvegarder l’état actuel de tous les command blocks détectés ? (écrase la sauvegarde précédente)')) return;
    setAction(kind);
    try {
      await fetch('/api/cmdblocks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'save' ? { save: true } : { restore: true }),
      });
      await load();
    } finally { setAction(null); }
  }

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 15000); // auto-refresh, mais STOP si onglet caché (quota Vercel)
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

  const q = query.trim().toLowerCase();
  const filtered = q
    ? (blocks ?? []).filter((b) =>
        (b.cmd ?? '').toLowerCase().includes(q)
        || `${b.x} ${b.y} ${b.z}`.includes(q)
        || (DIM[b.world] ?? b.world).toLowerCase().includes(q)
        || (TYPE[b.type]?.label ?? '').toLowerCase().includes(q))
    : (blocks ?? []);

  return (
    <div className="launcher-sec">
      <h2>Command blocks</h2>
      <p className="lchr-hint">
        Chaque command block <b>chargé</b> (donc actif) apparaît ici. En cas de commande à répétition
        qui fait lag le serveur, clique <b>Broke</b> pour le casser directement en jeu.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '0 0 14px' }}>
        <button className="btn-accent" onClick={() => doAction('save')} disabled={action !== null}>
          {action === 'save' ? 'Sauvegarde…' : '💾 Sauvegarder'}
        </button>
        <button className="btn-sec" style={{ padding: '10px 16px' }} onClick={() => doAction('restore')} disabled={action !== null || backup.count === 0}>
          {action === 'restore' ? 'Restauration…' : '♻️ Restaurer la sauvegarde'}
        </button>
        <span className="lchr-hint" style={{ margin: 0 }}>
          {backup.count > 0
            ? `Sauvegarde : ${backup.count} bloc(s)${backup.savedAt ? ' · ' + new Date(backup.savedAt).toLocaleString('fr-FR') : ''}`
            : 'Aucune sauvegarde'}
          {restoring ? ' · restauration en cours…' : ''}
        </span>
      </div>

      <div className="lchr-card">
        <h3>
          Détectés <span className="lchr-count">{q ? `${filtered.length}/${blocks?.length ?? 0}` : (blocks?.length ?? 0)}</span>
          <button className="btn-sec" style={{ marginLeft: 'auto', padding: '6px 12px' }} onClick={load}>
            Rafraîchir
          </button>
        </h3>

        <div style={{ position: 'relative', margin: '0 0 12px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (commande, coordonnées, dimension, type)…"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '9px 32px 9px 12px',
              borderRadius: 8, border: '1px solid var(--line, rgba(255,255,255,.12))',
              background: 'var(--bg, #0e0e12)', color: 'var(--txt, #e8e8ec)', fontSize: 14,
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              title="Effacer"
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 0, color: 'var(--muted, #9a97a8)', cursor: 'pointer', fontSize: 18, lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>

        {blocks === null ? (
          <p className="lchr-hint">Chargement…</p>
        ) : blocks.length === 0 ? (
          <p className="lchr-hint">Aucun command block chargé détecté pour l’instant.</p>
        ) : filtered.length === 0 ? (
          <p className="lchr-hint">Aucun résultat pour « {query} ».</p>
        ) : (
          <ul className="lchr-list">
            {filtered.map((b) => {
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
