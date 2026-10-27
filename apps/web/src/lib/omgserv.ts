/**
 * Synchro d'un mod vers le SERVEUR OMGServ (dossier `mods/`) par FTP, + redémarrage.
 *
 * But : quand on publie le mod Emeria dans le launcher, le pousser AUSSI sur le serveur
 * (sinon mismatch client/serveur = crash), puis redémarrer — en une seule action.
 *
 * Tourne côté SITE (Vercel). basic-ftp = pur JS (aucun binaire natif), léger pour le
 * plan gratuit. On STREAME le fichier (pas de gros buffer en RAM) pour tenir sur Vercel
 * même avec de gros mods.
 *
 * Variables d'env (Vercel). Si absentes -> no-op (le launcher marche quand même) :
 *   OMGSERV_FTP_HOST      (défaut 62.210.231.110)
 *   OMGSERV_FTP_PORT      (défaut 21)
 *   OMGSERV_FTP_USER      (ex 463643_Xtazzking)     <- requis
 *   OMGSERV_FTP_PASSWORD                             <- requis (jamais dans le code)
 *   OMGSERV_FTP_SECURE    ("1" pour FTPS explicite, sinon FTP simple)
 *   OMGSERV_MODS_DIR      (défaut "mods")
 * Redémarrage (désarmé par défaut, pour ne jamais couper le serveur par accident) :
 *   OMGSERV_RESTART       ("1" pour autoriser le redémarrage auto)
 *   OMGSERV_RESTART_CMD   (défaut "stop" — via RCON ; suppose un auto-restart du host)
 *   + réutilise RCON_HOST / RCON_PORT / RCON_PASSWORD (déjà là pour lp sync)
 * Ping d'état (barre de redémarrage) :
 *   OMGSERV_PING_HOST     (défaut = OMGSERV_FTP_HOST)
 *   OMGSERV_PING_PORT     (défaut 25565)
 */
import { Client } from 'basic-ftp';
import { Readable } from 'stream';
import { Socket } from 'net';
import { rconCommand } from './rcon';

function cfg() {
  return {
    host: process.env.OMGSERV_FTP_HOST || '62.210.231.110',
    port: Number(process.env.OMGSERV_FTP_PORT || 21),
    user: process.env.OMGSERV_FTP_USER || '',
    password: process.env.OMGSERV_FTP_PASSWORD || '',
    secure: process.env.OMGSERV_FTP_SECURE === '1',
    modsDir: process.env.OMGSERV_MODS_DIR || 'mods',
  };
}

/** Vrai si on a de quoi se connecter en FTP (user + password présents). */
export function ftpConfigured(): boolean {
  const c = cfg();
  return !!(c.user && c.password);
}

export interface UploadResult {
  ok: boolean;
  size: number;
}

/**
 * Upload (ou écrase) `name` dans le dossier mods/ du serveur, en streamant `source`.
 * Vérifie la taille sur le serveur après coup (si expectedSize fourni).
 */
export async function uploadToServer(
  name: string,
  source: Readable,
  expectedSize?: number,
): Promise<UploadResult> {
  const c = cfg();
  const client = new Client(45_000); // 45 s de timeout
  client.ftp.verbose = false;
  try {
    await client.access({
      host: c.host,
      port: c.port,
      user: c.user,
      password: c.password,
      secure: c.secure,
    });
    await client.ensureDir(c.modsDir); // crée si besoin et se place dedans (on est maintenant DANS mods/)

    // Supprime les ANCIENNES versions du MÊME mod avant d'uploader, pour TOUS les mods
    // (pas que emeriacore), quel que soit le format de version :
    //   emeriacore-1.0.0.jar, sodium-fabric-0.5.8+mc1.21.jar, Macaws-Bridges-1.21-3.0.jar, fabric-api-0.116+1.21.jar...
    // base = nom jusqu'au premier "-<chiffre>" (ou "-v<chiffre>"). Ensuite on efface tout
    // fichier "<base>-<version quelconque>.jar" sauf celui qu'on vient d'uploader.
    const m = name.match(/^(.*?)-v?\d/i);
    const base = m ? m[1] : '';
    if (base) {
      const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const oldRe = new RegExp('^' + esc + '-v?\\d.*\\.jar$', 'i');
      try {
        for (const f of await client.list()) {
          if (f.isFile && f.name !== name && oldRe.test(f.name)) {
            try { await client.remove(f.name); } catch { /* on continue */ }
          }
        }
      } catch { /* listing indispo : on écrasera juste le même nom */ }
    }

    await client.uploadFrom(source, name); // écrase si déjà présent
    let size = -1;
    try { size = await client.size(name); } catch { /* certains serveurs refusent SIZE */ }
    const ok = expectedSize && expectedSize > 0 ? size === expectedSize : size > 0;
    return { ok, size };
  } finally {
    client.close();
  }
}

// --- DATA PACKS : vont dans le dossier datapacks du MONDE (serveur), PAS dans mods/ ni le launcher.
function datapacksDir() { return process.env.OMGSERV_DATAPACKS_DIR || 'world/datapacks'; }

/** Upload (ou écrase) un data pack (.zip) dans le dossier datapacks du monde. */
export async function uploadDatapack(name: string, source: Readable, expectedSize?: number): Promise<UploadResult> {
  const c = cfg();
  const client = new Client(45_000);
  client.ftp.verbose = false;
  try {
    await client.access({ host: c.host, port: c.port, user: c.user, password: c.password, secure: c.secure });
    await client.ensureDir(datapacksDir());
    await client.uploadFrom(source, name);
    let size = -1;
    try { size = await client.size(name); } catch { /* ignore */ }
    return { ok: expectedSize && expectedSize > 0 ? size === expectedSize : size > 0, size };
  } finally {
    client.close();
  }
}

/** Liste les data packs présents dans le dossier datapacks du serveur. */
export async function listDatapacks(): Promise<string[]> {
  const c = cfg();
  const client = new Client(30_000);
  try {
    await client.access({ host: c.host, port: c.port, user: c.user, password: c.password, secure: c.secure });
    await client.ensureDir(datapacksDir());
    return (await client.list()).filter((f) => f.isFile).map((f) => f.name);
  } catch {
    return [];
  } finally {
    client.close();
  }
}

/** Retire un data pack du serveur. */
export async function deleteDatapack(name: string): Promise<boolean> {
  const c = cfg();
  const client = new Client(30_000);
  try {
    await client.access({ host: c.host, port: c.port, user: c.user, password: c.password, secure: c.secure });
    await client.ensureDir(datapacksDir());
    try { await client.remove(name); return true; } catch { return false; }
  } finally {
    client.close();
  }
}

/**
 * Supprime un mod du dossier mods/ du serveur (toutes ses versions : même base avant le numéro).
 * Renvoie le nombre de fichiers retirés.
 */
export async function deleteFromServer(name: string): Promise<{ removed: number }> {
  const c = cfg();
  const client = new Client(30_000);
  client.ftp.verbose = false;
  try {
    await client.access({ host: c.host, port: c.port, user: c.user, password: c.password, secure: c.secure });
    await client.ensureDir(c.modsDir);
    const base = name.match(/^(.*?)-v?\d/i)?.[1] || '';
    const re = base ? new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-v?\\d.*\\.jar$', 'i') : null;
    let removed = 0;
    for (const f of await client.list()) {
      if (f.isFile && (f.name === name || (re && re.test(f.name)))) {
        try { await client.remove(f.name); removed++; } catch { /* on continue */ }
      }
    }
    return { removed };
  } finally {
    client.close();
  }
}

/**
 * Redémarre le serveur. DÉSARMÉ par défaut : ne fait rien tant que OMGSERV_RESTART != "1"
 * (on ne coupe jamais la prod sans que ce soit explicitement autorisé).
 */
export async function restartServer(): Promise<{ done: boolean; reason?: string }> {
  if (process.env.OMGSERV_RESTART !== '1') return { done: false, reason: 'restart_non_arme' };
  // ecrestart = commande EmeriaCore qui sauvegarde puis force l'arrêt -> OMGServ relance (restart-on-crash).
  const cmd = process.env.OMGSERV_RESTART_CMD || 'ecrestart';
  const ok = await rconCommand(cmd);
  return ok ? { done: true } : { done: false, reason: 'rcon_indisponible' };
}

/** Le serveur Minecraft répond-il ? (simple connexion TCP sur le port de jeu). */
export function pingServer(): Promise<boolean> {
  const host = process.env.OMGSERV_PING_HOST || process.env.OMGSERV_FTP_HOST || '62.210.231.110';
  const port = Number(process.env.OMGSERV_PING_PORT || 25565);
  return new Promise((resolve) => {
    const s = new Socket();
    let done = false;
    const end = (v: boolean) => { if (done) return; done = true; try { s.destroy(); } catch { /* ignore */ } resolve(v); };
    s.setTimeout(4000);
    s.on('timeout', () => end(false));
    s.on('error', () => end(false));
    s.connect(port, host, () => end(true));
  });
}
