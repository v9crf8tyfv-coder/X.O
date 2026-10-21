import { NextResponse } from 'next/server';
import { db, hasDatabase } from '@xo/db';

export const runtime = 'nodejs';

/**
 * Console Discord → serveur. Le bot (salon CM-IG) insère les commandes dans `ig_console`.
 *  - GET  : le mod EmeriaCore récupère les commandes en attente (à exécuter en jeu).
 *  - POST : le mod confirme les commandes traitées ({ ids: [...] }) → marquées processed.
 * Auth : header x-ig-secret == env IG_ACTION_SECRET (le même que /api/ig-action).
 */

function auth(req: Request): boolean {
  const secret = req.headers.get('x-ig-secret');
  return !!process.env.IG_ACTION_SECRET && secret === process.env.IG_ACTION_SECRET;
}

async function ensureTable(): Promise<void> {
  await db()`
    create table if not exists ig_console (
      id bigserial primary key,
      cmd text not null,
      actor text,
      do_log boolean not null default false,
      processed boolean not null default false,
      created_at timestamptz not null default now()
    )
  `;
}

export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json([], { status: 200 });
  await ensureTable();
  const rows = await db()<{ id: string; cmd: string; actor: string | null; do_log: boolean }[]>`
    select id::text as id, cmd, actor, do_log
    from ig_console where processed = false order by id asc limit 50
  `.catch(() => [] as never[]);
  return NextResponse.json(rows.map((r) => ({ id: Number(r.id), cmd: r.cmd, actor: r.actor, log: r.do_log })));
}

export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ ok: true });
  let body: { ids?: number[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }
  const ids = (body.ids ?? []).map((x) => Number(x)).filter((x) => Number.isFinite(x));
  if (ids.length) {
    await ensureTable();
    await db()`update ig_console set processed = true where id = any(${ids})`.catch(() => {});
  }
  return NextResponse.json({ ok: true, acked: ids.length });
}
