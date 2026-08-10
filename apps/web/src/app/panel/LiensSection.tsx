'use client';

import { useCallback, useEffect, useState } from 'react';
import { getGrade, isFounderTier } from '@xo/shared';
import { GradeBadge } from './GradeBadge';

interface Link {
  id: string;
  title: string;
  url: string;
  grade: string;
  created_at: string;
}

const GRADE_CHOICES = [
  'fondateur',
  'cofondateur',
  'responsable',
  'admin',
  'dev',
  'buildeur',
  'com',
  'modo',
  'betatesteur',
  'joueur',
];

export default function LiensSection({ myGrade }: { myGrade: string }) {
  const founder = isFounderTier(myGrade);
  const [links, setLinks] = useState<Link[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [grade, setGrade] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/links');
      if (r.ok) setLinks(await r.json());
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 90_000);
    return () => clearInterval(t);
  }, [load]);

  async function add() {
    setError('');
    const res = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, url, grade }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Ajout refusé.');
      return;
    }
    setAdding(false);
    setTitle('');
    setUrl('');
    setGrade('');
    load();
  }
  async function del(id: string) {
    await fetch(`/api/links?id=${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="site-section">
      <div className="site-head">
        <div>
          <h2>Liens utiles</h2>
          <p className="site-sub">Les liens destinés à ton grade et en dessous.</p>
        </div>
        {founder && (
          <button className="btn-submit add-staff" onClick={() => setAdding((a) => !a)}>
            + Ajouter
          </button>
        )}
      </div>
      {error && <div className="form-error">{error}</div>}

      {adding && founder && (
        <div className="add-form">
          <div className="add-grid">
            <input placeholder="Titre du lien" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            <select value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">— Destiné à —</option>
              {GRADE_CHOICES.map((k) => (
                <option key={k} value={k}>
                  {k === 'joueur' ? 'Joueur' : getGrade(k).label}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-submit" onClick={add}>
            Créer
          </button>
        </div>
      )}

      <div className="record-list">
        {links.length === 0 && <p className="site-sub">Aucun lien pour l’instant.</p>}
        {links.map((l) => (
          <div className="link-row" key={l.id}>
            <GradeBadge gk={l.grade} />
            <div className="link-info">
              <a className="link-title" href={l.url} target="_blank" rel="noreferrer">
                {l.title}
              </a>
              <span className="link-url">{l.url}</span>
            </div>
            <span className="site-sub">{l.grade === 'joueur' ? 'Joueur' : getGrade(l.grade).label}</span>
            {founder && (
              <button className="chip locked" onClick={() => del(l.id)}>
                Suppr
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
