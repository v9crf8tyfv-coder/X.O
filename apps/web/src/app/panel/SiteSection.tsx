'use client';

import { useCallback, useEffect, useState } from 'react';
import { getGrade } from '@xo/shared';

interface SiteAccount {
  id: string;
  username: string;
  site_grade: string;
  site_grades: string[];
  is_founder_chief: boolean;
  minecraft_pseudo: string | null;
  created_at: string;
}

// Rôles d'accès SITE attribuables (pas de modo pour l'instant, pas "joueur" = aucun rôle)
const ROLE_OPTIONS = [
  'fondateur',
  'cofondateur',
  'responsable',
  'admin',
  'dev',
  'buildeur',
  'com',
  'modo',
  'betatesteur',
];

export default function SiteSection({ isChief }: { myGrade: string; isChief: boolean }) {
  const [accounts, setAccounts] = useState<SiteAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts');
      if (!res.ok) {
        setError('Accès refusé ou erreur serveur.');
        return;
      }
      setAccounts(await res.json());
      setError('');
    } catch {
      setError('Impossible de contacter le serveur.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Chargement + synchro (poll toutes les 5s)
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function toggleRole(a: SiteAccount, role: string) {
    const has = a.site_grades.includes(role);
    const next = has ? a.site_grades.filter((r) => r !== role) : [...a.site_grades, role];
    // maj optimiste
    setAccounts((prev) =>
      prev.map((x) => (x.id === a.id ? { ...x, site_grades: next } : x)),
    );
    setError('');
    const res = await fetch(`/api/accounts/${a.id}/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grades: next }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Modification refusée.');
    }
    load();
  }

  // Transfert du "jaune" (fondateur principal) — chef uniquement, avec code
  async function transferChief(a: SiteAccount) {
    const code = window.prompt(
      `Transférer le fondateur principal 🟡 à « ${a.username} » ?\nEntre le code de confirmation :`,
    );
    if (!code) return;
    setError('');
    const res = await fetch(`/api/accounts/${a.id}/chief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Transfert refusé.');
    }
    load();
  }

  const filtered = accounts.filter(
    (a) =>
      a.username.toLowerCase().includes(q.toLowerCase()) ||
      (a.minecraft_pseudo ?? '').toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="site-section">
      <div className="site-head">
        <div>
          <h2>Gestion Site</h2>
          <p className="site-sub">
            Accès au <strong>site</strong> uniquement (ni Discord, ni jeu). Clique un rôle
            pour l’ajouter/retirer. {accounts.length} compte
            {accounts.length > 1 ? 's' : ''}.
          </p>
        </div>
        <input
          className="site-search"
          placeholder="Rechercher un compte…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading ? (
        <p className="site-sub">Chargement…</p>
      ) : (
        <div className="site-table">
          {filtered.map((a) => (
            <div className="site-row" key={a.id}>
              <div className="site-user">
                <div>
                  <div className="site-username">
                    {a.username}
                    {a.is_founder_chief && (
                      <span className="chief-dot" title="Fondateur principal" />
                    )}
                    {a.site_grades.length === 0 && (
                      <span className="site-joueur">Joueur</span>
                    )}
                  </div>
                  <div className="site-meta">
                    {a.minecraft_pseudo ? `⛏️ ${a.minecraft_pseudo}` : '—'} · créé le{' '}
                    {a.created_at}
                  </div>
                </div>
              </div>
              <div className="site-actions">
                {isChief && a.site_grades.includes('fondateur') && !a.is_founder_chief && (
                  <button
                    className="give-yellow"
                    onClick={() => transferChief(a)}
                    title="Transférer le fondateur principal"
                  >
                    🟡 Donner le jaune
                  </button>
                )}
                <div className="site-chips">
                {ROLE_OPTIONS.map((role) => {
                  const active = a.site_grades.includes(role);
                  const g = getGrade(role);
                  // Verrous : fondateur géré par le chef seulement ; chef non retirable
                  const locked =
                    (role === 'fondateur' && !isChief) ||
                    (role === 'fondateur' && a.is_founder_chief);
                  return (
                    <button
                      key={role}
                      className={`chip ${active ? 'active' : ''} ${locked ? 'locked' : ''}`}
                      disabled={locked}
                      title={locked ? 'Réservé au fondateur principal' : ''}
                      style={
                        active
                          ? { backgroundColor: `#${g.color}`, borderColor: `#${g.color}` }
                          : { color: `#${g.color}`, borderColor: `#${g.color}55` }
                      }
                      onClick={() => toggleRole(a, role)}
                    >
                      {g.label}
                    </button>
                  );
                })}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="site-sub">Aucun compte trouvé.</p>}
        </div>
      )}
    </div>
  );
}
