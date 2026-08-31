'use client';

import { useEffect, useRef, useState } from 'react';

interface Entry { name: string; url: string; sha256: string }
interface Manifest { mods: Entry[]; resourcepacks: Entry[]; optional: (Entry & { id: string })[]; axiomAllowed: string[] }
type Kind = 'mods' | 'resourcepacks';

export default function LauncherSection() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [needToken, setNeedToken] = useState(false);
  const [error, setError] = useState('');

  const [staged, setStaged] = useState<{ file: File; kind: Kind }[]>([]);
  const [impl, setImpl] = useState<{ on: boolean; done: number; total: number }>({ on: false, done: 0, total: 0 });
  const [implemented, setImplemented] = useState(false);

  const [build, setBuild] = useState<{ on: boolean; pct: number; label: string; done: boolean; ok: boolean; url: string | null }>(
    { on: false, pct: 0, label: '', done: false, ok: false, url: null },
  );

  const modRef = useRef<HTMLInputElement>(null);
  const rpRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/launcher/mods');
      if (r.status === 503) { setNeedToken(true); setLoading(false); return; }
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erreur');
      setNeedToken(false);
      setManifest(await r.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function stage(kind: Kind, files: FileList | null) {
    if (!files) return;
    const add = Array.from(files).map((file) => ({ file, kind }));
    setStaged((s) => [...s, ...add]);
    setImplemented(false);
  }
  function unstage(i: number) { setStaged((s) => s.filter((_, k) => k !== i)); }

  /** Implémente les fichiers en attente dans le launcher (upload + manifeste), avec barre. */
  async function implement() {
    if (!staged.length) return;
    setError('');
    setImpl({ on: true, done: 0, total: staged.length });
    for (let i = 0; i < staged.length; i++) {
      const { file, kind } = staged[i];
      const fd = new FormData();
      fd.append('kind', kind);
      fd.append('file', file);
      const r = await fetch('/api/launcher/mods', { method: 'POST', body: fd });
      if (!r.ok) {
        const msg = (await r.json().catch(() => ({}))).error || `Échec sur ${file.name}`;
        setError(`${file.name} : ${msg}`);
        setImpl({ on: false, done: i, total: staged.length });
        return;
      }
      setImpl({ on: true, done: i + 1, total: staged.length });
    }
    setStaged([]);
    setImpl({ on: false, done: 0, total: 0 });
    setImplemented(true);
    await load();
  }

  async function del(kind: Kind, name: string) {
    if (!confirm(`Retirer ${name} du launcher ?`)) return;
    const r = await fetch(`/api/launcher/mods?kind=${kind}&name=${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (r.ok) { setManifest((await r.json()).manifest); setImplemented(true); }
    else setError((await r.json().catch(() => ({}))).error || 'Échec de la suppression.');
  }

  /** Ajoute un mod/RP depuis une URL directe (le serveur télécharge — pas de limite navigateur). */
  async function addByLink(kind: Kind) {
    const url = prompt(`Colle le LIEN DIRECT du ${kind === 'mods' ? 'mod (.jar)' : 'resourcepack (.zip)'} (Modrinth / CurseForge CDN / GitHub) :`);
    if (!url) return;
    setError('');
    const r = await fetch('/api/launcher/mods', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, url: url.trim() }),
    });
    if (r.ok) { setManifest((await r.json()).manifest); setImplemented(true); }
    else setError((await r.json().catch(() => ({}))).error || 'Échec de l’ajout par lien.');
  }

  const [axiomInput, setAxiomInput] = useState('');
  async function addAxiom() {
    const pseudo = axiomInput.trim();
    if (!pseudo) return;
    setError('');
    const r = await fetch('/api/launcher/axiom', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pseudo }),
    });
    if (r.ok) { setManifest((await r.json()).manifest); setAxiomInput(''); }
    else setError((await r.json().catch(() => ({}))).error || 'Échec de l’ajout.');
  }
  async function delAxiom(pseudo: string) {
    if (!confirm(`Retirer ${pseudo} du staff build (Axiom) ?`)) return;
    const r = await fetch(`/api/launcher/axiom?pseudo=${encodeURIComponent(pseudo)}`, { method: 'DELETE' });
    if (r.ok) setManifest((await r.json()).manifest);
    else setError((await r.json().catch(() => ({}))).error || 'Échec de la suppression.');
  }

  /** Lance la mise à jour des 3 launchers (build 3 OS) + suit la progression. */
  async function update3() {
    setError('');
    setBuild({ on: true, pct: 4, label: 'Démarrage du build…', done: false, ok: false, url: null });
    const r = await fetch('/api/launcher/build', { method: 'POST' });
    if (!r.ok) {
      setError((await r.json().catch(() => ({}))).error || 'Échec du lancement du build.');
      setBuild((b) => ({ ...b, on: false }));
      return;
    }
    const { sha, version } = await r.json();
    setBuild({ on: true, pct: 8, label: `Build v${version} lancé…`, done: false, ok: false, url: null });

    const poll = async () => {
      try {
        const s = await (await fetch(`/api/launcher/build?sha=${sha}`)).json();
        const pct = Math.max(8, s.progress ?? 8);
        if (s.status === 'completed') {
          const ok = s.conclusion === 'success';
          setBuild({ on: false, pct: 100, label: ok ? '3 launchers mis à jour !' : 'Le build a échoué.', done: true, ok, url: s.url });
          return;
        }
        setBuild({ on: true, pct, label: s.status === 'in_progress' ? 'Build en cours (3 OS)…' : 'En file d’attente…', done: false, ok: false, url: s.url });
      } catch { /* on réessaie */ }
      setTimeout(poll, 5000);
    };
    setTimeout(poll, 4000);
  }

  if (loading) return <div className="soon-card"><h2>Launcher</h2><p>Chargement…</p></div>;

  if (needToken) {
    return (
      <div className="soon-card" style={{ textAlign: 'left' }}>
        <h2>Launcher</h2>
        <p>Le token GitHub n’est pas encore configuré. Ajoute la variable <code>GH_LAUNCHER_TOKEN</code> dans les
          réglages Vercel du panel (Settings → Environment Variables), puis redéploie. Ensuite cette page permettra
          d’ajouter des mods et de mettre à jour les 3 launchers.</p>
      </div>
    );
  }

  const modsStaged = staged.filter((s) => s.kind === 'mods');
  const rpStaged = staged.filter((s) => s.kind === 'resourcepacks');

  return (
    <div className="launcher-sec">
      <h2 style={{ marginBottom: 6 }}>Launcher</h2>
      <p style={{ color: 'var(--muted, #8a8a94)', marginBottom: 18 }}>
        Ajoute des mods / resourcepacks, implémente-les dans le launcher, puis mets à jour les 3 launchers.
      </p>

      {error && (
        <div style={{ background: 'rgba(220,60,60,.14)', border: '1px solid rgba(220,60,60,.4)', color: '#ffb4b4', padding: '10px 14px', borderRadius: 10, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Publiés actuellement */}
      <PublishedList title="Mods dans le launcher" items={manifest?.mods ?? []} onDel={(n) => del('mods', n)} />
      <PublishedList title="Resourcepacks dans le launcher" items={manifest?.resourcepacks ?? []} onDel={(n) => del('resourcepacks', n)} />
      {!!manifest?.optional?.length && (
        <PublishedList title="Optionnels (Axiom — staff build)" items={manifest.optional} readOnly />
      )}

      {/* Staff build : liste des pseudos autorisés à Axiom */}
      <div className="lchr-card">
        <h3>Staff build — Axiom <span className="lchr-count">{manifest?.axiomAllowed?.length ?? 0}</span></h3>
        <p className="lchr-hint">Ces pseudos Minecraft peuvent activer Axiom dans le launcher (build staff).</p>
        {manifest?.axiomAllowed?.length ? (
          <ul className="lchr-list">
            {manifest.axiomAllowed.map((p) => (
              <li key={p}><span>{p}</span><button className="lchr-x" onClick={() => delAxiom(p)}>Retirer</button></li>
            ))}
          </ul>
        ) : (
          <p className="lchr-hint">Aucun pour l’instant.</p>
        )}
        <div className="lchr-add" style={{ marginTop: 12 }}>
          <input
            className="btn-sec"
            style={{ flex: 1, minWidth: 160 }}
            placeholder="Pseudo Minecraft"
            value={axiomInput}
            onChange={(e) => setAxiomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addAxiom(); }}
          />
          <button className="btn-accent" onClick={addAxiom}>Ajouter</button>
        </div>
      </div>

      {/* Ajout */}
      <div className="lchr-card">
        <h3>Ajouter</h3>
        <div className="lchr-add">
          <button className="btn-sec" onClick={() => modRef.current?.click()}>+ Mods (.jar)</button>
          <button className="btn-sec" onClick={() => rpRef.current?.click()}>+ Resourcepacks (.zip)</button>
          <input ref={modRef} type="file" accept=".jar" multiple hidden onChange={(e) => stage('mods', e.target.files)} />
          <input ref={rpRef} type="file" accept=".zip" multiple hidden onChange={(e) => stage('resourcepacks', e.target.files)} />
        </div>
        <p className="lchr-hint">Fichier direct : ~4 Mo max (limite Vercel). Pour les gros mods, utilise « par lien » ci-dessous (jusqu'à 180 Mo).</p>
        <div className="lchr-add" style={{ marginTop: 8 }}>
          <button className="btn-sec" onClick={() => addByLink('mods')}>+ Mod par lien</button>
          <button className="btn-sec" onClick={() => addByLink('resourcepacks')}>+ Resourcepack par lien</button>
        </div>

        {!!staged.length && (
          <ul className="lchr-staged">
            {staged.map((s, i) => (
              <li key={i}>
                <span>{s.kind === 'mods' ? '🧩' : '🎨'} {s.file.name} <em>({(s.file.size / 1048576).toFixed(1)} Mo)</em></span>
                {!impl.on && <button className="lchr-x" onClick={() => unstage(i)}>×</button>}
              </li>
            ))}
          </ul>
        )}

        {impl.on && (
          <Bar pct={Math.round((impl.done / Math.max(1, impl.total)) * 100)} label={`Implémentation… ${impl.done}/${impl.total}`} />
        )}

        {!!staged.length && !impl.on && (
          <button className="btn-accent" onClick={implement} style={{ marginTop: 12 }}>
            Implémenter dans le launcher ({staged.length})
          </button>
        )}
      </div>

      {/* Mise à jour des 3 launchers : visible une fois qu'on a implémenté / modifié */}
      {(implemented || build.on || build.done) && (
        <div className="lchr-card">
          <h3>Mettre à jour les 3 launchers</h3>
          <p className="lchr-hint">Reconstruit et publie les launchers Windows / Mac / Linux. Les joueurs reçoivent la maj automatiquement.</p>
          {(build.on || build.done) && <Bar pct={build.pct} label={build.label} ok={build.done && build.ok} fail={build.done && !build.ok} />}
          {!build.on && !build.done && (
            <button className="btn-accent" onClick={update3} style={{ marginTop: 12 }}>Lancer la mise à jour</button>
          )}
          {build.done && build.url && (
            <a href={build.url} target="_blank" rel="noopener" className="lchr-hint" style={{ display: 'inline-block', marginTop: 8 }}>Voir le build sur GitHub →</a>
          )}
          {build.done && !build.on && (
            <button className="btn-sec" style={{ marginTop: 12, marginLeft: build.url ? 12 : 0 }} onClick={() => setBuild({ on: false, pct: 0, label: '', done: false, ok: false, url: null })}>OK</button>
          )}
        </div>
      )}
    </div>
  );
}

function PublishedList({ title, items, onDel, readOnly }: { title: string; items: { name: string }[]; onDel?: (n: string) => void; readOnly?: boolean }) {
  return (
    <div className="lchr-card">
      <h3>{title} <span className="lchr-count">{items.length}</span></h3>
      {items.length === 0 ? (
        <p className="lchr-hint">Aucun pour l’instant.</p>
      ) : (
        <ul className="lchr-list">
          {items.map((m) => (
            <li key={m.name}>
              <span>{m.name}</span>
              {!readOnly && onDel && <button className="lchr-x" onClick={() => onDel(m.name)}>Retirer</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Bar({ pct, label, ok, fail }: { pct: number; label: string; ok?: boolean; fail?: boolean }) {
  const color = fail ? '#e0574d' : ok ? '#3ba55d' : 'var(--accent, #7c5cff)';
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, color: 'var(--muted,#8a8a94)', marginBottom: 6 }}>{label}</div>
      <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', background: color, transition: 'width .4s ease' }} />
      </div>
    </div>
  );
}
