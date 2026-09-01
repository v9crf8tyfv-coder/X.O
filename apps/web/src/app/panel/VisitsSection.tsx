'use client';

import { useEffect, useState } from 'react';

interface Week { week: string; views: number; visitors: number }
interface Page { path: string; views: number }
interface Data { weeks: Week[]; pages: Page[]; thisWeek: { views: number; visitors: number } }

function frDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export default function VisitsSection() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/visits')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Accès refusé'))))
      .then(setData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="soon-card"><h2>Trafic du site</h2><p>Chargement…</p></div>;
  if (error) return <div className="soon-card"><h2>Trafic du site</h2><p>{error}</p></div>;

  const weeks = data?.weeks ?? [];
  const pages = data?.pages ?? [];
  const max = Math.max(1, ...weeks.map((w) => w.views));
  const muted = 'var(--muted, #8a8a94)';

  return (
    <div className="launcher-sec">
      <h2 style={{ marginBottom: 6 }}>Trafic du site</h2>
      <p style={{ color: muted, marginBottom: 18 }}>
        Vues et visiteurs du site public (emeria-site), par semaine.
      </p>

      {/* Résumé de la semaine en cours */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <Stat label="Vues cette semaine" value={data?.thisWeek.views ?? 0} />
        <Stat label="Visiteurs uniques" value={data?.thisWeek.visitors ?? 0} />
      </div>

      <div className="lchr-card">
        <h3>Par semaine (8 dernières)</h3>
        {weeks.length === 0 ? (
          <p className="lchr-hint">Aucune donnée pour l’instant. Les visites s’enregistreront dès que des joueurs iront sur le site.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {weeks.map((w) => (
              <div key={w.week} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 56, fontSize: 13, color: muted, fontVariantNumeric: 'tabular-nums' }}>
                  {frDate(w.week)}
                </span>
                <div style={{ flex: 1, height: 22, background: 'rgba(255,255,255,.06)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.round((w.views / max) * 100)}%`, height: '100%',
                    background: 'var(--accent, #7c5cff)', borderRadius: 6, transition: 'width .4s ease',
                  }} />
                </div>
                <span style={{ width: 120, textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                  <b>{w.views}</b> vues · {w.visitors} visit.
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="lchr-card">
        <h3>Pages les plus vues (cette semaine)</h3>
        {pages.length === 0 ? (
          <p className="lchr-hint">Aucune donnée pour l’instant.</p>
        ) : (
          <ul className="lchr-list">
            {pages.map((p) => (
              <li key={p.path}>
                <span>{p.path}</span>
                <span style={{ color: muted, fontVariantNumeric: 'tabular-nums' }}>{p.views} vues</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      flex: '1 1 160px', minWidth: 150, background: 'var(--panel, rgba(255,255,255,.03))',
      border: '1px solid var(--line, rgba(255,255,255,.08))', borderRadius: 14, padding: '16px 18px',
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--muted, #8a8a94)', marginTop: 2 }}>{label}</div>
    </div>
  );
}
