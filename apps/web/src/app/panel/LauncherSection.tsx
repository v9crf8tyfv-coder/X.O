'use client';

import { useEffect, useRef, useState } from 'react';

interface Entry { name: string; url: string; sha256: string }
interface Manifest { mods: Entry[]; resourcepacks: Entry[]; optional: (Entry & { id: string })[]; axiomAllowed: string[]; comAllowed: string[] }
type Kind = 'mods' | 'resourcepacks';

export default function LauncherSection() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [needToken, setNeedToken] = useState(false);
  const [error, setError] = useState('');

  const [staged, setStaged] = useState<{ file: File; kind: Kind }[]>([]);
  const [impl, setImpl] = useState<{ on: boolean; done: number; total: number }>({ on: false, done: 0, total: 0 });
  const [implemented, setImplemented] = useState(false);

  // Sync serveur OMGServ + redémarrage (une seule action : launcher + serveur + restart)
  const [srvConfigured, setSrvConfigured] = useState(false);
  const [toServer, setToServer] = useState(false);
  const [srv, setSrv] = useState<{ on: boolean; done: number; total: number }>({ on: false, done: 0, total: 0 });
  const [rst, setRst] = useState<{ phase: 'idle' | 'restarting' | 'waiting' | 'done' | 'skipped' | 'fail'; label: string; pct: number }>(
    { phase: 'idle', label: '', pct: 0 },
  );

  // Sync Google Drive (dossier Mod(s), partagé avec Orion)
  const [gdrive, setGdrive] = useState<{ configured: boolean; connected: boolean }>({ configured: false, connected: false });
  const [drv, setDrv] = useState<{ on: boolean; done: number; total: number }>({ on: false, done: 0, total: 0 });
  const [backup, setBackup] = useState<{ available: boolean; counts?: { mods: number; resourcepacks: number; optional: number } } | null>(null);
  const [restoring, setRestoring] = useState(false);

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
  async function loadBackup() {
    try {
      const r = await fetch('/api/launcher/restore');
      if (r.ok) setBackup(await r.json());
    } catch { /* ignore */ }
  }
  async function loadServerCfg() {
    try {
      const r = await fetch('/api/launcher/server-sync');
      if (r.ok) {
        const j = await r.json();
        setSrvConfigured(!!j.configured);
        setToServer(!!j.configured); // coché par défaut seulement si le FTP serveur est prêt
      }
    } catch { /* ignore */ }
  }
  async function loadGdrive() {
    try {
      const r = await fetch('/api/gdrive');
      if (r.ok) setGdrive(await r.json());
    } catch { /* ignore */ }
  }
  useEffect(() => { load(); loadBackup(); loadServerCfg(); loadGdrive(); }, []);

  /** Restaure le manifeste depuis la sauvegarde automatique (au cas où une manip a tout effacé). */
  async function restore() {
    if (!confirm('Restaurer la dernière sauvegarde du launcher ? La liste actuelle sera remplacée par la sauvegarde.')) return;
    setError('');
    setRestoring(true);
    try {
      const r = await fetch('/api/launcher/restore', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setManifest(j.manifest); setImplemented(true); }
      else setError(j.error || 'Échec de la restauration.');
    } finally {
      setRestoring(false);
    }
  }

  function stage(kind: Kind, files: FileList | null) {
    if (!files) return;
    const add = Array.from(files).map((file) => ({ file, kind }));
    setStaged((s) => [...s, ...add]);
    setImplemented(false);
  }
  function unstage(i: number) { setStaged((s) => s.filter((_, k) => k !== i)); }

  /**
   * Implémente les fichiers en attente : (1) launcher, puis si demandé (2) serveur OMGServ,
   * puis (3) redémarrage auto. Chaque étape a sa propre barre.
   */
  async function implement() {
    if (!staged.length) return;
    setError('');
    setRst({ phase: 'idle', label: '', pct: 0 });

    // --- (1) Launcher ---
    setImpl({ on: true, done: 0, total: staged.length });
    const uploadedMods: string[] = [];
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
      if (kind === 'mods') uploadedMods.push(file.name);
      setImpl({ on: true, done: i + 1, total: staged.length });
    }
    setStaged([]);
    setImpl({ on: false, done: 0, total: 0 });
    await load();

    // --- (2) Google Drive (dossier Mod(s)), si connecté — indépendant du serveur ---
    if (gdrive.connected && uploadedMods.length) {
      setDrv({ on: true, done: 0, total: uploadedMods.length });
      for (let i = 0; i < uploadedMods.length; i++) {
        const r = await fetch('/api/gdrive', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: uploadedMods[i] }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setDrv({ on: false, done: i, total: uploadedMods.length });
          setError(`Google Drive (${uploadedMods[i]}) : ${j.error || 'échec'}`);
          break;
        }
        setDrv({ on: true, done: i + 1, total: uploadedMods.length });
      }
      setDrv({ on: false, done: 0, total: 0 });
    }

    // --- (3) Serveur OMGServ (seulement les mods, si la case est cochée) ---
    if (toServer && uploadedMods.length) {
      setSrv({ on: true, done: 0, total: uploadedMods.length });
      for (let i = 0; i < uploadedMods.length; i++) {
        const r = await fetch('/api/launcher/server-sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: uploadedMods[i] }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          setSrv({ on: false, done: i, total: uploadedMods.length });
          if (j.error === 'ftp_non_configure') {
            setError('Mods bien dans le launcher. Upload serveur non configuré : ajoute OMGSERV_FTP_USER + OMGSERV_FTP_PASSWORD dans Vercel.');
          } else {
            setError(`Serveur (${uploadedMods[i]}) : ${j.error || 'échec de l\'upload'}`);
          }
          setImplemented(true);
          return;
        }
        setSrv({ on: true, done: i + 1, total: uploadedMods.length });
      }
      setSrv({ on: false, done: 0, total: 0 });

      // --- (3) Redémarrage auto, une fois launcher + serveur OK ---
      await doRestart();
    }

    setImplemented(true);
  }

  /** Déclenche le redémarrage puis suit l'état via ping (barre jusqu'à remise en ligne). */
  async function doRestart() {
    setRst({ phase: 'restarting', label: 'Tout est uploadé. Demande de redémarrage…', pct: 12 });
    const r = await fetch('/api/launcher/server-sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restart' }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.done === false) {
      const msg = j.reason === 'restart_non_arme'
        ? 'Launcher + serveur OK. Clique maintenant "Redémarrer" sur ton panneau OMGServ (panel.omgserv.com) pour appliquer — OMGServ ne permet pas le redémarrage automatique.'
        : 'Launcher + serveur OK. Redémarre le serveur à la main sur OMGServ.';
      setRst({ phase: 'skipped', label: msg, pct: 100 });
      return;
    }
    // Attend que le serveur tombe puis remonte.
    setRst({ phase: 'waiting', label: 'Serveur en cours de redémarrage…', pct: 30 });
    let sawDown = false;
    let tries = 0;
    const poll = async () => {
      tries++;
      let online = false;
      try { online = (await (await fetch('/api/launcher/server-sync')).json()).online; } catch { /* retry */ }
      if (!online) sawDown = true;
      if (sawDown && online) { setRst({ phase: 'done', label: 'Serveur redémarré et de nouveau en ligne.', pct: 100 }); return; }
      if (tries > 24) { setRst({ phase: 'done', label: 'Redémarrage lancé (vérification en ligne expirée, regarde en jeu).', pct: 100 }); return; }
      setRst({ phase: 'waiting', label: sawDown ? 'Serveur redémarre, remise en ligne…' : 'Arrêt du serveur en cours…', pct: Math.min(92, 30 + tries * 4) });
      setTimeout(poll, 5000);
    };
    setTimeout(poll, 5000);
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

  const [comInput, setComInput] = useState('');
  async function addCom() {
    const pseudo = comInput.trim();
    if (!pseudo) return;
    setError('');
    const r = await fetch('/api/launcher/axiom', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pseudo, type: 'com' }),
    });
    if (r.ok) { setManifest((await r.json()).manifest); setComInput(''); }
    else setError((await r.json().catch(() => ({}))).error || 'Échec de l’ajout.');
  }
  async function delCom(pseudo: string) {
    if (!confirm(`Retirer ${pseudo} de la catégorie Com ?`)) return;
    const r = await fetch(`/api/launcher/axiom?pseudo=${encodeURIComponent(pseudo)}&type=com`, { method: 'DELETE' });
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
      <p style={{ color: 'var(--muted, #8a8a94)', marginBottom: 12 }}>
        Ajoute des mods / resourcepacks, implémente-les dans le launcher, puis mets à jour les 3 launchers.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <a href="https://panel.omgserv.com" target="_blank" rel="noopener" className="btn-accent"
          style={{ display: 'inline-block', textDecoration: 'none' }}>
          Redémarrer le serveur
        </a>
        <span className="lchr-hint">Ouvre OMGServ — clique "Redémarrer" pour appliquer les mods sur le serveur.</span>
      </div>

      {error && (
        <div style={{ background: 'rgba(220,60,60,.14)', border: '1px solid rgba(220,60,60,.4)', color: '#ffb4b4', padding: '10px 14px', borderRadius: 10, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Sauvegarde de sécurité : restaurer la liste si une manip a tout effacé */}
      {backup?.available && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: 'rgba(124,92,255,.08)', border: '1px solid rgba(124,92,255,.35)', padding: '10px 14px', borderRadius: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--muted, #8a8a94)' }}>
            Sauvegarde disponible : {backup.counts?.mods ?? 0} mods, {backup.counts?.resourcepacks ?? 0} resourcepacks
            {backup.counts?.optional ? `, ${backup.counts.optional} optionnel(s)` : ''}. En cas de suppression accidentelle, restaure-la.
          </span>
          <button className="lchr-btn" onClick={restore} disabled={restoring}
            style={{ background: '#7c5cff', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 9, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {restoring ? 'Restauration…' : 'Restaurer la sauvegarde'}
          </button>
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

      {/* Com : liste des pseudos autorisés à la catégorie Com du launcher */}
      <div className="lchr-card">
        <h3>Équipe Com — catégorie launcher <span className="lchr-count">{manifest?.comAllowed?.length ?? 0}</span></h3>
        <p className="lchr-hint">Ces pseudos Minecraft ont la catégorie Équipe Com dans le launcher (Xtazzking et Orionyx84 l’ont déjà par défaut, inutile de les ajouter).</p>
        {manifest?.comAllowed?.length ? (
          <ul className="lchr-list">
            {manifest.comAllowed.map((p) => (
              <li key={p}><span>{p}</span><button className="lchr-x" onClick={() => delCom(p)}>Retirer</button></li>
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
            value={comInput}
            onChange={(e) => setComInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addCom(); }}
          />
          <button className="btn-accent" onClick={addCom}>Ajouter</button>
        </div>
      </div>

      {/* Google Drive : sync des mods dans le dossier Mod(s) (partagé avec Orion) */}
      <div className="lchr-card">
        <h3>Google Drive <span className="lchr-count">{gdrive.connected ? 'connecté' : gdrive.configured ? 'à connecter' : 'off'}</span></h3>
        {!gdrive.configured ? (
          <p className="lchr-hint">
            Pour copier automatiquement les mods dans ton Google Drive (dossier Mod(s)), ajoute dans Vercel :
            <code>GDRIVE_CLIENT_ID</code>, <code>GDRIVE_CLIENT_SECRET</code>, <code>GDRIVE_MODS_FOLDER_ID</code>, puis reviens ici.
          </p>
        ) : gdrive.connected ? (
          <p className="lchr-hint">
            Connecté. À chaque implémentation, les mods sont aussi copiés dans ton Drive (l&apos;ancienne version est remplacée) — Orion les voit aussi.
            {' '}<a href="/api/gdrive?action=connect" className="lchr-hint" style={{ textDecoration: 'underline' }}>Reconnecter</a>
          </p>
        ) : (
          <>
            <p className="lchr-hint">Clique pour autoriser l&apos;accès à ton Google Drive (une seule fois).</p>
            <a href="/api/gdrive?action=connect" className="btn-accent" style={{ display: 'inline-block', marginTop: 10, textDecoration: 'none' }}>
              Connecter Google Drive
            </a>
          </>
        )}
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
          <Bar pct={Math.round((impl.done / Math.max(1, impl.total)) * 100)} label={`1/2 Launcher… ${impl.done}/${impl.total}`} />
        )}
        {srv.on && (
          <Bar pct={Math.round((srv.done / Math.max(1, srv.total)) * 100)} label={`Serveur OMGServ… ${srv.done}/${srv.total}`} />
        )}
        {drv.on && (
          <Bar pct={Math.round((drv.done / Math.max(1, drv.total)) * 100)} label={`Google Drive… ${drv.done}/${drv.total}`} />
        )}
        {rst.phase !== 'idle' && (
          <Bar pct={rst.pct} label={rst.label}
            ok={rst.phase === 'done'}
            fail={rst.phase === 'fail'} />
        )}
        {rst.phase === 'skipped' && (
          <a href="https://panel.omgserv.com" target="_blank" rel="noopener"
            className="btn-accent" style={{ display: 'inline-block', marginTop: 10, textDecoration: 'none' }}>
            Ouvrir OMGServ pour redémarrer
          </a>
        )}

        {!!staged.length && !impl.on && !srv.on && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, color: 'var(--muted,#8a8a94)', cursor: srvConfigured ? 'pointer' : 'not-allowed', opacity: srvConfigured ? 1 : 0.55 }}>
              <input type="checkbox" checked={toServer} disabled={!srvConfigured} onChange={(e) => setToServer(e.target.checked)} />
              Pousser aussi les mods sur le serveur OMGServ et redémarrer automatiquement
            </label>
            {!srvConfigured && (
              <p className="lchr-hint" style={{ marginTop: 4 }}>
                Serveur non connecté : ajoute OMGSERV_FTP_USER + OMGSERV_FTP_PASSWORD dans Vercel pour activer l&apos;upload serveur + redémarrage.
              </p>
            )}
            <button className="btn-accent" onClick={implement} style={{ marginTop: 10 }}>
              {toServer ? `Implémenter (launcher + serveur) (${staged.length})` : `Implémenter dans le launcher (${staged.length})`}
            </button>
          </>
        )}
      </div>

      {/* Mise à jour des 3 launchers : visible une fois qu'on a implémenté / modifié */}
      {(implemented || build.on || build.done) && (
        <div className="lchr-card">
          <h3>Mettre à jour les 3 launchers</h3>
          <p className="lchr-hint">⚠️ PAS nécessaire pour les mods/resourcepacks — les joueurs les reçoivent au prochain lancement du jeu, tout seuls. Ce bouton sert UNIQUEMENT à reconstruire l'appli launcher elle-même (rare). Reconstruit et publie Windows / Mac / Linux.</p>
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
