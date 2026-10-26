import { NextResponse } from 'next/server';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';
import { getManifest, hasToken } from '@/lib/launcher';
import { gdriveConfigured, gdriveConnected, gdriveAuthUrl, syncModToDrive, deleteFromDrive } from '@/lib/gdrive';

export const runtime = 'nodejs';
export const maxDuration = 60;

function origin(req: Request): string {
  const host = req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}
function redirectUri(req: Request): string {
  return `${origin(req)}/api/gdrive/callback`;
}

/**
 * Google Drive :
 *  - GET                 : statut { configured, connected }.
 *  - GET ?action=connect : redirige vers le consentement Google (démarre la connexion OAuth).
 *  - POST {name}         : pousse le mod (depuis la release) dans le dossier Drive (supprime l'ancienne version).
 * Réservé fonda/co-fonda.
 */
export async function GET(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;

  if (new URL(req.url).searchParams.get('action') === 'connect') {
    if (!gdriveConfigured()) return NextResponse.json({ error: 'gdrive_non_configure' }, { status: 503 });
    return NextResponse.redirect(gdriveAuthUrl(redirectUri(req)));
  }
  return NextResponse.json({ configured: gdriveConfigured(), connected: await gdriveConnected() });
}

export async function POST(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!gdriveConfigured()) return NextResponse.json({ error: 'gdrive_non_configure' }, { status: 503 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const name = String(body.name || '').trim();
  if (!/\.jar$/i.test(name)) return NextResponse.json({ error: 'Nom de mod invalide (.jar attendu).' }, { status: 400 });

  let url = String(body.url || '').trim();
  if (!url && hasToken()) {
    try { const m = await getManifest(); url = m.mods.find((x) => x.name === name)?.url || ''; } catch { /* ignore */ }
  }
  if (!/^https?:\/\/.+/i.test(url)) {
    return NextResponse.json({ error: 'Mod introuvable dans le manifest (publie-le d\'abord dans le launcher).' }, { status: 404 });
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: `Téléchargement de la release échoué (${res.status}).` }, { status: 502 });
    const data = Buffer.from(await res.arrayBuffer());
    await syncModToDrive(name, data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

/** Retire un mod (toutes versions) du dossier Drive. */
export async function DELETE(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!gdriveConfigured()) return NextResponse.json({ error: 'gdrive_non_configure' }, { status: 503 });
  const name = new URL(req.url).searchParams.get('name') || '';
  if (!/\.jar$/i.test(name)) return NextResponse.json({ error: 'nom_invalide' }, { status: 400 });
  try {
    const r = await deleteFromDrive(name);
    return NextResponse.json({ ok: true, removed: r.removed });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
