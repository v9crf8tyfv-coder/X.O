'use client';

import { useCallback, useEffect, useState } from 'react';
import { getGrade } from '@xo/shared';
import { GradeBadge } from './GradeBadge';

interface Rec {
  id: string;
  type: string;
  reason: string | null;
  issued_by: string | null;
  created_at: string;
}
interface Staff {
  id: string;
  pseudo: string;
  discord_tag: string;
  site_username: string | null;
  grades: string[];
  is_absent: boolean;
  records: Rec[];
}

// Grades candidats (jamais fonda/co-fonda) ; filtrés ensuite par niveau du manager
const CANDIDATE = [
  'responsable',
  'resp_admin',
  'resp_com',
  'resp_dev',
  'resp_build',
  'resp_infra',
  'resp_systeme',
  'admin',
  'dev',
  'buildeur',
  'com',
  'modo',
  'betatesteur',
];

const Bubble = GradeBadge;

export default function StaffSection({ myGrade }: { myGrade: string }) {
  const myLevel = getGrade(myGrade).level;
  const canRank = myLevel >= getGrade('responsable').level; // resp+ = ajouter/rank/derank
  const assignable = CANDIDATE.filter((k) => getGrade(k).level < myLevel);

  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [mc, setMc] = useState('');
  const [tag, setTag] = useState('');
  const [site, setSite] = useState('');
  const [newGrades, setNewGrades] = useState<string[]>([]);

  const [recType, setRecType] = useState<'warn' | 'blame' | 'note'>('warn');
  const [recReason, setRecReason] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/staff');
      if (!r.ok) {
        setError('Accès refusé ou erreur serveur.');
        return;
      }
      setStaff(await r.json());
      setError('');
    } catch {
      setError('Impossible de contacter le serveur.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function submitAdd() {
    setError('');
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        minecraftPseudo: mc,
        discordTag: tag,
        siteUsername: site,
        grades: newGrades,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Ajout refusé.');
      return;
    }
    setAdding(false);
    setMc('');
    setTag('');
    setSite('');
    setNewGrades([]);
    load();
  }

  async function toggleGrade(s: Staff, role: string) {
    const next = s.grades.includes(role)
      ? s.grades.filter((r) => r !== role)
      : [...s.grades, role];
    if (next.length === 0) {
      setError('Un staff doit garder au moins un grade (ou retire-le du staff).');
      return;
    }
    setError('');
    const res = await fetch(`/api/staff/${s.id}`, {
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

  async function removeStaff(s: Staff) {
    if (!window.confirm(`Retirer ${s.pseudo} du staff ? Il repasse Joueur partout.`)) return;
    const res = await fetch(`/api/staff/${s.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Retrait refusé.');
      return;
    }
    setSelected(null);
    load();
  }

  async function submitRecord(s: Staff) {
    if (!recReason.trim()) return;
    const res = await fetch(`/api/staff/${s.id}/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: recType, reason: recReason }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Ajout refusé.');
      return;
    }
    setRecReason('');
    load();
  }

  async function deleteRec(id: string) {
    const res = await fetch(`/api/staff/record/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Suppression refusée.');
    }
    load();
  }

  const selectedStaff = staff.find((s) => s.id === selected) ?? null;

  // ---------- Vue détail (fiche d'un staff) ----------
  if (selectedStaff) {
    const s = selectedStaff;
    return (
      <div className="staff-section">
        <button className="back-btn" onClick={() => setSelected(null)}>
          ← Retour
        </button>
        <div className="staff-detail">
          <h2>{s.pseudo}</h2>
          <div className="site-meta">
            🎮 {s.pseudo} · 💬 {s.discord_tag} · 🌐 {s.site_username ?? '—'}
          </div>
          <div className="staff-grades">
            {s.grades.map((gk) => (
              <span className="grade-tag" key={gk}>
                <Bubble gk={gk} />
                {getGrade(gk).label}
              </span>
            ))}
          </div>

          {canRank && (
            <>
              <h3 className="staff-h3">Grades (clique pour ajouter/retirer)</h3>
              <div className="site-chips">
                {assignable.map((role) => {
                  const active = s.grades.includes(role);
                  const g = getGrade(role);
                  return (
                    <button
                      key={role}
                      className={`chip ${active ? 'active' : ''}`}
                      style={
                        active
                          ? { backgroundColor: `#${g.color}`, borderColor: `#${g.color}` }
                          : { color: `#${g.color}`, borderColor: `#${g.color}55` }
                      }
                      onClick={() => toggleGrade(s, role)}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <h3 className="staff-h3">Dossier ({s.records.length})</h3>
          <div className="record-add">
            <select value={recType} onChange={(e) => setRecType(e.target.value as never)}>
              <option value="warn">Warn</option>
              <option value="blame">Blame</option>
              <option value="note">Note</option>
            </select>
            <input
              placeholder="Motif…"
              value={recReason}
              onChange={(e) => setRecReason(e.target.value)}
            />
            <button className="btn-submit" onClick={() => submitRecord(s)}>
              Ajouter
            </button>
          </div>
          <div className="record-list">
            {s.records.length === 0 && <p className="site-sub">Aucun élément.</p>}
            {s.records.map((r) => (
              <div className={`record record-${r.type}`} key={r.id}>
                <span className="record-type">{r.type}</span>
                <span className="record-reason">{r.reason}</span>
                <span className="record-meta">
                  {r.issued_by} · {r.created_at}
                </span>
                <button
                  className="record-del"
                  title="Supprimer"
                  onClick={() => deleteRec(r.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {canRank && (
            <button className="remove-staff" onClick={() => removeStaff(s)}>
              Retirer du staff
            </button>
          )}
          {error && <div className="form-error">{error}</div>}
        </div>
      </div>
    );
  }

  // ---------- Vue liste (fiches) ----------
  return (
    <div className="staff-section">
      <div className="site-head">
        <div>
          <h2>Gestion Staff</h2>
          <p className="site-sub">
            {staff.length} staff{staff.length > 1 ? 's' : ''}.{' '}
            {canRank
              ? 'Clique une fiche pour le dossier, ou “+” pour ajouter.'
              : 'Clique une fiche pour ajouter des warns/blames.'}
          </p>
        </div>
        {canRank && (
          <button className="btn-submit add-staff" onClick={() => setAdding((a) => !a)}>
            + Ajouter
          </button>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}

      {adding && canRank && (
        <div className="add-form">
          <div className="add-grid">
            <div className="field">
              <label>Pseudo Minecraft (IG)</label>
              <input value={mc} onChange={(e) => setMc(e.target.value)} placeholder="Ex: Orionyx84" />
            </div>
            <div className="field">
              <label>Tag Discord</label>
              <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="ex: orionyx84" />
            </div>
            <div className="field">
              <label>Pseudo site</label>
              <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="(peut être vide)" />
            </div>
          </div>
          <label className="field-label">Grade(s)</label>
          <div className="site-chips">
            {assignable.map((role) => {
              const active = newGrades.includes(role);
              const g = getGrade(role);
              return (
                <button
                  key={role}
                  className={`chip ${active ? 'active' : ''}`}
                  style={
                    active
                      ? { backgroundColor: `#${g.color}`, borderColor: `#${g.color}` }
                      : { color: `#${g.color}`, borderColor: `#${g.color}55` }
                  }
                  onClick={() =>
                    setNewGrades((p) =>
                      p.includes(role) ? p.filter((r) => r !== role) : [...p, role],
                    )
                  }
                >
                  {g.label}
                </button>
              );
            })}
          </div>
          <button className="btn-submit" onClick={submitAdd}>
            Créer la fiche
          </button>
        </div>
      )}

      {loading ? (
        <p className="site-sub">Chargement…</p>
      ) : (
        <div className="staff-grid">
          {staff.map((s) => (
            <button className="staff-card" key={s.id} onClick={() => setSelected(s.id)}>
              <div className="staff-card-name">
                {s.pseudo}
                {s.is_absent && <span className="absent-tag">⏰ absent</span>}
              </div>
              <div className="site-meta">💬 {s.discord_tag}</div>
              <div className="staff-card-grades">
                {s.grades.map((gk) => (
                  <Bubble key={gk} gk={gk} />
                ))}
              </div>
              {s.records.length > 0 && (
                <div className="staff-card-badge">{s.records.length} dossier(s)</div>
              )}
            </button>
          ))}
          {staff.length === 0 && <p className="site-sub">Aucun staff pour l’instant.</p>}
        </div>
      )}
    </div>
  );
}
