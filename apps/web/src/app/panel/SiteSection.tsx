'use client';

import { useCallback, useEffect, useState } from 'react';
import { getGrade } from '@xo/shared';

interface SiteAccount {
  id: string;
  username: string;
  site_grade: string;
  is_founder_chief: boolean;
  minecraft_pseudo: string | null;
  created_at: string;
}

// Grades d'accès SITE attribuables (pas de modo pour l'instant)
const GRADE_OPTIONS = [
  'joueur',
  'fondateur',
  'cofondateur',
  'responsable',
  'admin',
  'dev',
  'buildeur',
  'com',
];

function gradeLabel(key: string): string {
  return key === 'joueur' ? 'Joueur' : getGrade(key).label;
}
function gradeColor(key: string): string {
  return key === 'joueur' ? 'ffffff' : getGrade(key).color;
}

export default function SiteSection({
  myGrade,
  isChief,
}: {
  myGrade: string;
  isChief: boolean;
}) {
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

  async function changeGrade(id: string, grade: string) {
    setError('');
    const res = await fetch(`/api/accounts/${id}/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Modification refusée.');
    }
    load(); // resynchronise immédiatement
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
            Accès au <strong>site</strong> uniquement (ne touche ni Discord ni le jeu).
            {' '}
            {accounts.length} compte{accounts.length > 1 ? 's' : ''}.
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
          {filtered.map((a) => {
            // Règle : seul le chef gère un compte fondateur
            const locked = a.site_grade === 'fondateur' && !isChief;
            return (
              <div className="site-row" key={a.id}>
                <div className="site-user">
                  <span
                    className="grade-bubble"
                    style={{
                      backgroundColor: `#${gradeColor(a.site_grade)}`,
                      color: `#${gradeColor(a.site_grade)}`,
                    }}
                  />
                  <div>
                    <div className="site-username">
                      {a.username}
                      {a.is_founder_chief && (
                        <span className="chief-dot" title="Fondateur principal" />
                      )}
                    </div>
                    <div className="site-meta">
                      {a.minecraft_pseudo ? `⛏️ ${a.minecraft_pseudo}` : '—'} · créé le{' '}
                      {a.created_at}
                    </div>
                  </div>
                </div>
                <select
                  className="site-grade-select"
                  value={a.site_grade}
                  disabled={locked}
                  title={locked ? 'Seul le fondateur principal gère les fondateurs' : ''}
                  onChange={(e) => changeGrade(a.id, e.target.value)}
                >
                  {GRADE_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {gradeLabel(k)}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="site-sub">Aucun compte trouvé.</p>}
        </div>
      )}
    </div>
  );
}
