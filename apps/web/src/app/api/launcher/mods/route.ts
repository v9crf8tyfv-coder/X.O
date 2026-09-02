import { NextResponse } from 'next/server';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';
import { getManifest, addFile, removeFile, hasToken, downloadRemote } from '@/lib/launcher';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX = 4 * 1024 * 1024; // ~4 Mo : limite d'upload Vercel

/** Liste des mods / resourcepacks / optionnels du launcher (fonda/co-fonda). */
export async function GET() {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!hasToken()) return NextResponse.json({ error: 'token_manquant' }, { status: 503 });
  try {
    return NextResponse.json(await getManifest());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

const MAX_URL = 180 * 1024 * 1024; // ~180 Mo pour l'ajout par lien (le serveur télécharge)

/** Ajoute un mod ou resourcepack (upload de fichier, OU par lien via JSON). */
export async function POST(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!hasToken()) return NextResponse.json({ error: 'token_manquant' }, { status: 503 });

  // --- Ajout PAR LIEN : le serveur va chercher le fichier (pas de limite navigateur) ---
  if ((req.headers.get('content-type') || '').includes('application/json')) {
    const { kind, url, name } = await req.json().catch(() => ({}));
    if (kind !== 'mods' && kind !== 'resourcepacks') {
      return NextResponse.json({ error: 'Type invalide.' }, { status: 400 });
    }
    if (!/^https?:\/\/.+/i.test(String(url || ''))) {
      return NextResponse.json({ error: 'Lien invalide (http/https).' }, { status: 400 });
    }
    const ext = kind === 'mods' ? '.jar' : '.zip';
    let filename = String(name || '').trim();
    if (!filename) {
      try { filename = decodeURIComponent(new URL(url).pathname.split('/').pop() || ''); } catch { filename = ''; }
    }
    if (!filename.toLowerCase().endsWith(ext)) {
      return NextResponse.json({ error: `Le fichier doit finir par ${ext} (donne un nom si l'URL n'en a pas).` }, { status: 400 });
    }
    try {
      const data = await downloadRemote(url);
      if (data.length === 0) {
        return NextResponse.json({ error: 'Le fichier téléchargé est vide.' }, { status: 400 });
      }
      if (data.length > MAX_URL) {
        return NextResponse.json({ error: `Fichier trop lourd (${(data.length / 1048576).toFixed(1)} Mo, max ${MAX_URL / 1048576} Mo).` }, { status: 413 });
      }
      return NextResponse.json({ ok: true, manifest: await addFile(kind, filename, data) });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
  const kind = String(form.get('kind') || 'mods');
  if (kind !== 'mods' && kind !== 'resourcepacks') {
    return NextResponse.json({ error: 'Type invalide.' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Fichier manquant.' }, { status: 400 });
  }
  const ext = kind === 'mods' ? /\.jar$/i : /\.zip$/i;
  if (!ext.test(file.name)) {
    return NextResponse.json(
      { error: kind === 'mods' ? 'Un mod doit être un .jar.' : 'Un resourcepack doit être un .zip.' },
      { status: 400 },
    );
  }
  if (file.size > MAX) {
    return NextResponse.json(
      { error: `Fichier trop lourd (${(file.size / 1048576).toFixed(1)} Mo). Limite ${MAX / 1048576} Mo sur le panel.` },
      { status: 413 },
    );
  }
  try {
    const data = Buffer.from(await file.arrayBuffer());
    if (data.length === 0) {
      return NextResponse.json(
        { error: 'Fichier vide reçu — il est probablement trop lourd pour l\'upload direct (limite ~4 Mo du panel). Utilise plutôt « Ajouter par lien » avec le lien de la release GitHub.' },
        { status: 413 },
      );
    }
    const manifest = await addFile(kind, file.name, data);
    return NextResponse.json({ ok: true, manifest });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

/** Retire un mod / resourcepack. */
export async function DELETE(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!hasToken()) return NextResponse.json({ error: 'token_manquant' }, { status: 503 });
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind');
  const name = url.searchParams.get('name');
  if ((kind !== 'mods' && kind !== 'resourcepacks') || !name) {
    return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
  }
  try {
    const manifest = await removeFile(kind, name);
    return NextResponse.json({ ok: true, manifest });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
