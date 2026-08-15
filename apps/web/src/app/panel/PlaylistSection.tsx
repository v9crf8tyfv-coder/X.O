'use client';

import { useCallback, useEffect, useState } from 'react';
import { ALL_GRADES, getGrade } from '@xo/shared';
import { GradeBadge } from './GradeBadge';

interface Entry {
  id: number;
  pseudo: string;
  grade: string;
}

const GRADE_KEYS = Object.keys(ALL_GRADES).filter((k) => k !== 'joueur');

/** Liste PUREMENT esthétique (pseudo -> grade) pour le /playerlist. Ne crée AUCUNE fiche staff. */
export default function PlaylistSection() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pseudo, setPseudo] = useState('');
  const [grade, setGrade] = useState(GRADE_KEYS[0] ?? '');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/playerlist');
      if (r.ok) setEntries(await r.json());
    } catch {
      setError('Impossible de contacter le serveur.');
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    setError('');
    const r = await fetch('/api/playerlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pseudo, grade }),
    });
    if (!r.ok) {
      setError((await r.json().catch(() => ({}))).error ?? 'Erreur.');
      return;
    }
    setPseudo('');
    load();
  }
  async function remove(id: number) {
    await fetch(`/api/playerlist?id=${id}`, { method: 'DELETE' });
    load();
  }

  const sorted = [...entries].sort((a, b) => getGrade(b.grade).level - getGrade(a.grade).level);

  return (
    <div className="site-section">
      <h2>Playerlist</h2>
      <p className="site-sub">
        Associe un <b>pseudo Minecraft</b> à un <b>grade</b> — uniquement pour l’affichage du
        <b> /playerlist</b> du bot. Ça ne crée aucune fiche staff.
      </p>
      {error && <div className="form-error">{error}</div>}

      <div className="add-grid" style={{ marginBottom: 16 }}>
        <input
          placeholder="Pseudo Minecraft"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
        />
        <select value={grade} onChange={(e) => setGrade(e.target.value)}>
          {GRADE_KEYS.map((k) => (
            <option key={k} value={k}>
              {getGrade(k).label}
            </option>
          ))}
        </select>
        <button className="btn-submit" disabled={!pseudo} onClick={add}>
          Ajouter
        </button>
      </div>

      <div className="record-list">
        {sorted.length === 0 && <p className="site-sub">Aucune entrée.</p>}
        {sorted.map((e) => (
          <div className="record" key={e.id}>
            <span className="record-reason">
              <GradeBadge gk={e.grade} /> <b>{getGrade(e.grade).label}</b> · {e.pseudo}
            </span>
            <button className="chip locked" onClick={() => remove(e.id)}>
              Retirer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
