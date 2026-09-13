import { NextResponse } from 'next/server';
import { db } from '@xo/db';

export const runtime = 'nodejs';

/**
 * Registre des items + enchantements du serveur (publié par le mod EmeriaCore).
 * Sert à peupler l'auto-complétion du créateur d'items custom (modés/futurs inclus).
 */
async function ensure(): Promise<void> {
  await db()`create table if not exists registry_cache (k text primary key, v jsonb, updated_at timestamptz default now())`.catch(() => {});
}

function cleanIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out = v
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(s));
  return [...new Set(out)].slice(0, 5000);
}

// Publié par le mod (aucune auth : données non sensibles, juste des identifiants).
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const items = cleanIds(b.items);
  const enchants = cleanIds(b.enchants);
  if (!items.length && !enchants.length) {
    return NextResponse.json({ error: 'items/enchants manquants' }, { status: 400 });
  }
  await ensure();
  if (items.length)
    await db()`insert into registry_cache (k, v, updated_at) values ('items', ${JSON.stringify(items)}::jsonb, now())
               on conflict (k) do update set v = ${JSON.stringify(items)}::jsonb, updated_at = now()`;
  if (enchants.length)
    await db()`insert into registry_cache (k, v, updated_at) values ('enchants', ${JSON.stringify(enchants)}::jsonb, now())
               on conflict (k) do update set v = ${JSON.stringify(enchants)}::jsonb, updated_at = now()`;
  return NextResponse.json({ ok: true, items: items.length, enchants: enchants.length });
}

// Tableau quel que soit le stockage (tableau jsonb, ou chaîne JSON double-encodée).
function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : []; }
    catch { return []; }
  }
  return [];
}

// Lu par l'UI du panel pour l'auto-complétion.
export async function GET() {
  await ensure();
  const rows = await db()<{ k: string; v: unknown }[]>`select k, v from registry_cache where k in ('items','enchants')`;
  const items = asArray(rows.find((r) => r.k === 'items')?.v);
  const enchants = asArray(rows.find((r) => r.k === 'enchants')?.v);
  const res = NextResponse.json({ items, enchants });
  res.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  return res;
}
