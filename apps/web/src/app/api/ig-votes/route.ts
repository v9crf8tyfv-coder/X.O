import { NextResponse } from 'next/server';
import { db, hasDatabase } from '@xo/db';

export const runtime = 'nodejs';

/**
 * Votes récents pour le mod EmeriaCore (système de vote obligatoire toutes les 48 h).
 * GET ?since=<epoch ms> -> [{ pseudo, ts }] : dernier vote de chaque pseudo depuis `since`.
 * Auth : header x-ig-secret == env IG_ACTION_SECRET.
 */
function auth(req: Request): boolean {
  const secret = req.headers.get('x-ig-secret');
  return !!process.env.IG_ACTION_SECRET && secret === process.env.IG_ACTION_SECRET;
}

export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json([]);
  const since = Number(new URL(req.url).searchParams.get('since') ?? '0') || 0;
  const rows = await db()<{ pseudo: string; ts: string }[]>`
    select pseudo, (extract(epoch from max(voted_at)) * 1000)::bigint::text as ts
    from site_votes
    where voted_at > to_timestamp(${since} / 1000.0)
    group by pseudo
    order by ts asc
    limit 1000
  `.catch(() => [] as never[]);
  return NextResponse.json(rows.map((r) => ({ pseudo: r.pseudo, ts: Number(r.ts) })));
}
