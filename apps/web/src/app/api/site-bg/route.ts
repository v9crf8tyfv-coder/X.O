import { NextResponse } from 'next/server';
import { db, hasDatabase } from '@xo/db';
import { requireLevel, RESP_LEVEL } from '@/lib/guard';

export const runtime = 'nodejs';

/**
 * Image d'arrière-plan de l'accueil du site — UPLOADÉE (pas un lien).
 * Stockée en base (app_config, base64) et partagée avec le site (api/status.js, même base).
 *  - GET  : { hasImage, ver } (staff+).
 *  - POST : { data (base64 sans préfixe), mime } → enregistre (Responsables et +).
 *           data vide → retire l'image.
 */

const MAX_BYTES = 3 * 1024 * 1024; // 3 Mo (limite Vercel ~4.5 Mo une fois en base64)
const OK_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

async function ensure(): Promise<void> {
  await db()`create table if not exists app_config (k text primary key, v text)`.catch(() => {});
}

export async function GET() {
  const g = await requireLevel(RESP_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!hasDatabase()) return NextResponse.json({ hasImage: false, ver: 0 });
  const r = await db()<{ v: string }[]>`select v from app_config where k = 'site_bg_ver' limit 1`.catch(() => []);
  const ver = r[0]?.v ? Number(r[0].v) : 0;
  return NextResponse.json({ hasImage: ver > 0, ver });
}

export async function POST(req: Request) {
  const g = await requireLevel(RESP_LEVEL);
  if (g instanceof NextResponse) return g;
  if (!hasDatabase()) return NextResponse.json({ error: 'no database' }, { status: 500 });

  let body: { data?: string; mime?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }

  await ensure();

  // Retrait de l'image.
  const data = (body.data ?? '').trim();
  if (!data) {
    await db()`delete from app_config where k in ('site_bg', 'site_bg_type', 'site_bg_ver')`;
    return NextResponse.json({ ok: true, hasImage: false, ver: 0 });
  }

  const mime = (body.mime ?? '').toLowerCase();
  if (!OK_MIME.has(mime)) {
    return NextResponse.json({ error: 'Format non supporté (JPG, PNG, WebP ou GIF).' }, { status: 400 });
  }
  // Taille approximative depuis le base64.
  const approxBytes = Math.floor((data.length * 3) / 4);
  if (approxBytes > MAX_BYTES) {
    return NextResponse.json({ error: 'Image trop lourde (max 3 Mo).' }, { status: 400 });
  }

  const ver = Date.now();
  await db()`insert into app_config (k, v) values ('site_bg', ${data})
    on conflict (k) do update set v = ${data}`;
  await db()`insert into app_config (k, v) values ('site_bg_type', ${mime})
    on conflict (k) do update set v = ${mime}`;
  await db()`insert into app_config (k, v) values ('site_bg_ver', ${String(ver)})
    on conflict (k) do update set v = ${String(ver)}`;
  return NextResponse.json({ ok: true, hasImage: true, ver });
}
