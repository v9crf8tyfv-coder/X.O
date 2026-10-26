/**
 * Sync d'un mod vers un dossier GOOGLE DRIVE (ex : "Gestion EmeriaMC > Mod(s)", partagé avec Orion).
 *
 * But : quand on publie un mod, le mettre AUSSI dans le Drive (supprime l'ancienne version, met la neuve),
 * en plus du launcher (GitHub) et du serveur (FTP). Comme le dossier est partagé, Orion le voit aussi.
 *
 * Gmail PERSO (pas Workspace) => on ne peut pas utiliser un "compte de service" (pas de quota Drive).
 * On passe donc par OAuth : le panel agit "au nom" du compte Google. Le refresh token est stocké en DB
 * (table gdrive_auth) via le bouton "Connecter Google Drive" du panel.
 *
 * Variables d'env (Vercel). Si absentes -> no-op (le reste marche quand même) :
 *   GDRIVE_CLIENT_ID        (identifiant OAuth, Google Cloud)
 *   GDRIVE_CLIENT_SECRET
 *   GDRIVE_MODS_FOLDER_ID   (l'ID du dossier Drive "Mod(s)" — dans l'URL du dossier)
 */
import { db, hasDatabase } from '@xo/db';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
// Scope "drive" (complet) nécessaire pour supprimer d'anciens jars uploadés à la main (pas seulement par l'app).
const SCOPE = 'https://www.googleapis.com/auth/drive';

function clientId() { return process.env.GDRIVE_CLIENT_ID || ''; }
function clientSecret() { return process.env.GDRIVE_CLIENT_SECRET || ''; }
function folderId() { return process.env.GDRIVE_MODS_FOLDER_ID || ''; }

/** Les identifiants OAuth + le dossier sont-ils configurés ? */
export function gdriveConfigured(): boolean {
  return !!(clientId() && clientSecret() && folderId());
}

async function ensureTable(): Promise<void> {
  await db()`
    create table if not exists gdrive_auth (
      id int primary key default 1,
      refresh_token text not null,
      email text,
      updated_at timestamptz not null default now()
    )
  `;
}

/** Y a-t-il un refresh token stocké (= Drive "connecté") ? */
export async function gdriveConnected(): Promise<boolean> {
  if (!hasDatabase()) return false;
  try {
    await ensureTable();
    const rows = await db()<{ refresh_token: string }[]>`select refresh_token from gdrive_auth where id = 1`;
    return !!rows[0]?.refresh_token;
  } catch { return false; }
}

/** URL de consentement Google pour connecter le Drive (access_type=offline + prompt=consent => refresh token). */
export function gdriveAuthUrl(redirectUri: string): string {
  const p = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });
  return `${AUTH_URL}?${p.toString()}`;
}

/** Échange le code OAuth contre un refresh token et le stocke en DB. */
export async function gdriveExchangeCode(code: string, redirectUri: string): Promise<void> {
  const body = new URLSearchParams({
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!r.ok) throw new Error('Échange OAuth Google échoué : ' + (await r.text()).slice(0, 200));
  const j = (await r.json()) as { refresh_token?: string; access_token?: string };
  if (!j.refresh_token) throw new Error('Pas de refresh token reçu (révoque l\'accès et réessaie).');
  let email: string | null = null;
  try {
    const me = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${j.access_token}` } });
    if (me.ok) email = ((await me.json()) as { email?: string }).email ?? null;
  } catch { /* email facultatif */ }
  await ensureTable();
  await db()`
    insert into gdrive_auth (id, refresh_token, email, updated_at)
    values (1, ${j.refresh_token}, ${email}, now())
    on conflict (id) do update set refresh_token = excluded.refresh_token, email = excluded.email, updated_at = now()
  `;
}

/** Access token frais à partir du refresh token stocké. */
async function accessToken(): Promise<string> {
  await ensureTable();
  const rows = await db()<{ refresh_token: string }[]>`select refresh_token from gdrive_auth where id = 1`;
  const refresh = rows[0]?.refresh_token;
  if (!refresh) throw new Error('Google Drive non connecté (clique « Connecter Google Drive »).');
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refresh,
    grant_type: 'refresh_token',
  });
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!r.ok) throw new Error('Rafraîchissement du token Google échoué : ' + (await r.text()).slice(0, 200));
  const j = (await r.json()) as { access_token?: string };
  if (!j.access_token) throw new Error('Pas d\'access token Google.');
  return j.access_token;
}

/** Base du nom d'un mod (avant le 1er "-<chiffre>"), pour repérer les anciennes versions. */
function modBase(name: string): string {
  const m = name.match(/^(.*?)-v?\d/i);
  return m ? m[1] : '';
}

/**
 * Pousse `data` (le .jar) dans le dossier Drive : supprime les anciennes versions du même mod puis uploade.
 */
export async function syncModToDrive(name: string, data: Buffer): Promise<{ ok: boolean }> {
  const token = await accessToken();
  const fid = folderId();

  // 1) Supprime anciennes versions (même base) + un éventuel fichier du même nom (pour ré-uploader propre).
  const base = modBase(name);
  const esc = base ? base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
  const oldRe = base ? new RegExp('^' + esc + '-v?\\d.*\\.jar$', 'i') : null;
  try {
    const q = encodeURIComponent(`'${fid}' in parents and trashed = false`);
    const lr = await fetch(`${API}/files?q=${q}&fields=files(id,name)&pageSize=1000`, { headers: { Authorization: `Bearer ${token}` } });
    if (lr.ok) {
      const files = ((await lr.json()) as { files?: { id: string; name: string }[] }).files ?? [];
      for (const f of files) {
        if (f.name === name || (oldRe && oldRe.test(f.name))) {
          await fetch(`${API}/files/${f.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
        }
      }
    }
  } catch { /* listing indispo : on uploade quand même */ }

  // 2) Upload multipart (métadonnées + contenu).
  const boundary = 'xo' + Date.now().toString(36);
  const meta = JSON.stringify({ name, parents: [fid] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: application/java-archive\r\n\r\n`),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const ur = await fetch(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!ur.ok) throw new Error('Upload Drive échoué : ' + (await ur.text()).slice(0, 200));
  return { ok: true };
}
