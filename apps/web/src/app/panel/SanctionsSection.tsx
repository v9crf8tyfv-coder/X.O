'use client';

import { useState } from 'react';

interface Sanction {
  id: string;
  actor: string;
  action: string;
  target: string;
  details: string | null;
  created_at: string;
}

const ACTION_STYLE: Record<string, { label: string; color: string }> = {
  Mute: { label: 'Mute', color: '#e0902f' },
  Unmute: { label: 'Unmute', color: '#3fae6a' },
  Tempban: { label: 'Ban', color: '#d64545' },
  Jail: { label: 'Jail', color: '#8b5cf6' },
  Unjail: { label: 'Unjail', color: '#3fae6a' },
  Freeze: { label: 'Freeze', color: '#3b82f6' },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris', // heure française, peu importe d'où on consulte
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Ordre d'affichage des filtres
const FILTER_ORDER = ['Mute', 'Tempban', 'Jail', 'Freeze', 'Unmute', 'Unjail'];

export default function SanctionsSection() {
  const [pseudo, setPseudo] = useState('');
  const [results, setResults] = useState<Sanction[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState('');
  const [filter, setFilter] = useState<string | null>(null); // null = tous
  const [canDelete, setCanDelete] = useState(false); // fonda uniquement
  const [busy, setBusy] = useState(false);

  async function search() {
    const q = pseudo.trim();
    if (q.length < 2) {
      setError('Entre au moins 2 caractères.');
      return;
    }
    setLoading(true);
    setError('');
    setFilter(null); // on repart sur "Tous" à chaque recherche
    try {
      const r = await fetch(`/api/sanctions?pseudo=${encodeURIComponent(q)}`);
      if (!r.ok) {
        setError(r.status === 403 ? 'Accès refusé.' : 'Erreur lors de la recherche.');
        setResults(null);
      } else {
        const data = await r.json();
        setResults(data.sanctions ?? []);
        setCanDelete(!!data.canDelete);
        setSearched(q);
      }
    } catch {
      setError('Impossible de contacter le serveur.');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  async function deleteOne(id: string) {
    if (!confirm('Supprimer cette sanction ? Elle disparaîtra aussi de l\'historique en jeu.')) return;
    setBusy(true);
    try {
      const r = await fetch('/api/sanctions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: searched, id }),
      });
      if (r.ok) setResults((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
      else setError(r.status === 403 ? 'Réservé aux fondateurs.' : 'Suppression échouée.');
    } catch {
      setError('Impossible de contacter le serveur.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAll() {
    if (!results?.length) return;
    if (!confirm(`Supprimer TOUTES les sanctions de ${searched} ? Elles disparaîtront aussi en jeu.`)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/sanctions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: searched }),
      });
      if (r.ok) setResults([]);
      else setError(r.status === 403 ? 'Réservé aux fondateurs.' : 'Suppression échouée.');
    } catch {
      setError('Impossible de contacter le serveur.');
    } finally {
      setBusy(false);
    }
  }

  // Types présents dans les résultats (pour n'afficher que les filtres utiles)
  const presentTypes = results
    ? FILTER_ORDER.filter((t) => results.some((s) => s.action === t))
    : [];
  const shown = results && filter ? results.filter((s) => s.action === filter) : results;

  return (
    <div className="sanctions-section">
      <h2 className="section-title">Gestion Sanction(s)</h2>
      <p className="section-sub">
        Recherche un joueur pour voir l&apos;historique de ses sanctions en jeu
        (mute, ban, jail, freeze…).
      </p>

      <div className="sanctions-search">
        <input
          type="text"
          value={pseudo}
          placeholder="Pseudo du joueur…"
          onChange={(e) => setPseudo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <button onClick={search} disabled={loading}>
          {loading ? 'Recherche…' : 'Rechercher'}
        </button>
      </div>

      {error && <p className="sanctions-error">{error}</p>}

      {results !== null && !error && (
        <div className="sanctions-results">
          {results.length === 0 ? (
            <p className="sanctions-empty">
              Aucune sanction trouvée pour <strong>{searched}</strong>.
            </p>
          ) : (
            <>
              <p className="sanctions-count">
                {results.length} sanction(s) pour <strong>{results[0]!.target}</strong>
                {canDelete && (
                  <button
                    onClick={deleteAll}
                    disabled={busy}
                    style={{
                      marginLeft: 12, padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                      border: '1px solid #d64545', background: 'rgba(214,69,69,.12)', color: '#e88',
                      fontSize: 12, fontWeight: 700,
                    }}
                  >
                    Tout supprimer
                  </button>
                )}
              </p>

              {presentTypes.length > 1 && (
                <div className="sanctions-filters">
                  <button
                    className={`filter-chip ${filter === null ? 'active' : ''}`}
                    onClick={() => setFilter(null)}
                  >
                    Tous ({results.length})
                  </button>
                  {presentTypes.map((t) => {
                    const st = ACTION_STYLE[t] ?? { label: t, color: '#888' };
                    const n = results.filter((s) => s.action === t).length;
                    return (
                      <button
                        key={t}
                        className={`filter-chip ${filter === t ? 'active' : ''}`}
                        onClick={() => setFilter(t)}
                        style={filter === t ? { background: st.color, borderColor: st.color, color: '#fff' } : { borderColor: st.color, color: st.color }}
                      >
                        {st.label} ({n})
                      </button>
                    );
                  })}
                </div>
              )}

              <ul className="sanctions-list">
                {shown!.map((s) => {
                  const st = ACTION_STYLE[s.action] ?? { label: s.action, color: '#888' };
                  return (
                    <li key={s.id} className="sanction-row">
                      <span className="sanction-badge" style={{ background: st.color }}>
                        {st.label}
                      </span>
                      <div className="sanction-body">
                        <div className="sanction-meta">
                          <span className="sanction-actor">par {s.actor}</span>
                          <span className="sanction-date">{fmtDate(s.created_at)}</span>
                        </div>
                        {s.details && <div className="sanction-details">{s.details}</div>}
                      </div>
                      {canDelete && (
                        <button
                          onClick={() => deleteOne(s.id)}
                          disabled={busy}
                          title="Supprimer cette sanction"
                          style={{
                            marginLeft: 'auto', width: 28, height: 28, flexShrink: 0, cursor: 'pointer',
                            borderRadius: 8, border: '1px solid rgba(214,69,69,.4)',
                            background: 'transparent', color: '#e88', fontSize: 16, lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
