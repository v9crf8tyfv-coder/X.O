import crypto from 'crypto';

/**
 * Gestion du launcher EmeriaMC depuis le panel (fonda/co-fonda) :
 *  - la release GitHub "mods" héberge manifest.json + les .jar / .zip
 *  - le launcher télécharge tout depuis ce manifeste au lancement
 *  - "mettre à jour les 3 launchers" = bump version + tag -> déclenche le build 3 OS
 *
 * Nécessite la variable d'env GH_LAUNCHER_TOKEN (token GitHub, scope repo).
 */

const OWNER = process.env.LAUNCHER_REPO_OWNER || 'v9crf8tyfv-coder';
const REPO = process.env.LAUNCHER_REPO_NAME || 'EmeriaLauncher';
const MODS_TAG = 'mods';
const API = 'https://api.github.com';
const UPLOADS = 'https://uploads.github.com';

export type ManifestEntry = { name: string; url: string; sha256: string };
export type OptionalEntry = ManifestEntry & { id: string };
export interface Manifest {
  mods: ManifestEntry[];
  resourcepacks: ManifestEntry[];
  optional: OptionalEntry[];
  axiomAllowed: string[]; // pseudos autorisés à voir/activer Axiom (staff build)
}

export function hasToken(): boolean {
  return !!process.env.GH_LAUNCHER_TOKEN;
}

function token(): string {
  const t = process.env.GH_LAUNCHER_TOKEN;
  if (!t) throw new Error('GH_LAUNCHER_TOKEN manquant (à ajouter dans Vercel).');
  return t;
}

function ghHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${token()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'xo-panel-launcher',
    ...extra,
  };
}

async function gh(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path.startsWith('http') ? path : `${API}${path}`, {
    ...init,
    headers: ghHeaders(init?.headers as Record<string, string>),
    cache: 'no-store',
  });
}

interface Release {
  id: number;
  assets: { id: number; name: string; browser_download_url: string; url: string }[];
}

/** Récupère (ou crée) la release "mods". */
export async function getModsRelease(): Promise<Release> {
  let r = await gh(`/repos/${OWNER}/${REPO}/releases/tags/${MODS_TAG}`);
  if (r.status === 404) {
    const created = await gh(`/repos/${OWNER}/${REPO}/releases`, {
      method: 'POST',
      body: JSON.stringify({ tag_name: MODS_TAG, name: 'mods', body: 'Mods du launcher', prerelease: true }),
    });
    if (!created.ok) throw new Error(`Création release mods: ${created.status} ${await created.text()}`);
    return (await created.json()) as Release;
  }
  if (!r.ok) throw new Error(`Release mods: ${r.status} ${await r.text()}`);
  return (await r.json()) as Release;
}

const EMPTY: Manifest = { mods: [], resourcepacks: [], optional: [], axiomAllowed: [] };

/** Lit manifest.json depuis la release (ou un manifeste vide s'il n'existe pas). */
export async function getManifest(rel?: Release): Promise<Manifest> {
  const release = rel ?? (await getModsRelease());
  const asset = release.assets.find((a) => a.name === 'manifest.json');
  if (!asset) return { ...EMPTY };
  const r = await gh(asset.url, { headers: { Accept: 'application/octet-stream' } });
  if (!r.ok) return { ...EMPTY };
  try {
    const j = JSON.parse(await r.text());
    return {
      mods: Array.isArray(j.mods) ? j.mods : [],
      resourcepacks: Array.isArray(j.resourcepacks) ? j.resourcepacks : [],
      optional: Array.isArray(j.optional) ? j.optional : [],
      axiomAllowed: Array.isArray(j.axiomAllowed) ? j.axiomAllowed : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

async function deleteAssetByName(release: Release, name: string): Promise<void> {
  const existing = release.assets.find((a) => a.name === name);
  if (existing) {
    await gh(`/repos/${OWNER}/${REPO}/releases/assets/${existing.id}`, { method: 'DELETE' });
  }
}

/** Envoie un fichier comme asset de la release (remplace s'il existe déjà). Renvoie l'URL publique. */
export async function uploadAsset(
  release: Release,
  name: string,
  data: Buffer,
  contentType = 'application/octet-stream',
): Promise<string> {
  await deleteAssetByName(release, name);
  const url = `${UPLOADS}/repos/${OWNER}/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: ghHeaders({ 'Content-Type': contentType, 'Content-Length': String(data.length) }),
    body: new Uint8Array(data),
  });
  if (!r.ok) throw new Error(`Upload ${name}: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { browser_download_url: string };
  return j.browser_download_url;
}

/** Écrit le manifest.json sur la release. */
export async function putManifest(release: Release, manifest: Manifest): Promise<void> {
  const data = Buffer.from(JSON.stringify(manifest, null, 2));
  // Recharge la release pour avoir l'asset manifest.json à jour avant suppression
  const fresh = await getModsRelease();
  await uploadAsset(fresh, 'manifest.json', data, 'application/json');
}

export function sha256(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Télécharge un fichier distant en Buffer. Gère les liens de release GitHub
 * (y compris repos PRIVÉS) via l'API + le token : on résout l'asset et on le
 * récupère en application/octet-stream (les liens browser_download_url d'un repo
 * privé ne sont pas accessibles sans authentification).
 */
export async function downloadRemote(url: string): Promise<Buffer> {
  const m = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\/(.+)$/i.exec(url);
  if (m && hasToken()) {
    const [, owner, repo, tag, rawName] = m;
    const name = decodeURIComponent(rawName);
    const relRes = await gh(`/repos/${owner}/${repo}/releases/tags/${tag}`);
    if (!relRes.ok) throw new Error(`Release introuvable (${relRes.status}) — le token a-t-il accès à ${owner}/${repo} ?`);
    const rel = (await relRes.json()) as Release;
    const asset = rel.assets.find((a) => a.name === name);
    if (!asset) throw new Error(`Fichier « ${name} » absent de la release ${tag}.`);
    const bin = await gh(asset.url, { headers: { Accept: 'application/octet-stream' } });
    if (!bin.ok) throw new Error(`Téléchargement de l'asset échoué (${bin.status}).`);
    return Buffer.from(await bin.arrayBuffer());
  }
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Téléchargement échoué (${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}

/** Ajoute/remplace un fichier (mod ou resourcepack) : upload + maj manifeste. */
export async function addFile(
  kind: 'mods' | 'resourcepacks',
  filename: string,
  data: Buffer,
): Promise<Manifest> {
  const release = await getModsRelease();
  const url = await uploadAsset(release, filename, data);
  const hash = sha256(data);
  const manifest = await getManifest(release);
  const list = manifest[kind];
  const idx = list.findIndex((e) => e.name === filename);
  const entry: ManifestEntry = { name: filename, url, sha256: hash };
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  await putManifest(release, manifest);
  return manifest;
}

/** Retire un fichier du manifeste (et supprime l'asset). */
/** Ajoute un pseudo à la liste Axiom (staff build). Insensible à la casse, sans doublon. */
export async function addAxiom(pseudo: string): Promise<Manifest> {
  const release = await getModsRelease();
  const manifest = await getManifest(release);
  const p = pseudo.trim();
  if (p && !manifest.axiomAllowed.some((x) => x.toLowerCase() === p.toLowerCase())) {
    manifest.axiomAllowed.push(p);
    await putManifest(release, manifest);
  }
  return manifest;
}

/** Retire un pseudo de la liste Axiom. */
export async function removeAxiom(pseudo: string): Promise<Manifest> {
  const release = await getModsRelease();
  const manifest = await getManifest(release);
  manifest.axiomAllowed = manifest.axiomAllowed.filter((x) => x.toLowerCase() !== pseudo.toLowerCase());
  await putManifest(release, manifest);
  return manifest;
}

export async function removeFile(kind: 'mods' | 'resourcepacks', filename: string): Promise<Manifest> {
  const release = await getModsRelease();
  const manifest = await getManifest(release);
  manifest[kind] = manifest[kind].filter((e) => e.name !== filename);
  await deleteAssetByName(release, filename);
  await putManifest(release, manifest);
  return manifest;
}

// ------------------------------------------------------------ Build 3 OS

interface ContentFile {
  content: string;
  sha: string;
}

async function getPackageJson(branch: string): Promise<ContentFile & { version: string }> {
  const r = await gh(`/repos/${OWNER}/${REPO}/contents/package.json?ref=${branch}`);
  if (!r.ok) throw new Error(`package.json: ${r.status}`);
  const j = (await r.json()) as ContentFile;
  const parsed = JSON.parse(Buffer.from(j.content, 'base64').toString());
  return { ...j, version: parsed.version };
}

function bumpPatch(v: string): string {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v);
  if (!m) return '0.0.1';
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

async function defaultBranch(): Promise<string> {
  const r = await gh(`/repos/${OWNER}/${REPO}`);
  if (!r.ok) throw new Error(`repo: ${r.status}`);
  return ((await r.json()) as { default_branch: string }).default_branch;
}

/**
 * Bump la version (package.json) + crée le tag vX.Y.Z -> déclenche build.yml (3 OS).
 * Renvoie la nouvelle version + le sha du commit (pour suivre le run).
 */
export async function triggerBuild(): Promise<{ version: string; sha: string }> {
  const branch = await defaultBranch();
  const pkg = await getPackageJson(branch);
  const version = bumpPatch(pkg.version);

  const parsed = JSON.parse(Buffer.from(pkg.content, 'base64').toString());
  parsed.version = version;
  const newContent = Buffer.from(JSON.stringify(parsed, null, 2) + '\n').toString('base64');

  const put = await gh(`/repos/${OWNER}/${REPO}/contents/package.json`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Launcher v${version} (via panel)`,
      content: newContent,
      sha: pkg.sha,
      branch,
    }),
  });
  if (!put.ok) throw new Error(`bump version: ${put.status} ${await put.text()}`);
  const commitSha = ((await put.json()) as { commit: { sha: string } }).commit.sha;

  const tag = await gh(`/repos/${OWNER}/${REPO}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/tags/v${version}`, sha: commitSha }),
  });
  if (!tag.ok) throw new Error(`tag: ${tag.status} ${await tag.text()}`);

  return { version, sha: commitSha };
}

export interface BuildStatus {
  found: boolean;
  status: string; // queued | in_progress | completed
  conclusion: string | null; // success | failure | null
  url: string | null;
  progress: number; // 0..100 (estimation)
}

/** Suit le run de build associé au commit (sha). */
export async function buildStatus(sha: string): Promise<BuildStatus> {
  const r = await gh(`/repos/${OWNER}/${REPO}/actions/runs?per_page=20`);
  if (!r.ok) throw new Error(`runs: ${r.status}`);
  const runs = ((await r.json()) as { workflow_runs: RunInfo[] }).workflow_runs || [];
  const run = runs.find((x) => x.head_sha === sha) || runs.find((x) => x.head_branch === `v${sha}`);
  if (!run) return { found: false, status: 'queued', conclusion: null, url: null, progress: 5 };

  let progress = 10;
  if (run.status === 'in_progress') progress = 55;
  if (run.status === 'completed') progress = run.conclusion === 'success' ? 100 : 100;
  return {
    found: true,
    status: run.status,
    conclusion: run.conclusion,
    url: run.html_url,
    progress,
  };
}

interface RunInfo {
  head_sha: string;
  head_branch: string;
  status: string;
  conclusion: string | null;
  html_url: string;
}
