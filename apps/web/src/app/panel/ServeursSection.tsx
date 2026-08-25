'use client';

import { useCallback, useEffect, useState } from 'react';
import { getGrade } from '@xo/shared';
import { GradeBadge } from './GradeBadge';
import PlaylistSection from './PlaylistSection';

interface AutoRole {
  id: string;
  role_id: string;
  label: string | null;
}
interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
}
interface Staff {
  id: string;
  pseudo: string;
  discord_tag: string;
  site_username: string | null;
  grades: string[];
}

const EFFECTIF_GRADES = ['responsable', 'admin', 'dev', 'modo', 'buildeur', 'com'];

export default function ServeursSection() {
  const [world, setWorld] = useState<null | 'discord'>(null);
  const [sub, setSub] = useState<null | 'roles' | 'effectif' | 'playlist'>(null);

  const [autoRoles, setAutoRoles] = useState<AutoRole[]>([]);
  const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState('');
  const [pickGrade, setPickGrade] = useState('');
  const [addFor, setAddFor] = useState<string | null>(null);
  const [mc, setMc] = useState('');
  const [tag, setTag] = useState('');
  const [site, setSite] = useState('');

  const load = useCallback(async () => {
    try {
      const [ar, st, dr] = await Promise.all([
        fetch('/api/serveurs/autoroles'),
        fetch('/api/staff'),
        fetch('/api/serveurs/discord-roles'),
      ]);
      if (ar.ok) setAutoRoles(await ar.json());
      if (st.ok) setStaff(await st.json());
      if (dr.ok) setDiscordRoles(await dr.json());
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
    const role = discordRoles.find((r) => r.id === pickGrade);
    if (!role) return;
    await fetch('/api/serveurs/autoroles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: role.id, label: role.name }),
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
        <div className="list-rows">
          <button className="pt-row" onClick={() => setWorld('discord')}>
            <span className="pt-staff">
              <span className="row-emoji">💬</span> <strong>Discord</strong>
              <span className="pt-grade">Rôles auto + effectif</span>
            </span>
            <span className="pt-rowtotal">›</span>
          </button>
          <button className="pt-row is-disabled" disabled>
            <span className="pt-staff">
              <span className="row-emoji">🎮</span> <strong>IG</strong>
              <span className="pt-grade">À venir (serveur Minecraft)</span>
            </span>
            <span className="pt-rowtotal">bientôt</span>
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
        <div className="list-rows">
          <button className="pt-row" onClick={() => setSub('roles')}>
            <span className="pt-staff">
              <span className="row-emoji">🎭</span> <strong>Rôles à l’arrivée</strong>
              <span className="pt-grade">Donnés automatiquement au join</span>
            </span>
            <span className="pt-rowtotal">›</span>
          </button>
          <button className="pt-row" onClick={() => setSub('effectif')}>
            <span className="pt-staff">
              <span className="row-emoji">📋</span> <strong>Effectif Discord</strong>
              <span className="pt-grade">Ajouter / voir le staff</span>
            </span>
            <span className="pt-rowtotal">›</span>
          </button>
          <button className="pt-row" onClick={() => setSub('playlist')}>
            <span className="pt-staff">
              <span className="row-emoji">🎬</span> <strong>Playlist</strong>
              <span className="pt-grade">Grades affichés dans /playerlist</span>
            </span>
            <span className="pt-rowtotal">›</span>
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
          <p className="site-sub">
            Ces rôles sont donnés à chaque membre qui rejoint le serveur. La liste se met à jour
            automatiquement avec les rôles créés/supprimés sur Discord.
          </p>
          <div className="record-add">
            <select value={pickGrade} onChange={(e) => setPickGrade(e.target.value)}>
              <option value="">— Choisir un rôle —</option>
              {discordRoles.filter((r) => !autoRoles.some((a) => a.role_id === r.id)).length === 0 && (
                <option value="" disabled>
                  {discordRoles.length === 0 ? '(rôles Discord indisponibles)' : '(tous déjà ajoutés)'}
                </option>
              )}
              {discordRoles
                .filter((r) => !autoRoles.some((a) => a.role_id === r.id))
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
            <button className="btn-submit" disabled={!pickGrade} onClick={addAutoRole}>
              Ajouter
            </button>
          </div>
          <div className="record-list">
            {autoRoles.length === 0 && <p className="site-sub">Aucun rôle auto.</p>}
            {autoRoles.map((r) => {
              const live = discordRoles.find((d) => d.id === r.role_id);
              const deleted = discordRoles.length > 0 && !live;
              return (
                <div className="record" key={r.id}>
                  <span className="record-reason">
                    {live?.name || r.label || r.role_id}
                    {deleted && ' — ⚠️ supprimé du Discord'}
                  </span>
                  <button className="chip locked" onClick={() => removeAutoRole(r.role_id)}>
                    Retirer
                  </button>
                </div>
              );
            })}
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
                  {members.length === 0 ? (
                    <span className="site-sub">Aucun membre</span>
                  ) : (
                    <div className="list-rows">
                      {members.map((m) => (
                        <div className="list-row" key={m.id}>
                          <span className="pt-staff">
                            <GradeBadge gk={gk} /> <strong>{m.pseudo}</strong>
                          </span>
                          <span className="pt-rowtotal">{m.discord_tag}</span>
                        </div>
                      ))}
                    </div>
                  )}
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
