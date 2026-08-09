'use client';

import { useCallback, useEffect, useState } from 'react';
import { GRADES, getGrade } from '@xo/shared';
import { GradeBadge } from './GradeBadge';

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

// Grades affichés dans l'éditeur d'effectif (comme sur Discord)
const EFFECTIF_GRADES = ['responsable', 'admin', 'dev', 'buildeur', 'modo'];
// Rôles proposables en "rôle auto" (ceux qui ont un ID Discord)
const AUTO_ROLE_CHOICES = Object.values(GRADES).filter((g) => g.roleId);

export default function ServeursSection() {
  const [tab, setTab] = useState<'discord' | 'ig'>('discord');
  const [autoRoles, setAutoRoles] = useState<AutoRole[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState('');

  // formulaire rôle auto
  const [pickGrade, setPickGrade] = useState('');
  // formulaire ajout effectif
  const [addFor, setAddFor] = useState<string | null>(null);
  const [mc, setMc] = useState('');
  const [tag, setTag] = useState('');
  const [site, setSite] = useState('');

  const load = useCallback(async () => {
    try {
      const [ar, st] = await Promise.all([fetch('/api/serveurs/autoroles'), fetch('/api/staff')]);
      if (ar.ok) setAutoRoles(await ar.json());
      if (st.ok) setStaff(await st.json());
      setError('');
    } catch {
      setError('Impossible de contacter le serveur.');
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function addAutoRole() {
    const g = getGrade(pickGrade);
    if (!g.roleId) return;
    await fetch('/api/serveurs/autoroles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: g.roleId, label: g.label }),
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
      body: JSON.stringify({
        minecraftPseudo: mc,
        discordTag: tag,
        siteUsername: site,
        grades: [grade],
      }),
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

  return (
    <div className="site-section">
      <h2>Gestion Serveurs</h2>
      <div className="tabs" style={{ maxWidth: 320, marginTop: 12 }}>
        <button className={`tab ${tab === 'discord' ? 'active' : ''}`} onClick={() => setTab('discord')}>
          Discord
        </button>
        <button className="tab" disabled title="À venir">
          IG (à venir)
        </button>
      </div>
      {error && <div className="form-error">{error}</div>}

      {tab === 'discord' && (
        <>
          {/* Rôles automatiques */}
          <h3 className="staff-h3">Rôles automatiques à l’arrivée</h3>
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

          {/* Éditeur d'effectif (comme Discord) */}
          <h3 className="staff-h3">Effectif (clique “+” pour ajouter à un grade)</h3>
          {EFFECTIF_GRADES.map((gk) => {
            const members = staff.filter(
              (s) => s.grades.includes(gk) && !s.grades.some((x) => getGrade(x).level > getGrade(gk).level),
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
                      Créer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {tab === 'ig' && (
        <div className="soon-card">
          <div className="soon-emoji">🎮</div>
          <p>La configuration IG arrivera quand le serveur Minecraft sera prêt.</p>
        </div>
      )}
    </div>
  );
}
