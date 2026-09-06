import { NextResponse } from 'next/server';
import { db, hasDatabase } from '@xo/db';
import { requireLevel, RESP_LEVEL } from '@/lib/guard';

export const runtime = 'nodejs';

/**
 * Image d'arrière-plan de la page d'accueil du site.
 * Stockée dans app_config (clé 'site_bg'). Lue par le site (api/status.js, même base).
 *  - GET  : renvoie l'URL actuelle (accessible à tout staff connecté).
 *  - POST : change l'URL (Responsables et +). Vide/null = enlève l'image.
 */

async function current(): Promise<string> {
  if (!hasDatabase()) return '';
  const r = await db()<{ v: string }[]>`select v from app_config where k = 'site_bg' limit 1`.catch(() => []);
  return r[0]?.v ?? '';
}

export async function GET() {
  const g = await requireLevel(RESP_LEVEL);
  if (g instanceof NextResponse) return g;
  return NextResponse.json({ url: await current() });
}

export async function POST(req: Request) {
  const g = await requireLevel(RESP_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!hasDatabase()) return NextResponse.json({ error: 'no database' }, { status: 500 });

  let body: { url?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const url = (body.url ?? '').trim().slice(0, 1000);

  // Autorise seulement une URL http(s) (ou vide pour retirer l'image).
  if (url && !/^https:\/\/.+/i.test(url)) {
    return NextResponse.json({ error: 'URL invalide (doit commencer par https://).' }, { status: 400 });
  }

  await db()`create table if not exists app_config (k text primary key, v text)`.catch(() => {});
  await db()`
    insert into app_config (k, v) values ('site_bg', ${url})
    on conflict (k) do update set v = ${url}
  `;
  return NextResponse.json({ ok: true, url });
}
