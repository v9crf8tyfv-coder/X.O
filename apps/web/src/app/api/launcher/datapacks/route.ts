import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';
import { ftpConfigured, uploadDatapack, listDatapacks, deleteDatapack } from '@/lib/omgserv';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Data packs : vont UNIQUEMENT dans le dossier datapacks du monde sur OMGServ (FTP),
 * jamais dans le launcher ni dans mods/ ni le Drive.
 *  - GET            : liste + si le FTP est configuré.
 *  - POST {url,name}: télécharge le .zip et le pousse dans datapacks/.
 *  - DELETE ?name=  : retire un data pack.
 * Réservé fonda/co-fonda.
 */
export async function GET() {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  return NextResponse.json({ configured: ftpConfigured(), datapacks: await listDatapacks() });
}

export async function POST(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!ftpConfigured()) return NextResponse.json({ error: 'ftp_non_configure' }, { status: 503 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const url = String(body.url || '').trim();
  if (!/^https?:\/\/.+/i.test(url)) return NextResponse.json({ error: 'Lien invalide (http/https).' }, { status: 400 });
  let name = String(body.name || '').trim();
  if (!name) { try { name = decodeURIComponent(new URL(url).pathname.split('/').pop() || ''); } catch { name = ''; } }
  if (!/\.zip$/i.test(name)) return NextResponse.json({ error: 'Un data pack doit être un .zip (donne un nom si l\'URL n\'en a pas).' }, { status: 400 });

  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) return NextResponse.json({ error: `Téléchargement échoué (${res.status}).` }, { status: 502 });
    const expected = Number(res.headers.get('content-length') || 0) || undefined;
    const stream = Readable.fromWeb(res.body as unknown as import('stream/web').ReadableStream);
    const up = await uploadDatapack(name, stream, expected);
    if (!up.ok) return NextResponse.json({ error: 'Vérification de taille échouée après upload.' }, { status: 502 });
    return NextResponse.json({ ok: true, name });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!ftpConfigured()) return NextResponse.json({ error: 'ftp_non_configure' }, { status: 503 });
  const name = new URL(req.url).searchParams.get('name') || '';
  if (!/\.zip$/i.test(name)) return NextResponse.json({ error: 'Nom invalide.' }, { status: 400 });
  const ok = await deleteDatapack(name);
  return NextResponse.json({ ok });
}
