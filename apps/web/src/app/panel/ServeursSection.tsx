'use client';

import { useCallback, useEffect, useState } from 'react';
import { GRADES, GRADE_JOUEUR, getGrade } from '@xo/shared';
import { GradeBadge } from './GradeBadge';
import PlaylistSection from './PlaylistSection';

interface AutoRole {
  id: string;
  role_id: string;
  label: string | null;
}
interface Staff {
  id: string;
  pseudo: string;
  discord_tag: string;
  site_username: string | null;
  grades: string[];
}

const EFFECTIF_GRADES = ['responsable', 'admin', 'dev', 'modo', 'buildeur', 'com'];
// Rôles proposables en auto (grades avec ID Discord + Joueur)
const AUTO_ROLE_CHOICES = [
  ...Object.values(GRADES).filter((g) => g.roleId),
  { key: 'joueur', label: 'Joueur', roleId: GRADE_JOUEUR.roleId },
];

export default function ServeursSection() {
  const [world, setWorld] = useState<null | 'discord'>(null);
  const [sub, setSub] = useState<null | 'roles' | 'effectif' | 'playlist'>(null);

  const [autoRoles, setAutoRoles] = useState<AutoRole[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState('');
  const [pickGrade, setPickGrade] = useState('');
  const [addFor, setAddFor] = useState<string | null>(null);
  const [mc, setMc] = useState('');
  const [tag, setTag] = useState('');
  const [site, setSite] = useState('');

  const load = useCallback(async () => {
    try {
      const [ar, st] = await Promise.all([fetch('/api/serveurs/autoroles'), fetch('/api/staff')]);
      if (ar.ok) setAutoRoles(await ar.json());
      if (st.ok) setStaff(await st.json());
    } catch {
      setError('Impossible de contacter le serveur.');
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 90_000); // refresh auto 1min30
    return () => clearInterval(t);
  }, [load]);

  async function addAutoRole() {
    const c = AUTO_ROLE_CHOICES.find((x) => x.key === pickGrade);
    if (!c?.roleId) return;
    await fetch('/api/serveurs/autoroles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: c.roleId, label: c.label }),
    });
    setPickGrade('');
    load();
  }
  async function removeAutoRole(roleId: string) {
    await fetch(`/api/serveurs/autoroles?roleId=${roleId}`, { method: 'DELETE' });
    load();
  }
  async function addToEffectif(grade: string) {
    setError('');
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minecraftPseudo: mc, discordTag: tag, siteUsername: site, grades: [grade], announce: false }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Ajout refusé.');
      return;
    }
    setAddFor(null);
    setMc('');
    setTag('');
    setSite('');
    load();
  }

  // ---------- Accueil : 2 cartes ----------
  if (world === null) {
    return (
      <div className="site-section">
        <h2>Gestion Serveurs</h2>
        <p className="site-sub">Configure les serveurs liés au panel.</p>
        <div className="srv-cards">
          <button className="srv-card" onClick={() => setWorld('discord')}>
            <div className="srv-card-emoji">💬</div>
            <strong>Discord</strong>
            <span className="site-sub">Rôles auto + effectif</span>
          </button>
          <button className="srv-card disabled" disabled>
            <div className="srv-card-emoji">🎮</div>
            <strong>IG</strong>
            <span className="site-sub">À venir (serveur Minecraft)</span>
          </button>
        </div>
      </div>
    );
  }

  // ---------- Discord : sous-catégories ----------
  if (sub === null) {
    return (
      <div className="site-section">
        <button className="back-btn" onClick={() => setWorld(null)}>
          ← Retour
        </button>
        <h2>Discord</h2>
        <div className="srv-cards">
          <button className="srv-card" onClick={() => setSub('roles')}>
            <div className="srv-card-emoji">🎭</div>
            <strong>Rôles à l’arrivée</strong>
            <span className="site-sub">Donnés automatiquement au join</span>
          </button>
          <button className="srv-card" onClick={() => setSub('effectif')}>
            <div className="srv-card-emoji">📋</div>
            <strong>Effectif Discord</strong>
            <span className="site-sub">Ajouter / voir le staff</span>
          </button>
          <button className="srv-card" onClick={() => setSub('playlist')}>
            <div className="srv-card-emoji">🎬</div>
            <strong>Playlist</strong>
            <span className="site-sub">Grades affichés dans /playerlist</span>
          </button>
        </div>
      </div>
    );
  }

  // ---------- Playlist (fusionnée ici) ----------
  if (sub === 'playlist') {
    return (
      <div className="site-section">
        <button className="back-btn" onClick={() => setSub(null)}>
          ← Retour
        </button>
        <PlaylistSection />
      </div>
    );
  }

  return (
    <div className="site-section">
      <button className="back-btn" onClick={() => setSub(null)}>
        ← Retour
      </button>
      {error && <div className="form-error">{error}</div>}

      {sub === 'roles' && (
        <>
          <h2>Rôles à l’arrivée</h2>
          <p className="site-sub">Ces rôles sont donnés à chaque membre qui rejoint le serveur.</p>
          <div className="record-add">
            <select value={pickGrade} onChange={(e) => setPickGrade(e.target.value)}>
              <option value="">— Choisir un rôle —</option>
              {AUTO_ROLE_CHOICES.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
            <button className="btn-submit" disabled={!pickGrade} onClick={addAutoRole}>
              Ajouter
            </button>
          </div>
          <div className="record-list">
            {autoRoles.length === 0 && <p className="site-sub">Aucun rôle auto.</p>}
            {autoRoles.map((r) => (
              <div className="record" key={r.id}>
                <span className="record-reason">{r.label || r.role_id}</span>
                <button className="chip locked" onClick={() => removeAutoRole(r.role_id)}>
                  Retirer
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {sub === 'effectif' && (
        <>
          <h2>Effectif Discord</h2>
          {EFFECTIF_GRADES.map((gk) => {
            const members = staff.filter(
              (s) =>
                s.grades.includes(gk) &&
                !s.grades.some((x) => getGrade(x).level > getGrade(gk).level),
            );
            return (
              <div className="eff-grade" key={gk}>
                <div className="eff-grade-head">
                  <GradeBadge gk={gk} />
                  <strong>{getGrade(gk).label}</strong>
                  <span className="site-sub">({members.length})</span>
                  <button className="chip" onClick={() => setAddFor(addFor === gk ? null : gk)}>
                    + ajouter
                  </button>
                </div>
                <div className="eff-members">
                  {members.length === 0 ? '—' : members.map((m) => m.pseudo).join(', ')}
                </div>
                {addFor === gk && (
                  <div className="add-grid" style={{ marginTop: 8 }}>
                    <input placeholder="Pseudo Minecraft" value={mc} onChange={(e) => setMc(e.target.value)} />
                    <input placeholder="Tag Discord" value={tag} onChange={(e) => setTag(e.target.value)} />
                    <input placeholder="Pseudo site" value={site} onChange={(e) => setSite(e.target.value)} />
                    <button className="btn-submit" onClick={() => addToEffectif(gk)}>
                      Ajouter
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
