'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RP_GRADES } from '@xo/shared';

interface RpRecord {
  id: string;
  type: string;
  reason: string | null;
  issued_by: string | null;
  created_at: string;
}
interface RpMember {
  id: string;
  pseudo: string;
  discord_tag: string | null;
  grades: string[];
  records: RpRecord[];
}

const RP_LIST = Object.values(RP_GRADES);
function rpGrade(k: string) {
  return RP_GRADES[k] ?? { key: k, label: k, color: '8a8f98', roleId: '' };
}

export default function RpSection() {
  const [members, setMembers] = useState<RpMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [mc, setMc] = useState('');
  const [tag, setTag] = useState('');
  const [newGrades, setNewGrades] = useState<string[]>([]);
  const [recType, setRecType] = useState<'warn' | 'blame' | 'note'>('warn');
  const [recReason, setRecReason] = useState('');
  const pending = useRef(0);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/rp');
      if (!r.ok) throw new Error();
      const data = (await r.json()) as RpMember[];
      if (pending.current === 0) setMembers(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function submitAdd() {
    setError('');
    if (!mc.trim() || newGrades.length === 0) {
      setError('Pseudo IG + au moins un grade RP.');
      return;
    }
    const res = await fetch('/api/rp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pseudo: mc.trim(), discordTag: tag.trim() || null, grades: newGrades }),
    });
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error || 'Échec.');
      return;
    }
    setAdding(false);
    setMc('');
    setTag('');
    setNewGrades([]);
    load();
  }

  async function toggleGrade(m: RpMember, role: string) {
    const next = m.grades.includes(role) ? m.grades.filter((r) => r !== role) : [...m.grades, role];
    const prev = m.grades;
    setMembers((list) => list.map((x) => (x.id === m.id ? { ...x, grades: next } : x)));
    pending.current++;
    try {
      const res = await fetch(`/api/rp/${m.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grades: next }),
      });
      if (!res.ok) setMembers((list) => list.map((x) => (x.id === m.id ? { ...x, grades: prev } : x)));
    } catch {
      setMembers((list) => list.map((x) => (x.id === m.id ? { ...x, grades: prev } : x)));
    } finally {
      pending.current--;
    }
  }

  async function removeMember(m: RpMember) {
    if (!window.confirm(`Retirer ${m.pseudo} du RP ?`)) return;
    await fetch(`/api/rp/${m.id}`, { method: 'DELETE' });
    setSelected(null);
    load();
  }

  async function addRecord(id: string) {
    if (!recReason.trim()) return;
    await fetch(`/api/rp/${id}/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: recType, reason: recReason.trim() }),
    });
    setRecReason('');
    load();
  }

  async function delRecord(recId: string) {
    await fetch(`/api/rp/record/${recId}`, { method: 'DELETE' });
    load();
  }

  const sel = members.find((m) => m.id === selected) ?? null;

  if (sel) {
    return (
      <div className="staff-section">
        <button className="back-btn" onClick={() => setSelected(null)}>← Retour</button>
        <h2 className="site-title" style={{ marginTop: 10 }}>🎭 {sel.pseudo}</h2>
        {sel.discord_tag && <div className="site-meta">💬 {sel.discord_tag}</div>}
        <label className="field-label" style={{ marginTop: 14 }}>Grades RP</label>
        <div className="site-chips">
          {RP_LIST.map((g) => {
            const active = sel.grades.includes(g.key);
            return (
              <button key={g.key} className={`chip ${active ? 'active' : ''}`}
                style={active ? { backgroundColor: `#${g.color}`, borderColor: `#${g.color}` } : { color: `#${g.color}`, borderColor: `#${g.color}55` }}
                onClick={() => toggleGrade(sel, g.key)}>{g.label}</button>
            );
          })}
        </div>

        <label className="field-label" style={{ marginTop: 16 }}>Ajouter un dossier RP</label>
        <div className="record-add">
          <select value={recType} onChange={(e) => setRecType(e.target.value as 'warn' | 'blame' | 'note')}>
            <option value="warn">Warn RP</option>
            <option value="blame">Blame RP</option>
            <option value="note">Note RP</option>
          </select>
          <input value={recReason} onChange={(e) => setRecReason(e.target.value)} placeholder="Raison…" />
          <button className="btn-submit" onClick={() => addRecord(sel.id)}>Ajouter</button>
        </div>
        <div className="record-list">
          {sel.records.length === 0 && <div className="site-sub">Aucun dossier.</div>}
          {sel.records.map((r) => (
            <div className="record-item" key={r.id}>
              <div>
                <b>{r.type.toUpperCase()}</b> — {r.reason}
                <div className="site-sub">{r.created_at}{r.issued_by ? ` · par ${r.issued_by}` : ''}</div>
              </div>
              <button className="chip" onClick={() => delRecord(r.id)}>✕</button>
            </div>
          ))}
        </div>

        <button className="ghost-btn" style={{ marginTop: 20 }} onClick={() => removeMember(sel)}>
          Retirer du RP
        </button>
      </div>
    );
  }

  return (
    <div className="staff-section">
      <div className="staff-head">
        <h2 className="site-title">🎭 Gestion RP</h2>
        <button className="btn-submit add-staff" onClick={() => setAdding((a) => !a)}>+ Ajouter</button>
      </div>
      {error && <div className="form-error">{error}</div>}
      {adding && (
        <div className="add-form">
          <div className="add-grid">
            <div className="field"><label>Pseudo Minecraft (IG)</label>
              <input value={mc} onChange={(e) => setMc(e.target.value)} placeholder="Ex: Xtazzking" /></div>
            <div className="field"><label>Tag Discord (optionnel)</label>
              <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="(pour les rôles Discord RP)" /></div>
          </div>
          <label className="field-label">Grade(s) RP</label>
          <div className="site-chips">
            {RP_LIST.map((g) => {
              const active = newGrades.includes(g.key);
              return (
                <button key={g.key} className={`chip ${active ? 'active' : ''}`}
                  style={active ? { backgroundColor: `#${g.color}`, borderColor: `#${g.color}` } : { color: `#${g.color}`, borderColor: `#${g.color}55` }}
                  onClick={() => setNewGrades((p) => (p.includes(g.key) ? p.filter((r) => r !== g.key) : [...p, g.key]))}>
                  {g.label}
                </button>
              );
            })}
          </div>
          <button className="btn-submit" onClick={submitAdd}>Créer la fiche RP</button>
        </div>
      )}
      {loading ? (
        <p className="site-sub">Chargement…</p>
      ) : (
        <div className="list-rows">
          {members.map((m) => {
            const top = m.grades[0] ? rpGrade(m.grades[0]) : null;
            return (
              <button className="pt-row" key={m.id} onClick={() => setSelected(m.id)}>
                <span className="pt-staff">
                  <strong>{m.pseudo}</strong>
                  {m.grades.map((gk) => (
                    <span key={gk} className="pt-grade" style={{ color: `#${rpGrade(gk).color}` }}>{rpGrade(gk).label}</span>
                  ))}
                </span>
                <span className="pt-rowtotal">
                  {m.records.length > 0 ? `${m.records.length} dossier(s) ` : ''}›
                </span>
              </button>
            );
          })}
          {members.length === 0 && <p className="site-sub">Aucun membre RP pour l’instant.</p>}
        </div>
      )}
    </div>
  );
}
