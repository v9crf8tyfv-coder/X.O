'use client';

import { useEffect, useState } from 'react';
import { getGrade } from '@xo/shared';

interface Me {
  username: string;
  site_grade: string;
  is_founder_chief: boolean;
}

export default function Accueil() {
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mcPseudo, setMcPseudo] = useState('');
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');

  // Récupère la session au chargement
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setMe(data))
      .catch(() => {});
  }, []);

  async function submit() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${tab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          tab === 'register'
            ? { username, password, minecraftPseudo: mcPseudo }
            : { username, password },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue.');
      } else {
        setMe(data);
        setOpen(false);
        setUsername('');
        setPassword('');
      }
    } catch {
      setError('Impossible de contacter le serveur.');
    } finally {
      setLoading(false);
    }
  }

  function launch() {
    if (!me) {
      setOpen(true);
      setError('Connecte-toi pour lancer l’accueil.');
      return;
    }
    setLaunching(true);
    // Animation de chargement puis redirection vers le panel
    setTimeout(() => {
      window.location.href = '/panel';
    }, 1200);
  }

  const gradeColor = me ? getGrade(me.site_grade).color : 'ffffff';

  return (
    <div className="accueil">
      <div className="topbar">
        <div className="account-wrap">
          {me && (
            <span
              className="grade-bubble"
              style={{ backgroundColor: `#${gradeColor}`, color: `#${gradeColor}` }}
              title={me.site_grade}
            />
          )}
          <div className="account-box" onClick={() => setOpen((o) => !o)}>
            {me ? (
              <>
                {me.is_founder_chief && <span>👑</span>}
                <span>{me.username}</span>
              </>
            ) : (
              <span>Aucun Compte</span>
            )}
          </div>

          {open && !me && (
            <div className="dropdown">
              <div className="tabs">
                <button
                  className={`tab ${tab === 'login' ? 'active' : ''}`}
                  onClick={() => setTab('login')}
                >
                  Connexion
                </button>
                <button
                  className={`tab ${tab === 'register' ? 'active' : ''}`}
                  onClick={() => setTab('register')}
                >
                  Créer un compte
                </button>
              </div>

              {error && <div className="form-error">{error}</div>}

              <div className="field">
                <label>Pseudo</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="TonPseudo"
                />
              </div>
              <div className="field">
                <label>Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              {tab === 'register' && (
                <div className="field">
                  <label>Pseudo Minecraft</label>
                  <input
                    value={mcPseudo}
                    onChange={(e) => setMcPseudo(e.target.value)}
                    placeholder="TonPseudoMC"
                  />
                  <span className="field-hint">
                    Mets bien le pseudo Minecraft que tu utiliseras — sinon les grades ne
                    pourront pas t’être appliqués en jeu.
                  </span>
                </div>
              )}
              <button className="btn-submit" onClick={submit} disabled={loading}>
                {loading ? (
                  <span className="spinner" />
                ) : tab === 'login' ? (
                  'Se connecter'
                ) : (
                  'Créer le compte'
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="hero">
        <h1>X.O</h1>
        <p>
          Le panel de gestion du staff. Connecte-toi puis lance l’accueil pour accéder à
          ton espace.
        </p>
        <button className="btn-launch" onClick={launch} disabled={launching}>
          {launching ? <span className="spinner" /> : "Lancer l'accueil"}
        </button>
      </div>
    </div>
  );
}
