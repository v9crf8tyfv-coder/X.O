'use client';

import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';

interface Entry { name: string; url: string; sha256: string }
interface Manifest { mods: Entry[]; resourcepacks: Entry[]; optional: (Entry & { id: string })[]; axiomAllowed: string[]; comAllowed: string[] }
type Kind = 'mods' | 'resourcepacks';

/** POST multipart avec progression RÉELLE de l'upload (navigateur -> serveur), via XHR. */
function xhrUpload(
  url: string,
  form: FormData,
  onProgress: (frac: number) => void,
): Promise<{ ok: boolean; json: () => Promise<{ error?: string }> }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => resolve({
      ok: xhr.status >= 200 && xhr.status < 300,
      json: () => {
        try { return Promise.resolve(JSON.parse(xhr.responseText || '{}') as { error?: string }); }
        catch { return Promise.resolve({} as { error?: string }); }
      },
    });
    xhr.onerror = () => reject(new Error('Erreur réseau'));
    xhr.send(form);
  });
}

/** Fait avancer une barre tant qu'une requête tourne (upload fait côté serveur = non mesurable ici). */
function startCreep(set: (v: { on: boolean; pct: number }) => void, from = 8): () => void {
  let p = from;
  set({ on: true, pct: p });
  const id = window.setInterval(() => { p = Math.min(92, p + 4); set({ on: true, pct: p }); }, 250);
  return () => window.clearInterval(id);
}

// --- Vérification d'un .jar avant upload (version Minecraft, Fabric, dépendances, client/serveur) ---
const MC_TARGET = [1, 21, 1];
function parseV(s: string): number[] { return s.split('.').map((n) => parseInt(n, 10) || 0); }
function vCmp(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] || 0, y = b[i] || 0; if (x !== y) return x < y ? -1 : 1; }
  return 0;
}
/** Est-ce que 1.21.1 satisfait UNE condition de version Fabric (>=, >, <=, <, ~, ^, exact, x) ? */
function condOk(p: string): boolean {
  let m: RegExpMatchArray | null;
  if ((m = p.match(/^>=\s*v?(\d+(?:\.\d+)*)/))) return vCmp(MC_TARGET, parseV(m[1])) >= 0;
  if ((m = p.match(/^>\s*v?(\d+(?:\.\d+)*)/))) return vCmp(MC_TARGET, parseV(m[1])) > 0;
  if ((m = p.match(/^<=\s*v?(\d+(?:\.\d+)*)/))) return vCmp(MC_TARGET, parseV(m[1])) <= 0;
  if ((m = p.match(/^<\s*v?(\d+(?:\.\d+)*)/))) return vCmp(MC_TARGET, parseV(m[1])) < 0;
  if ((m = p.match(/^[~^]\s*v?(\d+)\.(\d+)/))) return MC_TARGET[0] === +m[1] && MC_TARGET[1] === +m[2];
  if ((m = p.match(/^=?\s*v?(\d+)\.(\d+)\.x$/i))) return MC_TARGET[0] === +m[1] && MC_TARGET[1] === +m[2];
  if ((m = p.match(/^=?\s*v?(\d+(?:\.\d+)*)$/))) return parseV(m[1]).every((n, i) => MC_TARGET[i] === n);
  return true; // forme inconnue -> on ne bloque pas
}
/** 1.21.1 est-il compatible avec une contrainte Minecraft (ET sur les espaces) ? */
function mcAllows(range: string): boolean {
  const r = range.trim();
  if (!r || r === '*') return true;
  return r.split(/\s+/).every(condOk);
}
interface JarCheck { fabric: boolean; mcOk: boolean; env: string; missingDeps: string[]; reason?: string }
async function inspectJar(file: File, manifestMods: string[]): Promise<JarCheck> {
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const fmj = zip.file('fabric.mod.json');
    if (!fmj) {
      const forge = zip.file('META-INF/mods.toml') || zip.file('META-INF/neoforge.mods.toml');
      return { fabric: false, mcOk: false, env: '*', missingDeps: [], reason: forge ? 'mod Forge/NeoForge (pas Fabric)' : 'pas un mod Fabric (fabric.mod.json absent)' };
    }
    const meta = JSON.parse(await fmj.async('string')) as { environment?: string; depends?: Record<string, unknown> };
    const env = typeof meta.environment === 'string' ? meta.environment : '*';
    const dep = meta.depends || {};
    const mc = dep.minecraft;
    const mcArr = Array.isArray(mc) ? mc.map(String) : (mc ? [String(mc)] : []);
    const mcOk = mcArr.length === 0 || mcArr.some(mcAllows);
    const nested = Object.keys(zip.files).filter((f) => /^META-INF\/jars\/.*\.jar$/i.test(f)).map((f) => (f.split('/').pop() || '').toLowerCase());
    const man = manifestMods.map((m) => m.toLowerCase());
    const missingDeps = Object.keys(dep).filter((id) => {
      const k = id.toLowerCase();
      if (['minecraft', 'java', 'fabricloader'].includes(k) || k.startsWith('fabric')) return false; // fournis par MC/Fabric
      if (nested.some((n) => n.includes(k))) return false; // embarqué (jar imbriqué)
      if (man.some((n) => n.includes(k))) return false; // déjà dans le launcher
      return true;
    });
    return { fabric: true, mcOk, env, missingDeps, reason: mcOk ? undefined : `cible Minecraft ${mcArr.join(', ')} (pas 1.21.1)` };
  } catch {
    return { fabric: false, mcOk: false, env: '*', missingDeps: [], reason: 'fichier illisible (.jar invalide ?)' };
  }
}

export default function LauncherSection() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [needToken, setNeedToken] = useState(false);
  const [error, setError] = useState('');

  const [staged, setStaged] = useState<{ file: File; kind: Kind }[]>([]);
  const [impl, setImpl] = useState<{ on: boolean; pct: number }>({ on: false, pct: 0 });
  const [implemented, setImplemented] = useState(false);

  // Sync serveur OMGServ + redémarrage (une seule action : launcher + serveur + restart)
  const [srvConfigured, setSrvConfigured] = useState(false);
  const [toServer, setToServer] = useState(false);
  const [srv, setSrv] = useState<{ on: boolean; pct: number }>({ on: false, pct: 0 });
  // Fin d'implémentation : 'success' = barre verte brève, 'restart' = encadré "tu peux redémarrer" (15 s)
  const [finish, setFinish] = useState<'idle' | 'success' | 'restart'>('idle');
  // Message de confirmation après une suppression (d'où le mod a été retiré)
  const [delMsg, setDelMsg] = useState('');

  // Sync Google Drive (dossier Mod(s), partagé avec Orion)
  const [gdrive, setGdrive] = useState<{ configured: boolean; connected: boolean }>({ configured: false, connected: false });
  const [drv, setDrv] = useState<{ on: boolean; pct: number }>({ on: false, pct: 0 });
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
  /** Rafraîchit la liste des mods SANS repasser par l'écran "Chargement…" (évite le saut de scroll). */
  async function refreshManifest() {
    try {
      const r = await fetch('/api/launcher/mods');
      if (r.ok) setManifest(await r.json());
    } catch { /* ignore */ }
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
    setFinish('idle');

    const total = staged.length;

    // --- (1) Launcher : progression RÉELLE de l'upload (navigateur -> serveur) ---
    setImpl({ on: true, pct: 0 });
    const uploadedMods: string[] = [];
    for (let i = 0; i < total; i++) {
      const { file, kind } = staged[i];
      // Vérification avant upload (seulement les mods) : version / Fabric / dépendances / client-serveur.
      if (kind === 'mods') {
        const chk = await inspectJar(file, manifest?.mods?.map((m) => m.name) ?? []);
        const warns: string[] = [];
        if (!chk.fabric) {
          warns.push(chk.reason || 'pas un mod Fabric');
        } else {
          if (!chk.mcOk) warns.push(chk.reason || 'mauvaise version Minecraft');
          if (chk.missingDeps.length) warns.push(`dépendance(s) manquante(s) : ${chk.missingDeps.join(', ')} (à installer aussi)`);
          if (chk.env !== 'client' && !toServer) warns.push('mod de contenu/serveur : coche « pousser aussi sur le serveur », sinon il ne marchera pas en jeu');
        }
        if (warns.length) {
          const go = window.confirm(`Attention — ${file.name} :\n\n- ${warns.join('\n- ')}\n\nUploader quand même ?`);
          if (!go) continue; // on saute ce fichier
        }
      }
      const fd = new FormData();
      fd.append('kind', kind);
      fd.append('file', file);
      let r: { ok: boolean; json: () => Promise<{ error?: string }> };
      try {
        r = await xhrUpload('/api/launcher/mods', fd, (frac) =>
          setImpl({ on: true, pct: Math.round(((i + frac * 0.95) / total) * 100) }));
      } catch {
        setError(`${file.name} : erreur réseau pendant l'upload`);
        setImpl({ on: false, pct: 0 });
        return;
      }
      if (!r.ok) {
        const msg = (await r.json().catch(() => ({} as { error?: string }))).error || `Échec sur ${file.name}`;
        setError(`${file.name} : ${msg}`);
        setImpl({ on: false, pct: 0 });
        return;
      }
      if (kind === 'mods') uploadedMods.push(file.name);
      setImpl({ on: true, pct: Math.round(((i + 1) / total) * 100) });
    }
    setStaged([]);
    setImpl({ on: false, pct: 0 });
    await refreshManifest();

    // --- (2) Serveur + Drive + rappel de redémarrage (mutualisé avec l'ajout par lien) ---
    await syncExtra(uploadedMods);
  }

  /** Pousse des mods DÉJÀ dans le launcher vers Google Drive + serveur OMGServ, puis affiche la fin. */
  async function syncExtra(names: string[]) {
    // Google Drive (si connecté)
    if (gdrive.connected && names.length) {
      for (let i = 0; i < names.length; i++) {
        const stop = startCreep(setDrv);
        const r = await fetch('/api/gdrive', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: names[i] }),
        });
        stop();
        if (!r.ok) {
          const j = await r.json().catch(() => ({} as { error?: string }));
          setDrv({ on: false, pct: 0 });
          setError(`Google Drive (${names[i]}) : ${j.error || 'échec'}`);
          break;
        }
        setDrv({ on: true, pct: Math.round(((i + 1) / names.length) * 100) });
      }
      setDrv({ on: false, pct: 0 });
    }
    // Serveur OMGServ (si la case est cochée)
    let serverPushed = false;
    if (toServer && names.length) {
      for (let i = 0; i < names.length; i++) {
        const stop = startCreep(setSrv);
        const r = await fetch('/api/launcher/server-sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: names[i] }),
        });
        stop();
        const j = await r.json().catch(() => ({} as { error?: string }));
        if (!r.ok) {
          setSrv({ on: false, pct: 0 });
          if (j.error === 'ftp_non_configure') {
            setError('Mods bien dans le launcher. Upload serveur non configuré : ajoute OMGSERV_FTP_USER + OMGSERV_FTP_PASSWORD dans Vercel.');
          } else {
            setError(`Serveur (${names[i]}) : ${j.error || 'échec de l\'upload'}`);
          }
          setImplemented(true);
          return;
        }
        setSrv({ on: true, pct: Math.round(((i + 1) / names.length) * 100) });
      }
      setSrv({ on: false, pct: 0 });
      serverPushed = true;
    }
    setImplemented(true);
    finishFlow(serverPushed); // barre verte brève, puis rappel "tu peux redémarrer" 15 s si serveur poussé
  }

  /** Fin : barre verte ~2 s, puis (si le serveur a reçu des mods) rappel de redémarrage pendant 15 s. */
  function finishFlow(serverPushed: boolean) {
    setFinish('success');
    window.setTimeout(() => setFinish(serverPushed ? 'restart' : 'idle'), 2000);
    if (serverPushed) window.setTimeout(() => setFinish('idle'), 17000);
  }

  async function del(kind: Kind, name: string) {
    const extra = kind === 'mods' ? ' partout (launcher + serveur + Drive)' : ' du launcher';
    if (!confirm(`Retirer ${name}${extra} ?`)) return;
    setError('');
    setDelMsg('');
    const enc = encodeURIComponent(name);
    // 1) Launcher (obligatoire)
    const r = await fetch(`/api/launcher/mods?kind=${kind}&name=${enc}`, { method: 'DELETE' });
    if (!r.ok) {
      setError((await r.json().catch(() => ({} as { error?: string }))).error || 'Échec de la suppression du launcher.');
      return;
    }
    setManifest((await r.json()).manifest);
    setImplemented(true);
    const where: string[] = ['launcher'];
    // 2) Serveur + Drive (seulement pour les mods)
    if (kind === 'mods') {
      if (srvConfigured) {
        const rs = await fetch(`/api/launcher/server-sync?name=${enc}`, { method: 'DELETE' });
        where.push(rs.ok ? 'serveur' : 'serveur (échec)');
      }
      if (gdrive.connected) {
        const rd = await fetch(`/api/gdrive?name=${enc}`, { method: 'DELETE' });
        where.push(rd.ok ? 'Drive' : 'Drive (échec)');
      }
    }
    setDelMsg(`« ${name} » retiré de : ${where.join(', ')}.`);
    window.setTimeout(() => setDelMsg(''), 12000);
  }

  /** Ajoute un mod/RP depuis une URL directe (le serveur télécharge — pas de limite navigateur). */
  async function addByLink(kind: Kind) {
    const url = prompt(`Colle le LIEN DIRECT du ${kind === 'mods' ? 'mod (.jar)' : 'resourcepack (.zip)'} (Modrinth / CurseForge CDN / GitHub) :`);
    if (!url) return;
    setError('');
    setFinish('idle');
    const r = await fetch('/api/launcher/mods', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, url: url.trim() }),
    });
    const j = await r.json().catch(() => ({} as { error?: string; manifest?: Manifest }));
    if (!r.ok) { setError(j.error || 'Échec de l’ajout par lien.'); return; }
    if (j.manifest) setManifest(j.manifest);
    setImplemented(true);
    // Mod par lien -> on pousse AUSSI sur le serveur + Drive (comme un upload normal).
    if (kind === 'mods') {
      let name = '';
      try { name = decodeURIComponent(new URL(url.trim()).pathname.split('/').pop() || ''); } catch { name = ''; }
      if (/\.jar$/i.test(name)) await syncExtra([name]);
    }
  }

  const [saveMsg, setSaveMsg] = useState('');
  /** Ajoute/remplace un mod OPTIONNEL (staff build, ex. Axiom) par lien direct (.jar). */
  async function addOptionalByLink() {
    const url = prompt('Colle le LIEN DIRECT du mod optionnel (.jar), ex. la nouvelle version d\'Axiom :');
    if (!url) return;
    const id = (prompt('Identifiant du mod optionnel (laisse « axiom » pour Axiom) :', 'axiom') || 'axiom').trim();
    setError('');
    const r = await fetch('/api/launcher/mods', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'optional', id, url: url.trim() }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setManifest(j.manifest); setImplemented(true); } else setError(j.error || 'Échec de l\'ajout du mod optionnel.');
  }
  async function delOptional(id: string, name: string) {
    if (!confirm(`Retirer ${name} (mod optionnel « ${id} ») ?`)) return;
    setError('');
    const r = await fetch(`/api/launcher/mods?kind=optional&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setManifest(j.manifest); setImplemented(true); } else setError(j.error || 'Échec de la suppression.');
  }
  /** Force une sauvegarde de l'état COURANT du manifest (point de restauration). */
  async function forceSave() {
    setError(''); setSaveMsg('Sauvegarde…');
    const r = await fetch('/api/launcher/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ save: true }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setSaveMsg('Sauvegarde forcée. Tu pourras restaurer cet état si besoin.'); loadBackup(); }
    else { setSaveMsg(''); setError(j.error || 'Échec de la sauvegarde.'); }
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
        <button className="btn-sec" onClick={forceSave}>Forcer la sauvegarde des mods</button>
        {saveMsg && <span className="lchr-hint">{saveMsg}</span>}
        <span className="lchr-hint">Ouvre OMGServ — clique "Redémarrer" pour appliquer les mods sur le serveur.</span>
      </div>

      {error && (
        <div style={{ background: 'rgba(220,60,60,.14)', border: '1px solid rgba(220,60,60,.4)', color: '#ffb4b4', padding: '10px 14px', borderRadius: 10, marginBottom: 16 }}>
          {error}
        </div>
      )}
      {delMsg && (
        <div style={{ background: 'rgba(54,192,138,.14)', border: '1px solid rgba(54,192,138,.4)', color: '#8ff0c4', padding: '10px 14px', borderRadius: 10, marginBottom: 16 }}>
          {delMsg}
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
      {/* Mods optionnels (staff build : Axiom) — gérables par lien */}
      <div className="lchr-card">
        <h3>Optionnels — staff build (Axiom) <span className="lchr-count">{manifest?.optional?.length ?? 0}</span></h3>
        <p className="lchr-hint">Mods réservés au staff build (ex. Axiom). Gros fichiers : utilise « par lien » (le serveur télécharge).</p>
        {manifest?.optional?.length ? (
          <ul className="lchr-list">
            {manifest.optional.map((m) => (
              <li key={m.id}><span>{m.name} <em>({m.id})</em></span><button className="lchr-x" onClick={() => delOptional(m.id, m.name)}>Retirer</button></li>
            ))}
          </ul>
        ) : (
          <p className="lchr-hint">Aucun pour l’instant.</p>
        )}
        <div className="lchr-add" style={{ marginTop: 10 }}>
          <button className="btn-sec" onClick={addOptionalByLink}>+ Mod optionnel par lien (Axiom)</button>
        </div>
      </div>

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

        {impl.on && <Bar pct={impl.pct} label={`Launcher… ${impl.pct}%`} />}
        {drv.on && <Bar pct={drv.pct} label={`Google Drive… ${drv.pct}%`} />}
        {srv.on && <Bar pct={srv.pct} label={`Serveur OMGServ… ${srv.pct}%`} />}
        {finish === 'success' && (
          <Bar pct={100} label="Terminé — tout est uploadé." ok />
        )}
        {finish === 'restart' && (
          <div style={{ marginTop: 12, background: 'rgba(124,92,255,.10)', border: '1px solid rgba(124,92,255,.35)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13 }}>Mods en ligne. Tu peux redémarrer le serveur pour les appliquer.</span>
            <a href="https://panel.omgserv.com" target="_blank" rel="noopener" className="btn-accent" style={{ textDecoration: 'none' }}>
              Redémarrer le serveur
            </a>
          </div>
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
