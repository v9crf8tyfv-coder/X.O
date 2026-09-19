'use client';

import { useEffect, useState } from 'react';

interface Stat {
  value: string;
  label: string;
  emoji?: string;
  count: number;
}

const BAR = '#7c5cff';

export default function EntryStatsSection() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    fetch('/api/entry-stats')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setStats(d.stats ?? []); setTotal(d.total ?? 0); })
      .catch(() => setError('Impossible de charger les statistiques.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  // (la barre représente la part sur 100 % — voir `pct` plus bas)

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 className="section-title">Statistiques d&apos;entrée</h2>
          <p className="section-sub">Comment les membres ont connu EmeriaMC.</p>
        </div>
        <button onClick={load} disabled={loading} style={{ padding: '8px 14px', borderRadius: 10, cursor: 'pointer', border: '1px solid var(--line)', background: 'transparent', color: 'var(--txt)', fontWeight: 600 }}>
          {loading ? '…' : 'Rafraîchir'}
        </button>
      </div>

      {/* Total */}
      <div style={{ display: 'flex', gap: 14, margin: '16px 0 22px', flexWrap: 'wrap' }}>
        <div style={{ padding: '14px 18px', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--panel)', minWidth: 140 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>Réponses totales</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>{total}</div>
        </div>
        <div style={{ padding: '14px 18px', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--panel)', minWidth: 200 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>Source n°1</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>
            {stats[0] && stats[0].count > 0 ? `${stats[0].label} (${stats[0].count})` : '—'}
          </div>
        </div>
      </div>

      {error && <p style={{ color: '#e88' }}>{error}</p>}

      {/* Tableau avec barres */}
      {!error && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', background: 'var(--panel)' }}>
          {stats.map((s, i) => {
            const pct = total ? Math.round((s.count / total) * 100) : 0;
            return (
              <div key={s.value} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', padding: '12px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6, alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>{s.emoji ? `${s.emoji} ` : ''}{s.label}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--muted)', fontSize: 13 }}>{s.count}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: BAR, background: 'rgba(124,92,255,.14)', borderRadius: 999, padding: '2px 9px', minWidth: 44, textAlign: 'center' }}>{pct}%</span>
                    </span>
                  </div>
                  <div style={{ height: 8, borderRadius: 6, background: 'rgba(124,92,255,.12)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: BAR, borderRadius: 6, transition: 'width .3s' }} />
                  </div>
                </div>
              </div>
            );
          })}
          {stats.length === 0 && !loading && (
            <div style={{ padding: 22, color: 'var(--muted)', textAlign: 'center' }}>Aucune donnée pour le moment.</div>
          )}
        </div>
      )}
    </div>
  );
}
