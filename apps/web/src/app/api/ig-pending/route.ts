import { NextResponse } from 'next/server';
import { db, hasDatabase } from '@xo/db';

export const runtime = 'nodejs';

/**
 * Pont panel → serveur pour les suppressions de sanctions décidées par les fonda.
 *  - GET  : le mod EmeriaCore récupère les ordres en attente (à appliquer dans ModStore).
 *  - POST : le mod confirme les ordres traités ({ ids: [...] }) → marqués processed.
 * Auth : header x-ig-secret == env IG_ACTION_SECRET (le même que /api/ig-action).
 */

function auth(req: Request): boolean {
  const secret = req.headers.get('x-ig-secret');
  return !!process.env.IG_ACTION_SECRET && secret === process.env.IG_ACTION_SECRET;
}

async function ensureTable(): Promise<void> {
  await db()`
    create table if not exists ig_delete_orders (
      id bigserial primary key,
      pseudo text not null,
      mode text not null,
      ts bigint,
      processed boolean not null default false,
      created_at timestamptz not null default now()
    )
  `;
}

export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json([], { status: 200 });
  await ensureTable();
  const rows = await db()<{ id: string; pseudo: string; mode: string; ts: string | null }[]>`
    select id::text as id, pseudo, mode, ts::text as ts
    from ig_delete_orders where processed = false order by id asc limit 100
  `.catch(() => [] as never[]);
  // ts en nombre (ms) pour le mod ; null si 'all'.
  return NextResponse.json(
    rows.map((r) => ({ id: Number(r.id), pseudo: r.pseudo, mode: r.mode, ts: r.ts ? Number(r.ts) : null })),
  );
}

export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ ok: true });
  let body: { ids?: number[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const ids = (body.ids ?? []).map((x) => Number(x)).filter((x) => Number.isFinite(x));
  if (ids.length) {
    await ensureTable();
    await db()`update ig_delete_orders set processed = true where id = any(${ids})`.catch(() => {});
  }
  return NextResponse.json({ ok: true, acked: ids.length });
}
