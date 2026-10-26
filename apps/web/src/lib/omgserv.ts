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
    await client.ensureDir(c.modsDir); // crée si besoin et se place dedans
    await client.uploadFrom(source, name); // écrase si déjà présent
    let size = -1;
    try { size = await client.size(name); } catch { /* certains serveurs refusent SIZE */ }
    const ok = expectedSize && expectedSize > 0 ? size === expectedSize : size > 0;
    return { ok, size };
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
  const cmd = process.env.OMGSERV_RESTART_CMD || 'stop';
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
