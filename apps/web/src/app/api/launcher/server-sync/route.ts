import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';
import { getManifest, hasToken } from '@/lib/launcher';
import { ftpConfigured, uploadToServer, restartServer, pingServer, deleteFromServer } from '@/lib/omgserv';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Sync d'un mod vers le SERVEUR OMGServ + redémarrage.
 *  - GET            : état du serveur (en ligne ?) + si le FTP est configuré. Sert à la barre de redémarrage.
 *  - POST {name}    : pousse le mod (depuis la release GitHub) dans mods/ du serveur, par FTP.
 *  - POST {action:'restart'} : redémarre le serveur (désarmé tant que OMGSERV_RESTART != "1").
 * Réservé fonda/co-fonda.
 */
export async function GET() {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  const online = await pingServer();
  return NextResponse.json({ online, configured: ftpConfigured() });
}

export async function POST(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  // --- Redémarrage ---
  if (body.action === 'restart') {
    return NextResponse.json(await restartServer());
  }

  // --- Upload d'un mod vers le serveur ---
  if (!ftpConfigured()) {
    return NextResponse.json({ error: 'ftp_non_configure' }, { status: 503 });
  }
  const name = String(body.name || '').trim();
  if (!/\.jar$/i.test(name)) {
    return NextResponse.json({ error: 'Nom de mod invalide (.jar attendu).' }, { status: 400 });
  }

  // On retrouve l'URL du mod dans le manifest (release GitHub), sauf si fournie.
  let url = String(body.url || '').trim();
  if (!url && hasToken()) {
    try {
      const m = await getManifest();
      url = m.mods.find((x) => x.name === name)?.url || '';
    } catch { /* ignore */ }
  }
  if (!/^https?:\/\/.+/i.test(url)) {
    return NextResponse.json({ error: 'Mod introuvable dans le manifest (publie-le d\'abord dans le launcher).' }, { status: 404 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      return NextResponse.json({ error: `Téléchargement de la release échoué (${res.status}).` }, { status: 502 });
    }
    const expected = Number(res.headers.get('content-length') || 0) || undefined;
    // Stream direct release -> FTP (pas de gros buffer : OK pour le plan gratuit).
    const stream = Readable.fromWeb(res.body as unknown as import('stream/web').ReadableStream);
    const up = await uploadToServer(name, stream, expected);
    if (!up.ok) {
      return NextResponse.json(
        { error: 'Vérification de taille échouée après upload.', size: up.size, expected: expected ?? null },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, size: up.size });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

/** Retire un mod (toutes versions) du dossier mods/ du serveur. */
export async function DELETE(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!ftpConfigured()) return NextResponse.json({ error: 'ftp_non_configure' }, { status: 503 });
  const name = new URL(req.url).searchParams.get('name') || '';
  if (!/\.jar$/i.test(name)) return NextResponse.json({ error: 'nom_invalide' }, { status: 400 });
  try {
    const r = await deleteFromServer(name);
    return NextResponse.json({ ok: true, removed: r.removed });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
