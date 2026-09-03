'use client';

import { useEffect, useState, type CSSProperties } from 'react';

interface Item { id: string; label: string; section?: boolean }
interface Template { title: string; intro: string; items: Item[] }
interface Formation {
  id: number;
  pseudo: string;
  started_at: string;
  ended_at: string | null;
  archived: boolean;
  validated: boolean;
  checks: Record<string, boolean>;
}

const card: CSSProperties = { border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: 16, background: 'rgba(255,255,255,.02)', marginBottom: 14 };
const btn: CSSProperties = { background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', color: '#e8e8ec', borderRadius: 9, padding: '7px 12px', cursor: 'pointer', font: 'inherit', fontSize: 13 };

function head(p: string) { return `https://mc-heads.net/avatar/${encodeURIComponent(p)}/48`; }
function frDate(s: string | null) { return s ? new Date(s).toLocaleDateString('fr-FR') : '—'; }
/** Date limite = début + 4 semaines (durée max de la formation). */
function deadline(start: string) { const d = new Date(start); d.setDate(d.getDate() + 28); return d.toLocaleDateString('fr-FR'); }

export default function FormationSection() {
  const [active, setActive] = useState<Formation[]>([]);
  const [archived, setArchived] = useState<Formation[]>([]);
  const [template, setTemplate] = useState<Template | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [tab, setTab] = useState<'active' | 'archived' | 'template'>('active');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch('/api/formations');
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || 'Erreur'); setLoading(false); return; }
    const d = await r.json();
    setActive(d.active || []); setArchived(d.archived || []); setTemplate(d.template); setCanEdit(!!d.canEditTemplate);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function post(body: unknown) {
    const r = await fetch('/api/formations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || 'Erreur'); return false; }
    return true;
  }
  async function toggle(f: Formation, item: string, done: boolean) {
    setActive((prev) => prev.map((x) => x.id === f.id ? { ...x, checks: { ...x.checks, [item]: done } } : x));
    await post({ action: 'toggle', id: f.id, item, done });
  }
  async function archive(id: number) { if (!confirm('Archiver cette formation ?')) return; if (await post({ action: 'archive', id })) load(); }
  async function validate(f: Formation) { if (await post({ action: 'validate', id: f.id, validated: !f.validated })) load(); }

  function progress(f: Formation): string {
    if (!template) return '';
    const checkable = template.items.filter((i) => !i.section);
    const done = checkable.filter((i) => f.checks[i.id]).length;
    return `${done} / ${checkable.length}`;
  }

  function renderFormation(f: Formation, editable: boolean) {
    return (
      <div key={f.id} style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={head(f.pseudo)} alt="" style={{ width: 40, height: 40, borderRadius: 8, imageRendering: 'pixelated' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800 }}>{f.pseudo}{f.validated && <span style={{ color: '#16a34a', fontSize: 12, marginLeft: 8 }}>Validé</span>}</div>
            <div style={{ color: 'var(--muted,#8a8a94)', fontSize: 12 }}>Début {frDate(f.started_at)} · {f.ended_at ? `terminée le ${frDate(f.ended_at)}` : `limite le ${deadline(f.started_at)}`} · {progress(f)}</div>
          </div>
          {editable && <button style={btn} onClick={() => validate(f)}>{f.validated ? 'Annuler validation' : 'Valider'}</button>}
          {editable && <button style={{ ...btn, borderColor: 'rgba(224,65,62,.4)', color: '#ff9b9b' }} onClick={() => archive(f.id)}>Archiver</button>}
        </div>
        <div>
          {template?.items.map((it) => it.section ? (
            <div key={it.id} style={{ fontWeight: 800, color: '#a78bfa', margin: '10px 0 4px' }}>{it.id}. {it.label}</div>
          ) : (
            <label key={it.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '3px 0', color: '#d7d7de', fontSize: 14, cursor: editable ? 'pointer' : 'default' }}>
              <input type="checkbox" checked={!!f.checks[it.id]} disabled={!editable} onChange={(e) => toggle(f, it.id, e.target.checked)} />
              <span><b>{it.id}</b> — {it.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <div><h2>Gestion Formation</h2><p style={{ color: 'var(--muted,#8a8a94)' }}>Chargement…</p></div>;
  if (err) return <div><h2>Gestion Formation</h2><p style={{ color: '#ff9b9b' }}>{err}</p></div>;

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Gestion Formation</h2>
      <p style={{ color: 'var(--muted,#8a8a94)', marginTop: 0 }}>Suivi des Modérateur Test — coche chaque compétence validée. (Admins et Modérateur X)</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button style={{ ...btn, borderColor: tab === 'active' ? '#7c5cff' : undefined }} onClick={() => setTab('active')}>En cours ({active.length})</button>
        <button style={{ ...btn, borderColor: tab === 'archived' ? '#7c5cff' : undefined }} onClick={() => setTab('archived')}>Archivées ({archived.length})</button>
        {canEdit && <button style={{ ...btn, borderColor: tab === 'template' ? '#7c5cff' : undefined }} onClick={() => setTab('template')}>Modèle</button>}
      </div>

      {tab === 'active' && (active.length ? active.map((f) => renderFormation(f, true)) : <p style={{ color: 'var(--muted,#8a8a94)' }}>Aucune formation en cours. Une fiche se crée automatiquement quand un joueur devient Modérateur Test.</p>)}
      {tab === 'archived' && (archived.length ? archived.map((f) => renderFormation(f, false)) : <p style={{ color: 'var(--muted,#8a8a94)' }}>Aucune formation archivée.</p>)}
      {tab === 'template' && template && canEdit && <TemplateEditor template={template} onSaved={load} />}
    </div>
  );
}

function TemplateEditor({ template, onSaved }: { template: Template; onSaved: () => void }) {
  const [t, setT] = useState<Template>(JSON.parse(JSON.stringify(template)));
  const [saving, setSaving] = useState(false);
  const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, color: '#e8e8ec', padding: '7px 10px', font: 'inherit', marginBottom: 6 };

  function setItem(i: number, patch: Partial<Item>) { setT((p) => ({ ...p, items: p.items.map((it, k) => k === i ? { ...it, ...patch } : it) })); }
  function addItem(section: boolean) { setT((p) => ({ ...p, items: [...p.items, { id: '', label: '', section }] })); }
  function delItem(i: number) { setT((p) => ({ ...p, items: p.items.filter((_, k) => k !== i) })); }

  async function save() {
    setSaving(true);
    const r = await fetch('/api/formations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'template', template: t }) });
    setSaving(false);
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || 'Erreur'); return; }
    onSaved();
  }

  return (
    <div style={card}>
      <div style={{ color: 'var(--muted,#8a8a94)', fontSize: 12, marginBottom: 4 }}>Titre</div>
      <input style={inp} value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} />
      <div style={{ color: 'var(--muted,#8a8a94)', fontSize: 12, marginBottom: 4 }}>Intro</div>
      <input style={inp} value={t.intro} onChange={(e) => setT({ ...t, intro: e.target.value })} />
      <div style={{ color: 'var(--muted,#8a8a94)', fontSize: 12, margin: '10px 0 4px' }}>Points (id + libellé ; coche « section » pour un titre)</div>
      {t.items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
          <input style={{ ...inp, width: 70, marginBottom: 0 }} value={it.id} onChange={(e) => setItem(i, { id: e.target.value })} placeholder="1.1" />
          <input style={{ ...inp, marginBottom: 0 }} value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} placeholder="Libellé" />
          <label style={{ fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' }}><input type="checkbox" checked={!!it.section} onChange={(e) => setItem(i, { section: e.target.checked })} /> section</label>
          <button style={{ ...btn, padding: '4px 8px' }} onClick={() => delItem(i)}>×</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button style={btn} onClick={() => addItem(false)}>+ Point</button>
        <button style={btn} onClick={() => addItem(true)}>+ Section</button>
        <button style={{ ...btn, background: '#7c5cff', border: 0, color: '#fff', fontWeight: 700 }} onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le modèle'}</button>
      </div>
    </div>
  );
}
